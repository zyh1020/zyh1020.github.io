---
icon: file-lines
title: Semaphore原理
author: Ms.Zyh
date: 2022-06-24
category:
  - 多线程
tag:
  - 推荐
  - 多线程
sticky: false
star: false
---



### 一，Semaphore原理

​	信号量，用来限制能同时访问共享资源的线程上限，就好像ReentrantLock只允许一个线程进去，而Semaphore最多只允许n个线程进去，常用于资源访问，服务限流(Hystrix里限流就有基于信号量方式)

#### 1.1 简单使用

```java
public class SemaphoreRunner {
    public static void main(String[] args) {
        Semaphore semaphore = new Semaphore(2);
        for (int i=0;i<5;i++){
            new Task(semaphore,"zyh"+i).start();
        }
    }
    static class Task extends Thread{
        Semaphore semaphore;
        public Task(Semaphore semaphore,String tname){
            this.semaphore = semaphore;
            this.setName(tname);
        }
        public void run() {
            try {
                semaphore.acquire();
                System.out.println(Thread.currentThread().getName()+":aquire():"+System.currentTimeMillis());
                Thread.sleep(1000);
                semaphore.release();
                System.out.println(Thread.currentThread().getName()+":release():"+System.currentTimeMillis());
            } catch (InterruptedException e) {
                e.printStackTrace();
            }

        }
    }
}
```

输出结果：

```cmd
zyh0:aquire():1677224850140
zyh1:aquire():1677224850139
zyh1:release():1677224851140
zyh3:aquire():1677224851140
zyh2:aquire():1677224851140
zyh0:release():1677224851140
zyh2:release():1677224852141
zyh4:aquire():1677224852141
zyh3:release():1677224852141
zyh4:release():1677224853141
```

从打印结果可以看出，一次只有两个线程执行 acquire()，只有线程进行 release() 方法后才会有别的线程执行 acquire()。

#### 1.2 常用方法

有两个构造方法，参数permits设置最大许可数，fair表示是否公平，和ReentrantLock一样可以创建公平与非公平获取资源方式

```java
 Semaphore(int permits) 
 Semaphore(int permits, boolean fair)         
```

获取许可，无参的是获取1，也就是AQS的state-1，也可以state-permits，计算的结果小于0则会阻塞线程

```java
acquire() 
acquire(int permits)       
```

 尝试获得许可，会直接返回获取的结果，和ReentrantLock的tryAcquire一样

```java
 tryAcquire() 
 tryAcquire(int permits)      
```

会尝试一段时间，如果这段时间都没有获取会返回失败

```java
 tryAcquire(long timeout, TimeUnit unit)   
```

释放许可，释放后会唤醒其他等待线程

```java
 release() 
 release(int permits)
```

​	还有一些其他的次要的方法比如`acquireUninterruptibly(int permits)`在获取许可的时候不响应线程的中断信号，比较类似或简单这里就不再赘述了。

#### 1.3 原理解析

​	Semaphore 有点像一个停车场，permits 就好像停车位数量，当线程获得了 permits 就像是获得了停车位，然后 停车场显示空余车位减一。假设：刚开始，permits（state）为 3，这时 5 个线程来获取资源

<img src="http://img.zouyh.top/article-img/20240917135052305.png" alt="image-20230224161852993" style="zoom:80%;" />

假设：其中 Thread-01，Thread-02，Thread-04 cas 竞争成功，而 Thread-05 和 Thread-03 竞争失败，进入 AQS 队列 park 阻塞

