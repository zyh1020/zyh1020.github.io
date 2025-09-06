---
icon: file-lines
# 标题
title: 'CAS和Atomic'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-25
# 一个页面可以有多个分类
category:
  - 多线程
# 一个页面可以有多个标签
tag:
  - 干货
  - 多线程
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---



### 一，CAS

#### 1.1 介绍

```java
while(true){
    // 1，预期值X
    // 2，要修改的新值Y
    if(CompareAndSet(X,Y)){
        break;
    }
}       
```

​	在CompareAndSet方法中，会在修改volatile修饰的变量的值X之前，将传入的volatile修饰的变量X和再次获取的同样是volatile修饰的变量的值X 进行比较，

- 相等，证明volatile修饰的变量的值X没有被其他线程更改，可以进行更新并返回true。
- 不相等，证明volatile修饰的变量的值X被其他线程更改，不可以进行更新并返回false，不会跳出循环再次进行上面的三步。

​	CAS是一条原子指令,不会造成所谓的数据不一致的问题。CAS有3个操作数：内存值V，预期值X，要修改的新值Y。当且仅当预期值X和内存值V相同时，将内存值V修改为Y，否则什么都不做。

####  1.2 实现机制

​	在原子类变量中，如java.util.concurrent.atomic中的AtomicXXX，都使用了这些底层的JVM支持为数字类型的引用类型提供一种高效的CAS操作，而在java.util.concurrent中的大多数类在实现时都直接或间接的使用了这些原子变量类。

以 AtomicInteger 原子整型类为例，一起来分析下 CAS 底层实现机制：

```java
AtomicInteger atomicData = new AtomicInteger(6);// 类中成员变量定义原子类
atomicData.compareAndSet(6,66);// 原子类自增
```

AtomicInteger 的compareAndSet方法源码如下所示：

```java
// compareAndSet方法
public final boolean compareAndSet(int expect, int update) {
        return unsafe.compareAndSwapInt(this, valueOffset, expect, update);
}
```

我们看到了 AtomicInteger 内部方法都是基于 Unsafe 类实现的，Unsafe 的compareAndSwapInt方法有4个参数：

- this是调用compareAndSet()方法的 AtomicInteger 类型的对象，例如上面的代码，this是atomicData引用的对象
- valueOffset是变量在内存中的偏移地址,因为UnSafe就是根据内存偏移地址获取数据的。（这里的变量是AtomicInteger的value，下面有解释）
- expect，期望更新的值，例如上面的代码，expect是6。
- update，要更新的最新值，例如上面的代码，expect是66。

> 通过this和valueOffset，就可获取内存值V，而预期值X，要修改的新值Y是通过参数传递进来的

如何获得 valueOffset的

```java
@Data 
class Student {    
    volatile int id;    
    volatile String name; 
}
```

```java
// 通过反射获取 Unsafe对象
Field theUnsafe = Unsafe.class.getUnsafe("theUnsafe"); 
theUnsafe.setAccessinible(true);
Unsafe unsafe =  (Unsafe)theUnsafe.get(null);
    
// 获得成员变量的偏移量 
Field id = Student.class.getDeclaredField("id"); 
Field name = Student.class.getDeclaredField("name"); 

long idOffset = unsafe.objectFieldOffset(id); 
long nameOffset = unsafe.objectFieldOffset(name);
 
Student student = new Student(); // 使用 cas 方法替换成员变量的值 
unsafe.compareAndSwapInt(student, idOffset, 0, 20); // 返回 true  
unsafe.compareAndSwapObject(student, nameOffset, null, "张三"); // 返回 true
```

AtomicInteger中的实现

```java
public class AtomicInteger extends Number implements Serializable {
    // Unsafe实例
    private static final Unsafe unsafe = Unsafe.getUnsafe();
    // 实际变量的值
    private volatile int value;

    private static final long valueOffset;

    static {
            try {
                  // 获得value在AtomicInteger中的偏移量
                    valueOffset = unsafe.objectFieldOffset
                            (AtomicInteger.class.getDeclaredField("value"));
            } catch (Exception ex) { throw new Error(ex); }
    }
    // ，，，，省略
}
```

