---
icon: file-lines
# 标题
title: '手写zookeeper注册中心'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-08
# 一个页面可以有多个分类
category:
  - zookeeper
# 一个页面可以有多个标签
tag:
  - 偏僻
  - zookeeper
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，手写zookeeper注册中心

#### 1.1 服务注册

​	springboot项目启动时，自定义监听器ApplicationListener去监听web服务启动事件，触发事件回调方法，在回调方法中，在zookeeper指定节点下创建临时节点，临时节点的值保存当前项目启动的 ip + port。

##### 1.1.1 pom.xml

引入zookeeper操作jar：

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

##### 1.1.2 application.yml

配置服务注册信息：

```yaml
zookeeper:
  service:
    name: test-service
    ip: 10.73.237.47
    port: 8002
```

##### 1.1.3 监听器 ApplicationListener

监听spring web服务器已经初始化完成事件 WebServerInitializedEvent:

```java
@Component
public class ZkApplicationListener implements ApplicationListener<WebServerInitializedEvent> {
    @Override
    public void onApplicationEvent(WebServerInitializedEvent webServerInitializedEvent) {
        Environment environment = webServerInitializedEvent.getApplicationContext().getEnvironment();
        String serviceName = environment.getProperty("zookeeper.service.name");
        String serviceIp = environment.getProperty("zookeeper.service.ip");
        String servicePort = environment.getProperty("zookeeper.service.port");
        String serviceNamePath = "/service/" + serviceName;
        try {
            // 判断服务名称是否存在，不存在就创建，持久化节点
            if(ZookeeperUtils.curatorFramework.checkExists().forPath(serviceNamePath)==null){
                ZookeeperUtils.curatorFramework.create()
                        .creatingParentsIfNeeded()
                        .withMode(CreateMode.PERSISTENT)
                        .forPath(serviceNamePath);
            }

            // 开始服务注册，创建临时节点
            ZookeeperUtils.curatorFramework.create()
                    .withMode(CreateMode.EPHEMERAL)
                    .forPath(serviceNamePath + "/" + serviceIp + ":" + servicePort);
            System.out.println("注册完成serviceName:"+serviceName+" serviceIp"+":" + servicePort);
        } catch (Exception e) {
            e.printStackTrace();
        }

    }
}

```

ZookeeperUtils链接工具：

```java
public class ZookeeperUtils {
    public static final CuratorFramework curatorFramework;
    static {
        // 第一步：创建链接
        curatorFramework = CuratorFrameworkFactory.builder()
                .connectString("1.15.141.218:2181")
                .connectionTimeoutMs(200000)
                .retryPolicy(new ExponentialBackoffRetry(10000, 3))
                .sessionTimeoutMs(200000)
                .build(); //
        curatorFramework.start();//启动zookeeper客户端curator
    }

}
```

注意：我这里使用的是`@Component`注解方式引入监听器，在第三方框架中是使用的是SPI的方式：

在resources目录下创建/META-INF/spring.factories文件，文件内容如下：

##### 1.1.4 测试结果

控制台输出：

```
注册完成serviceName:test-service serviceIp:8002
```

zookeeper数据：

<img src="http://img.zouyh.top/article-img/20240917135103334.png" alt="image-20230403103618713" style="zoom:80%;" />

#### 1.2 服务发现

​	项目启动时自动获取zookeeper中配置的需要调用的服务所有可用url列表，这是利用zookeeper临时节点特性，如果某个服务节点宕机，那么对应临时节点会在一定时间后自动删除，在访问服务时，可以根据负载均衡算法从可用的服务url列表中获取某个节点url。

##### 1.2.1 pom.xml

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

##### 1.2.2  拉取并监听

```java
@Component
public class ServiceList {
    public static final String serviceNamePath = "/service";
    public static final Map<String, List<String>> serviceMap = new HashMap<>();
    static {
        getServices();
        addListener();
    }
    private static void getServices(){
        try {
            if(ZookeeperUtils.curatorFramework.checkExists().forPath(serviceNamePath) != null){
                List<String> services = ZookeeperUtils.curatorFramework.getChildren().forPath(serviceNamePath);
                for (String service : services) {
                    serviceMap.put(service, ZookeeperUtils.curatorFramework.getChildren().forPath(serviceNamePath+"/"+service));

                }
                System.out.println("服务拉取成功！");
                Set<String> forServices = ServiceList.serviceMap.keySet();
                for (String serviceTemp : forServices) {
                    System.out.println("serviceName:"+serviceTemp);
                    List<String> serviceUrl = ServiceList.serviceMap.get(serviceTemp);
                    System.out.println(serviceUrl);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void addListener(){
        TreeCache nodeCache = new TreeCache(ZookeeperUtils.curatorFramework,serviceNamePath);
        nodeCache.getListenable().addListener(new TreeCacheListener() {
            @Override
            public void childEvent(CuratorFramework curatorFramework, TreeCacheEvent treeCacheEvent) throws Exception {
                getServices();
            }
        });
        try {
            nodeCache.start();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

}
```

