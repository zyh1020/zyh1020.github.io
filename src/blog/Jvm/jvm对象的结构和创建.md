---
icon: file-lines
title: jvm对象的结构和创建
author: Ms.Zyh
date: 2023-07-16
category:
  - Jvm
tag:
  - 干货
  - Jvm
sticky: false
star: false
---

### 一，对象的结构

<img src="http://img.zouyh.top/article-img/20240917135027224.png" alt="image-20230208164713119" style="zoom: 80%;" />

  

#### 1.1 对象头

​	HotSpot虚拟机的对象头主要包括两部分信息markword和klass，如果是数组实例还会包含数组长度。

##### 1.1.2 markword

​	第一部分markword,用于存储对象自身的运行时数据，如**哈希码（HashCode）**、**GC分代年龄、锁状态标志、线程持有的锁、偏向线程ID、偏向时间戳**等，这部分数据的长度在32位和64位的虚拟机（未开启压缩指针）中分别为32bit和64bit，官方称它为“MarkWord”。

Mark Word的32bit空间里的25位用于存储对象哈希码，4bit用于存储对象分代年龄，2bit用于存储锁标志位，1bit固定为0，表示非偏向锁。其他状态如下图所示：

<img src="http://img.zouyh.top/article-img/20240917135027225.png" alt="image-20230208164949725" style="zoom: 67%;" />

对象头在hotspot的C++源码里的注释如下：

```c++
// 32 bits:
// ‐‐‐‐‐‐‐‐
// hash:25 ‐‐‐‐‐‐‐‐‐‐‐‐>| age:4 biased_lock:1 lock:2 (normal object)
// JavaThread*:23 epoch:2 age:4 biased_lock:1 lock:2 (biased object)
// size:32 ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐>| (CMS free block)
// PromotedObject*:29 ‐‐‐‐‐‐‐‐‐‐>| promo_bits:3 ‐‐‐‐‐>| (CMS promoted object)
//
// 64 bits:
// ‐‐‐‐‐‐‐‐
// unused:25 hash:31 ‐‐>| unused:1 age:4 biased_lock:1 lock:2 (normal object)
// JavaThread*:54 epoch:2 unused:1 age:4 biased_lock:1 lock:2 (biased object)
// PromotedObject*:61 ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐>| promo_bits:3 ‐‐‐‐‐>| (CMS promoted object)
// size:64 ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐>| (CMS free block)
//
// unused:25 hash:31 ‐‐>| cms_free:1 age:4 biased_lock:1 lock:2 (COOPs && normal object)
// JavaThread*:54 epoch:2 cms_free:1 age:4 biased_lock:1 lock:2 (COOPs && biased object)
// narrowOop:32 unused:24 cms_free:1 unused:4 promo_bits:3 ‐‐‐‐‐>| (COOPs && CMS promoted object)
// unused:21 size:35 ‐‐>| cms_free:1 unused:7 ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐>| (COOPs && CMS free block)
```



##### 1.1.2 klass

​	对象头的另外一部分是klass类型指针，即对象指向它的类元数据的指针，虚拟机通过这个指针来确定这个对象是哪个类的实例.

##### 1.1.3 数组长度

​	数组长度只有数组对象有，如果对象是一个数组, 那在对象头中还必须有一块数据用于记录数组长度.

#### 1.2 实例填充

​	实例数据部分是对象真正存储的有效信息，也是在程序代码中所定义的各种类型的字段内容。无论是从父类继承下来的，还是在子类中定义的，都需要记录起来。

#### 1.3 对齐填充

​	对齐填充并不是必然存在的，也没有特别的含义，它仅仅起着占位符的作用。由于HotSpot VM的自动内存管理系统要求对象起始地址必须是8字节的整数倍，换句话说，就是对象的大小必须是8字节的整数倍。而对象头部分正好是8字节的倍数（1倍或者2倍），因此，当对象实例数据部分没有对齐时，就需要通过对齐填充来补全。

### 二，对象创建时机

#### 2.1 new关键字

​	通过 new关键字创建对象是最常见的，也是最简单的创建对象的方式，通过这种方式我们可以调用任意的构造函数去创建对象：

```java
public static void main(String[] args) {
    User = new User();
}
```

#### 2.2 Class类的newInstance方法

​	通过Java的反射机制使用Class类的newInstance方法来创建对象，这个newInstance方法调用无参的构造器创建对象；

