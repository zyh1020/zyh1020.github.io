---
icon: file-lines
# 标题
title: 'Redis持久化'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-21
# 一个页面可以有多个分类
category:
  - Redis
# 一个页面可以有多个标签
tag:
  - 进阶
  - Redis
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

Redis 提供了2个不同形式的持久化方式，RDB和AOF。

### 一，RDB

>  RDB是指在指定的时间间隔内将内存中的数据集快照写入磁盘， 也就是快照的方式，它恢复时是将快照文件直接读到内存里。

#### 1.1 配置

RDB持久化方式默认是开启的，下面介绍的是RDB持久化方式的其它配置，需要编辑`redis.conf`文件：

①，配置时间间隔：

```properties
# 含义：在900秒内如果有1个key发生了改变就保存数据
save 900 1
```

②，配置快照文件存储目录，查找dir

```properties
# 默认是redis.conf的所在目录
dir ./
```

③，配置快照文件存储名称，查找dump.rdb文件

```properties
# 默认名称是dump.rdb
dbfilename dump.rdb
```

执行`flushall`命令，也会产生`dump.rdb`文件，但里面是空的，无意义.

④,其它默认配置：

```properties
# 当Redis无法写入磁盘的话，直接关掉Redis的写操，推荐yes
stop-writes-on-bgsave-erro yes
# 压缩文件，redis会采用LZF算法进行压缩
rdbcompression yes
# 检查完整性，可以让redis使用CRC64算法来进行数据校验
rdbchecksum yes
```

#### 1.2 命令 save 和 bgsave

手动执行`save`和`bgsave`命令可以直接生成RDB快照文件，不需要满足redis.conf文件中配置的时间间隔。

`save`与`bgsave`对比：

| **命令**              | **save**         | **bgsave**               |
| --------------------- | ---------------- | ------------------------ |
| IO类型                | 同步             | 异步                     |
| 是否阻塞redis其它命令 | 是               | 否                       |
| 复杂度                | O(n)             | O(n)                     |
| 优点                  | 不会消耗额外内存 | 不阻塞客户端命令         |
| 缺点                  | 阻塞客户端命令   | 需要fork子进程，消耗内存 |

#### 1.3 原理

​	Redis会根据主线程Fork一个子进程来进行持久化。在子进程持久化过程中，子进程会读取主线程的内存数据，并把它们写入 RDB 文件。此时，如果主线程对这些数据也都是读操作，那么，主线程和 `bgsave` 子进程相互不影响。但是，如果主线程要修改一块数据，那么，这块数据就会被复制一份，生成该数据的副本，然后`bgsave`子进程会把这个副本数据写入 RDB 文件，而在这个过程中，主线程仍然可以直接修改原来的数据。

- Fork的作用是复制一个与当前进程一样的进程。新进程的所有数据（变量、环境变量、程序计数器等） 数值都和原进程一致，但是是一个全新的进程，并作为原进程的子进程
- 在Linux程序中，fork()会产生一个和父进程完全相同的子进程，但子进程在此后多会exec系统调用，出于效率考虑，Linux中引入了写时复制技术
- 一般情况父进程和子进程会共用同一段物理内存，只有进程空间的各段的内容要发生变化时，才会将父进程的内容复制一份给子进程。

### 二，AOF

​	以日志的形式来记录每个写操作（增量保存），将Redis执行过的所有写指令记录下来(读操作不记录)， 只许追加文件但不可以改写文件，它恢复时是日志文件的内容将写指令从前到后执行一次以完成数据的恢复工作。

#### 2.1 配置

①，AOF默认是不开启的，需要修改`redis.conf`文件:

```properties
# appendonly yes
```

②，配置同步频率：

```properties
appendfsync everysec
```

 `appendfsync`有三个选项：    

- `appendfsync always`：每次有新命令追加到 AOF 文件时就执行一次 fsync ，非常慢，但是非常安全。
- `appendfsync everysec`：每秒 fsync 一次，足够快，并且在故障时只会丢失1 秒钟的数据。 
- `appendfsync no`：从不主动 fsync ，将数据交给操作系统来处理。更快，也更不安全的选择。              

③，配置文件名称，默认为` appendonly.aof`

```properties
appendfilename appendonly.aof
```