#### 1.3 ABA问题

​	问题1：作为乐观锁的一种实现，当多线程竞争资源激烈的情况下，而且锁定的资源处理耗时，那么其他线程就要考虑自旋的次数限制，避免过度的消耗 CPU。 CAS大量失败后长时间占用 CPU 资源，加大了系统性能开销的问题。

​	问题2：A-->B--->A 问题，假设有一个变量 A ，修改为B，然后又修改为了 A，实际已经修改过了，但 CAS 可能无法感知，造成了不合理的值修改操作。整数类型还好，如果是对象引用类型，包含了多个变量，那怎么办？

例如：需求是Thread1通过CAS操将value值由1改为3

```java
public class ABATest {
    private final static Logger log = LoggerFactory.getLogger(ABATest.class);
    public static void main(String[] args) {
        AtomicInteger atomicInteger = new AtomicInteger(1);
        new Thread(() -> {
            int value = atomicInteger.get();
            log.debug("Thread1 获取value: " + value);
            LockSupport.parkNanos(1000000000L);//阻塞1s
            if (atomicInteger.compareAndSet(value, 3)) {
                log.debug("Thread1 修改value值，由" + value + "改为3");
            } else {
                log.debug("Thread1 修改value值失败");
            }
        }, "Thread1").start(); // Thread1通过CAS操作修改value值为3

        new Thread(() -> {
            int value = atomicInteger.get();
            log.debug("Thread2 获取value: " + value);
            if (atomicInteger.compareAndSet(value, 2)) { // Thread2通过CAS操作修改value值为2
                log.debug("Thread2 修改value值，由 " + value + " 改为 2");
                value = atomicInteger.get();
                log.debug("Thread2 再次获取value:" + value);
                if (atomicInteger.compareAndSet(value, 1)) { // Thread2 通过CAS修改value值为1
                    log.debug("Thread2 修改value值，由 " + value + " 改为1");
                }
            }
        },"Thread2").start();
    }
}
```

输出：

```cmd
10:45:59.031 [Thread1] DEBUG www.zyh.com.ABATest - Thread1 获取value: 1
10:45:59.031 [Thread2] DEBUG www.zyh.com.ABATest - Thread2 获取value: 1
10:45:59.036 [Thread2] DEBUG www.zyh.com.ABATest - Thread2 修改value值，由 1 改为 2
10:45:59.036 [Thread2] DEBUG www.zyh.com.ABATest - Thread2 再次获取value:2
10:45:59.036 [Thread2] DEBUG www.zyh.com.ABATest - Thread2 修改value值，由 2 改为1
10:46:00.037 [Thread1] DEBUG www.zyh.com.ABATest - Thread1 修改value值，由1改为3
```

分析：查看输出可知，在Thread1将value值由1改为3之间的时间内，Thread2将值偷偷改成了2，然后又改回了原来的1；Thread1并未察觉，修改将value值由1改为3。

如何避免上面未察觉的修改呢，通过加个版本号或时间戳：

