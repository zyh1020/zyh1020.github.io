---
icon: file-lines
title: Redis主从，哨兵和集群模式
author: Ms.Zyh
date: 2024-01-24
category:
  - Redis
tag:
  - 推荐
  - Redis
sticky: false
star: false
---

### 一，Redis的主从复制

​	主机数据更新后根据配置和策略， 自动同步到备机的master/slaver机制，Master以写为主，Slave以读为主。这样做的好处是读写分离，性能扩展，容灾快速恢复。

<img src="http://img.zouyh.top/article-img/20240917135019207.png" alt="image-20230303101109512" style="zoom:80%;" />

#### 1.1 环境搭建

如果你的redis在不同的服务器上，可以不看同一台服务器上启动多个redis的实现步骤：

将redis的配置文件redis.conf到/myredis文件夹中：

```cmd
cp redis.conf /myredis/redis.conf
```

编辑拷贝后的redis.conf文件，查找`bing 127.0.0.1`配置有没有注释掉，没有的话，自己注释了

```
vi /myredis/redis.conf
```

在/myredis文件夹中，新建redis6379.conf，填写以下内容：

```properties
include /myredis/redis.conf
pidfile /var/run/redis_6379.pid
daemonize yes
port 6379
logfile "6379.log"
dir ./6379
```

解释：

- `daemonize yes`：daemonize守护线程，默认是NO、daemonize是用来指定redis是否要用守护线程的方式启动，
- `include`：表示引入redis.conf的配置。
- `pidfile` ：使用该配置文件启动后，redis的线程id。
- `port`： 使用该配置文件启动后，redis的端口。
- `logfile`：使用该配置文件启动后，日志生成文件名称。
- `dir`：使用该配置文件启动后，RDB和AOF数据持久化生成的文件路径。

同样的方式在/myredis文件夹中，新建redis6380.conf，填写以下内容：

```properties
include /myredis/redis.conf
pidfile /var/run/redis_6380.pid
daemonize yes
port 6380
logfile "6379.log"
dir ./6379
```

在/myredis文件夹中，新建redis6381.conf，填写以下内容：

```properties
include /myredis/redis.conf
pidfile /var/run/redis_6381.pid
daemonize yes
port 6381
logfile "6381.log"
dir ./6381
```

 启动三台redis服务器在/myredis文件夹中，输入如下命令：        

```sh
redis-server redis6379.conf 
redis-server redis6380.conf 
redis-server redis6381.conf 
```

查看系统进程，看看三台服务器是否启动：

```cmd
ps -ef | grep redis
```

到这就通过生成三个不同的redis.conf文件启动了，三台不同的redis。

**配置主从关系**

在配置主从关系之前，先查看三台主机运行情况，通过如下命令连接三台主机：

```
redis-cli -p 端口   
```

连接成功后，通过如下命令查看当前redis的主从复制的相关信息：

```
info replication
```