![image-20230224162114953](http://img.zouyh.top/article-img/20240917135052303.png)

这时 Thread-04 释放了 permits， state+1,状态如下

![image-20230224162242828](http://img.zouyh.top/article-img/20240917135053306.png)

Thread-04释放了 permits同时，会唤醒Thread-05， 假设Thread-05 在自旋时竞争成功，permits 再次设置为 0，Thread-05将自己变为 head ，断开原来的 head 节点，接着unpark 唤醒 Thread-03 节点，但由于permits 是 0，因此 Thread-03 在尝试不成功后再次进入 park 状态。

<img src="http://img.zouyh.top/article-img/20240917135052304.png" alt="image-20230224162644654" style="zoom:80%;" />



##### 1.3.1 加锁

`acquire()`方法：

```java
public void acquire() throws InterruptedException {
    sync.acquireSharedInterruptibly(1);
}
```

继续跟进`acquireSharedInterruptibly(int arg)`方法：

```java
public final void acquireSharedInterruptibly(int arg)
        throws InterruptedException {
    if (Thread.interrupted())
        throw new InterruptedException(); // 可打断
    if (tryAcquireShared(arg) < 0) // 标记①，下面解析tryAcquireShared(arg)方法
        doAcquireSharedInterruptibly(arg); //标记②，下面解析doAcquireSharedInterruptibly(arg)方法
}
```

解析标记①，跟进`tryAcquireShared(arg)`方法的非公平实现

```java
protected int tryAcquireShared(int acquires) {
    return nonfairTryAcquireShared(acquires);
}
```

继续跟进`nonfairTryAcquireShared(acquires);`方法：

```java
final int nonfairTryAcquireShared(int acquires) {
    for (;;) {
        // 得到当前state的值
        int available = getState();
        // 当前state的值减一
        int remaining = available - acquires;
        // remaining < 0 时直接返回-1，加锁失败
        // remaining > 0 时进行cas操作更新state值
        if (remaining < 0 ||
            compareAndSetState(available, remaining))
            return remaining;
    }
}
```

解析标记②，跟进`doAcquireSharedInterruptibly(arg)`方法:

```java
private void doAcquireSharedInterruptibly(int arg)
    throws InterruptedException {
    final Node node = addWaiter(Node.SHARED);// 添加的是共享节点
    boolean failed = true;
    try {
        for (;;) {
            final Node p = node.predecessor();
            if (p == head) {
                int r = tryAcquireShared(arg);
                if (r >= 0) {
                    setHeadAndPropagate(node, r);// 重新设置头节点并将后面连续的共享类型的节点唤醒
                    p.next = null; 
                    failed = false;
                    return;
                }
            }
            if (shouldParkAfterFailedAcquire(p, node) &&
                parkAndCheckInterrupt())
                throw new InterruptedException();// 在parkAndCheckInterrupt方法中挂起
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}
```

跟进`setHeadAndPropagate(node, r);`方法，重新设置头节点并将后面连续的共享类型的节点唤醒

```java
private void setHeadAndPropagate(Node node, int propagate) {
    Node h = head; // 重新设置头节点
    setHead(node);
    if (propagate > 0 || h == null || h.waitStatus < 0 ||
        (h = head) == null || h.waitStatus < 0) {
        Node s = node.next;
        if (s == null || s.isShared())
            doReleaseShared(); // 唤醒下一个节点
    }
}
```

跟进`doReleaseShared()`方法，唤醒节点

```java
private void doReleaseShared() {
    for (;;) {
        Node h = head;
        if (h != null && h != tail) {
            int ws = h.waitStatus;
            if (ws == Node.SIGNAL) {
                if (!compareAndSetWaitStatus(h, Node.SIGNAL, 0))
                    continue;
                unparkSuccessor(h);// 接着唤醒下一个节点
            }
            else if (ws == 0 &&
                     !compareAndSetWaitStatus(h, 0, Node.PROPAGATE))
                continue;                
        }
        if (h == head)                  
            break;
    }
}
```

##### 1.3.2 解锁

`release()`方法：

```java
public void release() {
    sync.releaseShared(1);
}
```

继续跟进`sync.releaseShared(1);`方法：

```java
public final boolean releaseShared(int arg) {
    if (tryReleaseShared(arg)) { // tryReleaseShared更改cas的值 标记①，tryReleaseShared(arg)后面解析
        doReleaseShared(); // doReleaseShared唤醒  标记②，doReleaseShared()后面解析
        return true;
    }
    return false;
}
```

解析标记①，跟进`tryReleaseShared(arg)`方法的非公平实现：

```java
protected final boolean tryReleaseShared(int releases) {
    for (;;) {
        int current = getState();
        int next = current + releases; // 还回去
        if (next < current) // overflow
            throw new Error("Maximum permit count exceeded");
        if (compareAndSetState(current, next)) // cas
            return true;
    }
}
```

解析标记②，跟进` doReleaseShared()`方法：

```java
private void doReleaseShared() {
    for (;;) {
        Node h = head;
        if (h != null && h != tail) {
            int ws = h.waitStatus;
            if (ws == Node.SIGNAL) {
                if (!compareAndSetWaitStatus(h, Node.SIGNAL, 0))
                    continue; 
                // 唤醒下一个         
                unparkSuccessor(h);
            }
            else if (ws == 0 &&
                     !compareAndSetWaitStatus(h, 0, Node.PROPAGATE))
                continue;                // cas操作失败，自旋
        }
        if (h == head)                   
            break; // 循环的过程中头节点没有被改变，就结束自旋
    }
}
```

被唤醒的线程回到，挂起的地方，进行自旋。