```java
public class ABATest {
    private final static Logger log = LoggerFactory.getLogger(ABATest.class);
    public static void main(String[] args) {
        AtomicStampedReference atomicStampedReference = new AtomicStampedReference(1,1);
        new Thread(()->{
            int[] stampHolder = new int[1];
            int value = (int) atomicStampedReference.get(stampHolder);
            int stamp = stampHolder[0];
            log.debug("Thread1 获取value: "+ value + ",stamp: " + stamp);
            LockSupport.parkNanos(1000000000L);// 阻塞1s
            // Thread1通过CAS修改value值为3   stamp是版本，每次修改可以通过+1保证版本唯一性
            if(atomicStampedReference.compareAndSet(value,3,stamp,stamp+1)){
                log.debug("Thread1 修改value值由 "+ value + "改为 3,stamp值由: " + stamp+ "改为 "+(stamp+1));
            }else{
                log.debug("Thread1 更改失败！");
            }
        },"Thread1").start();

        new Thread(()->{
            int[] stampHolder = new int[1];
            int value = (int) atomicStampedReference.get(stampHolder);
            int stamp = stampHolder[0];
            log.debug("Thread2 获取value: "+ value + ",stamp: " + stamp);
            // Thread2通过CAS修改value值为2
            if(atomicStampedReference.compareAndSet(value,2,stamp,stamp+1)){
                log.debug("Thread2 修改value值由"+ value + " 改为 2,stamp值由: " + stamp+ "改为 "+(stamp+1);
                value = (int) atomicStampedReference.get(stampHolder);
                stamp = stampHolder[0];
                log.debug("Thread2 获取value:"+ value + ",stamp: " + stamp);
                // Thread2通过CAS修改value值为1
                if(atomicStampedReference.compareAndSet(value,1,stamp,stamp+1)){
                    log.debug("Thread2 修改value值，由:"+ value + " 改为 1,stamp值由: " + stamp+ "改为 "+(stamp+1);
                }
            }
        },"Thread2").start();
    }

}
```

输出：

```cmd
10:57:47.752 [Thread2] DEBUG www.zyh.com.ABATest - Thread2 获取value: 1,stamp: 1
10:57:47.752 [Thread1] DEBUG www.zyh.com.ABATest - Thread1 获取value: 1,stamp: 1
10:57:47.756 [Thread2] DEBUG www.zyh.com.ABATest - Thread2 修改value值由1 改为 2,stamp值由: 1改为 2
10:57:47.756 [Thread2] DEBUG www.zyh.com.ABATest - Thread2 获取value:2,stamp: 2
10:57:47.756 [Thread2] DEBUG www.zyh.com.ABATest - Thread2 修改value值，由:2 改为 1,stamp值由: 2改为 3
10:57:48.756 [Thread1] DEBUG www.zyh.com.ABATest - Thread1 更改失败！
```

分析：查看输出可知，在Thread1将value值由1改为3之间的时间内，Thread2将值偷偷改成了2，然后又改回了原来的1；Thread1通过stamp察觉到了，Thread1更改之前获得是1，在更改时变成了3，可以感知到了。

### 二，Atomic

- 原子整数：AtomicBoolean，AtomicInteger，AtomicLong
- 原子引用：AtomicReference ，AtomicMarkableReference (是否被更改过)，AtomicStampedReference（带有版本号的）
- 原子数组：AtomicIntegerArray ，AtomicLongArray ，AtomicReferenceArray
- 字段更新器：AtomicIntegerFieldUpdater（原子更新整型的字段的更新器），AtomicLongFieldUpdater（原子更新长整型字段的更新器）AtomicStampedFieldUpdater（原子更新带有版本号的引用类型）
- 原子累加器：LongAder，DoubleAdder 

#### 2.1 原子整数演示

常用方法:

- `addAndGet(int delta)`：以原子的方式将输入的数值与实例中的值（AtomicInteger种的value）相加，并返回结果。
- `boolean compareAndSet(int expect, int update)`：如果输入的值等于预期值，则以原子方式将该值设置为输入的值。
- `getAndIncrement()`：以原子的方式将当前值加1，注意，这里返回的是自增前的值。
- `void lazySet(int newValue)`：最终会设置成newValue，使用lazySet设置值后，可能导致其他线程在之后的一小段时间内还是可以读到旧的值。
- `getAndSet(int newValue)`：以原子方式设置为newValue的值，并返回旧值。