ZookeeperUtils链接工具：

```java
public class ZookeeperUtils {
    public static final CuratorFramework curatorFramework;
    static {
        // 第一步：创建链接
        curatorFramework = CuratorFrameworkFactory.builder()
                .connectString("1.15.141.218:2181")
                .connectionTimeoutMs(200000)
                .retryPolicy(new ExponentialBackoffRetry(10000, 3))
                .sessionTimeoutMs(200000)
                .build(); //
        curatorFramework.start();//启动zookeeper客户端curator
    }

}
```

##### 1.2.3 测试结果

控制台输出：

```
服务拉取成功！
serviceName:test-service
[10.73.237.47:8002]
```

关闭`10.73.237.47:8002`服务，看看是否能通过监听，删除该节点url：

```
服务拉取成功！
serviceName:test-service
[]
```

### 二，Spring Cloud Zookeeper实现注册中心

#### 2.1 pom.xml

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
		<artifactId>spring-cloud-starter-zookeeper-discovery</artifactId>
	</dependency>
</dependencies>
```

#### 2.2 application.yml

```yaml
server:
  port: 8002
  address: 10.73.237.47

spring:
  cloud:
    zookeeper:
      connect-string: 1.15.141.218:2181
      discovery:
        root: /services
  application:
    name: test-service
```

#### 2.3 测试

启动项目，查看zookeeper数据：

<img src="http://img.zouyh.top/article-img/20240917135104335.png" alt="image-20230403155017775" style="zoom: 80%;" />

可以发现信息已经填写上去了。

#### 2.4 服务发现

```java
@RestController
@RequestMapping("/test")
public class TestController {
    // 1.注入服务发现客户端接口
    @Autowired
    private DiscoveryClient discoveryClient;

    @RequestMapping("/one")
    public List<ServiceInstance> testOne(){
        // 2.调用getInstances方法可获得所有可用实例
        List<ServiceInstance> instances = discoveryClient.getInstances("test-service");
        String url = instances.get(0).getUri().toString();
        System.out.println("url=" + url);
        return discoveryClient.getInstances("test-service");
    }
}
```

控制台输出结果：

```
url=http://DESKTOP-P1EQ07J.mshome.net:8002
```

访问结果：

```json
[{"serviceId":"test-service","host":"DESKTOP-P1EQ07J.mshome.net","port":8002,"secure":false,"uri":"http://DESKTOP-P1EQ07J.mshome.net:8002","metadata":{},"serviceInstance":{"name":"test-service","id":"52d26182-d7aa-4704-b2a8-6a557f9e2db8","address":"DESKTOP-P1EQ07J.mshome.net","port":8002,"sslPort":null,"payload":{"id":"application-1","name":"test-service","metadata":{}},"registrationTimeUTC":1680508528147,"serviceType":"DYNAMIC","uriSpec":{"parts":[{"value":"scheme","variable":true},{"value":"://","variable":false},{"value":"address","variable":true},{"value":":","variable":false},{"value":"port","variable":true}]},"enabled":true},"instanceId":"52d26182-d7aa-4704-b2a8-6a557f9e2db8","scheme":null}]
```

#### 2.5 原理

监听器AbstractAutoServiceRegistration监听web容器启动类似于我们手动实现服务注册，Spring Cloud也自定义了一个监听器 `AbstractAutoServiceRegistration `去监听 web服务器启动事件 WebServerInitializedEvent

```java
public abstract class AbstractAutoServiceRegistration<R extends Registration> implements AutoServiceRegistration, ApplicationContextAware, ApplicationListener<WebServerInitializedEvent> {
	public void onApplicationEvent(WebServerInitializedEvent event) {
        this.bind(event); // 跟进
    }
    @Deprecated
    public void bind(WebServerInitializedEvent event) {
        ApplicationContext context = event.getApplicationContext();
        if (!(context instanceof ConfigurableWebServerApplicationContext) || !"management".equals(((ConfigurableWebServerApplicationContext)context).getServerNamespace())) {
            this.port.compareAndSet(0, event.getWebServer().getPort()); // 获取端口号
            this.start();
        }
    }
}
```

继续跟进` this.start();`方法：

```java
public void start() {
	if (!this.isEnabled()) {
		if (logger.isDebugEnabled()) {
			logger.debug("Discovery Lifecycle disabled. Not starting");
		}

	} else {
		if (!this.running.get()) {
            // 发布事件注册服务之前事件
			this.context.publishEvent(new InstancePreRegisteredEvent(this, this.getRegistration()));
			this.register(); // 注册服务
			if (this.shouldRegisterManagement()) {
				this.registerManagement();
			}
			// 发布事件注册服务之前事件
			this.context.publishEvent(new InstanceRegisteredEvent(this, this.getConfiguration()));
			this.running.compareAndSet(false, true);
		}

	}
}
```

跟进`this.register();`方法：

```java
protected void register() {
   this.serviceRegistry.register(this.getRegistration());
}
```

跟进`ZookeeperServiceRegistry#register`方法:

