---
icon: file-lines
title: ReentrantLock原理解析
author: Ms.Zyh
date: 2022-06-18
category:
  - 多线程
tag:
  - 常用
  - 多线程
sticky: false
star: true
---

### 一，ReentrantLock原理解析

​	ReentrantLock的基本实现可以概括为：先通过CAS尝试获取锁。如果此时已经有线程占据了锁，那就加入AQS队列并且被挂起。当锁被释放之后，排在CLH队列队首的线程会被唤醒，然后CAS再次尝试获取锁。在这个时候，如果：

- 非公平锁：如果同时还有另一个线程进来尝试获取，那么有可能会让这个线程抢先获取；
- 公平锁：如果同时还有另一个线程进来尝试获取，当它发现自己不是在队首的话，就会排到队尾，由队首的线程获取到锁；

#### 1.1 AQS介绍

​	AbstractQueuedSynchronizer简称AQS，是一个用于构建锁和同步容器的框架。事实上于`java.concurrent.util`包内许多类都是基于AQS构建，例如ReentrantLock，Semaphore，CountDownLatch，ReentrantReadWriteLock，FutureTask等。AQS解决了在实现同步容器时设计的大量细节问题。

​	 AQS当中的同步等待队列也称CLH队列，CLH队列是Craig、Landin、Hagersten三 发明的一种基于双向链表数据结构的队列，是FIFO先入先出线程等待队列，AQS依赖它来完成同步状态的管理，当前线程如果获取同步状态失败时，AQS则会将当前线程已经等待状态等信息构造成一个节点（Node）并将其加入到CLH同步队列，同时会阻塞当前线程，当同步状态释放时，会把首节点唤醒（公平锁），使其再次尝试获取同步状态。