```java
public class AtomicIntegerTest {
    private static AtomicInteger ai = new AtomicInteger(1);
    public static void main(String[] args) {
        System.out.println(ai.addAndGet(1)); // 输出2
        System.out.println(ai.getAndAdd(1)); // 输出2
        System.out.println(ai.getAndSet(4)); // 输出3
        System.out.println(ai.getAndIncrement()); // 输出4
        System.out.println(ai.getAndDecrement()); // 输出5
        ai.lazySet(6);
        System.out.println(ai.get()); // 输出6
    }
}
```

#### 2.2 原子数组演示

- `addAndGet(int i, int delta)`：以原子方式将输入值与数组中索引i的元素相加，返回新值。
- `getAndSet(int i, int newValue)`：以原子方式将输入值与数组中索引i的元素相加，返回旧值。
- `getAndIncrement(int i)`：以原子方式将数组中索引i的元素加1，返回旧值。
- `getAndDecrement(int i)`：以原子方式将数组中索引i的元素减1，返回旧值。
- `boolean compareAndSet(int i, int expect, int update)`：如果当前值等于预期值，则以原子方式将数组位置i的元素设置为update值。

```java
public class AtomicArryTest {
    private static int[] value = new int[]{1,2};
    public static void main(String[] args) {
        AtomicIntegerArray aia = new AtomicIntegerArray(value);

        System.out.println(aia.addAndGet(0,1)); // 输出2
        System.out.println(aia.get(0)); // 输出2

        System.out.println(aia.getAndSet(0,3)); // 输出2
        System.out.println(aia.get(0)); // 输出3

        System.out.println(aia.getAndIncrement(0)); // 输出3
        System.out.println(aia.get(0)); // 输出4

        System.out.println(aia.getAndDecrement(0)); // 输出4
        System.out.println(aia.get(0)); // 输出3

        System.out.println(aia.compareAndSet(1,3,4)); // 输出false
        System.out.println(aia.get(1)); // 输出2

        System.out.println(aia.compareAndSet(1,2,4)); // 输出true
        System.out.println(aia.get(1)); // 输出4

        System.out.println(value[0]);// 输出1
    }
}
```

#### 2.3 原子引用演示

```java
public class ABATest {
    private static AtomicReference<Student> ar = new AtomicReference<>();
    public static void main(String[] args) {
        Student s1 = new Student("张三",18);
        ar.set(s1);
        Student s2 = new Student("李四",17);
        ar.compareAndSet(s1,s2);
        Student s3 = ar.get();
        System.out.println(s3.getName()); // 输出李四
        System.out.println(s3.getAge());// 输出17
    }
    static class Student{
        private String name;
        private int age;
        public Student(String name, int age) {
            this.name = name;
            this.age = age;
        }
        public String getName() {
            return name;
        }

        public int getAge() {
            return age;
        }
    }
}
```

#### 2.4 字段更新器演示

使用步骤:

- 因为原子更新字段类都是抽象类，每次使用的时候必须使用静态方法newUpdater()创建一个更新器，并且需要设置想要更新的类和属性。
- 更新类的字段必须使用public volatile修饰。


```java
public class AtomicIntegerFieldUpdateTest {
    private static AtomicIntegerFieldUpdater<Student> aifu = AtomicIntegerFieldUpdater.newUpdater(Student.class,"age");
    public static void main(String[] args) {
        Student student = new Student("张三",18);
        System.out.println(aifu.getAndIncrement(student)); // 输出18
        System.out.println(aifu.get(student)); // 输出19
    }
    static class Student{
        private String name;
        public volatile int age; // public volatile修饰
        public Student(String name, int age) {
            this.name = name;
            this.age = age;
        }
    }
}
```

#### 2.5 原子累加器

