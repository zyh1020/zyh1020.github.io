---
icon: file-lines
# 标题
title: 'HashMap原理'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-05
# 一个页面可以有多个分类
category:
  - Java
# 一个页面可以有多个标签
tag:
  - 推荐
  - Java
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，HashMap原理

#### 1.1 数据结构

从结构实现来讲，HashMap是数组+链表+红黑树（JDK1.8增加了红黑树部分）实现的，如下如所示:

<img src="http://img.zouyh.top/article-img/20240917134940109.png" alt="image-20230320114228827" style="zoom: 67%;" />

从源码可知，HashMap类中有一个非常重要的字段，就是 `Node<K,V>[] table`，即哈希桶数组

```java
transient Node<K,V>[] table;
```

我们来看JDK1.8中Node是何物

```java
static class Node<K,V> implements Map.Entry<K,V> {
        final int hash;    //用来定位数组索引位置
        final K key;
        V value;
        Node<K,V> next;   //链表的下一个node
        Node(int hash, K key, V value, Node<K,V> next) { ... }
        public final K getKey(){ ... }
        public final V getValue() { ... }
        public final String toString() { ... }
        public final int hashCode() { ... }
        public final V setValue(V newValue) { ... }
        public final boolean equals(Object o) { ... }
}
```

Node是HashMap的一个内部类，实现了Map.Entry接口，本质是就是一个映射(键值对)。上图中的每个黑色圆点代表一个Node对象。

#### 1.2 hash算法

​	不管增加、删除、查找键值对，定位到哈希桶数组的位置都是很关键的第一步。前面说过HashMap的数据结构是数组和链表的结合，所以我们当然希望这个HashMap里面的元素位置尽量分布均匀些，尽量使得每个位置上的元素数量只有一个，那么当我们用hash算法求得这个位置的时候，马上就可以知道对应位置的元素就是我们要的，不用遍历链表，大大优化了查询的效率。HashMap定位数组索引位置，直接决定了hash方法的离散性能。先看看源码的实现(方法一+方法二):

```java
// 方法一：获取hash值
static final int hash(Object key) {   //jdk1.8 & jdk1.7
     int h;
     // h = key.hashCode() 为第一步 取hashCode值
     // h ^ (h >>> 16)  为第二步 高位运算位异或
     return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
// 方法二：计算该对象应该保存在table数组的哪个索引处
static int indexFor(int h, int length) {  //jdk1.7的源码，jdk1.8没有这个方法，但是实现原理一样的
     return h & (length-1);  //第三步 取模运算
}
```

这里的Hash算法本质上就是三步：取key的hashCode值、高位运算、取模运算。

​	对于任意给定的对象，只要它的hashCode()返回值相同，那么程序调用方法一所计算得到的Hash码值总是相同的。我们首先想到的就是把hash值对数组长度取模运算，这样一来，元素的分布相对来说是比较均匀的。但是，模运算的消耗还是比较大的，在HashMap中是这样做的：在HashMap中底层数组的长度总是2的n次方这个前提下，通过`h & (table.length -1)`运算得到的结果和`h % length`得到的结果一致，但是`&`比`%`具有更高的效率。

`h & (table.length -1)`运算得到的结果和`h % length`得到的结果一致,测试案例:

```java
public class TestClass02 {
    public static void main(String[] args) {
        int i = "zyh".hashCode();
        boolean xd = isXD(4,i);
        System.out.println("判断是否相等："+xd);

    }
    
    public static boolean isXD(int length,int key){
        int pow = (int) Math.pow(2, (double) length); //2的次方
        int qy = key % pow;
        int yy = key & (pow -1);
        System.out.println("hashCode:"+key);
        System.out.println("长度："+pow);
        System.out.println("%取模值:"+qy);
        System.out.println("&取模值:"+yy);
        return qy == yy;
    }
}
```

结果：

```java
hashCode:121097
长度：16
%取模值:9
&取模值:9
判断是否相等：true
```

补充：第二步`(h = k.hashCode()) ^ (h >>> 16)`高位参与运算的目的，这么做可以在数组table的length比较小的时候，也能保证考虑到高低Bit都参与到Hash的计算中，同时不会有太大的开销，元素的分布相对来说是比较均匀的。

#### 1.3 HashMap的put方法

HashMap的put方法：

```java
public V put(K key, V value) {
     // 对key的hashCode()做hash
    return putVal(hash(key), key, value, false, true);
}
```

