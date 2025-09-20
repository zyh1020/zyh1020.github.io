---
icon: file-lines
title: Redis发布订阅，锁和事务
author: Ms.Zyh
date: 2024-05-04
category:
  - Redis
tag:
  - 进阶
  - Redis
sticky: false
star: false
---

### 一，发布和订阅

Redis 发布订阅 (pub/sub) 是一种消息通信模式：发送者 (pub) 发送消息，订阅者 (sub) 接收消息。Redis 客户端可以订阅任意数量的频道：

![image-20230302150557562](http://img.zouyh.top/article-img/20240917135017202.png)

#### 1.1 命令

```cmd
-- 订阅命令
subscribe [频道名称] [频道名称] [频道名称....]
-- 取消订阅命令
unsubscribe
-- 发布信息
publish [频道名称] [信息]
```

#### 1.2 演示

①，打开一个客户端A订阅channel1：

```cmd
127.0.0.1:6379> subscribe channel1
Reading messages... (press Ctrl-C to quit)
1) "subscribe"
2) "channel1"
3) (integer) 1
```

②，再打开另一个客户端B，给channel1发布消息hello：

```cmd
127.0.0.1:6379> publish channel1 hello
(integer) 1
127.0.0.1:6379>
```

返回的1是表示订阅者数量。

③，回到客户端A可以看到发送的消息

```java
127.0.0.1:6379> subscribe channel1
Reading messages... (press Ctrl-C to quit)
1) "subscribe"
2) "channel1"
3) (integer) 1
1) "message"
2) "channel1"
3) "hello"
```

④，再打开另一个客户端C，也订阅channel1：

```cmd
127.0.0.1:6379> subscribe channel1
Reading messages... (press Ctrl-C to quit)
1) "subscribe"
2) "channel1"
3) (integer) 1
```

新订阅的客户端C并没收到，客户端B给channel1发布消息hello，说明发布的消息没有持久化，只能收到订阅后发布的消息。

总结：

Redis发布订阅与ActiveMQ的比较：

- ActiveMQ支持多种消息协议，包括AMQP，MQTT，Stomp等，并且支持JMS规范，但Redis没有提供对这些协议的支持；
- ActiveMQ提供持久化功能，但Redis无法对消息持久化存储，一旦消息被发送，如果没有订阅者接收，那么消息就会丢失；
- ActiveMQ提供了消息传输保障，当客户端连接超时或事务回滚等情况发生时，消息会被重新发送给客户端，Redis没有提供消息传输保障。

​	ActiveMQ所提供的功能远比Redis发布订阅要复杂，毕竟Redis不是专门做发布订阅的，但是如果系统中已经有了Redis，并且需要基本的发布订阅功能，就没有必要再安装ActiveMQ了，因为可能ActiveMQ提供的功能大部分都用不到，而Redis的发布订阅机制就能满足需求。

### 二，事务

​	Redis事务是一个单独的隔离操作：事务中的所有命令都会序列化、按顺序地执行。事务在执行的过程中，不会被其他客户端发送来的命令请求所打断。Redis事务的主要作用就是串联多个命令防止别的命令插队。

#### 2.1 命令：

```cmd
 -- 标记一个事务块的开始（ queued ）
 multi
 -- 执行所有事务块的命令 （ 一旦执行exec后，之前加的监控锁都会被取消掉 ）
 exec
 -- 取消事务，放弃事务块中的所有命令
 discard
```

#### 2.2 演示

##### 2.2.1 不需要隔离级别

情况1：组队成功，提交事务

```cmd
127.0.0.1:6379> multi
OK
127.0.0.1:6379> set k1 v1
QUEUED
127.0.0.1:6379> set k2 v2
QUEUED
127.0.0.1:6379> get k2
QUEUED
127.0.0.1:6379> set k3 v3
QUEUED
127.0.0.1:6379> exec
1) OK
2) OK
3) "v2"
4) OK
127.0.0.1:6379> get k1
"v1"
127.0.0.1:6379> get k3
"v3"
```

​	当事务开启时，事务期间的命令并没有执行，而是加入队列，只有执行EXEC命令时，事务中的命令才会按照顺序一一执行，从而事务间就不会导致数据脏读、不可重复读、幻读的问题，因此就没有隔离级别

##### 2.2.2 取消事务

情况2：组队成功，取消事务 

```cmd
127.0.0.1:6379> multi
OK
127.0.0.1:6379> set k1 v1
QUEUED
127.0.0.1:6379> set k2 v2
QUEUED
127.0.0.1:6379> get k2
QUEUED
127.0.0.1:6379> set k3 v3
QUEUED
127.0.0.1:6379> discard
OK
127.0.0.1:6379> get k1
(nil)
127.0.0.1:6379> get k3
(nil)
```

情况3：组队阶段报错，提交失败

```cmd
127.0.0.1:6379> multi
OK
127.0.0.1:6379> set k1 v1
QUEUED
127.0.0.1:6379> set k2
(error) ERR wrong number of arguments for 'set' command
127.0.0.1:6379> get k2
QUEUED
127.0.0.1:6379> set k3 v3
QUEUED
127.0.0.1:6379> exec
(error) EXECABORT Transaction discarded because of previous errors.
127.0.0.1:6379> get k1
(nil)
127.0.0.1:6379> get k3
(nil)
```

​	不管是情况2中的手动取消事务，还是情况3中组队中某个命令出现了报告错误，执行时整个的所有队列都会被取消，这个都是不是回滚事务。Redis事务中也没有提供回滚的支持，官方提供了两个理由，大概的意思就是：

- 使用Redis命令语法错误，或是将命令运用在错误的数据类型键上(如对字符串进行加减乘除等)，从而导致业务数据有问题，这种情况认为是编程导致的错误，应该在开发过程中解决，避免在生产环境中发生；
- 由于不用支持回滚功能，Redis内部简单化，而且还比较快

##### 2.2.3 不保证数据的原子性

情况4：组队成功，提交有成功有失败情况，并不保证数据的原子性（要么都执行成功，要么都失败）。

```cmd
127.0.0.1:6379> multi
OK
127.0.0.1:6379> set k1 v1
QUEUED
127.0.0.1:6379> get k1
QUEUED
127.0.0.1:6379> incr k1
QUEUED
127.0.0.1:6379> set k2 v2
QUEUED
127.0.0.1:6379> get k2
QUEUED
127.0.0.1:6379> exec
1) OK
2) "v1"
3) (error) ERR value is not an integer or out of range
4) OK
5) "v2"
127.0.0.1:6379> get k1
"v1"
127.0.0.1:6379> get k2
"v2"
```

提交后有报错的命令，不会影响正确执行的命令。

总结：

- 单独的隔离操作，没有隔离级别的概念：事务中的所有命令都会序列化、按顺序地执行。事务在执行的过程中，不会被其他客户端发送来的命令请求所打断，队列中的命令没有提交之前都不会实际被执行，因为事务提交前任何指令都不会被实际执行。
- 不保证原子性：事务中如果有一条命令执行失败，其后的命令仍然会被执行，没有回滚

**lua脚本**

Redis在2.6推出了脚本功能，允许开发者使用Lua语言编写脚本传到Redis中执行。使用脚本的好处如下:

- 减少网络开销：本来5次网络请求的操作，可以用一个请求完成，原先5次请求的逻辑放在redis服务器上完成。使用脚本，减少了网络往返时延。这点跟管道类似。
- 原子操作：Redis会将整个脚本作为一个整体执行，中间不会被其他命令插入。管道不是原子的，不过redis的批量操作命令(类似mset)是原子的。
- 替代redis的事务功能：redis自带的事务功能很鸡肋，而redis的lua脚本几乎实现了常规的事务功能，官方推荐如果要使用redis的事务功能可以用redis lua替代

从Redis2.6.0版本开始，通过内置的Lua解释器，可以使用EVAL命令对Lua脚本进行求值。EVAL命令的格式如下：

```sh
EVAL script numkeys key [key ...] arg [arg ...]
```

script参数是一段Lua脚本程序，它会被运行在Redis服务器上下文中，这段脚本不必(也不应该)定义为一个Lua函数。numkeys参数用于指定键名参数的个数。键名参数 key [key ...] 从EVAL的第三个参数开始算起，表示在脚本中所用到的那些Redis键(key)，这些键名参数可以在 Lua中通过全局变量KEYS数组，用1为基址的形式访问( KEYS[1] ， KEYS[2] ，以此类推)。

在命令的最后，那些不是键名参数的附加参数 arg [arg ...] ，可以在Lua中通过全局变量ARGV数组访问，访问的形式和KEYS变量类似( ARGV[1] 、 ARGV[2] ，诸如此类。例如

```cmd
127.0.0.1:6379> eval "return {KEYS[1],KEYS[2],ARGV[1],ARGV[2]}" 2 key1 key2 first second
1) "key1"
2) "key2"
3) "first"
4) "second"
```

其中 `"return {KEYS[1],KEYS[2],ARGV[1],ARGV[2]}" `是被求值的Lua脚本，数字2指定了键名参数的数量， key1和key2是键名参数，分别使用 KEYS[1] 和 KEYS[2] 访问，而最后的 first 和 second 则是附加参数，可以通过 ARGV[1] 和 ARGV[2] 访问它们。

Jedis调用示例: 逻辑将商品10016的库存由15改为10，如果成功返回1，失败返回0

```java
jedis.set("product_stock_10016", "15");  // 初始化商品10016的库存
String script = " local count = redis.call('get', KEYS[1]) " +
                " local a = tonumber(count) " +
                " local b = tonumber(ARGV[1]) " +
                " if a >= b then " +
                "   redis.call('set', KEYS[1], a-b) " +
                "   return 1 " +
                " end " +
                " return 0 ";
Object obj = jedis.eval(script, Arrays.asList("product_stock_10016"), Arrays.asList("10"));
System.out.println(obj);
```

需要注意的时，redis集群执行lua操作的时候，要求key值必须要在同一个solt上面，为了达到这个目的，可以在key值写在{}内容，这样redis在计算hash槽的时候会按{}内的内容计算hash值。



### 三，锁

#### 3.1 锁的分类

- 悲观锁：顾名思义，就是很悲观，每次去拿数据的时候都认为别人会修改，所以每次在拿数据的时候都会上锁，这样别人想拿这个数据就会阻塞，直到拿到锁。
- 乐观锁：顾名思义，就是很乐观，每次去拿数据的时候都认为别人不会修改，所以不会上锁，但是在更新的时候会判断一下在此期间别人有没有去更新这个数据，可以使用版本号等机制。乐观锁适用于多读的应用类型，这样可以提高吞吐量。

#### 3.2 命令

```cmd
-- 监视一个或多个key
watch [key1] [key2...]
--  取消监视一个或多个key
--  WATCH命令之后，EXEC命令或DISCARD命令先被执行了的话，不需要再执行UNWATCH 了。
unwatch [key1] [key2...]
```

#### 3.3 演示

测试1：在执行multi之前，先执行watch key1 [key2],可以监视一个(或多个) key ，如果在事务执行之前这个(或这些) key 被其他命令所改动，那么事务将被打断。

<img src="http://img.zouyh.top/article-img/20240917135017201.png" alt="image-20230302165724929" style="zoom: 67%;" />
