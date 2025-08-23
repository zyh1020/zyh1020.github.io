---
icon: document
# 标题
title: 'ConcurrentHashMap分段锁'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-20
# 一个页面可以有多个分类
category:
  - 多线程
# 一个页面可以有多个标签
tag:
  - 进阶
  - 多线程
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---



### 一，ConcurrentHashMap分段锁

​	HashTable容器在竞争激烈的并发环境下表现出效率低下的原因，是因为所有访问HashTable的线程都必须竞争同一把锁，那假如容器里有多把锁，每一把锁用于锁容器其中一部分数据，那么当多线程访问容器里不同数据段的数据时，线程间就不会存在锁竞争，从而可以有效的提高并发访问效率，这就是ConcurrentHashMap所使用的锁分段技术，首先将数据分成一段一段的存储，然后给每一段数据配一把锁，当一个线程占用锁访问其中一个段数据的时候，其他段的数据也能被其他线程访问。有些方法需要跨段，比如size()和containsValue()，它们可能需要锁定整个表而而不仅仅是某个段，这需要按顺序锁定所有段，操作完毕后，又按顺序释放所有段的锁。这里“按顺序”是很重要的，否则极有可能出现死锁，在ConcurrentHashMap内部，段数组是final的，并且其成员变量实际上也是final的，但是，仅仅是将数组声明为final的并不保证数组成员也是final的，这需要实现上的保证。这可以确保不会出现死锁，因为获得锁的顺序是固定的。JDK1.8的实现已经抛弃了Segment分段锁机制，利用CAS+Synchronized来保证并发更新的安全。

#### 1.1 源码原理分析

​	ConcurrentHashMap 中维护着一个 Segment 数组，Segment 中有维护着一个 HashEntry 的数组，所以 ConcurrentHashMap 的底层数据结构可以理解为：数组 + 数组 + 链表

```java
public class ConcurrentHashMap<K, V> extends AbstractMap<K, V>
        implements ConcurrentMap<K, V>, Serializable {
    private static final long serialVersionUID = 7249069246763182397L;
 
    // 分段数组，每一段都是一个 hash 表
    final Segment<K,V>[] segments;
}
static final class Segment<K,V> extends ReentrantLock implements Serializable {
    // 每段中的表
    transient volatile HashEntry<K,V>[] table;
}
```

​	ConcurrentHashMap是由Segment数组结构和HashEntry数组结构组成。Segmen继承了ReentrantLock，在ConcurrentHashMap里扮演锁的角色，HashEntry则用于存储键值对数据。一个ConcurrentHashMap里包含一个Segment数组，Segment的结构和HashMap类似，是一种数组和链表结构， 一个Segment里包含一个HashEntry数组，每个HashEntry是一个链表结构的元素， 每个Segment守护者一个HashEntry数组里的元素,当对HashEntry数组的数据进行修改时，必须首先获得它对应的Segment锁。

![image-20230227163809621](http://img.zouyh.top/article-img/20240917135055310.png)

从 put 的源码中看分段锁的具体实现

```java
public class ConcurrentHashMap<K, V> extends AbstractMap<K, V>
        implements ConcurrentMap<K, V>, Serializable {
    public V put(K key, V value) {
        Segment<K,V> s;
        if (value == null)// 判断 value 是否为 null ，为 null 则直接抛出空指针异常
            throw new NullPointerException();
        int hash = hash(key);
        int j = (hash >>> segmentShift) & segmentMask;// 获取分段锁的下标
        if ((s = (Segment<K,V>)UNSAFE.getObject          
             (segments, (j << SSHIFT) + SBASE)) == null) // 从 Segment 数组中获取该下标的分段对象
            s = ensureSegment(j);// 如果分段不存在则创建一个新的分段
        return s.put(key, hash, value, false);// 调用 Segement 的 put 方法
    }
}
```

继续跟进`s.put(key, hash, value, false)`方法：

```java
static final class Segment<K,V> extends ReentrantLock implements Serializable {
        
    final V put(K key, int hash, V value, boolean onlyIfAbsent) {
        // tryLock()方法获取锁，如果获取成功则创建一个临时节点 node = null
        // 如果获取失败，则调用 scanAndLockForPut 循环获取
        HashEntry<K,V> node = tryLock() ? null :
           scanAndLockForPut(key, hash, value);
        V oldValue;
        try {
            HashEntry<K,V>[] tab = table;
            int index = (tab.length - 1) & hash;// 获取在分段中的索引
            HashEntry<K,V> first = entryAt(tab, index);// 根据索引获取链表的首节点
            for (HashEntry<K,V> e = first;;) { // 遍历链表
                if (e != null) {
                    K k;
                    if ((k = e.key) == key ||
                        (e.hash == hash && key.equals(k))) {
                        oldValue = e.value;
                        if (!onlyIfAbsent) {
                            e.value = value;
                            ++modCount;
                        }
                        break;
                    }
                    e = e.next;
                }
                else {// 遍历完未找到相同的 key
                    if (node != null)  // 将新节点设置为链表头
                        node.setNext(first);
                    else
                        node = new HashEntry<K,V>(hash, key, value, first);
                    int c = count + 1;
                    
                    if (c > threshold && tab.length < MAXIMUM_CAPACITY)// 判断是否需要扩容
                        rehash(node);// 扩容
                    else
                        setEntryAt(tab, index, node); // 更新数组
                    ++modCount;
                    count = c;
                    oldValue = null;
                    break;
                }
            }
        } finally {
            unlock(); // 释放锁
        }
        return oldValue; // 如果 key 存在，更新 value，返回旧 value
    }
 
    // 如果获取失败，则调用 scanAndLockForPut 循环获取
    private HashEntry<K,V> scanAndLockForPut(K key, int hash, V value) {
        HashEntry<K,V> first = entryForHash(this, hash);
        HashEntry<K,V> e = first;
        HashEntry<K,V> node = null;
        int retries = -1; 
        while (!tryLock()) { // 如果第一次获取锁就成功，则直接返回一个 node = null
            HashEntry<K,V> f; 
            if (retries < 0) {// 遍历一次链表，后面检查到链表被其他线程修改，会重新遍历
                if (e == null) {
                    if (node == null) 
                        node = new HashEntry<K,V>(hash, key, value, null);
                    retries = 0;
                }
                else if (key.equals(e.key))
                    retries = 0;
                else
                    e = e.next;
            }
            else if (++retries > MAX_SCAN_RETRIES) { // 尝试获取的次数大于 64，则加互排锁，并结束循环
                lock();
                break;
            }
            // 尝试的次数为偶数时判断一下，是否链表被其他线程改变，如果修改了，则重新遍历
            else if ((retries & 1) == 0 &&
                        (f = entryForHash(this, hash)) != first) {
                e = first = f; 
                retries = -1;
            }
        }
        return node;
    }
 
    private void scanAndLock(Object key, int hash) {
        HashEntry<K,V> first = entryForHash(this, hash);
        HashEntry<K,V> e = first;
        int retries = -1;
        while (!tryLock()) {
            HashEntry<K,V> f;
            if (retries < 0) {
                if (e == null || key.equals(e.key))
                    retries = 0;
                else
                    e = e.next;
            }
            else if (++retries > MAX_SCAN_RETRIES) {
                lock();
                break;
            }
            else if ((retries & 1) == 0 &&
                        (f = entryForHash(this, hash)) != first) {
                e = first = f;
                retries = -1;
            }
        }
    }
}
```

put的完整流程

![img](http://img.zouyh.top/article-img/20240917135055311.png)