![image-20230303104649136](http://img.zouyh.top/article-img/20240917135019208.png)

可以看出在没有配置，主从关系前，上图中`role:master`都是主库.

配置主从关系，只需要配置从库不需要主库，也就是说从库只需要认主即可，认主的命令是：

```cmd
-- 5.0之前命令
slaveof <ip> <port>
-- 5.0之后命令
replicaof <ip> <port>
```

通过命令的方式，只是在当前链接有效，重启redis后就不行了，如果想要一直生效，可以在对应的配置文件中添加如下内容：

```properties
# 5.0之前
slaveof <ip> <port>
# 5.0之后
replicaof <ip> <port> 
replica-read-only yes  
```

假设在6380和6381上执行命令或者在redis6380.conf和redis6381.conf文件中添加了内容后：

![image-20230303105610726](http://img.zouyh.top/article-img/20240917135018205.png)

从上截图可以看到6380和6381的角色变成了slave。

#### 1.2 原理解析

​	如果你为master配置了一个slave，不管这个slave是否是第一次连接上Master，它都会发送一个PSYNC命令给master请求复制数据。master收到PSYNC命令后，会在后台进行数据持久化通过bgsave生成最新的rdb快照文件，持久化期间，master会继续接收客户端的请求，它会把这些可能修改数据集的请求缓存在内存中。当持久化进行完毕以后，master会把这份rdb文件数据集发送给slave，slave会把接收到的数据进行持久化生成rdb，然后再加载到内存中。然后，master再将之前缓存在内存中的命令发送给slave。

​	当master与slave之间的连接由于某些原因而断开时，slave能够自动重连Master，如果master收到了多个slave并发连接请求，它只会进行一次持久化，而不是一个连接一次，然后再把这一份持久化的数据发送给多个并发连接的slave。

全量复制：

<img src="http://img.zouyh.top/article-img/20240917135018204.png" alt="image-20230303105900585" style="zoom:67%;" />

​	当master和slave断开重连后，一般都会对整份数据进行复制。但从redis2.8版本开始，redis改用可以支持部分数据复制的命令PSYNC去master同步数据，slave与master能够在网络连接断开重连后只进行部分数据复制(断点续传)。

​	master会在其内存中创建一个复制数据用的缓存队列，缓存最近一段时间的数据，master和它所有的slave都维护了复制的数据下标offset和master的进程id，因此，当网络连接断开后，slave会请求master继续进行未完成的复制，从所记录的数据下标开始。如果master进程id变化了，或者从节点数据下标offset太旧，已经不在master的缓存队列里了，那么将会进行一次全量数据的复制。

部分复制，断点续传流程图：

<img src="http://img.zouyh.top/article-img/20240917135020211.png" alt="image-20230303110008991" style="zoom:67%;" />

​	如果有很多从节点，为了缓解主从复制风暴(多个从节点同时复制主节点导致主节点压力过大)，可以做如下架构，上一个Slave可以是下一个slave的Master，Slave同样可以接收其他 slaves的连接和同步请求，那么该slave作为了链条中下一个的master, 可以有效减轻master的写压力,去中心化降低风

<img src="http://img.zouyh.top/article-img/20240917135019209.png" alt="image-20230303110309672" style="zoom:67%;" />

### 二，Redis的哨兵模式

​	主从复制的好处是读写分离，性能扩展，容灾快速恢复，但是只有一个Master，也只有它能够写数据，当这个Master不能工作时，主从复制的集群就不能工作了，为了解决这个问题，redis引入了哨兵模式。

![image-20230303115108125](http://img.zouyh.top/article-img/20240917135019210.png)

​	sentinel哨兵是特殊的redis服务，不提供读写服务，主要用来监控redis实例节点。哨兵架构下client端第一次从哨兵找出redis的主节点，后续就直接访问redis的主节点，不会每次都通过sentinel代理访问redis的主节点，当redis的主节点发生变化，哨兵会第一时间感知到，并且将新的redis主节点通知给client端(这里面redis的client端一般都实现了订阅功能，订阅sentinel发布的节点变动消息)

#### 2.1 环境搭建

在/myredis目录下新建多个sentinel.conf文件：

```sh
vim /myredis/sentinel-26379.conf
```

添加如下内容：

```properties
port 26379
daemonize yes
pidfile "/var/run/redis-sentinel-26379.pid"
logfile "26379.log"
dir "./26379"
sentinel monitor mymaster 166.66.66.66 6379 2 
```

- `daemonize yes`：daemonize守护线程，默认是NO、daemonize是用来指定redis是否要用守护线程的方式启动，可以查看redis.conf是如何配置的如果是NO，改为yes。
- `pidfile` ：使用该配置文件启动后，redis的线程id。
- `port`： 使用该配置文件启动后，redis的端口。
- `logfile`：使用该配置文件启动后，日志生成文件名称。
- `dir`：使用该配置文件启动后，RDB和AOF数据持久化生成的文件路径。
- `sentinel monitor`：表示当前redis是哨兵、mymaster是随便起的名字，`136.66.66.66`是监视的Master的ip，6379是监视的Master的port，2代表2位哨兵同意才可以。

 启动sentinel哨兵实例

```cmd
src/redis-sentinel sentinel-26379.conf 
```

同样的流程，可以自己再配置两个sentinel，端口26380和26381，只需要将上述配置文件名和文件内容里的对应数字都修改即可。

同样可以通过如下命令查看sentinel的info信息             

```cmd
> src/redis-cli -p 26379
127.0.0.1:26379>info replication
```

​	sentinel集群都启动完毕后，会将哨兵集群的元数据信息写入所有sentinel的配置文件里去(追加在文件的最下面) 我们查看下如下配置文件sentinel-26379.conf，如下所示：

```properties
sentinel known-replica mymaster 166.66.66.66 6380 #代表主节点的从节点信息
sentinel known-replica mymaster 166.66.66.66 6381 #代表主节点的从节点信息
sentinel known-sentinel mymaster 166.66.66.66 26380 52d0a5d70c1f9043c56935760f  #代表感知到的其它哨兵节点
sentinel known-sentinel mymaster 166.66.66.66 26381 e9f53ebb8e1686438ba8bd5ca6  #代表感知到的其它哨兵节点
```

​    当redis主节点如果挂了，哨兵集群会重新选举出新的redis主节点，同时会修改所有sentinel节点配置文件的集群元数据信息，比如6379的redis如果挂了，假设选举出的新主节点是6380，则sentinel文件里的集群元数据信息会变成如下所示：        

```properties
sentinel known-replica mymaster 166.66.66.66 6381 #代表主节点的从节点信息
sentinel known-sentinel mymaster 166.66.66.66 26380 52d0a5d70c1f9043c56935760f  #代表感知到的其它哨兵节点
sentinel known-sentinel mymaster 166.66.66.66 26381 e9f53ebb8e1686438ba8bd5ca6  #代表感知到的其它哨兵节点
```

同时还会修改sentinel文件里之前配置的mymaster对应的6379端口，改为6380

```properties
sentinel monitor mymaster 166.66.66.66 6380 2 
```

​	原主机重启后会变为从机，当6379的redis实例再次启动时，哨兵集群根据集群元数据信息就可以将6379端口的redis节点作为从节点加入集群，则sentinel文件里的集群元数据信息会变成如下所示：

```properties
sentinel known-replica mymaster 166.66.66.66 6379 #代表主节点的从节点信息
sentinel known-replica mymaster 166.66.66.66 6381 #代表主节点的从节点信息
sentinel known-sentinel mymaster 166.66.66.66 26380 52d0a5d70c1f9043c56935760f  #代表感知到的其它哨兵节点
sentinel known-sentinel mymaster 166.66.66.66 26381 e9f53ebb8e1686438ba8bd5ca6  #代表感知到的其它哨兵节点
```

#### 2.3 原理解析

​	哨兵的leader选举流程：当一个master服务器被某哨兵视为下线状态后，该哨兵会与其他哨兵协商选出哨兵的leader进行故障转移工作。每个发现master服务器进入下线的哨兵都可以要求其他哨兵选自己成为哨兵的leader，选举是先到先得。同时每个哨兵每次选举都会自增配置纪元(选举周期)，每个纪元中只会选择一个哨兵(包含自己)成为leader。如果所有超过一半的哨兵选举某哨兵作为leader，那么之后该哨兵负责进行故障转移操作，从存活的slave中选举出新的master，这个选举过程跟集群的master选举很类似。 哨兵集群只有一个哨兵节点，redis的主从也能正常运行以及选举master，如果master挂了，那唯一的那个哨兵节点就是哨兵leader了，可以正常选举新master。 不过为了高可用一般都推荐至少部署三个哨兵节点。

​	至于为什么要部署三个哨兵节点：主要是为了满足超过半数的原则又能节约资源，假设有2个哨兵节点，当有一个节点挂了时候，就算另一个节点参加选举，选了自己，也没有超过1不可能成为哨兵leader。假设有4个哨兵节点，当有一个节点挂了时候，还有三个哨兵节点，都选择某一个哨兵有机会超过半数的2的，可以成为哨兵leader，但是这个时候用了4个哨兵节点有点浪费资源。

### 三，集群模式

​	在redis3.0以前的版本要实现集群一般是借助哨兵sentinel工具来监控master节点的状态，如果master节点异 常，则会做主从切换，将某一台slave作为master，哨兵的配置略微复杂，并且性能和高可用性等各方面表现 一般，特别是在主从切换的瞬间存在访问瞬断的情况，而且哨兵模式只有一个主节点对外提供服务，没法支持 很高的并发，且单个主节点内存也不宜设置得过大，否则会导致持久化文件过大，影响数据恢复或主从同步的效率。

![image-20230303152809120](http://img.zouyh.top/article-img/20240917135018206.png)

redis集群是一个由多个主从节点群组成的分布式服务器群，它具有复制、高可用和分片特性。Redis集群不需 要sentinel哨兵∙也能完成节点移除和故障转移的功能。需要将每个节点设置成集群模式，这种集群模式没有中 心节点，可水平扩展，据官方文档称可以线性扩展到上万个节点(官方推荐不超过1000个节点)。redis集群的 性能和高可用性均优于之前版本的哨兵模式，且集群配置非常简单。

#### 3.1 环境搭建

##### 3.1.1 准备多台redis

将redis的配置文件redis.conf到/myredis文件夹中：

```cmd
cp redis.conf /myredis/redis.conf
```

编辑拷贝后的redis.conf文件，查找`bing 127.0.0.1`配置有没有注释掉，没有的话，自己注释了

```
vi /myredis/redis.conf
```

在/myredis文件夹中，新建redis6379.conf，填写以下内容：

```properties
include /myredis/redis.conf
pidfile /var/run/redis_6379.pid
daemonize yes
port 6379
logfile "6379.log"
dir ./6379
cluster-enabled yes
cluster-config-file nodes-6379.conf
cluster-node-timeout 15000
# 如果要设置密码需要增加如下配置：
#设置redis访问密码
requirepass zyh
# 设置集群节点间访问密码，
masterauth zyh
```

解释：

- `daemonize yes`：daemonize守护线程，默认是NO、daemonize是用来指定redis是否要用守护线程的方式启动，
- `include`：表示引入redis.conf的配置。
- `pidfile` ：使用该配置文件启动后，redis的线程id。
- `port`： 使用该配置文件启动后，redis的端口。
- `logfile`：使用该配置文件启动后，日志生成文件名称。
- `dir`：使用该配置文件启动后，RDB和AOF数据持久化生成的文件路径
- `cluster-enabled yes`：  打开集群模式
- `cluster-config-file nodes-6379.conf`： 设定节点配置文件名
- `cluster-node-timeout 15000`：  设定节点失联时间，超过该时间（毫秒），集群自动进行主从切换

同样的流程，可以再新增几个端口6380，6381，6382，6383，6384等等，只需要将上述配置文件名和文件内容里的对应数字都修改即可，在vi命令行模式下使用`%s/6379/6380`命令替换更快 。

 都准备好后，启动redis服务器在/myredis文件夹中，输入如下命令：        

```sh
redis-server redis6379.conf 
redis-server redis6380.conf 
redis-server redis6381.conf 
redis-server redis6382.conf 
redis-server redis6383.conf 
redis-server redis6384.conf 
```

查看系统进程，看看服务器是否启动：

```cmd
ps -ef | grep redis
```

到这就实现了，在一台服务器中启动多台redis。

##### 3.1.2 构建集群

在前面我们已经启动了6台redis服务，现在我们要将这6台redis组成一个集群，redis5以前的版本集群是依靠ruby脚本redis‐trib.rb实现，这里我们使用的是redis5，可以直接使用 `redis-cli`命令就可以：         

```cmd
redis-cli --cluster create --cluster-replicas 1 166.66.66.66:6379 166.66.66.66:6380 166.66.66.66:6381 166.66.66.66:6382 166.66.66.66:6383 166.66.66.66:6384               
```

解析命令：

- `redis-cli --cluster create`：表示构建集群。
- `--cluster-replicas 1`：集群是由主从节点构成的，`--cluster-replicas 1`表示每个主从节点中，从节点的个数，例如上面的命令表示，一台主机，一台从机，正好三组主从节点。

- `166.66.66.66:637*`：表示参与构建集群的redis服务器。

验证集群是否构建成功： 

连接任意一个客户端：

```cmd
-- ‐a访问服务端密码，‐c表示集群模式，指定ip地址和端口号
./redis‐cli ‐c ‐h ‐p 
```

执行如下信息：

```cmd
-- 查看集群信息
cluster info
-- 查看节点列表
cluster nodes
```

#### 3.2 原理解析

##### 3.2.1 插槽

​	一个 Redis 集群包含 16384 个插槽（hash slot），数据库中的每个键都属于这16384个插槽的其中一个，当 Redis Cluster 的客户端来连接集群时，它也会得到一份集群的槽位配置信息并将其缓存在客户端本地。这样当客户端要查找某个 key 时，可以直接定位到目标节点。同时因为槽位的信息可能会存在客户端与服务器不 一致的情况，还需要纠正机制来实现槽位信息的校验调整。

槽位定位算法：Cluster 默认会对 key 值使用 crc16 算法进行 hash 得到一个整数值，然后用这个整数值对 16384 进行取模来得到具体槽位。 `HASH_SLOT = CRC16(key) mod 16384`

跳转重定位：因为槽位的信息可能会存在客户端与服务器不 一致的情况，当客户端向一个错误的节点发出了指令，该节点会发现指令的 key 所在的槽位并不归自己管理，这时它会向客户端发送一个特殊的跳转指令同时携带目标操作的节点地址，告诉客户端去连这个节点去获取数据。客户端收到指令后除了跳转到正确的节点上去操作，还会同步更新纠正本地的槽位映射表缓存，后续所有 key 将使用新的槽 位映射表。例如：

```
166.66.66.66:6879> set name abc
-> Redirected to slot [5798] located at 166.66.66.66:6880 OK
166.66.66.66:6880>
```

##### 3.2.2 通信

redis cluster节点间采取gossip协议进行通信，gossip协议包含多种消息，包括ping，pong，meet，fail等等。

- meet：某个节点发送meet给新加入的节点，让新节点加入集群中，然后新节点就会开始与其他节点进行通 信； 
- ping：每个节点都会频繁给其他节点发送ping，其中包含自己的状态还有自己维护的集群元数据，互相通过 ping交换元数据(类似自己感知到的集群节点增加和移除，hash slot信息等)；
-  pong: 对ping和meet消息的返回，包含自己的状态和其他信息，也可以用于信息广播和更新；
-  fail: 某个节点判断另一个节点fail之后，就发送fail给其他节点，通知其他节点，指定的节点宕机了。 gossip协议的优点在于元数据的更新比较分散，不是集中在一个地方，更新请求会陆陆续续，打到所有节点上去更新，有一定的延时，降低了压力；缺点在于元数据更新有延时可能导致集群的一些操作会有一些滞后

gossip协议的优点在于元数据的更新比较分散，不是集中在一个地方，更新请求会陆陆续续，打到所有节点上 去更新，有一定的延时，降低了压力；缺点在于元数据更新有延时可能导致集群的一些操作会有一些滞后。

​	每个节点都有一个专门用于节点间gossip通信的端口，就是自己提供服务的端口号+10000，比如6379，那么用于节点间通信的就是16379端口。 每个节点每隔一段时间都会往另外几个节点发送ping消息，同时其他几点接收到ping消息之后返回pong消息。



网络抖动：真实世界的机房网络往往并不是风平浪静的，它们经常会发生各种各样的小问题。比如网络抖动就是非常常见 的一种现象，突然之间部分连接变得不可访问，然后很快又恢复正常。 为解决这种问题，Redis Cluster 提供了一种选项`cluster-node-timeout`，表示当某个节点持续 timeout 的时间失联时，才可以认定该节点出现故障，需要进行主从切换。如果没有这个选项，网络抖动会导致主从频繁切换 (数据的重新复制)

##### 3.2.3 Redis集群选举原理分析

当slave发现自己的master变为FAIL状态时，便尝试进行Failover，以期成为新的master。由于挂掉的master可能会有多个slave，从而存在多个slave竞争成为master节点的过程， 其过程如下： 

- slave发现自己的master变为FAIL 
- 将自己记录的集群currentEpoch加1，并广播FAILOVER_AUTH_REQUEST信息
- 其他节点收到该信息，只有master会响应，会判断请求者的合法性，并发送FAILOVER_AUTH_ACK，对每一个 epoch只发送一次ack 
- 尝试failover的slave收集master返回的FAILOVER_AUTH_ACK 
- slave收到超过半数master的ack后变成新Master
- slave广播Pong消息通知其他集群节点

注意：从节点并不是在主节点一进入 FAIL 状态就马上尝试发起选举，而是有一定延迟，一定的延迟确保我们等待 FAIL状态在集群中传播，slave如果立即尝试选举，其它masters或许尚未意识到FAIL状态，可能会拒绝投票。延迟计算公式：`DELAY = 500ms + random(0 ~ 500ms) + SLAVE_RANK * 1000ms`，SLAVE_RANK表示此slave已经从master复制数据的总量的rank。rank越小代表已复制的数据越新。这种方式下持有最新数据的slave将会首先发起选举（理论上）。

##### 3.2.4 集群脑裂数据丢失问题 

redis集群没有过半机制会有脑裂问题，网络波动导致新选出的master和以前由于网络波动以为死亡的master节点都能对外提供写服务，一旦网络恢复，其中一个主节点将变为从节点，但是，这个主节点也对外提供了写服务，如果变成从节点会有大量数据丢失。 规避方法可以在redis配置里加上参数

```properties
 # 写数据成功最少同步的slave数量，这个数量可以模仿大于半数机制配置，
 # 比如主从集群总共三个节点，那就可以配置1，这时只要一个slave节点同步了数据，加上master节点，超过了半数 
 min‐replicas‐to‐write 1
```

注意：

- 这种方法不可能百分百避免数据丢失，因为虽然保证了由一半的slave节点同步了数据，但是并不能保证，master节点是从这一半的slave节点中选出的。
- 这个配置在一定程度上会影响集群的可用性，比如slave要是少于1个，这个主从集群就算master正常也不能提供服务了，所以需要具体场景权衡选择。

##### 3.2.5 集群是否完整才能对外提供服务 

当redis.conf的配置`cluster-require-full-coverage`为no时，表示当负责一个插槽的主库下线且没有相应的从库进行故障恢复时，集群仍然可用（插槽值不落在故障插槽库可用），如果为yes则集群不可用，不管插槽值落不落在故障插槽库都不可用。

##### 3.3.5 Redis集群对批量操作命令的支持 

对于类似mset，mget这样的多个key的原生批量操作命令，redis集群只支持所有key落在同一slot的情况，如果有多个key一定要用mset命令在redis集群上操作，则可以在key的前面加上{XX}，这样参数数据分片hash计算的只会是大括号里的值，这样能确保不同的key能落到同一slot里去，示例如下：

```cmd
mset {user}:name zyh {user}:age 18 
```

假设`{user}:name`和`{user}:age`计算的hash slot值不一样，但是这条命令在集群下执行，redis只会对大括号里的user做hash slot计算，所以算出来的slot值肯定相同，最后都能落在同一slot。