```java
public static void main(String[] args) throws Exception {
    // 方式1
    User user1 = (User)Class.forName("com.zyh.bean.User").newInstance();
    // 方式2
    User user2 = User.class.newInstance();
}
```

#### 2.3 Constructor类的newInstance方法

​	通过Java的反射机制获取构造方法类`java.lang.relect.Constructor`，然后使用Constructor类的newInstance方法来创建对象，通过Constructor的newInstance方法来创建对象比直接使用Class类的newInstance方法来创建对象更强大，我们可以不仅可以通过Constructor类调用无参构造，还可以通过Constructor类调用有参数的和私有的构造函数：

```java
public static void main(String[] args) throws Exception {
    Constructor<User> constructor = User.class.getConstructor(Integer.class);
    User user3 = constructor.newInstance(123);
}
```

#### 2.4 Object类的clone方法

​	通过实现Cloneable接口，重写Object类的clone方法来创建对象（浅拷贝），Java为所有对象提供了clone方法（Object类），又出于安全考虑，将它设置为了保护属性：

```java
protected native Object clone() throws CloneNotSupportedException;
```

Java API采用判断是否实现空接口Cloneable的方法来判断对象所属的类是否支持克隆。如果被克隆对象所属类没有实现该接口，则抛出NotDeclareCloneMethod 异常。当支持克隆时，通过重写Object类的clone方法，并把方法的修饰符改为public，就可以直接调用该类的实例对象的clone方法实现克隆：

```java
@Data
public class User implements Cloneable {
    private String id;
    private String userName;

    @Override
    public Object clone() throws CloneNotSupportedException {
        return super.clone();
    }

    public static void main(String[] args) throws CloneNotSupportedException {
        User user = new User();
        User user1 = (User)user.clone();
    }
}

```

### 三，对象创建流程

#### 3.1 类加载检查

​	当虚拟机检测到对象创建时机时，首先将去检查这个指令的参数是否能在常量池中定位到对象对应类的符号引用，并且检查这个符号引用代表的类是否已被加载、解析和初始化过，如果没有，那必须先执行相应的类加载过程。

#### 3.2 分配内存 

​	在类加载检查通过后，接下来虚拟机将为新生对象分配内存，对象所需内存的大小在类加载完成后便可完全确定，为对象分配空间的任务等同于把一块确定大小的内存从Java堆中划分出来，划分的方式有指针碰撞和空闲列表两种方式：

- 指针碰撞：如果堆内存是规整的空间，即已经分配的内存与未使用的内存都是连续的空间，此时存在着一个指针位于已用与可用内存的分界，新内存的分配即指针移动对象大小的距离即可。此方式称为指针碰撞。
- 空闲列表：如果堆空间中已分配的内存与未分配的内存相互交错，就需要使用“空闲列表”的方式进行内存分配操作。此时堆内存中维护了一份可用内存的列表，当有新内存分配的需求时，会到空闲列表中确定足够大小的内存空间予以分配操作。

存在的问题：由于堆空间是线程共享的，所以该方式存在着并发问题。

解决方式：

-  对内存分配的动作进行同步处理，虚拟机采用CAS配上失败重试的方式，保证更新操作的原子性来对分配内存空间的动作进行同步处理；

-  本地线程分配缓冲（LTAB）：将内存按照分配的动作按线程划分在不同的空间进行，即每个线程在Java堆中预先申请一块内存(LTAB)，哪个线程需要分配空间，就在哪个线程的LTAB上执行。只有当某一线程的LTAB用完了才执行同步锁定。

#### 3.3 初始化 

​	内存分配完成后，虚拟机需要将分配到的内存空间都初始化为零值（不包括对象头）， 如果使用TLAB，这一工作过程也可以提前至TLAB分配时进行。正是应为初始化操的存在，对象的成员变量不用手动初始化赋值直接使用，方法中声明的变量需要手动赋值的原因。

#### 3.4 设置对象头

​	初始化之后，虚拟机要对对象进行必要的设置，例如这个对象是哪个类的实例、如何才能找到类的元数据信息、对象的哈希码、对象的GC分代年龄等信息，这些信息存放在对象的对象头Object Header之中，在上面"对象的结构”中介绍了。

#### 3.5 执行`<init>`方法

 	执行`<init>`方法，即对象按照程序员的意愿进行初始化，对应到语言层面上讲执行构造方法为属性赋值。