```java
public class ABATest {
    private final static Logger log = LoggerFactory.getLogger(ABATest.class);
    public static void main(String[] args) {
        for (int i = 0; i < 5; i++) {
            demo(() -> new LongAdder(), adder -> adder.increment());
        }

       /* for (int i = 0; i < 5; i++) {
            demo(() -> new AtomicLong(), adder -> adder.getAndIncrement());
        }*/
    }

    private static <T> void demo(Supplier<T> adderSupplier, Consumer<T> action) {
        T adder = adderSupplier.get();
        long start = System.nanoTime();
        List<Thread> ts = new ArrayList<>();
        for (int i = 0; i < 40; i++) {// 40个线程，每线程累加50万
            ts.add(new Thread(() -> {
                for (int j = 0; j < 500000; j++) {
                    action.accept(adder);
                }
            }));
        }
        ts.forEach(t -> t.start());
        ts.forEach(t -> {
            try {
                t.join();
            } catch (InterruptedException e) {
                e.printStackTrace();
            }});
        long end = System.nanoTime();
        System.out.println("结果"+adder + " 用时:" + (end - start)/1000_000);
    }
}
```

使用LongAdder的输出：

```cmd
结果20000000 用时:64
结果20000000 用时:62
结果20000000 用时:57
结果20000000 用时:93
结果20000000 用时:69
```

使用AtomicLong的输出：

```cmd
结果20000000 用时:362
结果20000000 用时:396
结果20000000 用时:443
结果20000000 用时:452
结果20000000 用时:447
```

​	使用原子累加器性能提升还是很吗，明显的。原因也很简单，原子累加器在有竞争时，设置多个累加单元，Therad-0 累加 Cell[0]，而 Thread-1 累加 Cell[1]... 后将结果汇总。这样它们在累加时操作的不同的 Cell 变量，因此减少了 CAS 重试失败，从而提高性能。

LongAdder 是并发大师 @author Doug Lea （大哥李）的作品，设计的非常精巧 LongAdder 类有几个关键域

```java
// 累加单元数组, 懒惰初始化 
transient volatile Cell[] cells;
// 基础值, 如果没有竞争, 则用 cas 累加这个域 
transient volatile long base;
// 在 cells 创建或扩容时, 置为 1, 表示加锁
transient volatile int cellsBusy;
```

定义了一个内部Cell类，这就是我们之前所说的槽，每个Cell对象存有一个value值，可以通过Unsafe来CAS操作它的值：

```java
@sun.misc.Contended static final class Cell {
	volatile long value;
	Cell(long x) { value = x; }
	final boolean cas(long cmp, long val) {
		return UNSAFE.compareAndSwapLong(this, valueOffset, cmp, val);
	}

	// Unsafe mechanics
	private static final sun.misc.Unsafe UNSAFE;
	private static final long valueOffset;
	static {
		try {
			UNSAFE = sun.misc.Unsafe.getUnsafe();
			Class<?> ak = Cell.class;
			valueOffset = UNSAFE.objectFieldOffset
				(ak.getDeclaredField("value"));
		} catch (Exception e) {
			throw new Error(e);
		}
	}
}
```

这也是LongAdder设计的精妙之处：尽量减少热点冲突，不到最后万不得已，尽量将CAS操作延迟

LongAdder的increment()方法源码： 

```java
public void increment() {
	add(1L);
}
```

```java
public void add(long x) {
	Cell[] as; long b, v; int m; Cell a;
    // 判断cells数组是否初始化
    // 情况1：判断cells数组== null 未初始化，调用casBase方法更新基础值base
    // 情况2：判断cells数组 ！= null 已初始化，进入if中
	if ((as = cells) != null || !casBase(b = base, b + x)) {
		boolean uncontended = true;
        // 再次判断cells数组是否初始化
        // 情况1：判断cells数组 == null 未初始化，调用longAccumulate方法更新基础值base
        // 情况2：判断cells数组 ！= null 已初始化，通过 as[getProbe() & m])方法获取Cell，通过cas方法更新数组的值
		if (as == null || (m = as.length - 1) < 0 ||
			(a = as[getProbe() & m]) == null ||
			!(uncontended = a.cas(v = a.value, v + x)))
			longAccumulate(x, null, uncontended);
	}
}
```

