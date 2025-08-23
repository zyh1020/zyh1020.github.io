---
icon: document
# 标题
title: 'zookeeper常用命令'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-19
# 一个页面可以有多个分类
category:
  - zookeeper
# 一个页面可以有多个标签
tag:
  - 偏僻
  - zookeeper
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，常见命令

#### 1.1 ls命令

ls命令：查看目录下的节点信息，

命令格式：

```sh
ls [-s] [-w] [-R] path
```

- `-s`：显示节点详情，包括状态信息
- `-w`：添加一个watch监视器
- `-R`：列举出节点的级联节点
- `path`：显示某目录下节点/文件

例如：

```
[zk: 192.168.198.110:2181(CONNECTED) 9] ls  /zookeeper 
[config, quota]
```

```
[zk: 192.168.198.110:2181(CONNECTED) 11] ls -R /zookeeper 
/zookeeper
/zookeeper/config
/zookeeper/quota
```

```sh
[zk: 192.168.198.110:2181(CONNECTED) 10] ls -s /zookeeper 
[config, quota]
cZxid = 0x0
ctime = Thu Jan 01 00:00:00 UTC 1970
mZxid = 0x0
mtime = Thu Jan 01 00:00:00 UTC 1970
pZxid = 0x0
cversion = -2
dataVersion = 0
aclVersion = 0
ephemeralOwner = 0x0
dataLength = 0
numChildren = 2
```

- cZxid：创建节点的事务 zxid 每次修改 ZooKeeper 状态都会产生一个 ZooKeeper 事务 ID。事务 ID 是 ZooKeeper 中所 有修改总的次序。每次修改都有唯一的 zxid，如果 zxid1 小于 zxid2，那么 zxid1 在 zxid2 之 前发生。
- ctime：znode 被创建的毫秒数（从 1970 年开始） 
- mZxid：znode 最后更新的事务 zxid 
- mtime：znode 最后修改的毫秒数（从 1970 年开始） 
- pZxid：znode 最后更新的子节点 zxid 尚硅谷技术之
- cversion：znode 子节点变化号，znode 子节点修改次数 
- dataversion：znode 数据变化号 
- aclVersion：znode 访问控制列表的变化号 
- ephemeralOwner：如果是临时节点，这个是 znode 拥有者的 session id。如果不是临时节点则是 0。 
- dataLength：znode 的数据长度 
- numChildren：znode 子节点数量

> cZxid和mZxid和pZxid可以判断出请求执行的全局顺序
>
> cversion和dataversion和aclVersion 基于CAS理论保证分布式数据的原子性

#### 1.2 stat命令

stat命令：查看节点状态。

命令格式：

```
stat [-w] path
```

- `-w`：添加watch
- `path`：查看某目录下节点的状态

例如：

```
[zk: 192.168.198.110:2181(CONNECTED) 12] stat /zookeeper 
cZxid = 0x0
ctime = Thu Jan 01 00:00:00 UTC 1970
mZxid = 0x0
mtime = Thu Jan 01 00:00:00 UTC 1970
pZxid = 0x0
cversion = -2
dataVersion = 0
aclVersion = 0
ephemeralOwner = 0x0
dataLength = 0
numChildren = 2
```

各个参数含义参考`ls -s` 输出信息。

#### 2.3 create命令

create命令：创建节点，默认持久节点

命令格式：

```
create [-s] [-e] [-c] [-t ttl] path [data] [acl]
```

- `-s`：有序节点
- `-e`：临时节点，不加默认是持久节点
- `-t ttl`：带过期时间节点，比如：`create ‐t 10 /ttl`，默认禁用，需要在 zoo.cfg中添加 `extendedTypesEnabled=true` 开启。 注意：ttl不能用于临时节点 。

Znode一般分为 4种类型：

- 持久的（persistent）
- 临时的（ephemeral）
- 持久有序的（persistent_sequential）
- 临时有序的（ephemeral_sequential）

例如：

创建持久节点：

```shell
[zk: 192.168.198.110:2181(CONNECTED) 12] create /p_node1
Created /p_node1
```

创建临时节点：

```
[zk: 192.168.198.110:2181(CONNECTED) 5] create -e /p_node1/e_node1
Created /p_node1/e_node1
```

创建顺序节点：

```
[zk: 192.168.198.110:2181(CONNECTED) 16] create -s  /p_node1/
Created /p_node1/0000000000
[zk: 192.168.198.110:2181(CONNECTED) 17] create -s  /p_node1/
Created /p_node1/0000000001
[zk: 192.168.198.110:2181(CONNECTED) 18] create -s  /p_node1/seq_
Created /p_node1/seq_0000000002
[zk: 192.168.198.110:2181(CONNECTED) 19] create -s  /p_node1/seq_
Created /p_node1/seq_0000000003
```

