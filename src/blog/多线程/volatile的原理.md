---
icon: document
# 标题
title: 'volatile的原理'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-28
# 一个页面可以有多个分类
category:
  - 多线程
# 一个页面可以有多个标签
tag:
  - 必看
  - 多线程
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---



### 一，volatile的原理

volatile是Java虚拟机提供的轻量级的同步机制。volatile关键字有如下两个作用 

- 保证被volatile修饰的共享变量对所有线程总数可见的，也就是当一个线程修改 了一个被volatile修饰共享变量的值，新值总是可以被其他线程立即得知。 
- 禁止指令重排序优化

#### 1.1 可见性

​	关于volatile的可见性作用，我们必须意识到被volatile修饰的变量对所有线程总数立即 可见的，对volatile变量的所有写操作总是能立刻反应到其他线程中。

 示例：线程A改变initFlag属性之后，线程B马上感知到

```java
public class VolatileVisibilitySample {
    volatile boolean initFlag = false;
    public void save(){
        this.initFlag = true;
        String threadname = Thread.currentThread().getName();
        System.out.println("线程："+threadname+":修改共享变量initFlag");
    }
    public void load(){
        String threadname = Thread.currentThread().getName();
        while (!initFlag){
       	 //线程在此处空跑，等待initFlag状态改变
        }
        System.out.println("线程："+threadname+"当前线程嗅探到initFlag的状态的改变");
    }
    public static void main(String[] args){
        VolatileVisibilitySample sample = new VolatileVisibilitySample();
        Thread threadA = new Thread(()‐>{
            sample.save();
        },"threadA");
        Thread threadB = new Thread(()‐>{
            sample.load();
        },"threadB");
        threadB.start();
        try {
        	Thread.sleep(1000);
        } catch (InterruptedException e) {
       		e.printStackTrace();
        }
        threadA.start();
    }
}
```

对于一个 volatile 变量的写操作会有一行以lock作为前缀的汇编代码。这个指令在多核处理器下会引发两件事：

- 将当前处理器缓存行的数据写回到主内存
- 这个写回内存的操作会使在其它 CPU 里缓存了该内存地址的数据无效

​	在多处理器下，为了保证各个处理器的缓存是一致的，就会实现缓存一致性协议，每个处理器通过嗅探在总线上传播的数据来检查自己缓存的值是不是过期了，当处理器发现自己缓存行对应的内存地址被修改，就会将当前处理器的缓存行设置成无效状态。当处理器对这个数据进行修改操作的时候，会重新从系统内存中把数据读到处理器缓存里

#### 1.2 有序性

**volatile禁止重排优化**