```java
final V putVal(int hash, K key, V value, boolean onlyIfAbsent,boolean evict) {
    Node<K,V>[] tab; Node<K,V> p; int n, i;
	// 步骤①：tab为空则创建
	if ((tab = table) == null || (n = tab.length) == 0)
         n = (tab = resize()).length;
	// 步骤②：计算index，并对null做处理 
    if ((p = tab[i = (n - 1) & hash]) == null) 
         tab[i] = newNode(hash, key, value, null);
    else {
         Node<K,V> e; K k;
         // 步骤③：节点key存在，直接覆盖value
         if (p.hash == hash && ((k = p.key) == key || (key != null && key.equals(k))))
             e = p;
         // 步骤④：判断该链为红黑树
         else if (p instanceof TreeNode)
             e = ((TreeNode<K,V>)p).putTreeVal(this, tab, hash, key, value);
         // 步骤⑤：该链为链表
         else {
            for (int binCount = 0; ; ++binCount) {
                if ((e = p.next) == null) {
                     p.next = newNode(hash, key,value,null);
                     //链表长度大于8转换为红黑树进行处理
                     if (binCount >= TREEIFY_THRESHOLD - 1) // -1 for 1st  
                        treeifyBin(tab, hash);
                     break;
                }
                // key已经存在直接覆盖value
                if (e.hash == hash && ((k = e.key) == key || (key != null && key.equals(k))))                                          break;
                   p = e;
             }
         }
         
        if (e != null) { // existing mapping for key
             V oldValue = e.value;
             if (!onlyIfAbsent || oldValue == null)
                   e.value = value;
             afterNodeAccess(e);
             return oldValue;
        }
	}
    ++modCount;
    // 步骤⑥：超过最大容量就扩容
    if (++size > threshold)
         resize();
    afterNodeInsertion(evict);
    return null;
}
```