#### 2.4 set命令

set命令：修改节点内容

命令格式：

```
set [-s] [-v version] path data
```

- -s：更新节点数据并显示节点状态信息
- -v 指定数据版本号，如果指定的数据版本号和数据当前版本号不一致，则更新失败。

例如：

```
[zk: 192.168.198.110:2181(CONNECTED) 36] set /p_node1/e_node1 "set data1"
[zk: 192.168.198.110:2181(CONNECTED) 37] set -s /p_node1/e_node1 "set data2"
cZxid = 0x6c
ctime = Fri May 13 09:55:49 UTC 2022
mZxid = 0x80
mtime = Fri May 13 10:15:46 UTC 2022
pZxid = 0x6c
cversion = 0
dataVersion = 6
aclVersion = 0
ephemeralOwner = 0x100002513c80001
dataLength = 9
numChildren = 0
```

#### 2.5 get命令

get命令：获取节点/文件内容

命令格式：

```
get [-s] [-w] path
```

- -s：查看节点数据以及节点状态信息
- -w 添加一个watch，节点数据变更时，会通知客户端（通知是一次性的）。

例如：

```
[zk: 192.168.198.110:2181(CONNECTED) 38] get /p_node1/e_node1
set data2
[zk: 192.168.198.110:2181(CONNECTED) 39] get -s /p_node1/e_node1
set data2
cZxid = 0x6c
ctime = Fri May 13 09:55:49 UTC 2022
mZxid = 0x80
mtime = Fri May 13 10:15:46 UTC 2022
pZxid = 0x6c
cversion = 0
dataVersion = 6
aclVersion = 0
ephemeralOwner = 0x100002513c80001
dataLength = 9
numChildren = 0
```

#### 2.6 删除节点

delete命令：只能删除没有子节点的节点。如果其有子节点时，无法删除

命令格式：`delete [-v version] path`

deleteall命令：级联删除该节点和子节点。

命令格式：`deleteall path [-b batch size]`

例如：

```sh
[zk: 192.168.198.110:2181(CONNECTED) 43] delete /p_node2/seq_0000000002
[zk: 192.168.198.110:2181(CONNECTED) 44] ls -R /p_node2
/p_node2
/p_node2/0000000000
/p_node2/0000000001
/p_node2/seq_0000000003
[zk: 192.168.198.110:2181(CONNECTED) 45] deleteall /p_node2
[zk: 192.168.198.110:2181(CONNECTED) 46] ls -R /p_node2
Node does not exist: /p_node2
```

#### 2.7 其它命令

- history：显示最近执行的11条命令的历史记录
- getAllChildrenNumber：获取节点下的所有子孙节点数量
- getEphemerals：获取当前客户端创建的所有临时节点



### 二，监听命令

#### 2.1 监听节点目录变化

监听节点目录变化：监听节点的子节点变化，当子节点发生改变时触发。

命令格式：`ls -w path`

例如：

```sh
#创建节点
[zk: 192.168.198.110:2181(CONNECTED) 13] create /watch_node
Created /watch_node
#监听节点目录变化
[zk: 192.168.198.110:2181(CONNECTED) 14] ls -w /watch_node
[]
[zk: 192.168.198.110:2181(CONNECTED) 15] create /watch_node/w1 data1

WATCHER::

WatchedEvent state:SyncConnected type:NodeChildrenChanged path:/watch_node
Created /watch_node/w1
[zk: 192.168.198.110:2181(CONNECTED) 17] create /watch_node/w2 data2
Created /watch_node/w2
```

一次性监听，触发后会被删除，无法再次触发。

#### 2.2 监听节点数据变化

监听节点数据变化：当该节点数据发生改变时触发。子节点的数据变化不会触发。

命令格式：`get -w path`

例如：

```sh
# 监听节点数据变化
[zk: 192.168.198.110:2181(CONNECTED) 18] get -w /watch_node 
null
[zk: 192.168.198.110:2181(CONNECTED) 19] set /watch_node data

WATCHER::

WatchedEvent state:SyncConnected type:NodeDataChanged path:/watch_node
[zk: 192.168.198.110:2181(CONNECTED) 20] set /watch_node data2
```

一次性监听，触发后会被删除，无法再次触发。

#### 2.3 永久监听

在 Zookeeper 3.6.0版本之后，客户端可以在节点上创建永久监听，永久监听在被触发后不会被删除。

命令格式：`addWatch [-m mode] path`

永久监听在创建时可以通过 -m 指定模式，模式分为两种：

