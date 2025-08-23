---
icon: document
# 标题
title: 'RabbitMQ安装'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-26
# 一个页面可以有多个分类
category:
  - MQ
# 一个页面可以有多个标签
tag:
  - 偏僻
  - MQ
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，基础安装

#### 1.1 安装ErLang

由于RabbitMQ是基于Erlang语言开发的，所以在安装RabbitMQ之前需要先安装Erlang的运行环境。

erlang与RabbitMQ版本的对应关系:https://www.rabbitmq.com/which-erlang.html

如：RabbitMQ3.6.10，建议的erlang最小版本是R16Bo3，最大版本19.3.x

<img src="http://img.zouyh.top/article-img/20240917135105343.png" alt="image-20230424104117398" style="zoom: 50%;" />



erlang各个版本的下载：https://www.erlang.org/downloads

<img src="http://img.zouyh.top/article-img/20240917135105341.png" alt="image-20230424104348852" style="zoom:50%;" />





#### 1.2 安装RabbitMQ

①，官网地址下载地址：https://www.rabbitmq.com/download.html

②，将下载好的erlang和RabbitMq文件，一起上传到/usr/local/software 目录下(如果没有 software 需要自己创建) 

③，进入到usr/local/software 目录，分别执行如下命令安装，注意按照以下顺序安装

```
rpm -ivh erlang-21.3-1.el7.x86_64.
rpm yum install socat -y 
rpm -ivh rabbitmq-server-3.8.8-1.el7.noarch.rpm 
```

常用命令：

```sh
# 添加开机启动 RabbitMQ 服务        
chkconfig rabbitmq-server on 
# 启动服务
rabbitmq-server start  
# 查看服务状态
rabbitmq-server status 
# 停止服务(选择执行)
rabbitmq-server stop  
```

####   1.3 web 管理插件

停止RabbitMQ服务后,开启 web 管理插件:               

```
rabbitmq-plugins enable rabbitmq_management
```

用默认账号密码(guest)访问地址 http://ip:15672/出现权限问题 

![image-20230424114410746](http://img.zouyh.top/article-img/20240917135105342.png)

```sh
# 添加一个新的用户创建账号      
rabbitmqctl add_user admin 123
# 设置用户角色 
rabbitmqctl set_user_tags admin administrator     
# 设置用户权限 
rabbitmqctl set_permissions -p "/" admin ".*" ".*" ".*" 
# 查看当前用户和角色 
rabbitmqctl list_users 
# 再次利用 admin 用户登录
# 重置命令 关闭应用的命令为
rabbitmqctl stop_app 
# 清除的命令为 
rabbitmqctl reset
# 重新启动命令为 
rabbitmqctl start_app
```

### 二，docker安装

第一步：在docker hub 中查找rabbitmq镜像，带有“mangement”的版本，包含web管理页面

```dockerfile
docker search rabbitmq:3.9.12-management
```

第二步：从docker hub 中拉取rabbitmq镜像

```
docker pull rabbitmq:3.9.12-management
```

第三步：查看拉取的rabbitmq镜像

```
docker images
```

第四步：运行 rabbitmq服务端

```
docker run -d \
-v /opt/rabbitmq/data:/root/rabbitmq/data \
-p 5672:5672 -p 15672:15672 --name rabbitmq --restart=always \
--hostname myRabbit rabbitmq:3.9.12-management
```

第五步：查看正在运行的容器

```
docker ps 
```

第六步：容器运行成功之后，在浏览器访问： ip+15672，账号 guest ， 密码 guest

### 三，集群安装

**安装**

采用上面的基础安装启动三台MQ，假设三台MQ分别为MQ1，MQ2，MQ3。

```sh
# 3台机器的主机名称
# MQ1中执行
hostnamectl set‐hostname node0
# MQ2中执行
hostnamectl set‐hostname node1
# MQ3中执行
hostnamectl set‐hostname node2
```

在MQ1中执行如下命令，将MQ1的cookie文件，推送给MQ2和MQ3以确保各个节点的cookie文件使用的是同一个值。

```sh
scp /var/lib/rabbitmq/.erlang.cookie root@node2:/var/lib/rabbitmq/.erlang.cookie 
scp /var/lib/rabbitmq/.erlang.cookie root@node3:/var/lib/rabbitmq/.erlang.cookie
```

在节点 MQ2 执行如下命令：                 

```sh
#rabbitmqctl stop会将Erlang虚拟机关闭，rabbitmqctl stop_app只关闭 RabbitMQ 服务
rabbitmqctl stop_app
# 重置节点，数据会清除
rabbitmqctl reset  
# --ram 设置为内存存储，默认为 disc 磁盘存储; rabbit@node1是该节点所在集群中的名称，node2指定就是hostname的名称
rabbitmqctl join_cluster --ram rabbit@node1 
# 从重启RabbitMQ 服务
rabbit@node1 rabbitmqctl start_app  
```

在节点 MQ3执行如下命令：  

```sh
s#rabbitmqctl stop会将Erlang虚拟机关闭，rabbitmqctl stop_app只关闭 RabbitMQ 服务
rabbitmqctl stop_app
# 重置节点，数据会清除
rabbitmqctl reset  
# --ram 设置为内存存储，默认为 disc 磁盘存储; rabbit@node2是该节点所在集群中的名称，node2指定就是hostname的名称
rabbitmqctl join_cluster --ram rabbit@node2
# 从重启RabbitMQ 服务
rabbit@node1 rabbitmqctl start_app
```

查看集群状态 

```sh
rabbitmqctl cluster_status      
```

**配置镜像队列**

在任意的节点中执行如下命令：

```
rabbitmqctl set_policy ha-all "^" '{"ha-mode":"all"}'
```

解释：
-  `rabbitmqctl set_policy` ：用于设置策略。
- `ha-all` ： 表示设置为镜像队列并策略为所有节点可用 ，意味着 队列会被（同步）到所有的节点，当一个节点被加入到集群中时，也会同步到新的节点中，此策略比较保守，性能相对低，对接使用半数原则方式设置（N/2+1），例如：有3个结点 此时可以设置为：ha-two 表示同步到2个结点即可。
- `"^" ` ：表示针对的队列的名称的正则表达式，此处表示匹配所有的队列名称。
- `'{"ha-mode":"all"}' `：设置一组key/value的JSON 设置为高可用模式 匹配所有exchange。

**负载：**RabbitMQ是不支持负载的，我们可以通过nginx或者HAProxy实现负载。注意要配置15672和5672两个端口。

**解除集群步骤**

解除集群节点(MQ2和 MQ3机器分别执行)           

```
rabbitmqctl stop_app  
rabbitmqctl reset  
rabbitmqctl start_app  
rabbitmqctl cluster_status 
```

 解除集群节点(MQ1 机器上执行)               

```
rabbitmqctl forget_cluster_node rabbit@node2              
```

