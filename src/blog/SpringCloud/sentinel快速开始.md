---
icon: file-lines
title: sentinel快速开始
author: Ms.Zyh
date: 2025-03-16
category:
  - SpringCloud
tag:
  - 基础
  - SpringCloud
sticky: false
star: false
---

#### 一,服务端启动
下载sentinel的jar：
```sh
Java -jar sentinel-dashboard-1.8.8.jar
```
访问127.0.0.1:8080进入登录页面:
![image.png](http://img.zouyh.top/article-img/202501261545190.png)
账号和密码都是sentinel，如果要修改Sentinel的默认端口、账户、密码，可以通过下列配置：

| 配置项           | 默认值      | 说明   |
| :------------ | :------- | :--- |
| server.port   | 8080     | 服务端口 |
| auth.username | sentinel | 账户   |
| auth.password | sentinel | 密码   |

例如：` java -jar sentinel-dashboard-1.8.78jar --server.port=8858 --auth.username=custom --auth.password=custom `
#### 二，客户端启动
导入jar包：
```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-sentinel</artifactId>
</dependency>
```
配置application文件或者bootstrap文件：
```yaml
spring:
  application:
    name: test-sentinel
  cloud:
    sentinel:
      transport:
        port: 8719
        dashboard: 127.0.0.1:8080
```
启动服务，回到127.0.0.1:8080页面，查看左侧导航`spring.application.name`。
![image.png](http://img.zouyh.top/article-img/202501261546028.png)
注意：如果服务启动没什么问题、配置也没出错，还是没发现spring.application.name对应的服务，可能不是你的问题，我第一次使用sentinel的时候也是一脸懵逼，不知道为什么，然后开始各种百度，有说先启动nacos才行等等各种解决方式。其实不然sentinel不依赖nacos的，不使用nacos也可以使用sentinel。我真正的解决方法是服务启动后，访问任何一个接口资源即可在控制台左侧导航找到`spring.application.name`对应的服务。
#### 2.1菜单介绍
实时监控：Sentinel 提供对所有资源的实时监控。
簇点链路：对资源（接口）调用的详细统计。
流控规则：配置对资源的流量控制规则。
降级规则：配置资源的熔断降级规则。
热点规则：配置某些热点资源的流控规则。
系统规则：整个系统的流控规则。
授权规则：对某个资源访问的黑白名单规则。
集群流控：配置集群的限流规则。
机器列表：微服务的机器列表。
