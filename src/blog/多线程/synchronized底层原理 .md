---
icon: file-lines
# 标题
title: 'synchronized底层原理 '
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-16
# 一个页面可以有多个分类
category:
  - 多线程
# 一个页面可以有多个标签
tag:
  - 偏僻
  - 多线程
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---



### 一，synchronized底层原理 

#### 1.1 应用方式

Java中每一个对象都可以作为锁，这是synchronized实现同步的基础：

- 当synchronized作用在实例方法时，监视器锁（monitor）便是对象实例（this）；
- 当synchronized作用在静态方法时，监视器锁（monitor）便是对象的Class实例，因为Class数据存在于永久代，因此静态方法锁相当于该类的一个全局锁；
- 当synchronized作用在某一个对象实例时，监视器锁（monitor）便是括号括起来的对象实例；

从语法上讲，Synchronized可以把任何一个非null对象作为"锁"，在HotSpot JVM实现中，锁有个专门的名字：对象监视器（Object Monitor）。

#### 1.2 实现原理 

​	HotSpot虚拟机的对象头，第一部分是“Mark Word”，用于存储对象自身的运行时数据， 如哈希码（HashCode）、GC分代年龄、锁状态标志、线程持有的锁、偏向线程ID、偏向时间戳等等，它是实现轻量级锁和偏向锁的关键。

无锁状态下Mark Word部分的存储结构（32位虚拟机）：

| 25bit          | 4bit           | 1bit是否启用偏向锁 | 2bit锁的标志为 |
| -------------- | -------------- | ------------------ | -------------- |
| 对象的hashCode | 对象的分代年龄 | 0                  | 01             |

##### 1.2.1 偏向锁

​	偏向锁状态下Mark Word部分的存储结构（32位虚拟机）：相比无锁的正常状态下，25bit的对象的hashCode，变成了23bit偏向线程的ID + 2bit的Epoch；

| 23bit  | 2bit  | 4bit           | 1bit是否启用偏向锁 | 2bit锁的标志为 |
| ------ | ----- | -------------- | ------------------ | -------------- |
| 线程id | Epoch | 对象的分代年龄 | 1                  | 01             |

​	偏向锁是Java 6之后加入的新锁，它是一种针对加锁操作的优化手段，经过研究发现，在大多数情况下，锁不仅不存在多线程竞争，而且总是由同一线程多次获得，因此为了减少同一线程获取锁的代价而引入偏向锁。偏向锁的核心思想是，如果一个线程获得了锁，那么锁就进入偏向模式，此时Mark Word 的结构也变为偏向锁结构，当这个线程再次请求锁时， 无需再做任何同步操作，即获取锁的过程，这样就省去了大量有关锁申请的操作，从而也就提供程序的性能。所以，对于没有锁竞争的场合，偏向锁有很好的优化效果，毕竟极有可能连续多次是同一个线程申请相同的锁。

偏向锁的撤销并不是把对象恢复到无锁可偏向状态（因为偏向锁并不存在锁释放的概念），而是在获取偏向锁的过程中，发现cas失败也就是存在线程竞争时，直接把被偏向的锁对象升级到被加了轻量级锁的状态。 

对原持有偏向锁的线程进行撤销时，原获得偏向锁的线程有两种情况： 

1. 原获得偏向锁的线程如果已经退出了同步代码块，那么这个时候会把对象头设置成无锁状态并且争抢锁的线程可以基于CAS重新偏向但前线程 

2. 如果原获得偏向锁的线程的同步代码块还没执行完，处于临界区之内，这个时候会把原获得偏向锁的线程升级为轻量级锁后继续执行同步代码块

> 开启偏向锁（默认）：-XX:+UseBiasedLocking -XX:BiasedLockingStartupDelay=0 
>
> 关闭偏向锁：-XX:-UseBiasedLocking

##### 1.2.2 轻量级锁

​	轻量级锁状态下Mark Word部分的存储结构(32位虚拟机)：相比无锁的正常状态下，25bit的对象hashCode + 4bit的分代年龄 + 1bit是否是偏向锁的变成了栈帧中的锁记录，锁记录包含两部分1,这个锁记录自己的地址 2，对象引用地址；

| 栈帧中的锁记录30bit | 2bit锁的标志为 |      |
| ------------------- | -------------- | ---- |
| 锁记录的地址        | 对象引用地址   | 00   |

