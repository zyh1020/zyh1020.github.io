---
icon: file-lines
# 标题
title: 'String字符串常量池'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-18
# 一个页面可以有多个分类
category:
  - Java
# 一个页面可以有多个标签
tag:
  - 常用
  - Java
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，String字符串常量池

#### 1.1 字符串常量池的设计思想 

1. 字符串的分配，和其他的对象分配一样，耗费高昂的时间与空间代价，作为最基础的数据类型，大量频繁的创建 字符串，极大程度地影响程序的性能 
2.  JVM为了提高性能和减少内存开销，在实例化字符串常量的时候进行了一些优化 为字符串开辟一个字符串常量池，类似于缓存区创建字符串常量时，首先查询字符串常量池是否存在该字符串存在该字符串，返回引用实例，不存在，实例化该字符串并放入池中

#### 1.2 三种字符串操作

①，直接赋值字符串

```java
String s = "zyh"; // s指向常量池中的引用
```

这种方式创建的字符串对象，只会在常量池中。因为有"zyh"这个字面量，创建对象s的时候，JVM会先去常量池中通过 equals(key) 方法，判断是否有相同的对象

- 如果字符串常量池没有，则会在常量池中创建一个新对象，再返回引用
- 如果字符串常量池有，则直接返回该对象在常量池中的引用；

②，new String();

```java
 String s1 = new String("zyh"); // s1指向内存中的对象引用
```

这种方式会保证字符串常量池和堆中都有这个对象，没有就创建，最后返回堆内存中的对象引用 。因为有"zyh"这个字面量，创建对象s的时候，JVM会先去常量池中通过 equals(key) 方法，判断是否有相同的对象

- 如果字符串常量池没有，会在常量池中创建一个新对象，再去堆内存中创建一个字符串对象"zyh"，将堆内存中的引用返回。
- 如果字符串常量池有，就直接去堆内存中创建一个字符串对象"zyh"，将堆内存中的引用返回；

③，intern方法

```java
String s1 = new String("zyh");
String s2 = s1.intern();
System.out.println(s1 == s2); //false
```

String中的intern方法是一个 native 的方法，当调用 intern方法时，用equals(oject)方法判断

- 如果字符串常量池已经包含此String对象的字符串 ，则返回池中的字符串。

- 如果字符串常量池已经不包含此String对象的字符串 ，将intern返回的引用指向当前字符串 s1(jdk1.6版本需要将 s1 复制到字符串常量池里)。

  

#### 1.3 字符串常量池位置 

- Jdk1.6及之前： 有永久代, 运行时常量池在永久代，运行时常量池包含字符串常量池 。

- Jdk1.7：有永久代，但已经逐步“去永久代”，字符串常量池从永久代里的运行时常量池分离到堆里。

- Jdk1.8及之后： 无永久代，运行时常量池在元空间，字符串常量池依然在堆里

  用一个程序证明下字符串常量池在哪里：

  ```java
  /**
  * jdk6：‐Xms6M ‐Xmx6M ‐XX:PermSize=6M ‐XX:MaxPermSize=6M
  * jdk8：‐Xms6M ‐Xmx6M ‐XX:MetaspaceSize=6M ‐XX:MaxMetaspaceSize=6M
  */
  public class RuntimeConstantPoolOOM{
  	public static void main(String[] args) {
  		ArrayList<String> list = new ArrayList<String>();
  		for (int i = 0; i < 10000000; i++) {
  			String str = String.valueOf(i).intern();
  			list.add(str);
  		}
  	}
  }
  ```

- jdk7及以上：Exception in thread "main" java.lang.OutOfMemoryError: Java heap space 17

-  jdk6：Exception in thread "main" java.lang.OutOfMemoryError: PermGen space



#### 1.4 字符串常量池设计原理 

​	字符串常量池底层是hotspot的C++实现的，底层类似一个 HashTable， 保存的本质上是字符串对象的引用。 看一道比较常见的面试题，下面的代码创建了多少个 String 对象？