​	volatile关键字另一个作用就是禁止指令重排优化，从而避免多线程环境下程序出现乱序执行的现象，关于指令重排优化前面已详细分析过，这里主要简单说明一下volatile是如何实现禁止指令重排优化的。先了解一个概念，内存屏障(Memory Barrier）。 

**硬件层的内存屏障**

Intel硬件提供了一系列的内存屏障，主要有： 

1. lfence，是一种Load Barrier 读屏障 
2. sfence, 是一种Store Barrier 写屏障 
3. mfence, 是一种全能型的屏障，具备ifence和sfence的能力 
4. Lock前缀，Lock不是一种内存屏障，但是它能完成类似内存屏障的功能。Lock会对CPU总线和高速缓存加锁，可以理解为CPU指令级的一种锁。它后面可以跟ADD, ADC, AND, BTC, BTR, BTS, CMPXCHG, CMPXCH8B, DEC, INC, NEG, NOT, OR, SBB, SUB, XOR, XADD, and XCHG等指令。

不同硬件实现内存屏障的方式不同，Java内存模型屏蔽了这种底层硬件平台的差异，由JVM来为不同的平台生成相应的机器码。 JVM中提供了四类内存屏障指令：

| 屏障类型   | 指令示例                   | 说明                                                         |
| ---------- | -------------------------- | ------------------------------------------------------------ |
| LoadLoad   | Load1; LoadLoad; Load2     | 保证load1的读取操作在load2及后续读取操作之前执行             |
| StoreStore | Store1; StoreStore; Store2 | 在store2及其后的写操作执行前，保证store1的写操作已刷新到主内存 |
| LoadStore  | Load1; LoadStore; Store2   | 在stroe2及其后的写操作执行前，保证load1的读操作已读取结束    |
| StoreLoad  | Store1; StoreLoad; Load2   | 保证store1的写操作已刷新到主内存之后，load2及其后的读操作才能执行 |

​	内存屏障，又称内存栅栏，是一个CPU指令，它的作用有两个，一是保证特定操作的执行顺序，二是保证某些变量的内存可见性（利用该特性实现volatile的内存可见性）。由于编译器和处理器都能执行指令重排优化。如果在指令间插入一条Memory Barrier则会告诉编译器和CPU，不管什么指令都不能和这条Memory Barrier指令重排序，也就是说通过插入内存屏障禁止在内存屏障前后的指令执行重排序优化。Memory Barrier的另外一个作用是强制刷出各种CPU的缓存数据，因此任何CPU上的线程都能读取到这些数据的最新版本。总之，volatile变量正是通过内存屏障实现其在内存中的语义，即可见性和禁止重排优化。下面看一个非常典型的禁止重排优化的例子DCL，如下：

```java
public class Singleton {
    private static Singleton instance;
    private Singleton(){}
    public static Singleton getInstance(){
        //第一次检测
        if (instance==null){
            //同步
            synchronized (Singleton.class){
                if (instance == null){
                    //多线程环境下可能会出现问题的地方
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

​	上述代码一个经典的单例的双重检测的代码，这段代码在单线程环境下并没有什么问题，但如果在多线程环境下就可以出现线程安全问题。问题出在 `instance = new Singleton(); `这一行，这里是创建 Singleton对象的地方，其实这里可以看成三个步骤:

```java
memory = allocate(); // 1.分配对象内存空间
instance(memory); // 2.初始化对象
instance = memory; // 3.设置instance指向刚分配的内存地址，此时instance！=null
```

​	步骤2和步骤3不存在数据依赖关系，而且无论重排前还是重排后程序的执行结果在单线程中并没有改变，因此这种重排优化是允许：

```java
memory=allocate();//1.分配对象内存空间
instance=memory;// 3.设置instance指向刚分配的内存地址，此时instance！=null，但是对象还没有初始化完成！
instance(memory);//2.初始化对象
```

​	多线程环境下就可能将一个未初始化的对象引用暴露出来，从而导致不可预料的结果。因此，为了防止这个过程的重排序，我们需要将变量设置为volatile类型的变量：

```java
public class Singleton {
    private static volatile Singleton instance; // 使用volatile
    private Singleton(){}
    public static Singleton getInstance(){
        //第一次检测
        if (instance==null){
            //同步
            synchronized (Singleton.class){
                if (instance == null){
                    //多线程环境下可能会出现问题的地方
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

JMM针对编译器制定的volatile重排序规则表：

| 第一个操作 | 第二个操作：普通读写 | 第二个操作：volatile读 | 第二个操作：volatile写 |
| ---------- | -------------------- | ---------------------- | ---------------------- |
| 普通读写   | 可以重排             | 可以重排               | 不可以重排             |
| volatile读 | 不可以重排           | 不可以重排             | 不可以重排             |
| volatile写 | 可以重排             | 不可以重排             | 不可以重排             |

从上表可以看出：

- 当第二个操作是volatile写时，不管第一个操作是什么，都不能重排序。这个规则确保volatile写之前的操作不会被编译器重排序到volatile写之后。

- 当第一个操作是volatile读时，不管第二个操作是什么，都不能重排序。这个规则确保volatile读之后的操作不会被编译器重排序到volatile读之前。
- 当第一个操作是volatile写，第二个操作是volatile读或写时，不能重排序

为了实现volatile的内存语义，编译器在生成字节码时，会在指令序列中插入内存屏障来禁止特定类型的处理器重排序。对于编译器来说，发现一个最优布置来最小化插入屏障的总数几乎不可能。为此，JMM采取保守策略。下面是基于保守策略的JMM内存屏障插入策略。

- 在每个volatile写操作的前面插入一个StoreStore屏障。
- 在每个volatile写操作的后面插入一个StoreLoad屏障。
- 在每个volatile读操作的后面插入一个LoadLoad屏障。
- 在每个volatile读操作的后面插入一个LoadStore屏障。


上述内存屏障插入策略非常保守，但它可以保证在任意处理器平台，任意的程序中都能得到正确的volatile内存语义。

下面是保守策略下，volatile写插入内存屏障后生成的指令序列示意图：

<img src="http://img.zouyh.top/article-img/20240917135048289.png" alt="image-20230214144928999" style="zoom:67%;" />

​	上图中StoreStore屏障可以保证在volatile写之前，其前面的所有普通写操作已经对任意处理器可见了。这是因为StoreStore屏障将保障上面所有的普通写在volatile写之前刷新到主内存。

​	这里比较有意思的是，volatile写后面的StoreLoad屏障。此屏障的作用是避免volatile写与 后面可能有的volatile读/写操作重排序。因为编译器常常无法准确判断在一个volatile写的后面 是否需要插入一个StoreLoad屏障（比如，一个volatile写之后方法立即return）。为了保证能正确 实现volatile的内存语义，JMM在采取了保守策略：在每个volatile写的后面，或者在每个volatile 读的前面插入一个StoreLoad屏障。从整体执行效率的角度考虑，JMM最终选择了在每个 volatile写的后面插入一个StoreLoad屏障。因为volatile写-读内存语义的常见使用模式是：一个 写线程写volatile变量，多个读线程读同一个volatile变量。当读线程的数量大大超过写线程时，选择在volatile写之后插入StoreLoad屏障将带来可观的执行效率的提升。从这里可以看到JMM 在实现上的一个特点：首先确保正确性，然后再去追求执行效率。

下图是在保守策略下，volatile读插入内存屏障后生成的指令序列示意图

<img src="http://img.zouyh.top/article-img/20240917135047287.png" alt="image-20230214145016369" style="zoom:67%;" />

上图中LoadLoad屏障用来禁止处理器把上面的volatile读与下面的普通读重排序。LoadStore屏障用来禁止处理器把上面的volatile读与下面的普通写重排序。

上述volatile写和volatile读的内存屏障插入策略非常保守。在实际执行时，只要不改变 volatile写-读的内存语义，编译器可以根据具体情况省略不必要的屏障。下面通过具体的示例：

```java
class VolatileBarrierExample {
       int a;
       volatile int v1 = 1;
       volatile int v2 = 2;
       void readAndWrite() {
           int i = v1;　　      // 第一个volatile读
           int j = v2;    　   // 第二个volatile读
           a = i + j;         // 普通写
           v1 = i + 1;     　 // 第一个volatile写
           v2 = j * 2;    　  // 第二个volatile写
       }
}
```

针对readAndWrite()方法，编译器在生成字节码时可以做如下的优化:

<img src="http://img.zouyh.top/article-img/20240917135048290.png" alt="image-20230214145413123" style="zoom: 80%;" />

​	最后的StoreLoad屏障不能省略。因为第二个volatile写之后，方法立即return。此时编 译器可能无法准确断定后面是否会有volatile读或写，为了安全起见，编译器通常会在这里插 入一个StoreLoad屏障。

​	上面的优化针对任意处理器平台，由于不同的处理器有不同“松紧度”的处理器内存模 型，内存屏障的插入还可以根据具体的处理器内存模型继续优化。以X86处理器为例，最后的StoreLoad屏障外，其他的屏障都会被省略，X86处理器仅会对写-读操作做重排序，不会对读-读、读-写和写-写操作做重排序，因此在X86处理器中会省略掉这3种操作类型对应的内存屏障。在X86中，JMM仅需在volatile写后面插入一个StoreLoad屏障即可正确实现volatile写-读的内存语义。这意味着在 X86处理器中，volatile写的开销比volatile读的开销会大很多（因为执行StoreLoad屏障开销会比较大）

<img src="http://img.zouyh.top/article-img/20240917135047288.png" alt="image-20230214150157153" style="zoom:67%;" />

#### 1.3 不保证原子性

```java
//示例
public class VolatileVisibility {
    public static volatile int i =0;
    public static void increase(){
        i++;
    }
}
```

​	在并发场景下，i变量的任何改变都会立马反应到其他线程中，但是如此存在多条线程同时调用increase()方法的话，就会出现线程安全问题，因为i++;操作并不具备原子性，该操作是可以看成如下:

```java
temp = i; //取值
i= temp + 1; //加1后赋值
```

​	如果线程B在线程A读取旧值和写回新值期间读取i的值，那么线程B就会与线程A得到的是同一个值，并执行相同值的加1操作，这也就造成了线程安全失败，因此对于increase方法必须使用synchronized修饰，以便保证线程安全，需要注意的是一旦使用synchronized修饰方法后，由于synchronized本身也具备与volatile相同的特性，即可见性，因此在这样种情况下就完全可以省去volatile修饰变量。
