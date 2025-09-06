---
icon: file-lines
# 标题
title: 'nacos的安装'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-29
# 一个页面可以有多个分类
category:
  - SpringCloud
# 一个页面可以有多个标签
tag:
  - 必看
  - SpringCloud
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，单机安装 
1，下载安装包
安装包下载链接：https://github.com/alibaba/nacos/releases，如果觉得github下载太慢，也可以使用我下载好的，通过天翼网盘下载链接：https://cloud.189.cn/web/share?code=nQ32uejeIFbm（访问码：d1r7），linux系统选择`.tar.gz`， windows系统选择`zip`
如果是linux系统可以通过如下命令，解压下载的安装包：
``` sh
tar -xvf nacos-server-$version.tar.gz
```
2，启动服务器
不论是Linux还是window都需要进入解压下载的安装包后的bin文件
Linux/Unix/Mac启动命令：
```sh
sh startup.sh -m standalone
```
如果您使用的是ubuntu系统，或者运行脚本报错提示，符号找不到，可尝试如下运行：
```sh
bash startup.sh -m standalone
```
Windows启动命令:
```sh
startup.cmd -m standalone
```
3，验证结果：
访问验证网址：http://127.0.0.1:8848/nacos/index.html，8848 是默认启动端口。
![2024-08-18 15 01 59.png](http://img.zouyh.top/article-img/20240917135205448.png)
需要注意的：2.2.2版本之前的Nacos默认控制台，无论服务端是否开启鉴权，都会存在一个登录页，登录的账号和密码都是nocas；这导致很多用户被误导认为Nacos默认是存在鉴权的。在社区安全工程师的建议下，Nacos自2.2.2版本开始，在未开启鉴权时，默认控制台将不需要登录即可访问，所以用户开启鉴权后，控制台才需要进行登录访问。
### 二，单机模式支持mysql
在0.7版本之前，在单机模式nacos是使用嵌入式数据库实现数据的存储，虽然减少了对第三方的依赖，但是不方便观察数据存储的基本情况，0.7版本增加了支持mysql数据源能力：
1，在conf目录下找到mysql-schema.sql文件:
![2024-08-18 15 29 18.png](http://img.zouyh.top/article-img/20240917135206451.png)

2，修改conf目录下application.properties文件：
```properties
spring.datasource.platform=mysql
db.num=1
db.url.0=jdbc:mysql://127.0.0.1:3306/数据库名称?characterEncoding=utf8&connectTimeout=1000&socketTimeout=3000&autoReconnect=true&useUnicode=true&useSSL=false&serverTimezone=UTC
db.user.0=数据库账号
db.password.0=数据库密码
```
3，然后重新启动nacos
```sh
startup.cmd -m standalone
```
### 三，集群安装
集群结构：

![2024-08-18 17 06 27.png|400](http://img.zouyh.top/article-img/20240917135206449.png)

1，下载安装包
安装包下载链接：https://github.com/alibaba/nacos/releases，如果觉得github下载太慢，也可以使用我下载好的，通过天翼网盘下载链接：https://cloud.189.cn/web/share?code=nQ32uejeIFbm（访问码：d1r7），linux系统选择`.tar.gz`， windows系统选择`zip`
如果是linux系统可以通过如下命令，解压下载的安装包：
``` sh
tar -xvf nacos-server-$version.tar.gz
```
2，我是在同一台机器上启动的，所以我复制了3个nacos，所以如果你想要在同一台机器上构建集群，就要避免这端口冲突，当然如果有多台机器当我没说。
![2024-08-18 16 45 35.png](http://img.zouyh.top/article-img/20240917135207453.png)
然后修改nacos8848，nacos8850和nacos8852的conf目录下application.properties文件
```
#  1，修改端口
server.port= 端口 （8848，8850，8852）

# 2， 创建nocas_conf数据库，并将目录下找到mysql-schema.sql文件在nocas_conf数据库中执行以下
spring.datasource.platform=mysql
db.num=1
db.url.0=jdbc:mysql://127.0.0.1:3306/nocas_conf?characterEncoding=utf8&connectTimeout=1000&socketTimeout=3000&autoReconnect=true&useUnicode=true&useSSL=false&serverTimezone=UTC
db.user.0=数据库账号
db.password.0=数据库密码
```

4，配置集群配置文件，在nacos的解压目录nacos/的conf目录下，创建cluster.config文件输入以下内容，ip不能写127.0.0.1写你本地的ip，我的本地IP就是169.254.127.119：
```
169.254.127.119:8848
169.254.127.119:8850
169.254.127.119:8852
```
注意这三台nacos都需要在conf文件夹下，添加cluster.conf配置文件，并且内容必须保持一致。

5，以集群的方式启动，在windows环境下默认是以单机模式启动的，可以使用如下命令以集群的方式启动nocas服务
```sh
startup.cmd -m cluster
```
6，验证，在浏览器分别访问：
169.254.127.119:8848/nacos/index.html
169.254.127.119:8850/nacos/index.html
169.254.127.119:8852/nacos/index.html
随便访问上面的任何一个网址，
![2024-08-18 16 41 17.png](http://img.zouyh.top/article-img/20240917135206450.png)
7，nginx的安装包可以通过天翼云盘下载：https://cloud.189.cn/web/share?code=z22QZfrYFrUr（访问码：vwk0）nginx配置，修改niginx的配置文件conf/nginx.conf
```
upstream nacosserver {
	server 169.254.127.119:8848;
	server 169.254.127.119:8850;
	server 169.254.127.119:8852;
}
server {
	listen       80;
	server_name  localhost;
	location /nacos/ {
		proxy_pass http://nacosserver/nacos/;
	}
}
```
然后在sbin目录下，执行nginx启动命令，访问169.254.127.119
![2024-08-18 17 01 33.png](http://img.zouyh.top/article-img/20240917135207452.png)