- PERSISTENT：该节点的数据变化以及子节点的变化会触发相应事件，子节点的数据变化不会触发。
- PERSISTENT_RECURSIVE：该节点的数据变化以及所有子孙节点的目录或者数据变化都会触发相应事件，不指定默认使用 PERSISTENT_RECURSIVE模式。

例如：

PERSISTENT模式：

```sh
[zk: 192.168.198.110:2181(CONNECTED) 29] create /watch_node2
# 监听节点 PERSISTENT   
[zk: 192.168.198.110:2181(CONNECTED) 30] addWatch -m PERSISTENT /watch_node2   
[zk: 192.168.198.110:2181(CONNECTED) 31] set /watch_node2 data1

WATCHER::

WatchedEvent state:SyncConnected type:NodeDataChanged path:/watch_node2
[zk: 192.168.198.110:2181(CONNECTED) 32] create /watch_node2/w1 data

WATCHER::Created /watch_node2/w1


WatchedEvent state:SyncConnected type:NodeChildrenChanged path:/watch_node2
#子节点的数据变化不会触发
[zk: 192.168.198.110:2181(CONNECTED) 33] set /watch_node2/w1 data1
[zk: 192.168.198.110:2181(CONNECTED) 34] delete /watch_node2/w1

WATCHER::

WatchedEvent state:SyncConnected type:NodeChildrenChanged path:/watch_node2
```

PERSISTENT_RECURSIVE模式

```sh
[zk: 192.168.198.110:2181(CONNECTED) 39] create /watch_node3
# 监听节点 PERSISTENT_RECURSIVE  
[zk: 192.168.198.110:2181(CONNECTED) 40] addWatch -m PERSISTENT_RECURSIVE /watch_node3
[zk: 192.168.198.110:2181(CONNECTED) 41] set /watch_node3 data1

WATCHER::

WatchedEvent state:SyncConnected type:NodeDataChanged path:/watch_node3
[zk: 192.168.198.110:2181(CONNECTED) 42] create /watch_node3/w1 

WATCHER::

WatchedEvent state:SyncConnected type:NodeCreated path:/watch_node3/w1
Created /watch_node3/w1
#子节点的数据变化也会触发
[zk: 192.168.198.110:2181(CONNECTED) 43] set /watch_node3/w1 data1
WATCHER::

WatchedEvent state:SyncConnected type:NodeDataChanged path:/watch_node3/w1

[zk: 192.168.198.110:2181(CONNECTED) 44]  delete /watch_node3/w1

WATCHER::

WatchedEvent state:SyncConnected type:NodeDeleted path:/watch_node3/w1

```

### 三，ACL命令

#### 3.1 ACL总体构成

Zookeeper 的 ACL(Access Control List)，分为三个维度：scheme、id、permission。

通常表示为：`scheme:id:permission`来构成权限列表。

- scheme：代表采用某种权限机制
- id：代表允许访问的用户
- permissions：代表权限（组合字符串）

##### 3.1.1 scheme：权限策略

- world : world下只有一个id，即只有一个用户，也就是anyone，那么组合的写法就是`world:anyone:[permissions]`。 `world:anyone` 代表任何人，zookeeper 中对所有人有权限的结点就是属于` world:anyone` 的。
- auth：代表认证登录，需要注册用户有权限就可以，使用的是明文密码，形式为`auth:user:password:[permissions]`。
- 它不需要 id, 只要是通过 authentication 的 user 都有权限（zookeeper 支持通过 kerberos来进行 authencation，也支持 username/password 形式的 authentication)。
- digest：需要对密码加密才能访问，使用的是加密密码，组合形式为
- digest: `username:BASE64(SHA1(password)):[permissions]`。
- ip：它对应的 id 为客户机的 IP 地址，设置的时候可以设置一个 ip 段，此时限制ip进行访问。比如ip:192.168.1.1:[permissions]
- super：代表超级管理员，拥有所有的权限

##### 3.1.2 id：用户

id 是验证模式，不同的 scheme，id 的值也不一样。默认为anyone。s

- scheme 为 auth 时，id为：`username:password`
- scheme 为 digest 时，id为：`username:BASE64(SHA1(password))`
- scheme 为 ip 时，id为：客户端的 ip 地址。
- scheme 为 world 时，id为：anyone

##### 3.1.3 permission：权限

Zookeeper定义了五种权限：

- CREATE：创建子节点的权限。允许创建子节点；
- DELETE：删除节点的权限。允许删除子节点；
- READ：读取节点数据的权限。允许从节点获取数据并列出其子节点；
- WRITE：修改节点数据的权限。允许为节点设置数据；
- ADMIN：设置子节点权限的权限，允许为节点设置权限。

