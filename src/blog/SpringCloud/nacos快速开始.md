---
icon: document
# 标题
title: 'nacos快速开始'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-17
# 一个页面可以有多个分类
category:
  - SpringCloud
# 一个页面可以有多个标签
tag:
  - 偏僻
  - SpringCloud
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---


> 前言：nacos的服务端window/linux安装和启动教程请看另一篇文章
#### 一, nacos服务治理
![image.png](http://img.zouyh.top/article-img/202501261527005.png)
##### 1.1 引入jar
``` pom
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
</dependency>
```
##### 1.2 服务注册
服务注册的方式非常简单，只需要在resources/bootstrap.yml文件中添加如下配置即可：
```yaml
spring:
  cloud:
    nacos:
      discovery:
        server-addr: 127.0.0.1:8848
```
127.0.0.1:8848 表示nacos的服务端的ip和端口，nacos的服务端安装和启动这里就不多说了，有兴趣的可以看看我的另一篇nacos的安装文章。
然后启动服务，访问：http://nacos的服务端的ip和端口/nacos/index.html，查看服务管理/服务列表：
![image.png](http://img.zouyh.top/article-img/202501261530564.png)

再启动两个`application.name`为test-nacos，端口分别是8282、8383的服务：
![image.png](http://img.zouyh.top/article-img/202501261533922.png)

nacos将`application.name`服务名称一样的归类为同一服务，通过Ribbon实现负载调用服务。点击详情可以查看详细信息：
![image.png](http://img.zouyh.top/article-img/202501261538234.png)
##### 1.3 服务发现
在主启动类上添加`@EnableDiscoveryClient`注解
```java
@SpringBootApplication
@EnableDiscoveryClient
public class TestSpringcloudApplication {
    public static void main(String[] args) {
        SpringApplication.run(TestSpringcloudApplication.class, args);
    }
}
到此为止，服务发现就已经搞定了
```
编写测试
```java
@RestController
@RequestMapping("/nacos")
public class NacosTest {

    @Resource
    private NacosDiscoveryClient nacosDiscoveryClient;

    @GetMapping("/services")
    public List<String> getAllServiceNames() {
        return nacosDiscoveryClient.getServices();
    }

    @GetMapping("/instances/{serviceName}")
    public List<ServiceInstance> getInstances(@PathVariable String serviceName) {
        return nacosDiscoveryClient
                .getInstances(serviceName)
                .stream()
                .collect(Collectors.toList());
    }
}
```
访问`/nacos/services`地址：
![image.png](http://img.zouyh.top/article-img/202501261539042.png)
访问`/nacos/instances/{serviceName}`地址：
![2025-01-26 15 40 33.png](http://img.zouyh.top/article-img/202501261541527.png)
#### 二, nacos配置中心
```pom
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
</dependency>
<dependency>
     <groupId>org.springframework.cloud</groupId>
     <artifactId>spring-cloud-starter-bootstrap</artifactId>
</dependency>
```
注意：默认不在加载bootstrap配置文件，如果项目中要用bootstrap配置文件需要手动添加spring-cloud-starter-bootstrap依赖，否则服务启动会报错
- 多引入一个依赖，application.name写在bootstrap不然失效
- 同名配置（不同配置文件中如果存在相同的配置项）加载顺序
- userservice-dev.yml（当前环境配置profiles） > userservice.yml（nacos上的）> application.yml（本地的）
- 主配置 > 扩展配置(extension-configs) > 共享配置(shared-configs)。
- 同为扩展配置，存在如下优先级关系：extension-configs[3] > extension-configs[2] > extension-configs[1] > extension-configs[0]。
- 同为共享配置，存在如下优先级关系：shared-configs[3] > shared-configs[2] > shared-configs[1] > shared-configs[0]。
简单记为：
- 远程：定位越明确优先级越高，
- 远程和本地：远程的优先级大于本地，
- 本地：扩展配置优先级大于共享配置
- 同为扩展配置或同为共享配置：数组编号越大优先级越高



