---
icon: file-lines
title: SpringCloud项目创建
author: Ms.Zyh
date: 2025-08-24
category:
  - SpringCloud
tag:
  - 进阶
  - SpringCloud
sticky: false
star: false
---

### 一，版本介绍
springboot和springcloud对应版本：https://spring.io/projects/spring-cloud
![image.png](http://img.zouyh.top/article-img/202501261836118.png)
springcloud和SpringCloudAlibaba对应版本：https://github.com/alibaba/spring-cloud-alibaba/wiki/%E7%89%88%E6%9C%AC%E8%AF%B4%E6%98%8E
![image.png](http://img.zouyh.top/article-img/202501261843412.png)

### 二，版本修改
通过idea的springBoot创建项目后
springboot的版本修改：
```xml
<parent>  
    <groupId>org.springframework.boot</groupId>  
    <artifactId>spring-boot-starter-parent</artifactId>  
    <version>2.6.14</version>  
    <relativePath/> 
</parent>
```
JDK的版本修改：
```xml
<properties>  
    <java.version>8</java.version>  
</properties>
```
SpringCloud的版本修改：
```xml
<properties>   
    <spring-cloud.version>2021.0.7</spring-cloud.version>  
</properties>
<dependencyManagement>  
    <dependencies>        
	    <dependency>            
		    <groupId>org.springframework.cloud</groupId>  
	        <artifactId>spring-cloud-dependencies</artifactId>  
	        <version>${spring-cloud.version}</version>  
	        <type>pom</type>  
	        <scope>import</scope>  
	        </dependency>    
	</dependencies>
</dependencyManagement>
```
SpringCloud-alibaba版本修改：
``` xml
<properties>  
    <spring-cloud-alibaba.version>2021.0.5.0</spring-cloud.version>  
</properties>
<dependencyManagement>  
    <dependencies>        
	    <dependency>            
		    <groupId>com.alibaba.cloud</groupId>  
			<artifactId>spring-cloud-alibaba-dependencies</artifactId>  
			<version>${spring-cloud-alibaba.version}</version>
	        <type>pom</type>  
	        <scope>import</scope>  
	        </dependency>    
	</dependencies>
</dependencyManagement>
```
### 三，阿里云创建springboot项目
实现方法：  创建工程时，切换选择 starter 服务路径，然后手工输入阿里云地址即可，地址：`http://start.aliyun.com`：
![2025-03-30 13 37 11.png](http://img.zouyh.top/article-img/202503301342531.png)
注意：阿里云提供的工程创建地址初始化完毕后和使用 SpringBoot 官网创建出来的工程略有区别，主要是在配置文件的形式上有区别。如果不希望有这样的差异存在，可以通过下面普通 Maven工程创建springboot项目中的pom配置文件覆盖方式解决。
### 四，普通 Maven工程创建springboot项目
我们前面介绍的方法都需要联网，或者说我们需要外网的支持。如果我们的环境不满足这些条件我们怎么去创建 SpringBoot 项目呢？
不能上网，还想创建 SpringBoot 工程，能不能做呢？能做，但是你要先问问自己联网和不联网到底差别是什么？这个差别找到以后，你就发现，你把联网要干的事情都提前准备好，就无需联网了。
联网做什么呢？首先 SpringBoot 工程也是基于 Maven 构建的，而 Maven 工程中如果加载一些工程需要使用又不存在的东西时，就要联网去下载。其实 SpringBoot 工程创建的时候就是要去下载一些必要的组件。也就是说你如果maven 仓库中存在这些东西就不需要联网。
下面就手工创建一个 SpringBoot 工程，如果需要使用的东西提前保障在 maven 仓库中存在，整个过程就可以不依赖联网环境了。
第一步: 创建一个普通的maven项目
第二步：修改工程的 pom 文件
```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>zouyh.top</groupId>
    <artifactId>blog</artifactId>
    <version>1.0-SNAPSHOT</version>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>2.3.8.RELEASE</version>
        <relativePath/> <!-- lookup parent from repository -->
    </parent>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <includeSystemScope>true</includeSystemScope>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```
这个你可以直接复制覆盖原来pom文件。

步骤 ③：运行 SpringBoot 工程需要一个类：
```java
@SpringBootApplication  
public class SpringBootApplication {  
    public static void main(String[] args) {  
        SpringApplication.run(SpringBootApplication.class,args);  
    }  
}
```