CREATE、READ、WRITE、DELETE、ADMIN 也就是增、删、改、查、管理权限，这 5 种权限简写为 crwda（即单词的首字符缩写）。

#### 3.2 ACL命令操作

##### 3.2.1 getAcl命令

getAcl命令：查看指定节点 ACL信息

命令格式：`getAcl [-s] path`，-s：查看节点详细信息

例如：

```sh
[zk: 192.168.198.110:2181(CONNECTED) 15] getAcl /p_node1 
'world,'anyone
: cdrwa
[zk: 192.168.198.110:2181(CONNECTED) 17] getAcl -s /p_node1 
'world,'anyone
: cdrwa
cZxid = 0x67
ctime = Fri May 13 09:53:38 UTC 2022
mZxid = 0x67
mtime = Fri May 13 09:53:38 UTC 2022
pZxid = 0x83
cversion = 6
dataVersion = 0
aclVersion = 0
ephemeralOwner = 0x0
dataLength = 0
numChildren = 0
```

##### 3.2.2 setAcl命令

setAcl命令：设置指定节点的ACL 信息

命令格式：`setAcl [-s] [-v version] [-R] path acl`

例如：

```sh
[zk: 192.168.198.110:2181(CONNECTED) 21] create /testAcl
Created /testAcl
# 设置该节点的 acl 权限
[zk: 192.168.198.110:2181(CONNECTED) 22] setAcl /testAcl world:anyone:crwa 
[zk: 192.168.198.110:2181(CONNECTED) 23] getAcl /testAcl
'world,'anyone
: crwa
# 创建子节点
[zk: 192.168.198.110:2181(CONNECTED) 24] create /testAcl/xyz " xyz-data"
Created /testAcl/xyz
# 由于没有 d 权限，所以提示无法删除
[zk: 192.168.198.110:2181(CONNECTED) 25] delete /testAcl/xyz
Insufficient permission : /testAcl/xyz
```

##### 3.2.3 addauth命令

addauth命令：添加认证用户

命令格式：`addauth scheme auth`

- scheme：（digest：是授权方式）格式为：`digest username:password`
- auth：就是分配权限， crwda。如果不写时表示创建用户，可以通过setAcl命令来设置权限

案例1：我们创建一个用户，并分配权限：

```sh
[zk: 192.168.198.110:2181(CONNECTED) 27] addauth digest charge_admin:123456 crwda
[zk: 192.168.198.110:2181(CONNECTED) 28] addauth digest charge_crw:123456 crw
```

案例2：给某个节点，设置用户，用户只能在分配的权限内操作

```shs
# 添加一个用户
[zk: 192.168.198.110:2181(CONNECTED) 13] addauth digest user1:123456
# 给节点设置用户权限
[zk: 192.168.198.110:2181(CONNECTED) 14] setAcl /testAcl auth:user1:123456:crwa
# 查看节点权限，密码是以密文的形式存储的
[zk: 192.168.198.110:2181(CONNECTED) 15] getAcl /testAcl
'digest,'user1:HYGa7IZRm2PUBFiFFu8xY2pPP/s=
: crwa
[zk: 192.168.198.110:2181(CONNECTED) 16] create /testAcl/ztest "data"
Created /testAcl/ztest
# 由于用户没有 d 权限，所以提示无法删除
[zk: 192.168.198.110:2181(CONNECTED) 17] delete /testAcl/ztest
Insufficient permission : /testAcl/ztest
```

我们 quit退出后，重新进入客户端，操作 /testAcl节点

```
#没有用户权限无法访问
[zk: 192.168.198.110:2181(CONNECTED) 0] ls /testAcl
Insufficient permission : /testAcl
[zk: 192.168.198.110:2181(CONNECTED) 1] create /testAcl/ztest2
Insufficient permission : /testAcl/ztest2

# 重新新增权限后可以访问了
[zk: 192.168.198.110:2181(CONNECTED) 2] addauth digest user1:123456
[zk: 192.168.198.110:2181(CONNECTED) 3] create /testAcl/ztest2
Created /testAcl/ztest2
[zk: 192.168.198.110:2181(CONNECTED) 4] ls -R /testAcl
/testAcl
/testAcl/xyz
/testAcl/ztest
/testAcl/ztest2
# 由于用户没有 d 权限，所以提示无法删除
[zk: 192.168.198.110:2181(CONNECTED) 5] delete /testAcl/ztest2
Insufficient permission : /testAcl/ztest2
```



转发：https://blog.csdn.net/qq_42402854/article/details/124775663
