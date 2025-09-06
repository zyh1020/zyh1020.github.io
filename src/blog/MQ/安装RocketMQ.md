---
icon: file-lines
# 标题
title: '安装RocketMQ'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-29
# 一个页面可以有多个分类
category:
  - MQ
# 一个页面可以有多个标签
tag:
  - 基础
  - MQ
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，Docker安装RocketMQ

#### 1.1 创建namesrv服务

拉取镜像

```sh
docker pull rocketmqinc/rocketmq
```

创建namesrv数据存储路径

```sh
mkdir -p /root/docker/rocketmq/data/namesrv/logs  /root/docker/rocketmq/data/namesrv/logs
```

构建namesrv容器

```sh
docker run -d \
--restart=always \
--name rmqnamesrv \
-p 9876:9876 \
-v /root/docker/rocketmq/data/namesrv/logs:/root/logs \
-v /root/docker/rocketmq/data/namesrv/logs:/root/store \
-e "MAX_POSSIBLE_HEAP=100000000" \
rocketmqinc/rocketmq \
sh mqnamesrv 
```

| 参数                                | 解析                                   |
| ----------------------------------- | -------------------------------------- |
| `--restart=always`                  | docker重启时候容器自动重启             |
| `--name rmqnamesrv`                 | 把容器的名字设置为rmqnamesrv           |
| `-p 9876:9876`                      | 把容器内的端口9876挂载到宿主机9876上面 |
| `-v`                                | 把容器内的目录挂载到宿主机的           |
| `-e "MAX_POSSIBLE_HEAP=100000000" ` | 设置容器的最大堆内存为100000000        |
| `rocketmqinc/rocketmq `             | 使用的镜像名称                         |
| `sh mqnamesrv `                     | 启动namesrv服务                        |



#### 1.2 创建broker节点

创建broker数据存储路径

```sh
mkdir -p  /root/docker/rocketmq/data/broker/logs   /root/docker/rocketmq/data/broker/store /root/docker/rocketmq/conf
```

创建配置文件

```
vi /root/docker/rocketmq/conf/broker.conf
```

文件内容如下：

```properties
# 所属集群名称，如果节点较多可以配置多个
brokerClusterName = DefaultCluster
# broker名称，master和slave使用相同的名称，表明他们的主从关系
brokerName = broker-a
# 0表示Master，大于0表示不同的slave
brokerId = 0
# 表示几点做消息删除动作，默认是凌晨4点
deleteWhen = 04
# 在磁盘上保留消息的时长，单位是小时
fileReservedTime = 48
# 有三个值：SYNC_MASTER，ASYNC_MASTER，SLAVE；同步和异步表示Master和Slave之间同步数据的机制；
brokerRole = ASYNC_MASTER
#刷盘策略，取值为：ASYNC_FLUSH，SYNC_FLUSH表示同步刷盘和异步刷盘；SYNC_FLUSH消息写入磁盘后才返回成功状态，ASYNC_FLUSH不需要；
flushDiskType = ASYNC_FLUSH
# 设置broker节点所在服务器的ip地址
brokerIP1 = 1.15.141.218
# 磁盘使用达到95%之后,生产者再写入消息会报错 CODE: 14 DESC: service not available now, maybe disk full
diskMaxUsedSpaceRatio=95
```

构建broker容器

```sh
docker run -d  \
--restart=always \
--name rmqbroker \
--link rmqnamesrv:namesrv \
-p 10911:10911 \
-p 10909:10909 \
-v /root/docker/rocketmq/data/broker/logs:/root/logs \
-v /root/docker/rocketmq/data/broker/store:/root/store \
-v /root/docker/rocketmq/conf/broker.conf:/opt/rocketmq-4.4.0/conf/broker.conf \
-e "NAMESRV_ADDR=namesrv:9876" \
-e "MAX_POSSIBLE_HEAP=200000000" \
rocketmqinc/rocketmq \
sh mqbroker -c /opt/rocketmq-4.4.0/conf/broker.conf 
```

| 参数                              | 解析                                        |
| --------------------------------- | ------------------------------------------- |
| `--restart=always`                | docker重启时候容器自动重启                  |
| `--name rmqbroker`                | 把容器的名字设置为rmqbroker                 |
| `--link rmqnamesrv:namesrv`       | 和rmqnamesrv容器通信                        |
| `-p 10911:10911`                  | 把容器的非vip通道端口挂载到宿主机           |
| `-p 10909:10909`                  | 把容器的vip通道端口挂载到宿主机             |
| `-e "NAMESRV_ADDR=namesrv:9876" ` | 指定namesrv的地址为本机namesrv的ip地址:9876 |
| `rocketmqinc/rocketmq`            | 使用的镜像名称                              |
| `sh mqbroker -c`                  | 指定配置文件启动broker节点                  |

#### 1.3 创建rockermq-console服务

拉取镜像

```
docker pull pangliang/rocketmq-console-ng
```

构建rockermq-console容器

```sh
docker run -d \
--restart=always \
--name rmqadmin \
-e "JAVA_OPTS=-Drocketmq.namesrv.addr=1.15.141.218:9876 \
-Dcom.rocketmq.sendMessageWithVIPChannel=false" \
-p 9999:8080 \
pangliang/rocketmq-console-ng
```

| 参数                            | 解析                                             |
| ------------------------------- | ------------------------------------------------ |
| `--restart=always`              | docker重启时候容器自动重启                       |
| `--name rmqadmin`               | 把容器的名字设置为rmqadmin                       |
| `-e`                            | 设置namesrv服务的ip地址 和 不使用vip通道发送消息 |
| `-p`                            | 把容器内的端口8080挂载到宿主机上的9999端口       |
| `pangliang/rocketmq-console-ng` | 使用的镜像名称                                   |

需要关闭防火墙或者开放端口：9999，10911，9876

![image-20230512105027325](http://img.zouyh.top/article-img/20240917135117379.png)

