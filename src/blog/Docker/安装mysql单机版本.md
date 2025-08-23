---
icon: document
# 标题
title: '安装mysql单机版本'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-21
# 一个页面可以有多个分类
category:
  - Docker
# 一个页面可以有多个标签
tag:
  - 推荐
  - Docker
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，安装
1，官网搜索：https://hub.docker.com/search/?q=&type=image或者`docker search 关键字`搜索
![image.png](http://img.zouyh.top/article-img/202505241949706.png)

2，拉取镜像:
```sh
docker pull mysql:5.7
```
![image.png](http://img.zouyh.top/article-img/202505241948265.png)
3，创建容器：
``` sh
docker run -p 3306:3306 --name mysql -v /root/docker/mysql/conf:/etc/mysql/conf.d -v /root/docker/mysql/logs:/var/log/mysql -v /root/docker/mysql/data:/var/lib/mysql -e MYSQL_ROOT_PASSWORD=blog123456# -d mysql:5.7
```
4，查看实例：
```sh
docker ps -a
```

### 二，mysql中文乱码问题
中文乱码原因查找，第一步，进入创建mysql
```sh
docker exec -it mysql bash
```
![image.png](http://img.zouyh.top/article-img/202505241953744.png)

第二步，查看编码：
```mysql
show variables like '%character%';
```
![image.png](http://img.zouyh.top/article-img/202505241952846.png)
修复问题，第一步，进入挂载的数据卷：
```sh
cd /root/docker/mysql/conf
```
新建my.cnf文件`vi my.cnf`，添加如下内容:
```
[client] 
default-character-set=utf8 
[mysql] 
default-character-set=utf8 
[mysqld] 
init_connect='SET collation_connection = utf8_general_ci' 
init_connect='SET NAMES utf8' 
character-set-server=utf8 
collation-server=utf8_general_ci 
skip-character-set-client-handshake
```
然后重启mysql容器：
```sh
docker restart mysql
```