```java
public void registerService(ServiceInstance<T> service) throws Exception {
	ServiceDiscoveryImpl.Entry<T> newEntry = new ServiceDiscoveryImpl.Entry(service);
	ServiceDiscoveryImpl.Entry<T> oldEntry = (ServiceDiscoveryImpl.Entry)this.services.putIfAbsent(service.getId(), newEntry);
	ServiceDiscoveryImpl.Entry<T> useEntry = oldEntry != null ? oldEntry : newEntry;
	synchronized(useEntry) {
		if (useEntry == newEntry) {
			useEntry.cache = this.makeNodeCache(service);// 创建节点监听
		}

		this.internalRegisterService(service); // 创建zookeeper节点
	}
}
```

创建监听，跟进`this.makeNodeCache(service)`方法：

```java
private NodeCache makeNodeCache(final ServiceInstance<T> instance) {
	if (!this.watchInstances) {
		return null;
	} else {
		final NodeCache nodeCache = new NodeCache(this.client, this.pathForInstance(instance.getName(), instance.getId()));

		try {
			nodeCache.start(true);
		} catch (InterruptedException var4) {
			Thread.currentThread().interrupt();
			return null;
		} catch (Exception var5) {
			this.log.error("Could not start node cache for: " + instance, var5);
		}

		NodeCacheListener listener = new NodeCacheListener() {
			public void nodeChanged() throws Exception {
				if (nodeCache.getCurrentData() != null) {
					ServiceInstance<T> newInstance = ServiceDiscoveryImpl.this.serializer.deserialize(nodeCache.getCurrentData().getData());
					ServiceDiscoveryImpl.Entry<T> entry = (ServiceDiscoveryImpl.Entry)ServiceDiscoveryImpl.this.services.get(newInstance.getId());
					if (entry != null) {
						synchronized(entry) {
							entry.service = newInstance;
						}
					}
				} else {
					ServiceDiscoveryImpl.this.log.warn("Instance data has been deleted for: " + instance);
				}

			}
		};
		nodeCache.getListenable().addListener(listener);
		return nodeCache;
	}
}
```

创建zookeeper节点，跟进`this.internalRegisterService(service);`方法：

```java
@VisibleForTesting
protected void internalRegisterService(ServiceInstance<T> service) throws Exception {
	byte[] bytes = this.serializer.serialize(service);
	String path = this.pathForInstance(service.getName(), service.getId());
	int MAX_TRIES = true;
	boolean isDone = false;

	for(int i = 0; !isDone && i < 2; ++i) {
		try {
			CreateMode mode;
			switch(service.getServiceType()) {
			case DYNAMIC:
				mode = CreateMode.EPHEMERAL;
				break;
			case DYNAMIC_SEQUENTIAL:
				mode = CreateMode.EPHEMERAL_SEQUENTIAL;
				break;
			default:
				mode = CreateMode.PERSISTENT;
			}
		((ACLBackgroundPathAndBytesable)this.client.create().creatingParentContainersIfNeeded().withMode(mode)).forPath(path, bytes); // 创建节点
			isDone = true;
		} catch (NodeExistsException var8) {
			this.client.delete().forPath(path);
		}
	}

}
```

服务注册的原理如上，服务发现可以看2.4 服务发现编写的代码，就是从zookeeper中去数据。