轻量级锁状态下Mark Word部分中有30bit保存锁记录的地址，所以先看了解一下锁记录(lock Record)，Lock Record是线程私有的数据结构，每个线程的栈帧都会包含一个锁记录的结构。Lock Record有两个部分:

- 锁记录自身的地址，用于和synchronized锁的对象交换对象头
- synchronized锁的对象引用地址
![image.png](http://img.zouyh.top/article-img/202412281729183.png)


1，创建锁记录（Lock Record）对象，每个线程的栈帧都会包含一个锁记录的结构，内部可以存储锁定对象的 Mark Word
2，让锁记录中synchronized锁的对象引用地址指向锁对象，并尝试用cas将Object 的 Mark Word替换为锁记录自身的地址:

![image.png](http://img.zouyh.top/article-img/202412281730828.png)

3，如果cas替换成功，对象头中存储了锁记录地址和状态，表示由该线程给对象加锁，这时图示如下：
![image.png](http://img.zouyh.top/article-img/202412281735643.png)

4，如果 cas 失败，有两种情况 

- 如果是其它线程已经持有了该 Object 的轻量级锁，这时表明有竞争，进入锁膨胀过程。
- 如果是自己执行了 synchronized 锁重入，那么再添加一条 Lock Record 作为重入的计数。
![202412281735650.png](http://img.zouyh.top/article-img/202412281735650.png)

5，当退出 synchronized 代码块（解锁时）如果有取值为 null 的锁记录，表示有重入，这时重置锁记录，表示重入计数减1
![image.png](http://img.zouyh.top/article-img/202412281735643.png)

6，当再次退出 synchronized 代码块（解锁时）锁记录的值不为 null，这时使用 cas 将 Mark Word 的值恢复给对象头 
![image.png](http://img.zouyh.top/article-img/202412281735643.png)

- 成功，则解锁成功 
- 失败，说明轻量级锁进行了锁膨胀或已经升级为重量级锁，进入重量级锁解锁流程

**升级为重量锁**

​	CAS 操作无法成功，这时一种情况就是有其它线程为此对象加上了轻量级锁（有竞争），这时需要进行锁膨胀，将轻量级锁变为重量级锁。例如当 Thread-02 尝试进行轻量级加锁时，发现Thread-01已经对该对象加了轻量级锁：
![image.png](http://img.zouyh.top/article-img/202412281741853.png)


这时 Thread-02加轻量级锁失败，进入锁膨胀流程 ，Thread-02会为Object对象申请Monitor锁，让Object指向重量级锁Monitor锁，然后自己进入Monitor的EntryList BLOCKED.
![image.png](http://img.zouyh.top/article-img/202412281742918.png)

当 Thread-0 退出同步块解锁时，使用 cas 将 Mark Word 的值恢复给对象头，失败。这时会进入重量级解锁流程，即按照 Monitor 地址找到 Monitor 对象，设置 Owner 为 null，唤醒 EntryList中BLOCKED线程。

##### 1.2.3 重量级锁
重量级锁状态下Mark Word部分的存储结构（32位虚拟机）：
相比无锁的正常状态下，25bit的对象hashCode + 4bit的分代年龄 + 1bit是否是偏向锁的变成了monitor的地址：

| 30bit         | 2bit锁的标志为 |
| ------------- | -------------- |
| monitor的地址 | 10             |

​	重量级锁是通过内部对象Monitor(监视器锁)实现，Monitor被翻译为监视器或管程，每个Java对象都可以关联一个Monitor对象在Java虚拟机（HotSpot）中，Monitor是由ObjectMonitor实现的，其主要数据结构如下：

```

ObjectMonitor() {
    _header       = NULL;
    _count        = 0; // 记录个数
    _waiters      = 0,
    _recursions   = 0;
    _object       = NULL;
    _owner        = NULL; // 当前所属线程
    _WaitSet      = NULL; // 处于wait状态的线程，会被加入到_WaitSet
    _WaitSetLock  = 0 ;
    _Responsible  = NULL ;
    _succ         = NULL ;
    _cxq          = NULL ;
    FreeNext      = NULL ;
    _EntryList    = NULL ; // 处于等待锁block状态的线程，会被加入到该列表
    _SpinFreq     = 0 ;
    _SpinClock    = 0 ;
    OwnerIsThread = 0 ; 
  }
```

​	基于进入与退出Monitor对象实现方法与代码块同步，监视器锁的实现依赖底层操作系统的Mutex lock（互斥锁）实现，它是一个重量级锁性能较低, synchronized关键字被编译成字节码后会被翻译成monitorenter 和 monitorexit 两条指令分别在同步块逻辑代码的起始位置与结束位置

```java
synchronized(非null对象实例){
	// 逻辑代码
}
```

编译成字节码后

```java
monitorenter 
// 逻辑代码
monitorexit 
```

​	任何一个对象都有一个Monitor与之关联，当且一个Monitor被持有后，它将处于锁定状态。Synchronized在JVM里的实现都是基于进入和退出Monitor对象来实现方法同步和代码块同步，虽然具体实现细节不一样，但是都可以通过成对的MonitorEnter和 MonitorExit指令来实现:

- monitorenter：执行monitorenter指令时，可以尝试获取monitor的所有权，会出现如下情况：

  - 如果monitor的进入数为0，该monitor还没有线程占用，当前线程可以占用，并将进入数设置为1，当前线程即为monitor的所有者；
  - 如果monitor的进入数不为0，已经有线程占有该monitor，如果占有monitor线程是当前线程，可以重新进入，则进入monitor的进入数加1； 如果占有monitor线程不是当前线程，则该线程进入阻塞状态，直到monitor的进入数为0，再重新尝试获取monitor的所有权；
- monitorexit：执行monitorexit的线程必须是对应的monitor的所有者。指令执行时，monitor的进入数减-。

#### 1.3 锁升级

下图连接地址：https://www.processon.com/diagraming/63e9a8bc6f135835775fecb3

#### 1.4 锁优化

​	除了锁升级的优化外，自旋锁和锁消除也是非常有用的。

#####  1.4.1 自旋锁 

​	轻量级锁失败后，虚拟机为了避免线程真实地在操作系统层面挂起，还会进行一项称为自旋锁的优化手段。这是基于在大多数情 况下，线程持有锁的时间都不会太长，如果直接挂起操作系统层面的线程可能会得不偿失，毕竟操作系统实现线程之间的切换时需要 从用户态转换到核心态，这个状态之间的转换需要相对比较长的时间，时间成本相对较高，因此自旋锁会假设在不久将来，当前的线 程可以获得锁，因此虚拟机会让当前想要获取锁的线程做几个空循环(这也是称为自旋的原因)，一般不会太久，可能是50个循环或 100循环，在经过若干次循环后，如果得到锁，就顺利进入临界区。如果还不能获得锁，那就会将线程在操作系统层面挂起，这就是 自旋锁的优化方式，这种方式确实也是可以提升效率的。最后没办法也就只能升级为重量级锁了。

##### 1.4.2 锁消除 

​	消除锁是虚拟机另外一种锁的优化，这种优化更彻底，Java虚拟机在JIT编译时(可以简单理解为当某段代码即将第一次被执行时 进行编译，又称即时编译)，通过对运行上下文的扫描，去除不可能存在共享资源竞争的锁，通过这种方式消除没有必要的锁，可以节省毫无意义的请求锁时间，如下StringBuffer的append是一个同步方法，但是在add方法中的StringBuffer属于一个局部变量，并 且不会被其他线程所使用，因此StringBuffer不可能存在共享资源竞争的情景，JVM会自动将其锁消除。锁消除的依据是逃逸分析的 数据支持。 

​	锁消除，前提是java必须运行在server模式（server模式会比client模式作更多的优化），同时必须开启逃逸分析 ,`-XX:+DoEscapeAnalysis` 表示开启逃逸分析` -XX:+EliminateLocks` 表示开启锁消除从jdk 1.7开始已经默认开启逃逸分析，如需关闭，需要指定`-XX:-DoEscapeAnalysis`

**逃逸分析** 

使用逃逸分析，编译器可以对代码做如下优化： 

- 同步省略。如果一个对象被发现只能从一个线程被访问到，那么对于这个对象的操作可以不考虑同步。
- 将堆分配转化为栈分配。如果一个对象在子程序中被分配，要使指向该对象的指针永远不会逃逸，对象可能是栈分配的候选，而不是堆分 配。 
- 分离对象或标量替换。有的对象可能不需要作为一个连续的内存结构存在也可以被访问到，那么对象的部分（或全部）可以不存储在内存， 而是存储在CPU寄存器中。 