![image-20230320143655706](http://img.zouyh.top/article-img/20240917134941111.png)

①.判断键值对数组table[i]是否为空或为null，否则执行resize()进行扩容；

②.根据键值key计算hash值得到插入的数组索引i，如果table[i]==null，直接新建节点添加，转向⑥，如果table[i]不为空，转向③；

③.判断table[i]的首个元素是否和key一样，如果相同直接覆盖value，否则转向④，这里的相同指的是hashCode以及equals；

④.判断table[i] 是否为treeNode，即table[i] 是否是红黑树，如果是红黑树，则直接在树中插入键值对，否则转向⑤；

⑤.遍历table[i]，判断链表长度是否大于8，大于8的话把链表转换为红黑树，在红黑树中执行插入操作，否则进行链表的插入操作；遍历过程中若发现key已经存在直接覆盖value即可；

⑥.插入成功后，判断实际存在的键值对数量size是否超多了最大容量threshold，如果超过，进行扩容。

#### 1.4 扩容

​	扩容(resize)就是重新计算容量，向HashMap对象里不停的添加元素，而HashMap对象内部的数组无法装载更多的元素时，对象就需要扩大数组的长度，以便能装入更多的元素。当然Java里的数组是无法自动扩容的，方法是使用一个新的数组代替已有的容量小的数组，就像我们用一个小桶装水，如果想装更多的水，就得换大水桶。

我们分析下resize的源码，鉴于JDK1.8融入了红黑树，较复杂，为了便于理解我们仍然使用JDK1.7的代码，好理解一些，本质上区别不大，具体区别后文再说。

```java
void resize(int newCapacity) {   // 传入新的容量
     Entry[] oldTable = table;    // 引用扩容前的Entry数组
     int oldCapacity = oldTable.length;         
     if (oldCapacity == MAXIMUM_CAPACITY) {  // 扩容前的数组大小如果已经达到最大(2^30)了
         threshold = Integer.MAX_VALUE; // 修改阈值为int的最大值(2^31-1)，这样以后就不会扩容了
         return;
     }
  
     Entry[] newTable = new Entry[newCapacity];  // 初始化一个新的Entry数组
     transfer(newTable);                         // 将数据转移到新的Entry数组里
     table = newTable;                           // HashMap的table属性引用新的Entry数组
     threshold = (int)(newCapacity * loadFactor);// 修改阈值
}
```

这里就是使用一个容量更大的数组来代替已有的容量小的数组，transfer()方法将原有Entry数组的元素拷贝到新的Entry数组里，`transfer(newTable);  `去掉了一些冗余的代码， 层次结构更加清晰

```java
void transfer(Entry[] newTable, boolean rehash) {
	int newCapacity = newTable.length;
	for (Entry<K,V> e : table) { // 遍历老的桶数组
        while(null != e) {
            Entry<K,V> next = e.next; // 临时记录下一个将要遍历的 
            if (rehash) {
                e.hash = null == e.key ? 0 : hash(e.key);
            }
            int i = indexFor(e.hash, newCapacity);// 计算出在新的桶数组的位置
            e.next = newTable[i];// e放在头部，将该位置的链表接在e的后面
            newTable[i] = e;// 用e替代原来的。
            e = next; // 转移e到下一个节点， 继续循环下去
        }
    }
}
```

下面我们讲解下JDK1.8做了哪些优化。经过观测可以发现，我们使用的是2次幂的扩容(指长度扩为原来2倍)时，元素的位置要么是在原位置，要么是在原位置再移动2次幂的位置。看下图可以明白这句话的意思，n为table的长度，图（a）表示扩容前的key1和key2两种key确定索引位置的示例，图（b）表示扩容后key1和key2两种key确定索引位置的示例，其中hash1是key1对应的哈希与高位运算结果。

![image-20230320151156826](http://img.zouyh.top/article-img/20240917134941112.png)

假设，原来容量是2的4次方，扩容后容量是2的5次方，元素在重新计算hash之后，因为n变为2倍，那么n-1的mark范围在高位多1bit(下图红色)，因此新的index就会发生这样的变化：

<img src="http://img.zouyh.top/article-img/20240917134942114.png" alt="image-20230320151213924" style="zoom:80%;" />

因此，我们在扩充HashMap的时候，不需要像JDK1.7的实现那样重新计算hash，只需要看看原来的hash值转化为二进制后，如果容量是2的4次方就是第4位，容量是2的5次方就是第5位，判断这一位的值是1还是0就好了，是0的话索引没变，是1的话索引变成`原索引+老的容量`，这个设计确实非常的巧妙，既省去了重新计算hash值的时间，而且同时，由于新增的1bit是0还是1可以认为是随机的，因此resize的过程，均匀的把之前的冲突的节点分散到新的bucket了。这一块就是JDK1.8新增的优化点。有一点注意区别，JDK1.7中rehash的时候，旧链表迁移新链表的时候，如果在新表的数组索引位置相同，则链表元素会倒置，因为采用的是头插法，但是从上图可以看出，JDK1.8不会倒置。

#### 1.5 线程不安全

在多线程使用场景中，应该尽量避免使用线程不安全的HashMap，而使用线程安全的ConcurrentHashMap。那么为什么说HashMap是线程不安全的，下面举例子说明在并发的多线程使用场景中使用HashMap可能造成死循环。代码例子如下(便于理解，仍然使用JDK1.7的环境)，JDK1.7老map数据转移到新扩容map逻辑：

```java
while(null != e) {
     Entry next = e.next;//第一行，线程1执行到此被调度挂起
     int i = indexFor(e.hash, newCapacity); // 第二行
     e.next = newTable[i];// 第三行
     newTable[i] = e;// 第四行
     e = next;// 第五行
}
```

线程1执行完挂第一行后起，此时线程1的状态应该还是扩容之前的状态：然后线程2开始扩容并完成扩容后的状态：

![image-20230320161518019](http://img.zouyh.top/article-img/20240917134942115.png)

从上面的图我们可以看到，线程1执行完挂第一行后起，对于线程1而言，线程二完成扩容后，线程1e指依然指向了 key(3)，线程1的next指依然指向了key(7)。

假设此时线程1被唤醒了，开始继续扩容： e是 key(3）不是null，开始执行第二行

①，现在e指向了 key(3)，首先执行`e.next = newTable[i]`，于 key(3)的next指向了线程1的新Hash表，因为新Hash表为空，所以e.next = null。

②，执行`newTable[i] = e`，线程1的新 Hash 表第一个元素指向了线程2新Hash 表的key(3)。

③，执行`e = next`，因为线程1执行完挂第一行后起，对于线程1而言next = key(7) ，所以新e是 key(7)。

<img src="http://img.zouyh.top/article-img/20240917134940110.png" alt="image-20230320162650737" style="zoom:80%;" />



再次循环： e是 key(7）不是null

①，现在的e节点是key(7)，首先执行`Entry next = e.next`,那么 next 就是 key(3)了，next就成了key(3)

②，执行`e.next = newTable[i]`，于是e.next的key(3)

③，执行`newTable[i] = e`，那么线程1的新Hash表第一个元素变成 key(7)    

④，执行`e = next`，将 e 指向 next，所以新的 e是key(3)

<img src="http://img.zouyh.top/article-img/20240917134942116.png" alt="image-20230320163053439" style="zoom:80%;" />

再再次循环：e是key(3)，不是null

①，现在的 e 节点是 key(3)，首先执行Entry next = e.next,那么 next 就是 null

③，执行`e.next = newTable[i]`，于是key(3)的next就成了key(7)

④，执行`newTable[i] = e`，那么线程1的新 Hash表第一个元素变成了key(3)

⑤，执行`e = next`，将e指向next所以新的e是null

<img src="http://img.zouyh.top/article-img/20240917134941113.png" alt="image-20230320163848338" style="zoom:80%;" />

但是很明显，环形链表出现了。当我调用需要遍历这个链表就产生了死循环。

hashmap不安全的原因：

- 扩容时产生死链外，参考上面流程，此问题在JDK 1.7存在，JDK1.8使用尾插法插入元素，在扩容时会保持链表元素原本的顺序，不会出现环形链表的问题。
- 多线程put导致元素丢失，多线程同时执行 put 操作，如果计算出来的索引位置是相同的，那会造成前一个 key 被后一个 key 覆盖，从而导致元素的丢失。此问题在JDK 1.7和 JDK 1.8 中都存在。
- put和get并发时，可能导致get为null，线程1执行put时，因为元素个数超出threshold而导致rehash，线程2此时执行get，有可能导致这个问题。此问题在JDK 1.7和 JDK 1.8 中都存在。

