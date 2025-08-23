---
icon: document
# 标题
title: '手写zookeeper配置中心'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-02
# 一个页面可以有多个分类
category:
  - zookeeper
# 一个页面可以有多个标签
tag:
  - 推荐
  - zookeeper
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，手写zookeeper配置中心

#### 1.1 实现

pom.xml引入curator去操作zookeeper：

```xml
<dependency>
    <groupId>org.apache.zookeeper</groupId>
    <artifactId>zookeeper</artifactId>
    <version>3.5.7</version>
</dependency>
<dependency>
    <groupId>org.apache.curator</groupId>
    <artifactId>curator-recipes</artifactId>
    <version>4.3.0</version>
    <exclusions>
        <exclusion>
            <groupId>org.apache.zookeeper</groupId>
            <artifactId>zookeeper</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

自定义初始化器 ZkConfigApplicationContextInitializer

```java
public class ZkConfigApplicationContextInitializer implements ApplicationContextInitializer {
    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        // 第一步：创建链接
        CuratorFramework curatorFramework = CuratorFrameworkFactory.builder()
                .connectString("1.15.141.218:2181")
                .connectionTimeoutMs(200000)
                .retryPolicy(new ExponentialBackoffRetry(10000, 3))
                .sessionTimeoutMs(200000)
                .build(); //
        curatorFramework.start();//启动zookeeper客户端curator
        // 第二步：将zookeeper节点保存的配置数据加载到environment中
        try {
            // 获取保存在ck节点的配置
            byte[] bytes = curatorFramework.getData().forPath("/test/mykey");
            Map map = new ObjectMapper().readValue(new String(bytes), Map.class);
            System.out.println("从zookeeper server获取的值：" + map);
            // 将存有值的Map保存到env中的PropertySource中
            MapPropertySource mapPropertySource = new MapPropertySource("mykey", map);
            ConfigurableEnvironment environment = applicationContext.getEnvironment();
            // 将从zookeeper中获取的数据放到environment中的头部位置
            // 因为spring从environment中取值是从前往后遍历寻找，匹配到就返回
            environment.getPropertySources().addFirst(mapPropertySource);
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 第三步：设置永久监听，当zookeeper对应节点的数据发生改变，修改environment中的值
        NodeCache nodeCache = new NodeCache(curatorFramework,"/test/mykey");
        nodeCache.getListenable().addListener(new NodeCacheListener() {
            @Override
            public void nodeChanged() throws Exception {
                System.out.println("节点变化了！！！！");
                updateConfigurableEnvironment(curatorFramework,applicationContext); //获取数据并更新环境
            }
        });
        try {
            nodeCache.start(true);//开启监听 参数 如果设置为true 则开启监听时加载缓存数据
        } catch (Exception e) {
            e.printStackTrace();
        }

    }
    // 获取数据并更新环境
    private void updateConfigurableEnvironment(CuratorFramework curatorFramework,ConfigurableApplicationContext applicationContext){
        try {
            byte[] data = curatorFramework.getData().forPath("/test/mykey");
            Map updateDataMap = new ObjectMapper().readValue(new String(data), Map.class); // 封装新的数据
            ConfigurableEnvironment environment = applicationContext.getEnvironment();
            environment.getPropertySources().replace("mykey", new MapPropertySource("mykey", updateDataMap));
        } catch (JsonProcessingException e) {
            e.printStackTrace();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

}
```

SPI配置：新建 `src/main/resources/META-INF/spring.factories`

```properties
org.springframework.context.ApplicationContextInitializer=\
top.zouyh.zk.config.ZkConfigApplicationContextInitializer
```

本地配置文件application.yml

```yaml
server:
  port: 8081
mykey:
  name: zyh
  age: 18
```

zookeeper的`/test/mykey`节点的值：

```
{"mykey.name":"zouyh11","mykey.age":17}
```

编写测试controller：

```java
@RestController
@RequestMapping("/test")
public class TestController {
    @Autowired
    Environment env;

    @Value("${mykey.name}")
    private String name;
    @Value("${mykey.age}")
    private Integer age;

    @RequestMapping("/one")
    public void one() {
        System.out.println("env: name:"+env.getProperty("mykey.name")+" age:"+env.getProperty("mykey.age"));
        System.out.println("@Value: name:" +name+" age:"+age);
    }

}
```

#### 1.2 测试

第一次访问`http://127.0.0.1:8081/test/one`，查看控制台输出结果：

```
env: name:zouyh11 age17
@Value: name:zouyh11 age:17
```

可以看到读取的是zookeeper的`/test/mykey`节点的值.

更改zookeeper的`/test/mykey`节点的值，更改为如下值：

```
{"mykey.name":"zouyh","mykey.age":18}
```

我是通过prettyZoo工具更新的：

<img src="http://img.zouyh.top/article-img/20240917135103333.png" alt="image-20230328180303497" style="zoom: 67%;" />

点击更新后，再一次访问`http://127.0.0.1:8081/test/one`，查看控制台输出结果：

```
env: name:zouyh11 age:17
@Value: name:zouyh11 age:17
节点变化了！！！！
env: name:zouyh age:18
@Value: name:zouyh11 age:17
```

我们可以看出，env中的值确实改变了，但是没有刷新到@Value上。

#### 1.3 @Value动态刷新的问题

实现@Value动态刷新，先了解一个知识点自定义bean作用域，@Scop注解：

```java
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Scope {
    @AliasFor("scopeName")
    String value() default "";

    @AliasFor("value")
    String scopeName() default "";

    ScopedProxyMode proxyMode() default ScopedProxyMode.DEFAULT;
}
```

value的取值：spring容器自带的有2种作用域，分别是singleton和prototype；还有3种分别是spring web容器环境中才支持的request、session、application。

ScopedProxyMode类型的枚举，值有下面4个：

```java
public enum ScopedProxyMode {
    DEFAULT,
    NO,
    INTERFACES,
    TARGET_CLASS;
}
```

前面3个，不讲了，直接讲最后一个值是干什么的。当@Scope中proxyMode为TARGET_CLASS的时候，会给当前创建的bean通过cglib生成一个代理对象，通过这个代理对象来访问目标bean对象。理解起来比较晦涩，还是来看代码吧，容易理解一些，来个自定义的Scope案例。自定义scope 4个步骤，实现Scope接口，自定义一个bean作用域的注解，将实现类注册到spring容器，使用自定义的sope

第一步：实现`org.springframework.beans.factory.config.Scope`接口：

```java
public class BeanRefreshScope implements Scope {

    public static final String SCOPE_REFRESH = "refresh";

    private static final BeanRefreshScope INSTANCE = new BeanRefreshScope();

    // 来个map用来缓存bean,
    private ConcurrentHashMap<String, Object> beanMap = new ConcurrentHashMap<>(); //@1

    private BeanRefreshScope() {
    }

    public static BeanRefreshScope getInstance() {
        return INSTANCE;
    }

    // 清除缓存
    public static void clean() {
        INSTANCE.beanMap.clear();
    }

    @Override
    public Object get(String name, ObjectFactory<?> objectFactory) {
        Object bean = beanMap.get(name); // 没有更新配置的话就从beanMap中获取缓存的bean
        if (bean == null) { 
            bean = objectFactory.getObject();
            beanMap.put(name, bean);
        }
        return bean;
    }

    @Override
    public Object remove(String s) {
        return null;
    }

    @Override
    public void registerDestructionCallback(String s, Runnable runnable) {

    }

    @Override
    public Object resolveContextualObject(String s) {
        return null;
    }

    @Override
    public String getConversationId() {
        return null;
    }

}
```

第二步：自定义一个bean作用域的注解：

```cobol
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Scope(BeanRefreshScope.SCOPE_REFRESH)
@Documented
public @interface RefreshScope {
    ScopedProxyMode proxyMode() default ScopedProxyMode.TARGET_CLASS; //@1
}
```

第三步：将实现类注册到spring容器

```java
@SpringBootApplication
public class App {
    public static void main(String[] args) {
        ConfigurableApplicationContext context = SpringApplication.run(App.class, args);
        context.getBeanFactory().registerScope(BeanRefreshScope.SCOPE_REFRESH, BeanRefreshScope.getInstance());
    }
}
```

第四步：使用自定义的sope

```java
@RefreshScope
@Component
@Data
public class MyKey {
    @Value("${mykey.name}")
    private String name;
    @Value("${mykey.age}")
    private Integer age;
}
```

修改ZkConfigApplicationContextInitializer中的代码，在我们监听到配置改变的时候清空，调用` BeanRefreshScope.clean();`方法清空缓存的。

```java
public class ZkConfigApplicationContextInitializer implements ApplicationContextInitializer {
    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        // 第一步：创建链接
        CuratorFramework curatorFramework = CuratorFrameworkFactory.builder()
                .connectString("14.44.44.44:2181")
                .connectionTimeoutMs(200000)
                .retryPolicy(new ExponentialBackoffRetry(10000, 3))
                .sessionTimeoutMs(200000)
                .build(); //
        curatorFramework.start();//启动zookeeper客户端curator
        // 第二步：将zookeeper节点保存的配置数据加载到environment中
        try {
            // 获取保存在ck节点的配置
            byte[] bytes = curatorFramework.getData().forPath("/test/mykey");
            Map map = new ObjectMapper().readValue(new String(bytes), Map.class);
            System.out.println("从zookeeper server获取的值：" + map);
            // 将存有值的Map保存到env中的PropertySource中
            MapPropertySource mapPropertySource = new MapPropertySource("mykey", map);
            ConfigurableEnvironment environment = applicationContext.getEnvironment();
            // 将从zookeeper中获取的数据放到environment中的头部位置
            // 因为spring从environment中取值是从前往后遍历寻找，匹配到就返回
            environment.getPropertySources().addFirst(mapPropertySource);
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 第三步：设置永久监听，当zookeeper对应节点的数据发生改变，修改environment中的值
        NodeCache nodeCache = new NodeCache(curatorFramework,"/test/mykey");
        nodeCache.getListenable().addListener(new NodeCacheListener() {
            @Override
            public void nodeChanged() throws Exception {
                System.out.println("节点变化了！！！！");
                updateConfigurableEnvironment(curatorFramework,applicationContext); //获取数据并更新环境
            }
        });
        try {
            nodeCache.start(true);//开启监听 参数 如果设置为true 则开启监听时加载缓存数据
        } catch (Exception e) {
            e.printStackTrace();
        }

    }
    // 获取数据并更新环境
    private void updateConfigurableEnvironment(CuratorFramework curatorFramework,ConfigurableApplicationContext applicationContext){
        try {
            byte[] data = curatorFramework.getData().forPath("/test/mykey");
            // 封装新的数据
            Map updateDataMap = new ObjectMapper().readValue(new String(data), Map.class);
            ConfigurableEnvironment environment = applicationContext.getEnvironment();
            environment.getPropertySources().replace("mykey", new MapPropertySource("mykey", updateDataMap));
            BeanRefreshScope.clean();// 清除原来的，相比较之前的就添加了如下代码
        } catch (JsonProcessingException e) {
            e.printStackTrace();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

}
```

#### 1.4 再测试

```java
@RestController
@RequestMapping("/test")
public class TestController {
    @Autowired
    private Environment env;
    
    @Autowired
    private MyKey myKey;
    
    @Value("${mykey.name}")
    private String name;
    @Value("${mykey.age}")
    private Integer age;
    
    @RequestMapping("/one")
    public void one() {
        System.out.println("env: name:"+env.getProperty("mykey.name")+" age:"+env.getProperty("mykey.age"));
        System.out.println("@Value: name:" +name+" age:"+age);
        System.out.println("MyKey: "+myKey+" name:" +myKey.getName()+" age:"+myKey.getAge());
    }

}
```

第一次访问`http://127.0.0.1:8081/test/one`，查看控制台输出结果：

```sh
env: name:zouyh age:18
@Value: name:zouyh age:18
MyKey: top.zouyh.zk.config.MyKey@34efd703 name:zouyh age:18
```

我是通过prettyZoo工具更新zookeeper节点的值的：

<img src="http://img.zouyh.top/article-img/20240917135103333.png" alt="image-20230328180303497" style="zoom: 67%;" />

查看控制台输出结果：可以看出打印了节点变化了！！！！说明监听到改变了

```
节点变化了！！！！
```

再一次访问`http://127.0.0.1:8081/test/one`，查看控制台输出结果：

```
env: name:zouyh age:18
@Value: name:zouyh age:18
MyKey: top.zouyh.zk.config.MyKey@34efd703 name:zouyh age:18
节点变化了！！！！
env: name:zouyh11 age:17
@Value: name:zouyh age:18
MyKey: top.zouyh.zk.config.MyKey@fa0fcd4 name:zouyh11 age:17
```

对比可以看出，我们通过自定义Scope实现了更新，对MyKey中的@Value的更新了，至于TestController的@Value没有更新是因为我们没有使用自定义的Scope，自定义Scope实现@Value的更新是通过重新生成对象来实现的，自定义Scope的作用范围类似于pring web容器环境中才支持的request、session、application，自定义的是再每一次更新配置后就清除缓存的对象，重新创建新的对象。通过自定义Scope实现了更新@value的值不会更改没有添加个注解的值，比如`server.prot`的值，这里只是我们写着玩的。

### 二，Spring Cloud Zookeeper实现配置中心

#### 2.1 配置

pom配置：

```xml
<properties>
	<spring.boot.version>2.2.4.RELEASE</spring.boot.version>
	<spring.cloud.version>Hoxton.SR1</spring.cloud.version>
</properties>
<!-- 基础包 -->
<parent>
	<groupId>org.springframework.boot</groupId>
	<artifactId>spring-boot-starter-parent</artifactId>
	<version>2.2.4.RELEASE</version>
</parent>
<!--定义版本的管理-->
<dependencyManagement>
	<dependencies>
		<!--定义spring cloud的版本-->
		<dependency>
			<groupId>org.springframework.cloud</groupId>
			<artifactId>spring-cloud-dependencies</artifactId>
			<version>Hoxton.SR1</version>
			<type>pom</type>
			<scope>import</scope>
		</dependency>
	</dependencies>
</dependencyManagement>
<dependencies>
	<dependency>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-web</artifactId>
	</dependency>
	<!-- spring cloud zookeeper config 配置中心-->
	<dependency>
		<groupId>org.springframework.cloud</groupId>
		<artifactId>spring-cloud-starter-zookeeper-config</artifactId>
	</dependency>
</dependencies>
```

在resources文件夹下，新增bootstrap.yml文件，文件内容如下：

```yaml
server:
  port: 8001

spring:
  application:
    name: my-config
  cloud:
    zookeeper:
      config:
        root: /config
        profile-separator: ","
        enabled: true
      connect-string: 1.15.141.218:2181
      session-timeout: 200000
      connection-timeout: 200000
      max-retries: 10
```

- bootstrap.yml在application.yml之前加载，一般在spring cloud使用配置中心时使用；
- bootstrap.yml同名属性会被application.yml覆盖；

application.yml的配置如下：

```yaml
server:
  port: 8002
mykey:
  name: zyh
  age: 18
```

测试controller，通过添加`@RefreshScope`注解实现刷新环境

```java
@RestController
@RequestMapping("/test")
@RefreshScope
public class TestController {
    @Autowired
    private Environment env;
    
    @Value("${mykey.name}")
    private String name;
    @Value("${mykey.age}")
    private Integer age;

    @RequestMapping("/one")
    public void one() {
        System.out.println("env: name:"+env.getProperty("mykey.name")+" age:"+env.getProperty("mykey.age"));
        System.out.println("@Value: name:" +name+" age:"+age);
    }

}
```

#### 2.2 测试

启动项目后，第一次访问`http://127.0.0.1:8002/test/one`，查看控制台输出：

```
env: name:zyh age:18
@Value: name:zyh age:18
```

在zookeeper中创建配置，创建格式如下图：

<img src="http://img.zouyh.top/article-img/20240917135101329.png" alt="image-20230330152851653" style="zoom:67%;" />

添加完成后，再一次访问`http://127.0.0.1:8002/test/one`，查看控制台输出：

```
env: name:zyh1020 age:17
@Value: name:zyh1020 age:17
```

总结：zookeeper不会自动配置创建节点的，项目启动时默认使用的是bootstrap.yml和application.yml的配置，如果zookeeper中存在配置才会使用zookeeper中的配置。

#### 2.3 多环境配置

多环境是用`,`区分的，是我们在bootstrap.yml中配置的`spring.cloud.zookeeper.config.profile-separator`的作用就是用于去区分环境的，不同环境格式如下：

```properties
spring.application.name + spring.cloud.zookeeper.config.profile-separator + dev/prod/test
```

例如，新增测试环境`my-config,dev`和生产环境`my-config,prod`节点：

<img src="http://img.zouyh.top/article-img/20240917135102330.png" alt="image-20230331103011081" style="zoom: 67%;" />



设置项目启动加载的环境：

<img src="http://img.zouyh.top/article-img/20240917135102331.png" alt="image-20230331101421134" style="zoom: 50%;" />

因为启动的是dev环境，访问`http://127.0.0.1:8003/test/one`后查看控制台输出：

```
env: name:zyh-dev age:20
@Value: name:zyh-dev age:20
```

可以看到，确实启动了测试环境的配置，设置项目启动加载的环境为prod就会加载生产环境的，这里就不测试了。

#### 2.4 补充EnvironmentChangeEvent

通过 @ConfigurationProperties 或者 @Value + @RefreshScope 注解，已经能够满足我们绝大多数场景下的自动刷新配置的功能。但是，在一些场景下，我们仍然需要实现对配置的监听，执行自定义的逻辑。例如说，当数据库连接的配置发生变更时，我们需要通过监听该配置的变更，重新初始化应用中的数据库连接，从而访问到新的数据库地址。在 Spring Cloud 中，在 Environment 的属性配置发生变化时，会发布 EnvironmentChangeEvent 事件。这样，我们只需要实现 EnvironmentChangeEvent 事件的监听器，就可以进行自定义的逻辑处理。

#### 2.5 SpringCloud Zookeeper实现原理

在/spring-cloud-context-2.2.1.RELEASE.jar!/META-INF/spring.factories文件中：

```properties
# AutoConfiguration
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
org.springframework.cloud.autoconfigure.ConfigurationPropertiesRebinderAutoConfiguration,\
org.springframework.cloud.autoconfigure.LifecycleMvcEndpointAutoConfiguration,\
org.springframework.cloud.autoconfigure.RefreshAutoConfiguration,\
org.springframework.cloud.autoconfigure.RefreshEndpointAutoConfiguration,\
org.springframework.cloud.autoconfigure.WritableEnvironmentEndpointAutoConfiguration
# Application Listeners
org.springframework.context.ApplicationListener=\
org.springframework.cloud.bootstrap.BootstrapApplicationListener,\
org.springframework.cloud.bootstrap.LoggingSystemShutdownListener,\
org.springframework.cloud.context.restart.RestartListener
# Bootstrap components
org.springframework.cloud.bootstrap.BootstrapConfiguration=\
org.springframework.cloud.bootstrap.config.PropertySourceBootstrapConfiguration,\
org.springframework.cloud.bootstrap.encrypt.EncryptionBootstrapConfiguration,\
org.springframework.cloud.autoconfigure.ConfigurationPropertiesRebinderAutoConfiguration,\
org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration
```

@RefreshScope注解源码：

```java
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Scope("refresh")
@Documented
public @interface RefreshScope {
    ScopedProxyMode proxyMode() default ScopedProxyMode.TARGET_CLASS;
}
```

可以看到使用的是`@Scope("refresh")`和`ScopedProxyMode proxyMode() default ScopedProxyMode.TARGET_CLASS;`和我们在手写zookeeper实现配置中心，为解决@Value动态刷新问题，自定义@RefreshScope基本上是一样的。

RefreshScope的继承图如下：

![image-20230331150403524](http://img.zouyh.top/article-img/20240917135102332.png)

RefreshScope的继承`GenericScope`而`GenericScope`继承`BeanFactoryPostProcessor`和`Scope`，同时实现了`ApplicationEvent`

自定义的Scope，需要注册的，RefreshScope是通过实现`BeanFactoryPostProcessor`的postProcessBeanFactory方法实现注册的，但是RefreshScope没有直接实现，它的父类GenericScope实现了postProcessBeanFactory方法，如下：

```java
public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) throws BeansException {
	this.beanFactory = beanFactory;
	beanFactory.registerScope(this.name, this); // 注册Scope
	this.setSerializationId(beanFactory);
}
```

添加了`@RefreshScope`注解的`Bean`对象会被`@ComponentScan`注解扫描到，核心代码在`ClassPathBeanDefinitionScanner`类中的`doScan`方法中：

```java
protected Set<BeanDefinitionHolder> doScan(String... basePackages) {
	Assert.notEmpty(basePackages, "At least one base package must be specified");
	Set<BeanDefinitionHolder> beanDefinitions = new LinkedHashSet();
	String[] var3 = basePackages;
	int var4 = basePackages.length;

	for(int var5 = 0; var5 < var4; ++var5) {
		String basePackage = var3[var5];
		Set<BeanDefinition> candidates = this.findCandidateComponents(basePackage);
		Iterator var8 = candidates.iterator();

		while(var8.hasNext()) {
			BeanDefinition candidate = (BeanDefinition)var8.next();
			ScopeMetadata scopeMetadata = this.scopeMetadataResolver.resolveScopeMetadata(candidate);
			candidate.setScope(scopeMetadata.getScopeName());
			String beanName = this.beanNameGenerator.generateBeanName(candidate, this.registry);
			if (candidate instanceof AbstractBeanDefinition) {
				this.postProcessBeanDefinition((AbstractBeanDefinition)candidate, beanName);
			}

			if (candidate instanceof AnnotatedBeanDefinition) {
				AnnotationConfigUtils.processCommonDefinitionAnnotations((AnnotatedBeanDefinition)candidate);
			}

			if (this.checkCandidate(beanName, candidate)) {
				BeanDefinitionHolder definitionHolder = new BeanDefinitionHolder(candidate, beanName);
				definitionHolder = AnnotationConfigUtils.applyScopedProxyMode(scopeMetadata, definitionHolder, this.registry);
				beanDefinitions.add(definitionHolder);
				this.registerBeanDefinition(definitionHolder, this.registry);
			}
		}
	}

	return beanDefinitions;
}
```

上面中核心代码在`this.scopeMetadataResolver.resolveScopeMetadata(candidate)`这一行，这里就不展开讲了，注册的`Scope`将会在`AbstractBeanFactory#doGetBean`方法中调用，该方法中会先拿到当前`BeanDefinition`中定义的`Scope`，通过`scopeName`从`Map`集合中拿到`Scope`类，最后调用`Scope`的`get`方法获取实例对象，`AbstractBeanFactory#doGetBean`方法如下：

```java
protected <T> T doGetBean(
   String name, @Nullable Class<T> requiredType, @Nullable Object[] args, boolean typeCheckOnly)
   throws BeansException {
	// 省略部分代码
	String scopeName = mbd.getScope();
	if (!StringUtils.hasLength(scopeName)) {
		throw new IllegalStateException("No scope name defined for bean '" + beanName + "'");
	}
	// 1.从缓存中取，在beanFactory的registerScope方法调用时放入缓存
	Scope scope = this.scopes.get(scopeName);
	if (scope == null) {
		throw new IllegalStateException("No Scope registered for scope name '" + scopeName + "'");
	}
	try {
		// 2.调用scope的get方法创建bean，通过匿名内部类创建ObjectFactory对象并实现getObject方法。在GenericScope的get方法会回调此处的实现，创建一个bean。
		Object scopedInstance = scope.get(beanName, () -> {
			beforePrototypeCreation(beanName);
			try {
				return createBean(beanName, mbd, args);
			}
			finally {
				afterPrototypeCreation(beanName);
			}
		});
		beanInstance = getObjectForBeanInstance(scopedInstance, name, beanName, mbd);
	}catch (IllegalStateException ex) {
		throw new ScopeNotActiveException(beanName, scopeName, ex);
	}
	// 省略部分代码
}
```

RefreshScope没有直接实现get方法，它的父类GenericScope实现了get方法，如下：

```java
public Object get(String name, ObjectFactory<?> objectFactory) {
    // 基本思路，也是从缓存中获取
	GenericScope.BeanLifecycleWrapper value = this.cache.put(name, new GenericScope.BeanLifecycleWrapper(name, objectFactory));
	this.locks.putIfAbsent(name, new ReentrantReadWriteLock());
	try {
		return value.getBean();
	} catch (RuntimeException var5) {
		this.errors.put(name, var5);
		throw var5;
	}
}
```

​	基本思路，也是从缓存中获取，和我们在手写zookeeper实现配置中心，为解决@Value动态刷新问题，自定义BeanRefreshScope 实现Scope的get方法相似。

到这自定`@RefreshScope`注解获取如何将对象缓存的已经解释完了，但是如何清空缓存的呢？

当配置中心刷新配置之后，有两种方式可以动态刷新Bean的配置变量值：

- 方式一：向上下文发布一个`RefreshEvent`事件
- 方式二：`Http`访问`/refresh`这个`EndPoint`（zookeeper cloud采用的是）

方式一：RefreshEventListener事件监听到RefreshEvent事件通过`ContextRefresher`进行刷新

```java
public class RefreshEventListener implements SmartApplicationListener {
    private static Log log = LogFactory.getLog(RefreshEventListener.class);
    private ContextRefresher refresh;
    private AtomicBoolean ready = new AtomicBoolean(false);

    public RefreshEventListener(ContextRefresher refresh) {
        this.refresh = refresh;
    }

    public boolean supportsEventType(Class<? extends ApplicationEvent> eventType) {
        return ApplicationReadyEvent.class.isAssignableFrom(eventType) || RefreshEvent.class.isAssignableFrom(eventType);
    }

    public void onApplicationEvent(ApplicationEvent event) {
        if (event instanceof ApplicationReadyEvent) {
            this.handle((ApplicationReadyEvent)event);
        } else if (event instanceof RefreshEvent) { // 初始刷新
            this.handle((RefreshEvent)event);
        }

    }

    public void handle(ApplicationReadyEvent event) {
        this.ready.compareAndSet(false, true);
    }

    public void handle(RefreshEvent event) {
        if (this.ready.get()) {
            log.debug("Event received " + event.getEventDesc());
            Set<String> keys = this.refresh.refresh();
            log.info("Refresh keys changed: " + keys);
        }

    }
}
```

方式二：`RefreshEndpoint`端点也是通过`ContextRefresher`进行刷新

```java
@Endpoint( id = "refresh")
public class RefreshEndpoint {
    private ContextRefresher contextRefresher;

    public RefreshEndpoint(ContextRefresher contextRefresher) {
        this.contextRefresher = contextRefresher;
    }

    @WriteOperation
    public Collection<String> refresh() {
        Set<String> keys = this.contextRefresher.refresh();
        return keys;
    }
}
```

跟进``this.contextRefresher.refresh()`方法：

```java
public synchronized Set<String> refresh() {
    // 1.刷新环境
	Set<String> keys = this.refreshEnvironment();
    // 2.清空缓存
	this.scope.refreshAll();
	return keys;
}
```

1.刷新环境跟进`Set<String> keys = this.refreshEnvironment();`方法：

```java
public synchronized Set<String> refreshEnvironment() {
    	// 提取配置信息修改之前的值，排除systemEnvironment、systemProperties、jndiProperties、servletConfigInitParams、servletContextInitParams、configurationProperties相关配置
        Map<String, Object> before = this.extract(this.context.getEnvironment().getPropertySources());
        // 重新加载读取配置信息
    this.addConfigFilesToEnvironment();
    	// 获取所有改变的配置
        Set<String> keys = this.changes(before, this.extract(this.context.getEnvironment().getPropertySources())).keySet();
    	// 发布EnvironmentChangeEvent事件
        this.context.publishEvent(new EnvironmentChangeEvent(this.context, keys));
        return keys;
    }

```

2.清空缓存，跟进`this.scope.refreshAll();`方法，RefreshScope#refreshAll方法：

```java
public void refreshAll() {
	super.destroy();//  调用父类的GenericScope的destroy方法
	this.context.publishEvent(new RefreshScopeRefreshedEvent()); // RefreshScopeRefreshedEvent事件
}
```

调用父类的GenericScope的destroy方法：

```java
public void destroy() {
	List<Throwable> errors = new ArrayList();
     //清空缓存
	Collection<GenericScope.BeanLifecycleWrapper> wrappers = this.cache.clear();
	Iterator var3 = wrappers.iterator();

	while(var3.hasNext()) {
		GenericScope.BeanLifecycleWrapper wrapper = (GenericScope.BeanLifecycleWrapper)var3.next();
		try {
			Lock lock = ((ReadWriteLock)this.locks.get(wrapper.getName())).writeLock();
			lock.lock();
			try {
                //清空上次创建的对象信息
				wrapper.destroy();
			} finally {
				lock.unlock();
			}
		} catch (RuntimeException var10) {
			errors.add(var10);
		}
	}

	if (!errors.isEmpty()) {
		throw wrapIfNecessary((Throwable)errors.get(0));
	} else {
		this.errors.clear();
	}
}
```

当前清空了缓存对象后，下次再进入注入的时候会再次调用`ObjectFacotry#getObject`方法创建新的对象。

补充：当触发了`refresh`后，所有的带有`@ConfigurationProperties`注解的Bean都会自动的刷新并不需要`@RefreshScope`注解。而有`@RefreshScope`注解的一般在应用在非配置类上，有成员属性使用`@Value`注解的，例如我们写的测试类：

```java
@RestController
@RequestMapping("/test")
@RefreshScope
public class TestController {
    @Autowired
    private Environment env;

    @Autowired
    private MyKey myKey;

    @Value("${mykey.name}")
    private String name;
    @Value("${mykey.age}")
    private Integer age;

    @RequestMapping("/one")
    public void one() {
        System.out.println("env: name:"+env.getProperty("mykey.name")+" age:"+env.getProperty("mykey.age"));
        System.out.println("@Value: name:" +name+" age:"+age);
        System.out.println("MyKey: "+myKey+" name:" +myKey.getName()+" age:"+myKey.getAge());
    }

}
```

MyKey：

```java
@Component
@ConfigurationProperties(prefix = "mykey")
public class MyKey {
    private String name;
    private Integer age;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getAge() {
        return age;
    }

    public void setAge(Integer age) {
        this.age = age;
    }
}
```

第一次访问`http://127.0.0.1:8003/test/one`，控制台输出：

```
env: name:zyh age:16
@Value: name:zyh age:16
MyKey: top.zouyh.zk.controller.MyKey@44399567 name:zyh age:16
```

更爱zookeeper后，查看控制台输出：

```
env: name:zyh11 age:16
@Value: name:zyh11 age:16
MyKey: top.zouyh.zk.controller.MyKey@44399567 name:zyh11 age:16
```

可以发现MyKey带有`@ConfigurationProperties`注解会自动的刷新并不需要`@RefreshScope`注解，而TestController的成员属性使用`@Value`注解的，需要使用`@RefreshScope`注解。