> 注意：这里的赋值上面的初始化赋零值不同，

### 四，JVM对象分配策略

#### 4.1 优先分配到伊甸园eden

大多数情况下，对象在新生代中 Eden 区分配。当 Eden 区没有足够空间进行分配时，虚拟机将发起一次Minor GC。我 们来进行实际测试一下：

```java
// 添加运行JVM参数，是运行参数不要Debug启动： ‐XX:+PrintGCDetails
public class GCTest {
    public static void main(String[] args) throws InterruptedException {
        byte[] allocation1, allocation2/*, allocation3, allocation4, allocation5, allocation6*/;
        allocation1 = new byte[60000*1024];
        //allocation2 = new byte[8000*1024];
        /*allocation3 = new byte[1000*1024];
        allocation4 = new byte[1000*1024];
        allocation5 = new byte[1000*1024];
        allocation6 = new byte[1000*1024];*/
    }
}
```

运行结果：

```
Heap 
PSYoungGen total 76288K, used 65536K [0x000000076b400000, 0x0000000770900000, 0x00000007c0000000) 
    eden space 65536K, 100% used [0x000000076b400000,0x000000076f400000,0x000000076f400000) 
    from space 10752K, 0% used [0x000000076fe80000,0x000000076fe80000,0x0000000770900000) 
    to space 10752K, 0% used [0x000000076f400000,0x000000076f400000,0x000000076fe80000) 
ParOldGen total 175104K, used 0K [0x00000006c1c00000, 0x00000006cc700000, 0x000000076b400000) 
	object space 175104K, 0% used [0x00000006c1c00000,0x00000006c1c00000,0x00000006cc700000)
Metaspace used 3342K, capacity 4496K, committed 4864K, reserved 1056768K
	class space used 361K, capacity 388K, committed 512K, reserved 1048576K
```

​	我们可以看出eden区内存几乎已经被分配完全，假如我们再为 allocation2分配内存会出现什么情况呢？

```java
public class GCTest {
    public static void main(String[] args) throws InterruptedException {
        byte[] allocation1, allocation2/*, allocation3, allocation4, allocation5, allocation6*/;
        allocation1 = new byte[60000*1024];
        allocation2 = new byte[8000*1024];
        /*allocation3 = new byte[1000*1024];
        allocation4 = new byte[1000*1024];
        allocation5 = new byte[1000*1024];
        allocation6 = new byte[1000*1024];*/
    }
}
```

运行结果： 

```
[GC (Allocation Failure) [PSYoungGen: 65253K‐>936K(76288K)] 65253K‐>60944K(251392K), 0.0279083 secs] [Times: user=0.13 sys=0.02, real=0.03 secs] 
Heap 
PSYoungGen total 76288K, used 9591K [0x000000076b400000, 0x0000000774900000, 0x00000007c0000000) 
	eden space 65536K, 13% used [0x000000076b400000,0x000000076bc73ef8,0x000000076f400000) 
	from space 10752K, 8% used [0x000000076f400000,0x000000076f4ea020,0x000000076fe80000) 
	to space 10752K, 0% used [0x0000000773e80000,0x0000000773e80000,0x0000000774900000) 
ParOldGen total 175104K, used 60008K [0x00000006c1c00000, 0x00000006cc700000, 0x000000076b400000) 
	object space 175104K, 34% used [0x00000006c1c00000,0x00000006c569a010,0x00000006cc700000)
Metaspace used 3342K, capacity 4496K, committed 4864K, reserved 1056768K 
	class space used 361K, capacity 388K, committed 512K, reserved 1048576K
```

​	分析为什么会出现这种情况： 因为给allocation2分配内存的时候eden区内存几乎已经被分配完了，我们刚刚讲了当Eden区没有足够空间进行分配时，虚拟机将发起一次Minor GC，GC期间虚拟机又发现allocation1无法存入Survior空间，所以只好把新生代的对象提前转移到老年代中去，老年代上的空间足够存放allocation1，所以不会出现Full GC。执行Minor GC后，后面分配的对象如果能够存在eden区的话，还是会在eden区分配内存，如上eden区使用13%还剩大约4M,可以执行如下代码验证：

