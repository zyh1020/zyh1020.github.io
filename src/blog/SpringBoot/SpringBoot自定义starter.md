---
icon: document
# 标题
title: 'SpringBoot自定义starter'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-20
# 一个页面可以有多个分类
category:
  - SpringBoot
# 一个页面可以有多个标签
tag:
  - 进阶
  - SpringBoot
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

在一个空Maven项目中，新增`xxxx-spring-boot-starter`和`xxxx-spring-boot-autoconfigure`两个模块，`xxxx`是你这个starter是做什么的，模块`xxxx-spring-boot-starter`主要是作依赖管理，外界使用我们自定义的starter只需要导入我们`xxxx-spring-boot-starter`模块即可。自定义的`xxxx-spring-boot-autoconfigure`模块，是我们编写自动注入的地方，需要引入了Spring的`spring-boot-starter`模块，这个模块在创建SpringBoot项目的时候会自动引入的，也是必须引入的，通过加载META-INF文件夹下的spring.factories文件完成自动配置的功能以及开箱即用的效果。

### 一，创建项目

#### 1.1 创建空项目

<img src="http://img.zouyh.top/article-img/20240917135056315.png" alt="image-20230313110201135" style="zoom: 50%;" />

输入完项目名称，点击完成进入下图步骤：

<img src="http://img.zouyh.top/article-img/20240917135057319.png" alt="image-20230313110221826" style="zoom: 50%;" />

#### 1.2 创建starter模块  

<img src="http://img.zouyh.top/article-img/20240917135057317.png" alt="image-20230313110552863" style="zoom:50%;" />

选择Maven不需要使用任何模板，点击完成进入下一步

<img src="http://img.zouyh.top/article-img/20240917135057320.png" alt="image-20230313111611479" style="zoom: 50%;" />

输入模块名称，点击完成即可。

#### 1.3 创建autoconfigure模块

继续点击添加模块：

<img src="http://img.zouyh.top/article-img/20240917135056313.png" alt="image-20230313111822093" style="zoom:50%;" />

这次选择，SpringBoot项目，点击下一步

<img src="http://img.zouyh.top/article-img/20240917135057318.png" alt="image-20230313111938730" style="zoom:50%;" />

输入组织名称等信息后，点击下一步

<img src="http://img.zouyh.top/article-img/20240917135056314.png" alt="image-20230313112047738" style="zoom:50%;" />

输入模块名成等信息后，点击完成。

<img src="http://img.zouyh.top/article-img/20240917135056316.png" alt="image-20230313112146465" style="zoom:50%;" />

点击ok，完成创建。

在starter模块中引入自动配置模块：

```xml
<!--启动器-->
<dependencies>
    <!--引入自动配置模块-->
    <dependency>
        <groupId>com.zyh.starter</groupId>
        <artifactId>zyh-springboot-starter-autoconfigurer</artifactId>
        <version>0.0.1-SNAPSHOT</version>
    </dependency>
    <!-- 也可导入其他模块 -->
</dependencies>
```

在autoconfigurer模块中引入了Spring的`spring-boot-starter`模块

```xml
<!--自动引入的 也是必须引入的 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter</artifactId>
</dependency>
```

### 二，编写autoconfigurer模块

#### 2.1 创建自动配置类

仿照WebMvcAutoConfiguration自动配置，简单实现：

创建 `HelloProperties`类：

```java
@ConfigurationProperties(prefix = "zyh.hello")
public class HelloProperties {
    private String prefix;
    private String suffix;
    public String getPrefix() {
        return prefix;
    }
    public void setPrefix(String prefix) {
        this.prefix = prefix;
    }
    public String getSuffix() {
        return suffix;
    }
    public void setSuffix(String suffix) {
        this.suffix = suffix;
    }
}
```

通过`@ConfigurationPropertie `注解将配置文件的内容绑定到实体类，注意：只配置`@ConfigurationProperties`注解，在IOC容器中是获取不到properties配置文件转化的bean。

创建 `HelloServiceAutoConfiguration`类：

```java
@Configuration
@ConditionalOnWebApplication //web应用才生效
@EnableConfigurationProperties(HelloProperties.class) // 将HelloProperties类添加到IOC容器中
public class HelloServiceAutoConfiguration {
    @Autowired
    HelloProperties helloProperties;
    @Bean// 通过 @Bean的方式注入组件
    public HelloService helloService(){
        HelloService service = new HelloService();        
        return service;
    }
}
```

#### 2.2 加载自动配置类

在resources文件夹下创建META-INF/spring.factories文件，文件内容如下：

```properties
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
  com.zyh.HelloServiceAutoConfiguration
```

`\`代表换行，多个自动配置类可以以" , "分割。

在autoconfigurer模块的pom中必须引入了spring-boot-starter，这里我们来解释一下，为什么自定义satrter必须要导入`spring-boot-starter`的原因,springBoot的自动装配的原理，将需要启动就加载的自动配置类，在类路径下，创建META-INF/spring.factories文件。