```java
// 这一步创建5个，"he"和"llo"字符串常量池和堆内存各一个，"hello"堆内存一个，字符串常量池中没有因为没有出现过"hello"字面量
String s1 = new String("he") + new String("llo"); 
// 这一步 JDK 1.6 及以下需要将堆内存的复制到字符串常量池里，在常量池中创建一个；在JDK 1.7及以上直接指向堆内存的。
String s2 = s1.intern();
System.out.println(s1 == s2);
```

- 在 JDK 1.6 及以下输出是 false，创建了 6 个对象
- 在 JDK 1.7 及以上输出是 true，创建了 5 个对象

为什么输出会有这些变化呢？主要还是字符串池从永久代中脱离、移入堆区的原因， intern() 方法也相应发生了变化：

1、在 JDK 1.6 中，调用 intern() 首先会在字符串池中寻找 equal() 相等的字符串，

- 假如字符串存在就返回该字符串在字符串池中的引用；
- 假如字符串不存在，虚拟机会重新在永久代上创建一个实例，将StringTable 的一个表项指向这个新创建的实例。

<img src="http://img.zouyh.top/article-img/20240917134937100.png" alt="image-20230207114623970" style="zoom: 80%;" />

2、在 JDK 1.7 (及以上版本)中，由于字符串池不在永久代了，intern() 做了一些修改，更方便地利用堆中的对象。字符串存在时和 JDK 1.6一样，但是字符串不存在时不再需要重新创建实例，可以直接指向堆上的实例。

<img src="http://img.zouyh.top/article-img/20240917134938102.png" alt="image-20230207114747345" style="zoom:80%;" />



#### 1.5 String常量池问题

示例1：

```java
String s0="zyh";
String s1="zyh";
String s2="z" + "yh";
System.out.println( s0==s1 ); //true
System.out.println( s0==s2 ); //true
```

因为例子中的 s0和s1中的”zyh”都是字符串常量，它们在编译期就被确定了，所以s0==s1为true； 而”z”和”yh”也都是字符串常量，当一个字 符串由多个字符串常量连接而成时，它自己肯定也是字符串常量，所以s2也同样在编译期就被优化为一个字符串常量"zyh"，所以s2也是常量池中” zyh”的一个引用。所以我们得出 s0==s1==s2；

示例2： 

```java
String s0="zyh"; 
String s1=new String("zyh"); 
String s2="z" + new String("yh"); 
System.out.println( s0==s1 ); // false 
System.out.println( s0==s2 ); // false 
System.out.println( s1==s2 ); // false
```

 分析：用new String() 创建的字符串不是常量，不能在编译期就确定，所以new String() 创建的字符串不放入常量中，它们有自己的地址空间。 s0还是常量池中"zyh”的引用，s1因为无法在编译期确定，所以是运行时创建的新对象”zyh”的引用，s2因为后半部分 new String(”yh”)所以也无法在编译期确定，所以也是一个新创建对象”zyh”的引用;明白了这些也就知道为何得出此结果了。

示例3：

```java
String a = "a1"; 
String b = "a" + 1; 
System.out.println(a == b); // true
String a = "atrue"; 
String b = "a" + "true"; 
System.out.println(a == b); // true 
String a = "a3.4"; 
String b = "a" + 3.4; 
System.out.println(a == b); // true 
```

分析：JVM对于字符串常量的"+"号连接，将在程序编译期，JVM就将常量字符串的"+"连接优化为连接后的值，拿"a" + 1来说，经编译器优化后在class中就已经是a1。在编译期其字符串常量的值就确定下来，故上面程序最终的结果都为 true。

示例4： 

```java
String a = "ab"; 
String b = "b"; 
String c = "a" + b; 
System.out.println(a == c); // false 
```

分析：JVM对于字符串引用，由于在字符串的"+"连接中，有字符串引用存在，而引用的值在程序编译期是无法确定的， 即"a" + b无法被编译器优化，只有在程序运行期来动态分配并将连接后的新地址赋给c。所以上面程序的结果也就为 false。

示例5： 

```java
String a = "ab"; 
final String h = "b"; 
String c = "a" + h; 
System.out.println(a == c); // true 
```

