---
icon: file-lines
title: jvm调优工具
author: Ms.Zyh
date: 2023-07-12
category:
  - Jvm
tag:
  - 必看
  - Jvm
sticky: false
star: false
---

### 一，jvm基础调优工具

#### 1.1 jps

作用：

​	JVM Process Status Tool，显示虚拟机进程。

用法：

```
jps [-qmlvV]
```

参数说明：

- -q：打印进程号
- -l：打印进程号+启动类的全限定名
- -m：打印进程号+启动类的 main 方法入参
- -v：打印进程号+指定的虚拟机参数
- -V：打印类名

例子：`jps`

![image-20230210114625646](http://img.zouyh.top/article-img/20240917135038256.png)

#### 1.2 jstat

作用：

​	JVM statistics Monitoring，对Java虚拟机内存进行监控统计。

用法：

```
jstat -<option> [-t] [-h<lines>] <vmid> [<interval> [<count>]]
```

参数说明

- option：统计垃圾回收情况。
- -t：显示时间戳列
- -h：指定每隔多少行显示标题
- -vmid：进程ID通过jps查看
- -interval：每行检测结果输出的时间间隔
- -count：检测的次数

##### 1.2.1 堆内存

案例1： `jstat -gccapacity 8384`，监控通过jps获取的进程号8384的堆内存统计值

![image-20230210113233529](http://img.zouyh.top/article-img/20240917135042270.png)

输出的指标说明：

- NGCMN：新生代最小容量
- NGCMX：新生代最大容量
- NGC：当前新生代容量
- S0C：第一个Survivor区大小
- S1C：第二个Survivor区大小
- EC：Eden区的大小
- OGCMN：老年代最小容量
- OGCMX：老年代最大容量
- OGC：当前老年代大小
- OC: 当前老年代大小
- MCMN: 最小元数据容量
- MCMX：最大元数据容量
- MC：当前元数据空间大小
- CCSMN：最小压缩类空间大小
- CCSMX：最大压缩类空间大小
- CCSC：当前压缩类空间大小
- YGC：年轻代gc次数
- FGC：老年代GC次数

案例2：堆内存统计`jstat -gc  -h2 -t 8384 100 5`，监控通过jps获取的进程号8384的垃圾收集统计值，每隔100ms输出一行，总共输出5次，每输出2次需要重新输出标题:  

![image-20230210114553113](http://img.zouyh.top/article-img/20240917135042267.png)

  输出的指标说明：

  - S0C: 第一个Survivor区的容量
  - S1C: 第二个Survivor区的容量
  - S0U: 第一个Survivor区已经使用的容量
  - S1U:第二个Survivor区已经使用的容量
  - EC: 新生代Eden区的容量
  - EU: 新生代Eden区已经使用的容量
  - OC: 老年代容量
  - OU:老年代已经使用的容量
  - MC: 方法区大小（元空间）
  - MU: 方法区已经使用的大小
  - CCSC:压缩指针占用空间
  - CCSU:压缩指针已经使用的空间
  - YGC: YoungGC已经发生的次数
  - YGCT: 这一次YoungGC耗时
  - FGC: Full GC发生的次数
  - FGCT: Full GC耗时
  - GCT: 总的GC耗时，等于YGCT+FGCT

##### 1.2.2 新生代内存

案例3：`jstat -gcnewcapacity 8384`，监控通过jps获取的进程号8384的新生代统计值

![image-20230210114236497](http://img.zouyh.top/article-img/20240917135036247.png)

输出的指标说明:

- NGCMN：新生代最小容量
- NGCMX：新生代最大容量
- NGC：当前新生代容量
- S0CMX：Survivor 1区最大大小
- S0C：当前Survivor 1区大小
- S1CMX：Survivor 2区最大大小
- S1C：当前Survivor 2区大小
- ECMX：最大Eden区大小
- EC：当前Eden区大小
- YGC：年轻代垃圾回收次数
- FGC：老年代回收次数

案例4： `jstat -gcnew -h2 -t 8384 100 5`，监控通过jps获取的进程号8384的垃圾收集统计值，每隔100ms输出一行，总共输出5次，每输出2次需要重新输出标题:  

![image-20230210114140059](http://img.zouyh.top/article-img/20240917135042269.png)

输出的指标说明

- S0C：第一个Survivor的大小
- S1C：第二个Survivor的大小
- S0U：第一个Survivor已使用大小
- S1U：第二个Survivor已使用大小
- TT: 对象在新生代存活的次数
- MTT: 对象在新生代存活的最大次数
- DSS: 期望的Survivor大小
- EC：Eden区的大小
- EU：Eden区的使用大小
- YGC：年轻代垃圾回收次数
- YGCT：年轻代垃圾回收消耗时间

##### 1.2.3 老年代内存

案例5：`jstat -gcoldcapacity`，监控通过jps获取的进程号8384的老年代统计值.

![image-20230210115214318](http://img.zouyh.top/article-img/20240917135038258.png)

输出的指标说明:

- OGCMN：老年代最小容量
- OGCMX：老年代最大容量
- OGC：当前老年代大小
- OC：老年代大小
- YGC：年轻代垃圾回收次数
- FGC：老年代垃圾回收次数
- FGCT：老年代垃圾回收消耗时间
- GCT：垃圾回收消耗总时间

案例6：`jstat -gcold -h2 -t 8384 100 5`，监控通过jps获取的进程号8384的垃圾收集统计值，每隔100ms输出一行，总共输出5次，每输出2次需要重新输出标题:  

![image-20230210115333047](http://img.zouyh.top/article-img/20240917135035245.png)

输出的指标说明:

- MC：方法区大小
- MU：方法区已使用大小
- CCSC:压缩指针类空间大小
- CCSU:压缩类空间已使用大小
- OC：老年代大小
- OU：老年代已使用大小
- YGC：年轻代垃圾回收次数
- FGC：老年代垃圾回收次数
- FGCT：老年代垃圾回收消耗时间
- GCT：垃圾回收消耗总时间，新生代+老年代

##### 1.2.4 元空间

案例7：`jstat -gcmetacapacity 8384`，监控通过jps获取的进程号8384的老年代统计值.

![image-20230210115753776](http://img.zouyh.top/article-img/20240917135037251.png)

输出的指标说明:

- MCMN:最小元数据容量
- MCMX：最大元数据容量
- MC：当前元数据空间大小
- CCSMN：最小指针压缩类空间大小
- CCSMX：最大指针压缩类空间大小
- CCSC：当前指针压缩类空间大小
- YGC：年轻代垃圾回收次数
- FGC：老年代垃圾回收次数
- FGCT：老年代垃圾回收消耗时间
- GCT：垃圾回收消耗总时间

##### 1.2.5 整体运行情况

案例7：`jstat -gcutil -h2 -t 8384 100 5`监控通过jps获取的进程号8384的垃圾收集统计值，每隔100ms输出一行，总共输出5次，每输出2次需要重新输出标题:  

![image-20230210141413448](http://img.zouyh.top/article-img/20240917135044277.png)

输出的指标说明:

- S0：Survivor 1区当前使用比例
- S1：Survivor 2区当前使用比例
- E：Eden区使用比例
- O：老年代使用比例
- M：元数据区使用比例
- CCS：指针压缩使用比例
- YGC：年轻代垃圾回收次数
- YGCT：年轻代垃圾回收消耗时间
- FGC：老年代垃圾回收次数
- FGCT：老年代垃圾回收消耗时间
- GCT：垃圾回收消耗总时间

#### 1.3 jinfo

作用：

​	JVM Configuration info，可以实时查看和实时修改虚拟机参数。

用法：

```
jinfo [option] <pid>
```

参数说明

- option：操作

  - -flag 打印指定的VM参数的值
  - -flag [+|-] 启用或禁用指定的VM参数
  - -flag = 修改VM参数
  - -flags 打印VM参数（windos不支持）
  - -sysprops 打印Java系统配置 （windos不支持）

- pid：进程ID

例子：

通过`jsp -v`获取进程id：

![image-20230210095257572](http://img.zouyh.top/article-img/20240917135042268.png)

然后打印获取到的进程id，是否使用G1垃圾收集器`jinfo -flag UseG1GC 15754`：

<img src="http://img.zouyh.top/article-img/20240917135039259.png" alt="image-20230210095458158" style="zoom:67%;" />

<img src="http://img.zouyh.top/article-img/20240917135045279.png" alt="image-20230210095428854" style="zoom: 67%;" />

#### 1.4 jstack 

作用：

​	生成Java虚拟机当前时刻的线程快照，方便定位线程长时间停顿的问题，比如死锁、死循环、长时间等待等。

用法：

```
jstack [-F] [-m] [-l] <pid>
```

参数说明

- -F：强制打印堆栈
- -m：同时打印Java和本地方法的堆栈
- -l：打印关于锁的附件信息
- pid：进程ID

案例检测死锁：

```java
public class Test01 {
	private static Object lock1 = new Object();
	private static Object lock2 = new Object();
	public static void main(String[] args) {
		new Thread(() -> {
			synchronized (lock1) {
				try {
					System.out.println("thread1 begin");
					Thread.sleep(5000);
				} catch (InterruptedException e) {
				}
                synchronized (lock2) {
                    System.out.println("thread1 end");	
                }
           }
		}).start();
	
      new Thread(() -> {
		synchronized (lock2) {
			try {
				System.out.println("thread2 begin");	
                Thread.sleep(5000);
			} catch (InterruptedException e) {
			}
            synchronized (lock1) {
                System.out.println("thread2 end");
            }
		}
		}).start();
		System.out.println("main thread end");
	}
}

```

运行后上方代码后，执行`jps`命令获取pId

![image-20230210110923610](http://img.zouyh.top/article-img/20240917135044275.png)

继续执行`jstack 18580`:

![image-20230210111114812](http://img.zouyh.top/article-img/20240917135043273.png)

上图解释

- 线程名 ： "Thread-1"
- 优先级：prio=5
- 线程id：tid=0x000000001ad1b000
- 线程对应的本地线程标识nid：nid=0x4cb0：
- 线程状态： java.lang.Thread.State: BLOCKED

继续看`jstack 18580`命令最后的输出：

![image-20230210111915504](http://img.zouyh.top/article-img/20240917135036248.png)



#### 1.6 jmap

JVM Memory Map，用来查看实例个数以及占用内存大小；堆内存信息；生成堆栈dump文件。

用法：

```
jmap [option] <pid>
```

参数说明

- option：操作

  - heap：打印Java堆摘要 (window不支持）
  - histo[:live]：打印java对象堆的直方图; 如果指定了“live”选项，则仅计算实时对象
  - dump：[live/format,file]生成dump快照

- pid：进程ID

案例1：来查看内存信息，实例个数以及占用内存大小，`jmap -histo 8384`:

![image-20230210142642092](http://img.zouyh.top/article-img/20240917135040262.png)

输出的指标说明:

- num：序号 
- instances：实例数量
-  bytes：占用空间大小 
- class name：类名称

案例2：查看堆内存信息`jmap -heap 14660`:

<img src="http://img.zouyh.top/article-img/20240917135040263.png" alt="QQ截图20230210142947" style="zoom:67%;" />

案例3：生成堆内存dump文件

```
jmap -dump:live,file=.\heap_dump.hprof 8384
```

![image-20230210143635355](http://img.zouyh.top/article-img/20240917135037253.png)

也可以设置内存溢出自动导出dump文件，内存很大的时候，可能会导不出来，vm参数如下：

```
‐XX:+HeapDumpOnOutOfMemoryError ‐XX:HeapDumpPath=F:\heap_dump.hprof
```

可以用jvisualvm命令工具导入该dump文件分析.

### 二，jvm可视化调优工具

#### 2.1 jconsole

​	JConsole是一个基于JMX的GUI工具，用于连接正在运行的JVM，它是Java自带的简单性能监控工具。下面以对tomcat的监控为例，带领大家熟悉JConsole这个工具。	

在cmd窗口中输入`jconsole`:

<img src="http://img.zouyh.top/article-img/20240917135037250.png" alt="image-20230210152811681" style="zoom: 67%;" />

**①，概览**

![image-20230210153040420](http://img.zouyh.top/article-img/20240917135036246.png)

- 概要界面，主要显示堆内存使用情况、活动线程数、加载类数、CPU使用率四个参数的概要，可以通过下拉框来定制显示的时间范围
- 假如堆内存的图像一直在上升而没有下降的动作发生，则要怀疑是否内存泄露。健壮的项目由于GC的存在，所以它的上升和下降的幅度应该大抵相同
- CPU的图像规律跟堆内存的大致相同

**②，内存**

![image-20230210154131745](http://img.zouyh.top/article-img/20240917135038254.png)

- 点击右上的执行GC按钮可以通知JVM进行垃圾回收。
- GC 时间显示了垃圾回收的时间以及回收数，上面的是Young GC执行的时间和次数，下面的是Full GC执行的时间和次数
- 右下角的图案，Heap内存区包括：年轻代Eden Space、存活代Survivor Space和老年代Tenured Gen。Non-Heap内存区包括：代码缓存区Code Cache和持久代Perm Gen；可通过改变①中下拉框的值实现切换图形。

**③，线程**

![image-20230210154420489](http://img.zouyh.top/article-img/20240917135044278.png)

- “峰值”表示最大的线程数
- 点击具体的线程之后，我们可以看到它的状态以及方法栈的详细调用情况
- 点击“检查死锁”可以检测是否有死锁

**④，类**

![image-20230210154656875](http://img.zouyh.top/article-img/20240917135043271.png)

**⑤，VM概要**

![image-20230210154805864](http://img.zouyh.top/article-img/20240917135044276.png)

**⑥，MBean概要**

![image-20230210155037685](http://img.zouyh.top/article-img/20240917135043274.png)

操作显示该bean的所有方法，可以点击该按钮触发方法，但个人不推荐这么做，应该通过程序的统一入口来触发

#### 2.2 jvisualvm

使用：在cmd窗口中输入`jvisualvm`:

**①，起始页**

![image-20230210155516735](http://img.zouyh.top/article-img/20240917135037252.png)

右侧可以看到本地线程列表，选择那个可以监测那个。

**②，概述**

![image-20230210155833201](http://img.zouyh.top/article-img/20240917135039260.png)

显示的是该服务器的启动和系统参数，可以通过与服务器的实际参数进行对比查看是否有内存溢出

**③，监控**

![image-20230210160001480](http://img.zouyh.top/article-img/20240917135045280.png)

显示的是当前系统的CPU、内存、类和线程的相关资源的使用情况。其中"堆dump"可以查看堆的详细状态，包括堆的概况，里面所有的类，还能点进具体的一个类查看这个类的状态。

**④，线程**

![image-20230210160114448](http://img.zouyh.top/article-img/20240917135035244.png)

能够显示线程的名称和运行的状态，在调试多线程时必不可少，而且可以点进一个线程查看这个线程的详细运行情况，也可以检测死锁。

**⑤，抽样器**

![image-20230210160256856](http://img.zouyh.top/article-img/20240917135038257.png)

![image-20230210160415960](http://img.zouyh.top/article-img/20240917135036249.png)

抽样器，可针对cpu和内存进行抽样监控，判断那个线程cup使用率高，那些类占用内存多。

补充：分析jmap生成的dump文件方式：选择文件 -> 选择装入 -> 选中文件确定即可。

![image-20230210160830148](http://img.zouyh.top/article-img/20240917135043272.png)



### 三，第三方工具Arthas

​	Arthas 是 Alibaba 在 2018 年 9 月开源的 Java 诊断工具。支持 JDK6+， 采用命令行交互模式，可以方便的定位和诊断线上程序运行问题。Arthas 官方文档十分详细，详见：https://arthas.gitee.io/

Arthas使用 

```sh
# 方式1：github下载arthas
wget https://alibaba.github.io/arthas/arthas‐boot.jar 
# 方式2：Gitee下载arthas
wget https://arthas.gitee.io/arthas‐boot.jar
# 方3：手动下载jar后，上传服务器
```

用java -jar运行即可，可以识别机器上所有Java进程：![image-20230210161945929](http://img.zouyh.top/article-img/20240917135039261.png)

输入2，回车，进入进程信息操作：<img src="http://img.zouyh.top/article-img/20240917135041264.png" alt="image-20230210162103675" style="zoom: 80%;" />

输入`dashboard`可以查看整个进程的运行情况，线程、内存、GC、运行环境信息![image-20230210162210301](http://img.zouyh.top/article-img/20240917135038255.png)

输入`thread`可以查看线程详细情况:![image-20230210162406096](http://img.zouyh.top/article-img/20240917135041265.png)

输入 `jad`加类的全名可以反编译，这样可以方便我们查看线上代码是否是正确的版本![image-20230210162525401](http://img.zouyh.top/article-img/20240917135041266.png)

更多命令使用可以用help命令查看，或查看文档：https://arthas.gitee.io/doc/

