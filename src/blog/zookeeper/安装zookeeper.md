---
icon: file-lines
# 标题
title: '安装zookeeper'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-30
# 一个页面可以有多个分类
category:
  - zookeeper
# 一个页面可以有多个标签
tag:
  - 进阶
  - zookeeper
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，单机安装

①，查看本地镜像和检索拉取Zookeeper 镜像

```sh
# 查看本地镜像
docker images
# 检索ZooKeeper 镜像
docker search zookeeper
# 拉取ZooKeeper镜像最新版本
docker pull zookeeper:latest
# 我使用的版本
docker pull zookeeper:3.5.7
```

②，创建ZooKeeper 挂载目录（数据挂载目录、配置挂载目录和日志挂载目录）

```sh
# 数据挂载目录
mkdir -p /root/zookeeper/data
# 配置挂载目录
mkdir -p /root/zookeeper/conf
# 日志挂载目录
mkdir -p /root/zookeeper/logs
```

③，添加ZooKeeper配置文件，在挂载配置文件目录(/mydata/zookeeper/conf)下，新增zoo.cfg 配置文件，配置内容如下：

```sh
tickTime=2000
initLimit=10
syncLimit=5
dataDir=/data
clientPort=2181
dataLogDir=/datalog
```

- `tickTime = 2000`：通信心跳时间，Zookeeper服务器与客户端心跳时间，单位毫秒
- `initLimit = 10`：LF初始通信时限，Leader和Follower初始连接时能容忍的最多心跳数（tickTime的数量）
- `syncLimit = 5`：LF同步通信时限，Leader和Follower之间通信时间如果超过syncLimit * tickTime，Leader认为Follwer死 掉，从服务器列表中删除Follwer。
- `dataDir`：保存Zookeeper中的数据 注意：默认的tmp目录，容易被Linux系统定期删除，所以一般不用默认的tmp目录
- `clientPort = 2181`：客户端连接端口，通常不做修改。
- `dataLogDir`：日志存放目录

④，启动ZooKeeper容器

```sh
docker run -d --name zookeeper --privileged=true -p 2181:2181  -v /root/zookeeper/data:/data -v /root/zookeeper/conf:/conf -v /root/zookeeper/logs:/datalog zookeeper:3.5.7
```



### 二，集群安装

①，准备三台机器互相ping通，按照上面的方式安装三台zookeeper

②，设置myid标识，在三台机器分别执行，在数据挂载目录（/mydata/zookeeper/data）新建myid 的文件，文件内容分别是1，2，3

③，修改zoo.cfg 配置文件，在三台机器分别执行，在挂载配置文件目录(/mydata/zookeeper/conf)下，新增如下内容：

```properties
server.1=ip1:2888:3888
server.2=ip2:2888:3888
server.3=ip3:2888:3888
```

配置格式 `server.A=B:C:D`，分别解释一下ABCD：

- A 是一个数字，表示这个是第几号服务器； 集群模式下配置一个文件 myid，这个文件在 dataDir 目录下，这个文件里面有一个数据就是 A 的值，Zookeeper 启动时读取此文件，拿到里面的数据与 zoo.cfg 里面的配置信息比较从而判断到底是哪个 server。 
- B 是这个服务器的地址； 
- C 是这个服务器 Follower 与集群中的 Leader 服务器交换信息的端口；
- D 是万一集群中的 Leader 服务器挂了，需要一个端口来重新进行选举，选出一个新的 Leader，而这个端口就是用来执行选举时服务器相互通信的端口。