```java
public class GCTest {
    public static void main(String[] args) throws InterruptedException {
        byte[] allocation1, allocation2, allocation3, allocation4, allocation5, allocation6;
        allocation1 = new byte[60000*1024];
        allocation2 = new byte[8000*1024];
        allocation3 = new byte[1000*1024];
        allocation4 = new byte[1000*1024];
        allocation5 = new byte[1000*1024];
        allocation6 = new byte[1000*1024];
    }
}
```

运行结果： 

```
[GC (Allocation Failure) [PSYoungGen: 65253K‐>952K(76288K)] 65253K‐>60960K(251392K), 0.0311467 secs] [Times: user=0.08 sys=0.02, real=0.03 secs] 
Heap 
PSYoungGen total 76288K, used 13878K [0x000000076b400000, 0x0000000774900000, 0x00000007c0000000) 
	eden space 65536K, 19% used [0x000000076b400000,0x000000076c09fb68,0x000000076f400000) 
	from space 10752K, 8% used [0x000000076f400000,0x000000076f4ee030,0x000000076fe80000) 
	to space 10752K, 0% used [0x0000000773e80000,0x0000000773e80000,0x0000000774900000) 
ParOldGen total 175104K, used 60008K [0x00000006c1c00000, 0x00000006cc700000, 0x000000076b400000) 
	object space 175104K, 34% used [0x00000006c1c00000,0x00000006c569a010,0x00000006cc700000) 
Metaspace used 3343K, capacity 4496K, committed 4864K, reserved 1056768K 
	class space used 361K, capacity 388K, committed 512K, reserved 1048576K

```

​	eden的使用率增加了6%，所以说优先分配到伊甸园eden

#### 4.2 大的对象直接分配到老年代

​	大对象就是需要大量连续内存空间的对象（比如：字符串、数组）。JVM参数` -XX:PretenureSizeThreshold `可以设置大对象的大小，如果对象超过设置大小会直接进入老年代，不会进入年轻代，这个参数只在 Serial 和ParNew两个收集器下有效。

比如执行下面程序会发现大对象直接进了老年代:

```java
// 添加运行JVM参数： -XX:PretenureSizeThreshold=1000000 -XX:+UseSerialGC ‐XX:+PrintGCDetails
// -XX:+UseSerialGC 表示使用Serial垃圾收集器
// -XX:PretenureSizeThreshold=1000000 表示大对象时1000000字节，单位时字节
// ‐XX:+PrintGCDetails 表示打印gc日志
public class GCTest {
    public static void main(String[] args) throws InterruptedException {
        byte[] allocation1 = new byte[60000*1024];
    }
}
```

运行结果：

```
Heap
 def new generation   total 39296K, used 5613K [0x0000000081c00000, 0x00000000846a0000, 0x00000000abd50000)
  eden space 34944K,  16% used [0x0000000081c00000, 0x000000008217b418, 0x0000000083e20000)
  from space 4352K,   0% used [0x0000000083e20000, 0x0000000083e20000, 0x0000000084260000)
  to   space 4352K,   0% used [0x0000000084260000, 0x0000000084260000, 0x00000000846a0000)
 tenured generation   total 87424K, used 60000K [0x00000000abd50000, 0x00000000b12b0000, 0x0000000100000000)
   the space 87424K,  68% used [0x00000000abd50000, 0x00000000af7e8010, 0x00000000af7e8200, 0x00000000b12b0000)
 Metaspace       used 3750K, capacity 4596K, committed 4864K, reserved 1056768K
  class space    used 412K, capacity 432K, committed 512K, reserved 1048576K
```

分析发现老年代的内存占了68%，一共87424K，大概就是我程序分配的60000K，符合结论。

为什么要大的对象直接分配到老年代，是为了避免为大对象分配内存时的复制操作而降低效率。

#### 4.3 长期存活的对象分配到老年代

​	既然虚拟机采用了分代收集的思想来管理内存，那么内存回收时就必须能识别哪些对象应放在新生代，哪些对象应放在 老年代中。为了做到这一点，虚拟机给每个对象一个对象年龄（Age）计数器。 如果对象在 Eden 出生并经过第一次 Minor GC 后仍然能够存活，并且能被 Survivor 容纳的话，将被移动到 Survivor 空间中，并将对象年龄设为1。对象在 Survivor 中每熬过一次 MinorGC，年龄就增加1岁，当它的年龄增加到一定程度 （默认为15岁，CMS收集器默认6岁，不同的垃圾收集器会略微有点不同），就会被晋升到老年代中。对象晋升到老年代 的年龄阈值，可以通过参数` -XX:MaxTenuringThreshold` 来设置