![image-20230215175457598](http://img.zouyh.top/article-img/20240917135050295.png)

AbstractQueuedSynchronizer抽象类的核心成员：

```java
public abstract class AbstractQueuedSynchronizer extends AbstractOwnableSynchronizer implements Serializable {
    private transient volatile AbstractQueuedSynchronizer.Node head; // 头节点
    private transient volatile AbstractQueuedSynchronizer.Node tail; // 尾节点
    private volatile int state; // 表示资源的可用状态
    // ，，，省略
}
```

Node数据结构如下：

```java
static final class Node {
    static final Node SHARED = new Node(); // 共享
    static final Node EXCLUSIVE = null; // 独占
    static final int CANCELLED =  1; // 不需要唤醒，这个线程被抛弃了
    static final int SIGNAL = -1; // 表示可以唤醒
    static final int CONDITION = -2; // 条件等待
    static final int PROPAGATE = -3; // 下一次共享式同步状态获取将会无条件地传播下去
    volatile int waitStatus; // 等待状态 0：新结点入队时的默认状态，上面定义的 
    volatile Node prev; // 前驱节点
    volatile Node next; // 后继节点
    volatile Thread thread; // 获取同步状态的线程
    Node nextWaiter;
    final boolean isShared() {
        return nextWaiter == SHARED;
    }
    final Node predecessor() throws NullPointerException {
        Node p = prev;
        if (p == null)
            throw new NullPointerException();
        else
            return p;
    }
    Node() {
    }
    Node(Thread thread, Node mode) {
        this.nextWaiter = mode;
        this.thread = thread;
    }
    Node(Thread thread, int waitStatus) {
        this.waitStatus = waitStatus;
        this.thread = thread;
    }
}
```

- Node的waitStatus状态
  - 0 ：默认正常状态，
  - CANCELLED（1）：取消状态不会参与锁的竞争
  - SIGNAL（-1）：当前节点的线程如果释放了同步状态或者被取消，有责任唤醒下一个节点；
  - CONDITION （-2）：调用await进入阻塞的状态
  - PROPAGATE（-3） ：下一次共享式同步状态获取将会无条件地传播下去。
- Node 的创建是懒惰的 
- 其中第一个 Node 称为 Dummy（哑元）或哨兵，用来占位，并不关联线程



#### 1.2 构造方法

```java
public class ReentrantLock implements Lock, java.io.Serializable {
    private final Sync sync;
    public ReentrantLock() {
        sync = new NonfairSync();
    }

    public ReentrantLock(boolean fair) {
        sync = fair ? new FairSync() : new NonfairSync();
	}
    
    static abstract class Sync extends AbstractQueuedSynchronizer{
        // ，，，省略
    }
    static final class NonfairSync extends Sync {
        // ，，，省略
    }
    static final class FairSync extends Sync {
        // ，，，省略
    }
    // ，，，省略
}
```

- ReentrantLock把所有Lock接口的操作都委派到一个Sync类上，该类继承了AbstractQueuedSynchronizer。
- Sync又有两个子类NonfairSync和FairSync，NonfairSync是非公平锁，FairSync是公平锁。
- 默认构造器初始化为NonfairSync对象，即非公平锁，而带参数的构造器可以指定使用公平锁和非公平锁。

#### 1.3 加锁lock

以非公平的锁的lock()为例:

```java
final void lock() {
    if (compareAndSetState(0, 1)) // cas尝试加锁
        setExclusiveOwnerThread(Thread.currentThread());// 加锁成功，设置当前线程为该锁的独占线程
    else
        acquire(1);
}
```

​	首先用一个CAS操作，判断state（state是AbstractQueuedSynchronizer中volatile修饰的）是否是0（表示当前锁未被占用），如果是0则把它置为1，并且设置当前线程为该锁的独占线程，表示获取锁成功。当多个线程同时尝试占用同一个锁时，CAS操作只能保证一个线程操作成功，剩下的只能乖乖的去排队啦。

​	 “非公平”即体现在这里，如果占用锁的线程刚释放锁，state置为0，而排队等待锁的线程还未唤醒时，新来的线程就直接抢占了该锁，那么就“插队”了。

​	若当前有三个线程去竞争锁，假设线程A的CAS操作成功了，拿到了锁开开心心的返回了，那么线程B和C则设置state失败，走到了else里面。我们往下看acquire方法，他的操纵可以分为三步。

```java
public final void acquire(int arg) {
    // 第①步：tryAcquire尝试去获取锁
    // 第②步：addWaiter入队
    // 第③步：acquireQueued 挂起
    if (!tryAcquire(arg) &&
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
        selfInterrupt();// selfInterrupt 重置打断标记
}
```

第①步：`tryAcquire(arg)`尝试去获取锁。如果尝试获取锁成功，方法直接返回。

NonfairSync中尝试获取锁：

```java
protected final boolean tryAcquire(int acquires) {
    return nonfairTryAcquire(acquires);
}
```

继续跟进`nonfairTryAcquire(acquires);`方法：

```java
final boolean nonfairTryAcquire(int acquires) {
    final Thread current = Thread.currentThread();// 获取当前线程
    int c = getState();// 获取state变量值
    if (c == 0) { // 没有线程占用锁
        if (compareAndSetState(0, acquires)) {
            setExclusiveOwnerThread(current); // 占用锁成功,设置独占线程为当前线程
            return true;
        }
    } else if (current == getExclusiveOwnerThread()) { // 判断是否是当前线程已经占用该锁
        int nextc = c + acquires;
        if (nextc < 0) // overflow
            throw new Error("Maximum lock count exceeded");
        setState(nextc);// 更新state值为新的重入次数
        return true;
    }
    return false;// 获取锁失败
}
```

​	非公平锁tryAcquire的流程是：检查state字段，若为0，表示锁未被占用，那么尝试占用，若不为0，检查当前锁是否被自己占用，若被自己占用，则更新state字段，表示重入锁的次数。如果以上两点都没有成功，则获取锁失败，返回false。

第②步：`addWaiter(Node.EXCLUSIVE)`入队，由于上文中提到线程A已经占用了锁，所以B和C执行tryAcquire失败，并且入等待队列。如果线程A拿着锁死死不放，那么B和C就会被挂起。

```java
private Node addWaiter(Node mode) {
        Node node = new Node(Thread.currentThread(), mode); //根据给定的模式（独占或者共享）新建Node
        Node pred = tail;// 获取尾节点引用
        if (pred != null) {// 尾节点不为空,说明队列已经初始化过
            node.prev = pred;// 新节点的前驱节点指向当前最后的节点
            if (compareAndSetTail(pred, node)) { // 通过CAS更新尾节点为新节点
                pred.next = node;
                return node;
            }
        }
        enq(node); // 尾节点为空,说明队列还未初始化,需要初始化head节点并入队新节点
        return node;
    }
```

跟进`enq(node);`方法，查看如何初始化的，假设B、C线程同时尝试入队列，由于队列尚未初始化，tail==null，故至少会有一个线程会走到enq(node)，我们假设同时走到了enq(node)里。

```java
private Node enq(final Node node) {
    for (;;) {// 开始自旋
        Node t = tail;
        if (t == null) {  // 如果tail为空,则新建一个head节点,并且tail指向head
            if (compareAndSetHead(new Node()))
                tail = head;
        } else {
           	node.prev = t;// 新节点的前驱节点指向当前最后的节点
            if (compareAndSetTail(t, node)) {// tail不为空,将新节点入队
                t.next = node;
                return t;
            }
        }
    }
}
```

​	这里体现了经典的自旋+CAS组合来实现非阻塞的原子操作。由于compareAndSetHead的实现使用了unsafe类提供的CAS操作，所以只有一个线程会创建head节点成功。假设线程B成功，之后B、C开始第二轮循环，此时tail已经不为空，两个线程都走到else里面。假设B线程compareAndSetTail成功，那么B就可以返回了，C由于compareAndSetTail失败，还需要第三轮循环，最终所有线程也可以成功入队。当B、C入等待队列后，此时AQS队列如下：

<img src="http://img.zouyh.top/article-img/20240917135049293.png" alt="image-20230216175126291" style="zoom:80%;" />

 第③步：`acquireQueued(addWaiter(Node.EXCLUSIVE), arg))`挂起。B和C相继执行挂起操作，这个方法让已经入队的线程尝试获取锁，若失败则会被挂起。

```java
final boolean acquireQueued(final Node node, int arg) {
    boolean failed = true; //标记是否成功获取锁
    try {
        boolean interrupted = false; //标记线程是否被中断过
        for (;;) {  
            final Node p = node.predecessor(); // 当前节点获取前驱节点，
            if (p == head && tryAcquire(arg)) {// 如果前驱是head,即该结点已成老二，那么便有资格去尝试获取锁
                setHead(node); // 获取成功,将当前节点替换换来head节点
                p.next = null; // 原head节点出队,在某个时间点被GC回收
                failed = false; // 获取成功
                return interrupted; // 返回是否被中断过
            }
            // 判断获取失败后是否可以挂起,若可以则挂起
            if (shouldParkAfterFailedAcquire(p, node) &&
                    parkAndCheckInterrupt())
                // 线程若被中断,设置interrupted为true
                interrupted = true;
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}
```

​	这个acquireQueued方法中的`shouldParkAfterFailedAcquire(p, node)`返回false的时候，结合` for (;;) {`自旋操作，可能执行多次，至于为什么会执行多次，下面先看`shouldParkAfterFailedAcquire(p, node)`方法后，再说结论。

​	假设B和C在竞争锁的过程中A一直持有锁，那么它们的tryAcquire操作都会失败，因此会走到第2个if语句中。我们再看下shouldParkAfterFailedAcquire和parkAndCheckInterrupt都做了哪些事吧。

```java
private static boolean shouldParkAfterFailedAcquire(Node pred, Node node) {
    // waitStatus = Node.SIGNAL = -1 表示可以唤醒
    // waitStatus = 0  初始化
    // waitStatus =  Node.CANCELLED = 1  不需要唤醒，这个线程被抛弃了
    // waitStatus =  Node.CONFITION = -2  条件等待
    // waitStatus =  Node.PROPAGATE = -3 传播
    int ws = pred.waitStatus; // 前驱节点的状态
    if (ws == Node.SIGNAL) // 前驱节点状态为signal,返回true  
        return true;
    if (ws > 0) {// 前驱节点状态为cancelled
        do {
            node.prev = pred = pred.prev;// 从队尾向前寻找第一个状态不为CANCELLED的节点
        } while (pred.waitStatus > 0);
        pred.next = node;
    } else {
        compareAndSetWaitStatus(pred, ws, Node.SIGNAL);// 将前驱节点的状态设置为SIGNAL
    }
    return false;
}
```

`shouldParkAfterFailedAcquire(p, node)`方法结合` for (;;) {`自旋操作，执行次数解析：

- 执行1次，当节点的前驱节点是waitStatus = -1，表示告诉自己的前驱节点，自己是需要被唤醒的。
- 执行2次，当节点的前驱节点是waitStatus ！= 1，第一次将前驱节点状态waitStatus 改为 -1，然后返回false的，第二次判断自己的前驱节点状态waitStatus是-1。
- 执行3次，当节点的前驱节点是waitStatus = 1，第一次从队尾向前寻找第一个状态waitStatus 不为1的节点作为当节点的前驱节，然后返回false的，第二次将前驱节点状态waitStatus 改为 -1，然后返回false的，第三次判断自己的前驱节点状态waitStatus是-1。



​	线程入队后能够挂起的前提是，它的前驱节点的状态为SIGNAL，它的含义是“Hi，前面的兄弟，如果你获取锁并且出队后，记得把我唤醒！”。所以shouldParkAfterFailedAcquire会先判断当前节点的前驱是否状态符合要求，若符合则返回true，然后调用parkAndCheckInterrupt，将自己挂起。如果不符合，再看前驱节点是否>0(CANCELLED)，若是那么向前遍历直到找到第一个符合要求的前驱并将前驱节点的状态设置为SIGNAL。

```java
private final boolean parkAndCheckInterrupt() {
    LockSupport.park(this); // 挂起当前线程
    return Thread.interrupted(); // 返回线程中断状态并重置
}
```

​	整个流程中，如果前驱结点的状态不是SIGNAL，那么自己就不能安心挂起，需要去找个安心的挂起点，同时可以再尝试下看有没有机会去尝试竞争锁。最终队列可能会如下图所示：

<img src="http://img.zouyh.top/article-img/20240917135049294.png" alt="image-20230217094448356" style="zoom:80%;" />

#### 1.4 解锁unlock

同样以非公平的锁的unlock()为例:

```java
public void unlock() {
    sync.release(1);
}
```

继续跟进`sync.release(1);`方法：

```java
public final boolean release(int arg) {
    if (tryRelease(arg)) {// 第①步：通过tryRelease尝试释放锁
        Node h = head;
        if (h != null && h.waitStatus != 0)
            unparkSuccessor(h); // 第②步：通过unparkSuccessor唤起头结点的下一个节点关联
        return true;
    }
    
    return false;
}
```

​	如果理解了加锁的过程，那么解锁看起来就容易多了。流程大致为先尝试释放锁，若释放成功，那么查看头结点的状态是否为SIGNAL，如果是则唤醒头结点的下个节点关联的线程，如果释放失败那么返回false表示解锁失败。这里我们也发现了，每次都只唤起头结点的下一个节点关联的线程。

第①步：通过tryRelease尝试释放锁，查看`tryRelease(arg)`方法：

```java
protected final boolean tryRelease(int releases) {
    int c = getState() - releases;// 计算释放后state值
    // 如果不是当前线程占用锁,那么抛出异常
    if (Thread.currentThread() != getExclusiveOwnerThread())
        throw new IllegalMonitorStateException();
    boolean free = false;
    if (c == 0) { // 锁被重入次数为0,表示释放成功
        free = true;
        setExclusiveOwnerThread(null); // 清空独占线程
    }
    setState(c);// 更新state值
    return free;
}
```

​	这里入参为1。tryRelease的过程为：当前释放锁的线程若不持有锁，则抛出异常。若持有锁，计算释放后的state值是否为0，若为0表示锁已经被成功释放，并且则清空独占线程，最后更新state值，返回free。

第②步：通过unparkSuccessor唤起头结点的下一个节点关联，查看`unparkSuccessor(h)`方法：

```java
private void unparkSuccessor(Node node) {
    int ws = node.waitStatus; // head的waitStatus
    if (ws < 0) // waitStatus = -1 // 表示可以唤醒
        compareAndSetWaitStatus(node, ws, 0); // 由 -1 改为 0
    Node s = node.next; // node.next是头节点后的节点
    if (s == null || s.waitStatus > 0) { // 头节点后的节点是空或者waitStatus=1
        s = null;
        for (Node t = tail; t != null && t != node; t = t.prev) // 尾节点不是null不等于头节点，就往前找
            if (t.waitStatus <= 0) // 找到waitStatus = -1的
                s = t;
    }
    if (s != null)
        LockSupport.unpark(s.thread); // 唤醒节点
}
```

假设线程A释放锁，现在唤醒头节点后的节点线程，也就是线程B，当线程B唤醒成功，回到被挂起的地方继续执行，如下：

```java
final boolean acquireQueued(final Node node, int arg) {
    boolean failed = true; //标记是否成功获取锁
    try {
        boolean interrupted = false; //标记线程是否被中断过
        for (;;) {  
            final Node p = node.predecessor(); // 当前节点获取前驱节点，
            if (p == head && tryAcquire(arg)) {// 如果前驱是head,即该结点已成老二，那么便有资格去尝试获取锁
                setHead(node); // 获取成功,将当前节点替换换来head节点
                p.next = null; // 原head节点出队,在某个时间点被GC回收
                failed = false; // 获取成功
                return interrupted; // 返回是否被中断过
            }
            // 判断获取失败后是否可以挂起,若可以则挂起
            if (shouldParkAfterFailedAcquire(p, node) &&
                    parkAndCheckInterrupt())  
                // 线程若被中断,设置interrupted为true
                interrupted = true;
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}
```

线程B在`acquireQueued`方法中的`parkAndCheckInterrupt()`方法中被挂起，现在被唤醒了，接着执行，走自旋循环`for (;;) { `：

- 如果`tryAcquire(arg)`获取锁成功，自身节点变成头节点，原头节点出队。
- 如果`tryAcquire(arg)`获取锁失败，再非公平锁的情况下，线程D和线程B抢锁，线程D抢锁成功，线程B抢锁失败，需要执行两次`shouldParkAfterFailedAcquire()`方法，因为在唤醒当前节点的时候，在`unparkSuccessor(h)`方法中将 head的waitStatus的由-1改为0了，需要执行两次`shouldParkAfterFailedAcquire()`方法，再改回-1，才能挂起。



**小总结**：lock()和unlock的源码可以看到，它们只是分别调用了acquire(1)和release(1)方法。

下图连接：https://www.processon.com/embed/63f2d24ca600c667636a8aec

![image-20230217111525415](http://img.zouyh.top/article-img/20240917135048291.png)

#### 1.5 可重入

加锁流程跟踪：

```java
final void lock() {
    if (compareAndSetState(0, 1))
        setExclusiveOwnerThread(Thread.currentThread());
    else
        acquire(1);// 进入阻塞队列
}
```

跟进` acquire(1)`方法：

```java
public final void acquire(int arg) {
    if (!tryAcquire(arg) &&
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
        selfInterrupt();
}
```

继续跟进`tryAcquire(arg)`方法：

```java
protected final boolean tryAcquire(int acquires) {// 入队前，再次尝试获得锁
    return nonfairTryAcquire(acquires);
}
```

跟进`nonfairTryAcquire(acquires)`方法：

```java
inal boolean nonfairTryAcquire(int acquires) {
    final Thread current = Thread.currentThread();
    int c = getState();
    if (c == 0) { 
        if (compareAndSetState(0, acquires)) {
            setExclusiveOwnerThread(current);
            return true;
        }
    } else if (current == getExclusiveOwnerThread()) { // 当前线程已经占用该锁
        int nextc = c + acquires;
        if (nextc < 0) // overflow
            throw new Error("Maximum lock count exceeded");
        setState(nextc); // 更新state值为新的重入次数
        return true;
    }
    return false; 
}
```

可重入加锁的核心是当前线程已经占用该锁，state值+1表示加锁一次。

跟踪解锁流程:

```java
public void unlock() {
    sync.release(1);// 每调用一次 解锁只解锁一次
}
```

继续跟进`sync.release(1);`方法：

```java
public final boolean release(int arg) {
    if (tryRelease(arg)) {
        Node h = head;
        if (h != null && h.waitStatus != 0)
            unparkSuccessor(h);
        return true;
    }
    return false;
}
```

跟进`tryRelease(arg)`方法：

```java
protected final boolean tryRelease(int releases) {
    int c = getState() - releases;// 次数减1
    if (Thread.currentThread() != getExclusiveOwnerThread())// 不是当前线程持有锁抛出异常
        throw new IllegalMonitorStateException();
    boolean free = false;
    if (c == 0) {// 只有当state为0时，真正的释放锁
        free = true;
        setExclusiveOwnerThread(null);
    }
    setState(c);
    return free;
}
```

可重入解锁的核心是解锁线程是当前线程时，state值-1表示解锁一次。

#### 1.6 可打断和不可打断

​	线程在尝试获取锁时，如果拿不到锁时会一直在那等待，但是在等待过程中，别的线程可以打断等待的状态，ReentrantLock不可打断模式和可打断模式的区别：

- ReentrantLock不可打断模式：线程打断了等待的状态，仅仅是打断标识设置为true，但是线程需要CAS自旋获取锁，获得锁之后能够继续执行；
- ReentrantLock可打断模式：线程打断了等待的状态，通过直接抛出异常的方式结束自旋，外界通过InterruptedException的异常捕捉的处理逻辑，这个时候线程是没有获取锁的。

##### 1.6.1 不可打断

​	不可打断是通过`lock()`方法加锁的，在上面说过没有获得锁的线程执行到`parkAndCheckInterrupt()`方法后会被挂起，当有其他线程打断等待状态后，我们接着看他的执行逻辑：

```java
private final boolean parkAndCheckInterrupt() {        
     LockSupport.park(this); // 如果打断标记已经是 true, 则 park 会失效        
     return Thread.interrupted(); // interrupted 会清除打断标记，返回true     
} 
```

在parkAndCheckInterrupt()唤醒后，回到` acquireQueued() `方法中：

```java
final boolean acquireQueued(final Node node, int arg) {
    boolean failed = true; 
    try {
        boolean interrupted = false; 
        for (;;) {  
            final Node p = node.predecessor(); 
            if (p == head && tryAcquire(arg)) {
                setHead(node);
                p.next = null; 
                failed = false; 
                // 当获得锁后，返回，如果被打断interrupted将被置为true
                return interrupted; 
            }
            
            if (shouldParkAfterFailedAcquire(p, node) &&
                    parkAndCheckInterrupt()) // parkAndCheckInterrupt方法返回true，继续向下执行
                interrupted = true;// 线程若被中断,设置interrupted为true，但是没有跳出循环，当获得锁后，才能返回
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}
```

​	由上代码可以看出，不管是从阻塞队列中唤醒，还是打断唤醒，都需要通过自旋成功获取锁后，才能返回，只是打断唤醒的返回的是true，阻塞队列唤醒的是false；

```java
public final void acquire(int arg) {
    if (!tryAcquire(arg) &&
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg)) // acquireQueued方法，打断后获取锁返回的是ture，阻塞队列唤醒，返回的是false
        selfInterrupt();
}
```

`acquireQueued()`返回true表示是中断线程唤醒的，`acquireQueued() `返回false表示是从阻塞队列中唤醒的未发生打断，在流程1中`parkAndCheckInterrupt()`中使用`Thread.interrupted()`会清除打断标记，所以如果`acquireQueued() `返回true需要调用`selfInterrupt()`方法重现产生一个新的打断标记.

```java
static void selfInterrupt() {        
    Thread.currentThread().interrupt(); // 重新产生一次中断     
} 
```

##### 1.6.2 可打断

​	打断是通过`lockInterruptibly()`方法加锁的，同样的没有获得锁的线程执行到`parkAndCheckInterrupt()`方法后会被挂起，当有其他线程打断等待状态后，我们接着看他的执行逻辑：

```java
private final boolean parkAndCheckInterrupt() {        
     LockSupport.park(this); // 如果打断标记已经是 true, 则 park 会失效        
     return Thread.interrupted(); // interrupted 会清除打断标记，返回true     
} 
```

`lockInterruptibly()`方法加锁后，在`parkAndCheckInterrupt()`唤醒后，回到的是` doAcquireInterruptibly() `方法中：

```java
private void doAcquireInterruptibly(int arg)
    throws InterruptedException {
    final Node node = addWaiter(Node.EXCLUSIVE);
    boolean failed = true;
    try {
        for (;;) {
            final Node p = node.predecessor();
            if (p == head && tryAcquire(arg)) {
                setHead(node);
                p.next = null; // help GC
                failed = false;
                return;
            }
            if (shouldParkAfterFailedAcquire(p, node) &&
                parkAndCheckInterrupt())
                throw new InterruptedException();// 相比lock()方法，直接抛出异常
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}
```

不可打断是通过`lock()`方法加锁，调用的是`acquireQueued()`方法，可打断使用的是`lockInterruptibly()`方法加锁，调用的是`doAcquireInterruptibly()`方法，`doAcquireInterruptibly()`方法和`acquireQueued()`方法最大的区别是，`doAcquireInterruptibly`方法被唤醒后，直接抛出InterruptedException异常，跳出了自旋循环。

`lockInterruptibly()`方法加锁后,`doAcquireInterruptibly()`方法执行后，回到`acquireInterruptibly(int arg)`方法

```java
public final void acquireInterruptibly(int arg)
        throws InterruptedException {
    if (Thread.interrupted()) // 判断线程是否是被打断的
        throw new InterruptedException(); /// 如果被打断直接抛出异常
    if (!tryAcquire(arg))
        doAcquireInterruptibly(arg);
}
```

最后回到`lockInterruptibly()`方法：

```java
public void lockInterruptibly() throws InterruptedException { // 如果被打断直接抛出InterruptedException异常
    sync.acquireInterruptibly(1); // 加锁
}
```

小总结：可打断是使用`lockInterruptibly()`才可以，不可以打断的用`lock()`方法是。

#### 1.7 公平锁和非公平锁

排在CLH队列队首的线程会被唤醒，然后CAS再次尝试获取锁。在这个时候：

- 非公平锁：如果同时还有另一个线程进来尝试获取，那么有可能会让这个线程抢先获取；
- 公平锁：如果同时还有另一个线程进来尝试获取，当它发现自己不是在队首的话，就会排到队尾，由队首的线程获取到锁；

FairSync公平锁加锁：

```java
final void lock() {
    acquire(1);
}
public final void acquire(int arg) {
    if (!tryAcquire(arg) &&
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
        selfInterrupt();
}
protected final boolean tryAcquire(int acquires) {
    final Thread current = Thread.currentThread();
    int c = getState();
    if (c == 0) {
        if (!hasQueuedPredecessors() &&
            compareAndSetState(0, acquires)) { // hasQueuedPredecessors判断是否 无 权竞争锁
            setExclusiveOwnerThread(current);
            return true;
        }
    }
    else if (current == getExclusiveOwnerThread()) {
        int nextc = c + acquires;
        if (nextc < 0)
            throw new Error("Maximum lock count exceeded");
        setState(nextc);
        return true;
    }
    return false;
}
public final boolean hasQueuedPredecessors() {
    Node t = tail; 
    Node h = head;
    Node s;
    //  || 表示一真必真，
    //  ①，没有头节点返回真，头节点的原因是从来没有线程进入过CLH队列中
    //  ②，有头节点，h.next.thread 的线程不等于，表示当前线程没有竞争的权力
    //  返回真
    return h != t &&
        ((s = h.next) == null || s.thread != Thread.currentThread());
}
```

NonfairSync非公平锁加锁：

```java
final void lock() {
    if (compareAndSetState(0, 1)) // cas尝试加锁
        setExclusiveOwnerThread(Thread.currentThread());// 加锁成功，设置当前线程为该锁的独占线程
    else
        acquire(1);
}
```

对比可以发现NonfairSync非公平锁加锁时，可以直接进行cas尝试加锁，而FairSync公平锁加锁时需要调用`hasQueuedPredecessors()`方法判断是否无权竞争锁，有权限才能竞争锁。

#### 1.8 锁超时

​	在ReetrantLock的`tryLock(long timeout, TimeUnit unit) `提供了超时获取锁的功能。它的语义是在指定的时间内如果获取到锁就返回true，获取不到则返回false。这种机制避免了线程无限期的等待锁释放。那么超时的功能是怎么实现的呢？我们还是用非公平锁为例来一探究竟。

```java
public boolean tryLock(long timeout, TimeUnit unit)
        throws InterruptedException {
    return sync.tryAcquireNanos(1, unit.toNanos(timeout));
}
```

还是调用了内部类里面的方法。我们继续向前探究 

```java
public final boolean tryAcquireNanos(int arg, long nanosTimeout)
        throws InterruptedException {
    if (Thread.interrupted())
        throw new InterruptedException();
    return tryAcquire(arg) ||
        doAcquireNanos(arg, nanosTimeout);
}
```

​	这里的语义是：如果线程被中断了，那么直接抛出InterruptedException。如果未中断，先尝试获取锁，获取成功就直接返回，获取失败则进入doAcquireNanos方法，tryAcquire我们已经看过，这里重点看一下doAcquireNanos方法做了什么

```java
private boolean doAcquireNanos(int arg, long nanosTimeout)
        throws InterruptedException {
    long lastTime = System.nanoTime();// 起始时间
    final Node node = addWaiter(Node.EXCLUSIVE);// 线程入队
    boolean failed = true;
    try {
        for (;;) {// 又是自旋!
            final Node p = node.predecessor();// 获取前驱节点
            if (p == head && tryAcquire(arg)) {// 如果前驱是头节点并且占用锁成功,则将当前节点变成头结点
                setHead(node);
                p.next = null; // help GC
                failed = false;
                return true;
            }
            if (nanosTimeout <= 0)// 如果已经超时,返回false
                return false;
            if (shouldParkAfterFailedAcquire(p, node) &&
                    nanosTimeout > spinForTimeoutThreshold)// 超时时间未到,且需要挂起
                LockSupport.parkNanos(this, nanosTimeout);// 阻塞当前线程直到超时时间到期
            long now = System.nanoTime();
            nanosTimeout -= now - lastTime; // 更新nanosTimeout
            lastTime = now;
            if (Thread.interrupted())
                throw new InterruptedException();// 相应中断
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}
```

​	doAcquireNanos的流程简述为：线程先入等待队列，然后开始自旋，尝试获取锁，获取成功就返回，失败则判断锁是否超时，超时直接返回false，没超时，进入阻塞队列挂起，直到超时时间到了，自行苏醒再走一遍自旋，此时要么获取锁返回ture，要么在判断锁是否超时，一定超时，返回false。

#### 1.9 多条件变量

每个条件变量其实就对应着一个等待队列

```java
public interface Condition {
	/** 基础阻塞方法 */
	void await() throws InterruptedException;
	/** 阻塞且不响应中断 */
	void awaitUninterruptibly();
	/** 等待nanosTimeout时间后 唤醒线程 */
	long awaitNanos(long nanosTimeout) throws InterruptedException;
	/** 等效于awaitNanos(unit.toNanos(time) */
	boolean await(long time, TimeUnit unit) throws InterruptedException;
	/** 时间超过deadline时 唤醒线程 */
	boolean awaitUntil(Date deadline) throws InterruptedException;
	/** 唤醒一个等待队列上的线程 */
	void signal();
	/** 唤醒全部等待队列上的线程 */
	void signalAll();
}

```

Condition实现类ConditionObject在AbstractQueuedSynchronizer中，源码如下

```java
public class ConditionObject implements Condition, java.io.Serializable {
    private transient Node firstWaiter; 
    private transient Node lastWaiter;
    // ，，，，省略
}
```

等待队列是一个FIFO队列，等待队列中的每个Node节点都保存线程及相关信息，采取链式存储：

<img src="http://img.zouyh.top/article-img/20240917135050296.png" alt="image-20230220112447627" style="zoom:80%;" />



##### 1.9.1 同步队列与等待队列

​	当有线程尝试获取资源时，线程会被封装在Node节点中并加入同步队列，同步队列的首个节点是成功获取资源的节点，其余节点均进入阻塞状态，等待尝试获取资源，同步队列中阻塞的线程都是要等待尝试获取资源的。

​	当同步队列中的线程调用了ConditionObject提供的等待方法后，线程会释放当前资源，并将封装了当前线程的节点加入等待队列。在等待队列中的线程均为阻塞状态且不会尝试获取资源，等待其他线程通知后重新加入同步队列尝试获取资源。

<img src="http://img.zouyh.top/article-img/20240917135049292.png" alt="image-20230220112417962" style="zoom:80%;" />

##### 1.9.2 await流程

​	调用ConditionObject提供的await()方法，同步队列的首节点会首先释放资源，然后唤醒同步队列中的后继节点，随后将当前线程加入到等待队列中并阻塞：

```java
public final void await() throws InterruptedException {
    if (Thread.interrupted()) // await()方法是响应中断请求的
        throw new InterruptedException();
    Node node = addConditionWaiter(); // 第①步：新的封装了当前线程的节点到等待队列
    int savedState = fullyRelease(node); // 第②步：线程释放当前资源并返回资源状态 saveState即为释放掉的资源量
    int interruptMode = 0;
    while (!isOnSyncQueue(node)) { // 第③步：检查节点是否在同步队列中 signal()后会将节点重新加回同步队列
        LockSupport.park(this); // 如果不在同步队列中则会阻塞当前线程 等待unpark()唤醒
        if ((interruptMode = checkInterruptWhileWaiting(node)) != 0)
            break;
    }
    if (acquireQueued(node, savedState) && interruptMode != THROW_IE) // 被唤醒后 调用acquireQueued方法 线程尝试获取savedState个资源
        interruptMode = REINTERRUPT;
    if (node.nextWaiter != null)
        unlinkCancelledWaiters(); // 清除等待状态为CANCELLED的节点
    if (interruptMode != 0) // 根据interruptMode值来判断如何处理中断请求
        reportInterruptAfterWait(interruptMode);
}

```

第①步：跟进`addConditionWaiter()`方法查看，如何将当前线程的节点到等待队列：

```java
private Node addConditionWaiter() {
	Node t = lastWaiter;
	if (t != null && t.waitStatus != Node.CONDITION) { // 此处判断如果尾节点的waitStatus为CANCELLED(1) 
		unlinkCancelledWaiters(); // 进入unlinkCancelledWaiters() 方法清除所有状态为CANCELLED(1) 的节点
		t = lastWaiter; // 重新赋一个尾节点
	}
	Node node = new Node(Thread.currentThread(), Node.CONDITION); // 创建一个新的Node节点waitStatus为CANCELLED(-2) 
	// 根据不同情况分别设置ConditionObject的firstWaiter、lastWaiter 和当前节点的nextWaiter 
	if (t == null)
		firstWaiter = node;
	else
		t.nextWaiter = node;
	lastWaiter = node;
	return node;
}
```

进入`unlinkCancelledWaiters() `，查看如何清除节点的waitStatus为CANCELLED(1) 的节点：

```java
private void unlinkCancelledWaiters() {
   Node t = firstWaiter; // 头节点
   Node trail = null; // 表示最后一个节点，先初始化
   while (t != null) {
	   Node next = t.nextWaiter; // 节点的下一个节点
	   if (t.waitStatus != Node.CONDITION) { // 节点的下一个节点的转台如果不是为-2
		   t.nextWaiter = null; // 断开与节点的联系
		   if (trail == null)  // 表示还不是最后一个节点
			   firstWaiter = next; // 指针向下一移动一位
		   else
			   trail.nextWaiter = next; // 已经找到节点状态为Node.CONDITION的节点了
		   if (next == null) // 表示遍历到最后节点了
			   lastWaiter = trail;
	   }
	   else
		   trail = t;
	   t = next;
   }
}
```

第②步：跟进` fullyRelease(node);`方法，查看如何释放资源并返回最后的资源状态：

```java
final int fullyRelease(Node node) {
	boolean failed = true; // 用于标记资源释放是否失败
	try {
		int savedState = getState(); // 获取并在成功释放资源后返回资源状态 失败则抛出异常
		if (release(savedState)) { // 除了获取资源外还会唤醒同步队列中最近的一个状态非CANCELLED的节点，解锁中讲过该方法
			failed = false;
			return savedState;
		} else {
			throw new IllegalMonitorStateException();
		}
	} finally {
		if (failed) // 获取失败后同步状态被设为CANCELLED 在下次清除中移除等待队列
			node.waitStatus = Node.CANCELLED;
	}
}
```

第③步：查看检查`isOnSyncQueue(node)`节点是否在同步队列中:

```java
final boolean isOnSyncQueue(Node node) {
	
	// waitStatus = -2或者 node.prev是null 说明该节点一定在等待队列
	if (node.waitStatus == Node.CONDITION || node.prev == null)
		return false;
	// waitStatus != -2 且node.prev和node.next都不null 说明该节点一定在同步队列
	if (node.next != null)
		return true;
	return findNodeFromTail(node); // 两个条件都不满足 则进入findNodeFromTail方法从同步队列尾部遍历寻找 
}

```

跟进`findNodeFromTail(node)`方法：

```java
// waitStatus != -2且node.prev != null且node.next = null才会进入该方法
private boolean findNodeFromTail(Node node) {
	Node t = tail; // tail是同步队列的尾节点
	for (;;) {
		if (t == node) // 如果tail == node，说明node是同步队列的节点
			return true;
		if (t == null) // 如果一直找不到，说明node是不是同步队列的节点
			return false;
		t = t.prev; // 找前一个节点
	}
}
```

##### 1.9.3 signal流程

​	调用ConditionObject提供的signal()方法，会唤醒在等待队列中等待时间最长的节点，即首节点，并将对应线程重新添加到同步队列中，并尝试获取资源，如果获取资源失败仍会被阻塞：

```java
public final void signal() {
	if (!isHeldExclusively()) // 检查资源持有情况
		throw new IllegalMonitorStateException();
	Node first = firstWaiter;
	if (first != null)
		doSignal(first); // 唤醒等待队列的第一个节点
}
```

跟进`doSignal(first);`方法：

```java
private void doSignal(Node first) {
	do {
		if ( (firstWaiter = first.nextWaiter) == null)
			lastWaiter = null;
		first.nextWaiter = null; // 断开与等待队列的关联
	} while (!transferForSignal(first) &&
			 (first = firstWaiter) != null); // 如果transferForSignal方法更改等待队列头节点并唤醒线程
}
```

跟进`transferForSignal(first)`方法：

```java
final boolean transferForSignal(Node node) {
    // CAS原子操作修改等待状态 只有节点被取消时会出现失败的情况 此处signal无竞争 
	if (!compareAndSetWaitStatus(node, Node.CONDITION, 0)) 
		return false;
	// 调用enq方法将节点加入同步队列队尾并返回node在同步队列的前驱节点
	Node p = enq(node);
	int ws = p.waitStatus;
	/**
	* ws > 0时 等待状态一定为CANCELLED(1) 线程不再获取资源 直接调用unpark唤醒线程
	* 否则CAS原子的将前驱节点的等待状态修改为SIGNAL(-1) 修改失败时调用unpark唤醒线程
	*/
	if (ws > 0 || !compareAndSetWaitStatus(p, ws, Node.SIGNAL))
		LockSupport.unpark(node.thread);
	return true;
}
```