分析：和示例4中唯一不同的是b字符串加了final修饰，对于final修饰的变量，它在编译时被解析为常量值的一个本地拷贝存储到自己的常量池中或嵌入到它的字节码流中。所以此时的"a" + h和"a" + "b"效果是一样的。故上面程序的结果为true。

示例6：

```java
String a = "ab"; 
final String bb = getBB(); 
String b = "a" + bb; 
System.out.println(a == b); // false 
private static String getBB() { 
    return "b"; 
} 
```

分析：JVM对于字符串引用bb，它的值在编译期无法确定，只有在程序运行期调用方法后，将方法的返回值和"a"来动态 连接并分配地址为b，故上面程序的结果为false。

示例7:

```java
// 没有出现"计算机技术"字面量，所以不会在常量池里生成"计算机技术"对象
String str2 = new StringBuilder("计算机").append("技术").toString(); 
System.out.println(str2 == str2.intern()); // true


// 没有出现"java"字面量，所以不会在常量池里生成"java"对象
String str1 = new StringBuilder("ja").append("va").toString(); 
System.out.println(str1 == str1.intern()); //false
// java是关键字，在JVM初始化的相关类里肯定早就放进字符串常量池了str1.intern()指向的是字符串常量所以fales

// 出现"test"作为字面量，所以会在常量池里生成"test"对象
String s1=new String("test");
System.out.println(s1==s1.intern()); //false
// "test"作为字面量，放入了池中，而new时s1指向的是heap中新生成的string对象，s1.intern()指向的是"test"字面量之前在池中生成的字符串对象

```

#### 1.6 关于String是不可变的

字符串不可变的好处：

- 作为HashMap的键。因为字符串是不可变的，因此它在创建的时候哈希码（hash code）就计算好了。这也就意味着每次在使用一个字符串的哈希码的时候不用重新计算一次，这样更加高效，很适合作为HashMap中的键。
- 线程安全，同一个字符串对象可以被多个线程共享，如果访问频繁的话，可以省略同步和锁等待的时间，从而提升性能。



 String的成员变量是final修饰

```java
 private final char value[]; //该值用于字符存储        
```

注意：final修饰的表示value的引用地址是不可变的，但是存储的值是可以改变的。如下代码案例

<img src="http://img.zouyh.top/article-img/20240917134938101.png" alt="image-20230207142209484" style="zoom:67%;" />

从上代码，你是否产生一个疑问，value值可以被改变，又怎么会是不可改变的？

答：String值的改变都是会重新生成一个String对象，String的`new String(char[] chars)`构造也是赋予一个新的char[]；

如下分析String的构造方法：

```java
public String(char value[]) {
    this.value = Arrays.copyOf(value, value.length);
}
```

继续跟进`Arrays.copyOf(value, value.length);`方法源码:

```java
public static char[] copyOf(char[] original, int newLength) {
    char[] copy = new char[newLength];  // 创建了一个新的char[] 数组
    System.arraycopy(original, 0, copy, 0,
                     Math.min(original.length, newLength));
    return copy;
}
```

再看个字符串拼接的例子：

```java
String s = "a" + "b" + "c"; // 就等价于String s = "abc";
String a = "a";
String b = "b";
String c = "c";
String s1 = a + b + c;
```

s1 这个就不一样了，可以通过观察其JVM指令码发现s1的"+"操作会变成如下操作：

```java
StringBuilder temp = new StringBuilder();
temp.append(a).append(b).append(c);
String s = temp.toString();
```

StringBuilder的append方法如下：

```java
@Override
public StringBuilder append(String str) {
    super.append(str);
    return this;
}
```

跟进`super.append(str);`方法：

```java
public AbstractStringBuilder append(String str) {
        if (str == null)
            return appendNull();
        int len = str.length();
        ensureCapacityInternal(count + len); // 确保内部容量
    	// value是char[]成员变量，getChars方法就是将str的char[]值拷贝
        str.getChars(0, len, value, count); 
        count += len;
        return this;
}
```