#### 4.4 动态对象的年龄判断

​	当前放对象的Survivor区域里(其中一块区域，放对象的那块s区)，一批对象的总大小大于这块Survivor区域内存大小的 50%(-XX:TargetSurvivorRatio可以指定)，那么此时大于等于这批对象年龄最大值的对象，就可以直接进入老年代了， 例如Survivor区域里现在有一批对象，年龄1+年龄2+年龄n的多个年龄对象总和超过了Survivor区域的50%，此时就会 把年龄n(含)以上的对象都放入老年代。这个规则其实是希望那些可能是长期存活的对象，尽早进入老年代。对象动态年 龄判断机制一般是在minor gc之后触发的。

#### 4.5 空间担保

新生代Minor GC后剩余存活对象太多，无法放入Survivor区中，此时由老年代做内存担保，将这些存活对象直接转移到老年代去。

1. 执行任何一次Minor GC之前，JVM会先检查一下老年代可用内存空间，是否大于新生代所有对象的总大小，因为在极端情况下，可能新生代Minor GC之后，新生代所有对象都需要存活，那就会造成新生代所有对象全部要进入老年代；
2. 如果老年代的可用内存大于新生代所有对象总大小，此时就可以放心大胆的对新生代发起一次Minor GC，因为Minor GC之后即使所有对象都存活，Survivor区放不下了，也可以转移到老年代去；
3. 如果老年代的可用空间已经小于新生代的全部对象总大小，那么就会进行下一个判断，判断老年代的可用空间大小，是否大于之前每一次Minor GC后进入老年代的对象的平均大小.
4. 如果判断发现老年代的内存大小，大于之前每一次Minor GC后进入老年代的对象的平均大小，那么就是说可以冒险尝试一下Minor GC，但是此时真的可能有风险，那就是Minor GC过后，剩余的存活对象的大小，大于Survivor空间的大小，也大于老年代可用空间的大小，老年代都放不下这些存活对象了，此时就会触发一次“Full GC”；

<img src="http://img.zouyh.top/article-img/20240917135027223.jpg" alt="01-jvm内存担保" style="zoom:50%;" />

​	内存担保机制通过，冒险尝试一下Minor GC，Minor GC过后，剩余的存活对象的大小，如果小于老年代可用空间，可以减少一次full GC,所以老年代空间分配担保机制的目的,也是为了避免频繁进行Full GC.

### 五，逃逸分析（补充）

在逃逸分析和栈上分配之前，我们可以先简单了解一下它们的基本定义：

- 逃逸分析（个人理解）：就是方法内的对象，可以被方法外所访问。
- 栈上分配：就是把没发生逃逸的对象，在栈分配空间，一般对象分配空间是在堆。

二者联系，jvm根据对象是否发生逃逸，会分配到不同（堆或栈）的存储空间。

- 如果对象发生逃逸，那会分配到堆中，因为对象发生了逃逸，就代表这个对象可以被外部访问，换句话说，就是可以共享，能共享数据的，无非就是堆或方法区，这里就是堆。
- 如果对象没发生逃逸，那会分配到栈中，因为对象没发生逃逸，那就代表这个对象不能被外部访问，换句话说，就是不可共享，这里就是栈。

```java
public class A {
    private A obj;
    // 方法返回A对象,发生逃逸。
    public A getInstance() {
        return this.obj == null ? new A():obj;
    }
    // 为成员属性赋值,发生逃逸
    public void setObj() {
        this.obj = new A();
    }
    // 没有发生逃逸。对象的作用域尽在当前方法中有效，没有发生逃逸。
    public void useA() {
        A s = new A();
    }
    
}
```

那我们再想深一层，为什么会有逃逸分析，有栈上分配这些东西？

​	当然是为了主体的考虑，主体就是jvm，或者直接说为了GC考虑也不为过。大家想想，GC主要回收的对象是堆和方法区。GC不会对栈、程序计数器这些进行回收的，因为没东西可以回收。

​	话又说回来，如果方法逃逸，那么对象就会分配在堆中，这个时候，GC就要工作了。如果没发生方法逃逸，那么对象就分配在栈中，当方法结束后，资源就自动释放了，GC压根不用操心。