④，配置文件路径，AOF文件的保存路径和RDB的路径使用的是同样的配置：

```properties
# 默认是redis.conf的所在目录
dir ./
```

#### 2.2 重写机制

​	Redis 在长期运行的过程中，aof 文件会越变越长。如果机器宕机重启，“重演”整个 aof 文件会非常耗时，导致长时间 Redis 无法对外提供服务。因此就需要对 aof 文件做一下“瘦身”运动。

方式一：手动触发重写机制

手动执行`bgrewriteaof`命令，如下所示：

```cmd
127.0.0.1:6379> BGREWRITEAOF
Background append only file rewriting started
```

方式二：自动触发重写机制

在`redis-config`文件中，提供如下两个配置可以控制AOF自动重写频率：

```properties
# aof文件至少要达到64M才会自动重写，文件太小恢复速度本来就很快，重写的意义不大
auto-aof-rewrite-min-size 64mb  
# aof文件自上一次重写后文件大小增长了100%则再次触发重写
auto-aof-rewrite-percentage 100
```

手动触发或自动触发的方式，服务器会生成一个新的 aof 文件，该文件具有以下特点：

- 新的 aof 文件记录的数据库数据和原 aof 文件记录的数据库数据完全一致；
- 新的 aof 文件会使用尽可能少的命令来记录数据库数据，因此新的 aof 文件的体积会小很多；
- AOF 重写期间，服务器不会被阻塞，它可以正常处理客户端发送的命令。

重写机制AOF文件对比：

| 原有aof文件逻辑 | 重写后aof文件逻辑   |
| --------------- | ------------------- |
| incr readcount  | incrby  readcount 5 |
| incr readcount  |                     |
| incr readcount  |                     |
| incr readcount  |                     |
| incr readcount  |                     |

### 三 ，RDB和AOF

**①，AOF和RDB同时开启，redis听谁的？**

​	AOF和RDB同时开启，系统默认取AOF的数据（数据不会存在丢失）

②，**RDB 和 AOF ，我应该用哪一个？**

| **命令**   | **RDB**    | **AOF**      |
| ---------- | ---------- | ------------ |
| 启动优先级 | 低         | 高           |
| 体积       | 小         | 大           |
| 恢复速度   | 快         | 慢           |
| 数据安全性 | 容易丢数据 | 根据策略决定 |

​	官方推荐两个都启用，如果对数据不敏感，可以选单独用RDB，不建议单独用 AOF，因为可能会出现Bug。如果只是做纯内存缓存，可以都不用。

**③，Redis 4.0 混合持久化**

重启 Redis 时，我们很少使用 RDB来恢复内存状态，因为会丢失大量数据。我们通常使用 AOF 日志重放，但是重放 AOF 日志性能相对 RDB来说要慢很多，这样在 Redis 实例很大的情况下，启动需要花费很长的时间。 Redis 4.0 为了解决这个问题，带来了一个新的持久化选项——混合持久化。

通过如下配置可以开启混合持久化(必须先开启aof)：

```properties
# aof-use-rdb-preamble yes
```

如果开启了混合持久化，AOF在重写时，不再是单纯将内存数据转换为RESP命令写入AOF文件，而是将重写这一刻之前的内存做RDB快照处理，并且将RDB快照内容和增量的,AOF修改内存数据的命令存在一起，都写入新的AOF文件，新的文件一开始不叫appendonly.aof，等到重写完新的AOF文件才会进行改名，覆盖原有的AOF文件，完成新旧两个AOF文件的替换,

于是在 Redis 重启的时候，可以先加载 RDB 的内容，然后再重放增量 AOF 日志就可以完全替代之前的 AOF 全量文件重放，因此重启效率大幅得到提升。混合持久化AOF文件结构如下:

<img src="http://img.zouyh.top/article-img/20240917135017203.png" alt="image-20230302182343662" style="zoom:80%;" />

 **④，Redis数据备份策略：**

1. 写crontab定时调度脚本，每小时都copy一份rdb或aof的备份到一个目录中去，仅仅保留最近48小时的备份
2. 每天都保留一份当日的数据备份到一个目录中去，可以保留最近1个月的备份
3. 每次copy备份的时候，都把太旧的备份给删了
4. 每天晚上将当前机器上的备份复制一份到其他机器上，以防机器损坏
