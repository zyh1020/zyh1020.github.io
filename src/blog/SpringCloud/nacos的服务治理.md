---
icon: file-lines
title: nacos的服务治理
author: Ms.Zyh
date: 2025-06-19
category:
  - SpringCloud
tag:
  - 干货
  - SpringCloud
sticky: false
star: false
---

### 一，nacos服务治理

#### 1.1 Nacos Server 的注册表结构
> 注册表结构是nacos v1.X版本，是在nacos的源码中，不是在spring-cloud-starter-alibaba-nacos-discovery中，大家不用在问为什么找不到源码了
```java
package com.alibaba.nacos.naming.core;
@Component
public class ServiceManager implements RecordListener<Service> {
    
    /**
     * Map(namespace, Map(group::serviceName, Service)).
     */
    private final Map<String, Map<String, Service>> serviceMap = new ConcurrentHashMap<>();
    // 省略部分代码………
}
```
ServiceManager中的Map的Key为Namespace；Value也是一个Map，内层Map的Key为`group::serviceName`，Value为Service对象。Service对象如下：
```java
@JsonInclude(Include.NON_NULL)
public class Service extends com.alibaba.nacos.api.naming.pojo.Service implements Record, RecordListener<Instances> {
      private Map<String, Cluster> clusterMap = new HashMap<>();
     // 省略部分代码………
}
```
这个Map的Key值为Cluster的名字，Value为Cluster对象，Cluster对象中有两个Set的数据结构，用来存储Instance，这个Instance才是真正的客户端注册过来的实例信息：
```java
public class Cluster extends com.alibaba.nacos.api.naming.pojo.Cluster implements Cloneable {
    @JsonIgnore
    private Set<Instance> persistentInstances = new HashSet<>();
    @JsonIgnore
    private Set<Instance> ephemeralInstances = new HashSet<>();
    // 省略部分代码………
}
```
Instance实例对象源码：
```java
@JsonInclude(Include.NON_NULL)
public class Instance implements Serializable {
    private static final long serialVersionUID = -742906310567291979L;
    private String instanceId;
    private String ip;
    private int port;
    private double weight = 1.0;
    private boolean healthy = true;
    private boolean enabled = true;
    // ephemeral默认是临时实例
    private boolean ephemeral = true;
    private String clusterName;
    private String serviceName;
}
```
Cluster为什么有两个Set，一个是用来存储临时实例，一个是用来存储持久化实例，临时实例和永久实例在Nacos中是一个非常非常重要的概念：
- 临时实例，临时实例在注册到注册中心之后仅仅只保存在服务端内部一个缓存中，不会持久化到磁盘，这个服务端内部的缓存在注册中心一般被称为服务注册表，当服务实例出现异常或者下线之后，就会把这个服务实例从服务注册表中剔除。临时实例就比较适合于业务服务，服务下线之后可以不需要在注册中心中查看到.
- 永久实例，永久实例在注册到注册中心之后不仅仅会存在服务注册表中，同时也会被持久化到磁盘文件中，当服务实例出现异常或者下线，Nacos只会将服务实例的健康状态设置为不健康，并不会对将其从服务注册表中剔除，所以这个服务实例的信息还是可以从注册中心看到，只不过处于不健康状态.永久实例就比较适合需要运维的服务，这种服务几乎是永久存在的，比如说MySQL、Redis

在SpringCloud环境底下，一般其实都是业务服务，所以默认注册服务实例都是临时实例，当然如果你想改成永久实例，可以通过下面这个配置项来完成：
```
spring
  cloud:
    nacos:
      discovery:
        #ephemeral单词是临时的意思，设置成false，就是永久实例了
        ephemeral: false
```
注意：在1.x版本中，一个服务中可以既有临时实例也有永久实例，服务实例是永久还是临时是由**服务实例**决定的，但是2.x版本中，一个服务中的所有实例要么都是临时实例要么都是永久实例，是由**服务**决定的，而不是具体的服务实例，所以在2.x可以说是临时服务和永久服务.

#### 1.2 服务注册源码解析
pom依赖：
```
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
    <version>2.2.10</version>
</dependency>
```
查看依赖中的spring-cloud-starter-alibaba-nacos-discovery包中的spring.factories：
```
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
  com.alibaba.cloud.nacos.discovery.NacosDiscoveryAutoConfiguration,\
  com.alibaba.cloud.nacos.ribbon.RibbonNacosAutoConfiguration,\
  com.alibaba.cloud.nacos.endpoint.NacosDiscoveryEndpointAutoConfiguration,\
  com.alibaba.cloud.nacos.registry.NacosServiceRegistryAutoConfiguration,\
  com.alibaba.cloud.nacos.discovery.NacosDiscoveryClientConfiguration,\
  com.alibaba.cloud.nacos.discovery.NacosDiscoveryHeartBeatConfiguration,\
  com.alibaba.cloud.nacos.discovery.reactive.NacosReactiveDiscoveryClientConfiguration,\
  com.alibaba.cloud.nacos.discovery.configclient.NacosConfigServerAutoConfiguration,\
  com.alibaba.cloud.nacos.NacosServiceAutoConfiguration,\
  com.alibaba.cloud.nacos.util.UtilIPv6AutoConfiguration
org.springframework.cloud.bootstrap.BootstrapConfiguration=\
  com.alibaba.cloud.nacos.discovery.configclient.NacosDiscoveryClientConfigServiceBootstrapConfiguration
org.springframework.boot.SpringApplicationRunListener=\
  com.alibaba.cloud.nacos.logging.NacosLoggingAppRunListener

```
自动装配引入了NacosServiceRegistryAutoConfiguration：
```java
@Configuration(
    proxyBeanMethods = false
)
@EnableConfigurationProperties
@ConditionalOnNacosDiscoveryEnabled
@ConditionalOnProperty(
    value = {"spring.cloud.service-registry.auto-registration.enabled"},
    matchIfMissing = true
)
@AutoConfigureAfter({AutoServiceRegistrationConfiguration.class, AutoServiceRegistrationAutoConfiguration.class, NacosDiscoveryAutoConfiguration.class})
public class NacosServiceRegistryAutoConfiguration {
    public NacosServiceRegistryAutoConfiguration() {
    }

    @Bean
    public NacosServiceRegistry nacosServiceRegistry(NacosServiceManager nacosServiceManager, NacosDiscoveryProperties nacosDiscoveryProperties) {
        return new NacosServiceRegistry(nacosServiceManager, nacosDiscoveryProperties);
    }

    @Bean
    @ConditionalOnBean({AutoServiceRegistrationProperties.class})
    public NacosRegistration nacosRegistration(ObjectProvider<List<NacosRegistrationCustomizer>> registrationCustomizers, NacosDiscoveryProperties nacosDiscoveryProperties, ApplicationContext context) {
        return new NacosRegistration((List)registrationCustomizers.getIfAvailable(), nacosDiscoveryProperties, context);
    }

    @Bean
    @ConditionalOnBean({AutoServiceRegistrationProperties.class})
    public NacosAutoServiceRegistration nacosAutoServiceRegistration(NacosServiceRegistry registry, AutoServiceRegistrationProperties autoServiceRegistrationProperties, NacosRegistration registration) {
        return new NacosAutoServiceRegistration(registry, autoServiceRegistrationProperties, registration);
    }
}
```
在NacosServiceRegistryAutoConfiguration会帮我们注册NacosAutoServiceRegistration的继承关系:
```java
public class NacosAutoServiceRegistration extends AbstractAutoServiceRegistration<Registration> {
}
```
`AbstractAutoServiceRegistration<Registration>`的继承关系：
```java
public abstract class AbstractAutoServiceRegistration<R extends Registration> implements AutoServiceRegistration, ApplicationContextAware, ApplicationListener<WebServerInitializedEvent> {
}
```
这里实现了ApplicationListener接口，并且传入了WebServerInitializedEvent作为泛型，有什么作用呢？监听WebServerInitializedEvent事件，也就是说WebServer初始化完成后，会调用对应的事件绑定方法，调用onApplicationEvent（），那我们就看AbstractAutoServiceRegistration的onApplicationEvent（）的方法
```java
public void onApplicationEvent(WebServerInitializedEvent event) {
  // 跟进this.bind方法
    this.bind(event);
}

@Deprecated
public void bind(WebServerInitializedEvent event) {
    ApplicationContext context = event.getApplicationContext();
    if (!(context instanceof ConfigurableWebServerApplicationContext) || !"management".equals(((ConfigurableWebServerApplicationContext)context).getServerNamespace())) {
        this.port.compareAndSet(0, event.getWebServer().getPort());
	/// 跟进this.start();方法
        this.start();
    }
}

public void start() {
    if (!this.isEnabled()) {
        if (logger.isDebugEnabled()) {
            logger.debug("Discovery Lifecycle disabled. Not starting");
        }

    } else {
        if (!this.running.get()) {
            // 服务注册之前发布InstancePreRegisteredEvent事件
            this.context.publishEvent(new InstancePreRegisteredEvent(this, this.getRegistration()));
           // 核心调用this.register方法，继续跟进
            this.register();
            if (this.shouldRegisterManagement()) {
                this.registerManagement();
            }
           // 服务注册之前发布InstanceRegisteredEvent事件
            this.context.publishEvent(new InstanceRegisteredEvent(this, this.getConfiguration()));
            this.running.compareAndSet(false, true);
        }

    }
}

```
核心调用this.register方法，继续跟进时发现NacosAutoServiceRegistration实现了该方法
```java
protected void register() {
   //  判断是否开启了服务注册，默认是开启的，可以通过spring.cloud.nacos.discovery.register-enabled来关闭
    if (!this.registration.getNacosDiscoveryProperties().isRegisterEnabled()) {
        log.debug("Registration disabled.");
    } else {
        if (this.registration.getPort() < 0) {
            this.registration.setPort(this.getPort().get());
        }
	 // 回到父类AbstractAutoServiceRegistration的super.register方法
        super.register();
    }
}

```
跟进父类AbstractAutoServiceRegistration的super.register方法：
```java
protected void register() {
    this.serviceRegistry.register(this.getRegistration());
}
public void register(Registration registration) {
    if (StringUtils.isEmpty(registration.getServiceId())) {
        log.warn("No service to register for nacos client...");
    } else {
        NamingService namingService = this.namingService();
        // 获取服务id
        String serviceId = registration.getServiceId();
	// 获取分组信息
        String group = this.nacosDiscoveryProperties.getGroup();
	// 获取实例信息
        Instance instance = this.getNacosInstanceFromRegistration(registration);

        try {
	    // 真实的注册方法
            namingService.registerInstance(serviceId, group, instance);
            log.info("nacos registry, {} {} {}:{} register finished", new Object[]{group, serviceId, instance.getIp(), instance.getPort()});
        } catch (Exception var7) {
            if (this.nacosDiscoveryProperties.isFailFast()) {
                log.error("nacos registry, {} register failed...{},", new Object[]{serviceId, registration.toString(), var7});
                ReflectionUtils.rethrowRuntimeException(var7);
            } else {
                log.warn("Failfast is false. {} register failed...{},", new Object[]{serviceId, registration.toString(), var7});
            }
        }

    }
}

```
跟进NacosNamingService的registerInstance
```java
public void registerInstance(String serviceName, String groupName, Instance instance) throws NacosException {
    NamingUtils.checkInstanceIsLegal(instance);
     // 这里通过客户端代理的方式
    this.clientProxy.registerService(serviceName, groupName, instance);
}
```
跟进NamingClientProxyDelegate的registerService
```java
public void registerService(String serviceName, String groupName, Instance instance) throws NacosException {
   // 临时的实例就使用GRPC的客户端，永久实例就使用http客户端注册
    this.getExecuteClientProxy(instance).registerService(serviceName, groupName, instance);
}
// getExecuteClientProxy方法判断如果是临时的实例就使用GRPC的客户端，永久实例就使用http客户端
private NamingClientProxy getExecuteClientProxy(Instance instance) {
    return (NamingClientProxy)(instance.isEphemeral() ? this.grpcClientProxy : this.httpClientProxy);
}
```
http客户端注册，spring-cloud-starter-alibaba-nacos-discovery 2版本中：
```java
public void registerService(String serviceName, String groupName, Instance instance) throws NacosException {
    LogUtils.NAMING_LOGGER.info("[REGISTER-SERVICE] {} registering service {} with instance: {}", new Object[]{this.namespaceId, serviceName, instance});
    String groupedServiceName = NamingUtils.getGroupedName(serviceName, groupName);
    if (instance.isEphemeral()) {
        throw new UnsupportedOperationException("Do not support register ephemeral instances by HTTP, please use gRPC replaced.");
    } else {
        Map<String, String> params = new HashMap(32);
        params.put("namespaceId", this.namespaceId);
        params.put("serviceName", groupedServiceName);
        params.put("groupName", groupName);
        params.put("clusterName", instance.getClusterName());
        params.put("ip", instance.getIp());
        params.put("port", String.valueOf(instance.getPort()));
        params.put("weight", String.valueOf(instance.getWeight()));
        params.put("enable", String.valueOf(instance.isEnabled()));
        params.put("healthy", String.valueOf(instance.isHealthy()));
        params.put("ephemeral", String.valueOf(instance.isEphemeral()));
        params.put("metadata", JacksonUtils.toJson(instance.getMetadata()));
	// 通过post的请求方式注册实例
        this.reqApi(UtilAndComs.nacosUrlInstance, params, "POST");
    }
}
```
http客户端注册，spring-cloud-starter-alibaba-nacos-discovery 1版本中：
```java
public void registerInstance(String serviceName, String groupName, Instance instance) throws NacosException {
    // 判断如果是临时节点 会多一个心跳信息实现健康监测
    if (instance.isEphemeral()) {
        BeatInfo beatInfo = new BeatInfo();
        beatInfo.setServiceName(NamingUtils.getGroupedName(serviceName, groupName));
        beatInfo.setIp(instance.getIp());
        beatInfo.setPort(instance.getPort());
        beatInfo.setCluster(instance.getClusterName());
        beatInfo.setWeight(instance.getWeight());
        beatInfo.setMetadata(instance.getMetadata());
        beatInfo.setScheduled(false);
        long instanceInterval = instance.getInstanceHeartBeatInterval();
        beatInfo.setPeriod(instanceInterval == 0L ? DEFAULT_HEART_BEAT_INTERVAL : instanceInterval);
        // 1.addBeatInfo（）负责创建心跳信息实现健康监测。因为Nacos Server必须要确保注册的服务实例是健康的。
        // 而心跳监测就是服务健康监测的一种手段。
        this.beatReactor.addBeatInfo(NamingUtils.getGroupedName(serviceName, groupName), beatInfo);
    }
	// 2.registerService（）实现服务的注册
    this.serverProxy.registerService(NamingUtils.getGroupedName(serviceName, groupName), groupName, instance);
}
// 1，addBeatInfo（）心跳检测
public void addBeatInfo(String serviceName, BeatInfo beatInfo) {
    LogUtils.NAMING_LOGGER.info("[BEAT] adding beat: {} to beat map.", beatInfo);
    String key = this.buildKey(serviceName, beatInfo.getIp(), beatInfo.getPort());
    BeatInfo existBeat = null;
    if ((existBeat = (BeatInfo)this.dom2Beat.remove(key)) != null) {
        existBeat.setStopped(true);
    }

    this.dom2Beat.put(key, beatInfo);
    // 通过schedule（）方法，定时的向服务端发送一个数据包，然后启动一个线程不断地检测服务端的回应。
    // 如果在指定的时间内没有收到服务端的回应，那么认为服务器出现了故障。
    // 参数1：可以说是这个实例的相关信息。
    // 参数2：一个long类型的时间，代表从现在开始推迟执行的时间，默认是5000
    // 参数3：时间的单位，默认是毫秒，结合5000即代表每5秒发送一次心跳数据包
    this.executorService.schedule(new BeatReactor.BeatTask(beatInfo), beatInfo.getPeriod(), TimeUnit.MILLISECONDS);
    MetricsMonitor.getDom2BeatSizeMonitor().set((double)this.dom2Beat.size());
}

// 2，this.serverProxy.registerService服务的注册方法
public void registerService(String serviceName, String groupName, Instance instance) throws NacosException {
    LogUtils.NAMING_LOGGER.info("[REGISTER-SERVICE] {} registering service {} with instance: {}", new Object[]{this.namespaceId, serviceName, instance});
    String groupedServiceName = NamingUtils.getGroupedName(serviceName, groupName);
    if (instance.isEphemeral()) {
        throw new UnsupportedOperationException("Do not support register ephemeral instances by HTTP, please use gRPC replaced.");
    } else {
        Map<String, String> params = new HashMap(32);
        params.put("namespaceId", this.namespaceId);
        params.put("serviceName", groupedServiceName);
        params.put("groupName", groupName);
        params.put("clusterName", instance.getClusterName());
        params.put("ip", instance.getIp());
        params.put("port", String.valueOf(instance.getPort()));
        params.put("weight", String.valueOf(instance.getWeight()));
        params.put("enable", String.valueOf(instance.isEnabled()));
        params.put("healthy", String.valueOf(instance.isHealthy()));
        params.put("ephemeral", String.valueOf(instance.isEphemeral()));
        params.put("metadata", JacksonUtils.toJson(instance.getMetadata()));
	// 通过post的请求方式注册实例
        this.reqApi(UtilAndComs.nacosUrlInstance, params, "POST");
    }
}
```
总结：服务注册的实现流程spring-cloud-starter-alibaba-nacos-discovery包中的spring.factories中通过spi的方式加载了NacosServiceRegistryAutoConfiguration配置类，在配置类中注入了NacosAutoServiceRegistration对象，而NacosAutoServiceRegistration的父类AbstractAutoServiceRegistration实现了ApplicationListener接口，并且传入了WebServerInitializedEvent作为泛型，监听WebServerInitializedEvent事件，也就是说WebServer初始化完成后，会调用对应的事件监听方法，最终会调用registerService方法完成服务注册。需要注意的在spring-cloud-starter-alibaba-nacos-discovery 1版本中，临时实例和永久实例都是通过http的方式完成注册服务，在spring-cloud-starter-alibaba-nacos-discovery 2版本中，永久实例是通过http的方式完成注册服务，临时实例是通过GRPC的方式实现服务注册的。
#### 1.3 心跳机制
心跳机制的实现，心跳机制是针对临时实例，是客户端主动向服务端报备的能力。
客户端：
- 在spring-cloud-starter-alibaba-nacos-discovery 1版本中，临时实例心跳机制是通过定时任务实现的，每5秒发送一次心跳包。
- 在spring-cloud-starter-alibaba-nacos-discovery 2版本中，临时实例心跳机制是基于gRPC长连接本身的心跳机制实现的。
服务端：
- 在spring-cloud-starter-alibaba-nacos-discovery 1版本中，处理心跳的方式也是通过定时任务，定时检查心跳时间，超过15s标记不健康，超过30s直接剔除。
- 在spring-cloud-starter-alibaba-nacos-discovery 2版本中，处理心跳的方式是通过基于gRPC长连接本身的心跳机制实现的，长链接断开了直接剔除。
#### 1.4 健康检测机制
健康检测机制的实现，健康检测机制是针对永久实例，是服务端主动问询客户端的能力。对于永久实例来说，一般来说无法主动上报心跳，就比如说MySQL实例，肯定是不会主动上报心跳到Nacos的，所以这就导致无法通过心跳机制来保活。
健康检查机制在1.x和2.x的实现机制是一样的
Nacos服务端在会去创建一个健康检查任务，这个任务每次执行时间间隔会在2000~7000毫秒之间，当任务触发的时候，会根据设置的健康检查的方式执行不同的逻辑，目前主要有三种方式：
- TCP的方式：根据服务实例的ip和端口去判断是否能连接成功，如果连接成功，就认为健康，反之就任务不健康,默认情况下，都是通过TCP的方式来探测服务实例是否还活着.
- HTTP的方式：向服务实例的ip和端口发送一个Http请求，请求路径是需要设置的，如果能正常请求，说明实例健康，反之就不健康
- MySQL的方式：一种特殊的检查方式，通过执行`show global variables where variable_name='read_only`这条Sql来判断数据库是不是主库

#### 1.5 服务发现源码解析
我们在openFeign和restTemplate通过服务名称调用服务，在做负载均衡等操作的时候，最终都会调用NacosServerList
的getServers方法
```java
private List<NacosServer> getServers() {
    try {
	// 分组名称，默认是DEFAULT_GROUP
        String group = this.discoveryProperties.getGroup();
	// 根据服务名称和分组获取实例列表
        List<Instance> instances = this.discoveryProperties.namingServiceInstance().selectInstances(this.serviceId, group, true);
        return this.instancesToServerList(instances);
    } catch (Exception var3) {
        throw new IllegalStateException("Can not get service instances from nacos, serviceId=" + this.serviceId, var3);
    }
}
```
查看根据服务名称和分组获取实例列表的方法，跟进 selectInstances方法，会到NacosNamingService selectInstances方法：
```java
public List<Instance> selectInstances(String serviceName, String groupName, boolean healthy) throws NacosException {
    return this.selectInstances(serviceName, groupName, healthy, true);
}

public List<Instance> selectInstances(String serviceName, boolean healthy, boolean subscribe) throws NacosException {
   // subscribe为true
   return this.selectInstances(serviceName, (List)(new ArrayList()), healthy, subscribe);
}


public List<Instance> selectInstances(String serviceName, String groupName, List<String> clusters, boolean healthy, boolean subscribe) throws NacosException {
    String clusterString = StringUtils.join(clusters, ",");
    ServiceInfo serviceInfo;
    // 判断是否订阅
    if (subscribe) {
        // 先从缓存中获取
        serviceInfo = this.serviceInfoHolder.getServiceInfo(serviceName, groupName, clusterString);
        // 缓存中获取null，就订阅并获取
        if (null == serviceInfo) {
            serviceInfo = this.clientProxy.subscribe(serviceName, groupName, clusterString);
        }
    } else {
	// 如果没有订阅直接查询
        serviceInfo = this.clientProxy.queryInstancesOfService(serviceName, groupName, clusterString, 0, false);
    }

    return this.selectInstances(serviceInfo, healthy);
}

```
查看先从缓存中获取方法，跟进ServiceInfoHolder的getServiceInfo方法
```java
public ServiceInfo getServiceInfo(String serviceName, String groupName, String clusters) {
    // 打印是否开启故障转移
    LogUtils.NAMING_LOGGER.debug("failover-mode: {}", this.failoverReactor.isFailoverSwitch());
    // groupedServiceName = groupName + "@@" + serviceName;
    String groupedServiceName = NamingUtils.getGroupedName(serviceName, groupName);
    // key = !isEmpty(clusters) ? groupedServiceName + "@@" + clusters : groupedServiceName;
    String key = ServiceInfo.getKey(groupedServiceName, clusters);
   // 判断是否开启故障转移，开启通过故障转移的方式获取，否者从本地缓存中获取
    return this.failoverReactor.isFailoverSwitch() ? this.failoverReactor.getService(key) : (ServiceInfo)this.serviceInfoMap.get(key);
}
```
查看缓存中获取null，就订阅并获取的方法，跟进NamingClientProxyDelegate的subscribe方法：
```java
public ServiceInfo subscribe(String serviceName, String groupName, String clusters) throws NacosException {
    LogUtils.NAMING_LOGGER.info("[SUBSCRIBE-SERVICE] service:{}, group:{}, clusters:{} ", new Object[]{serviceName, groupName, clusters});
    // groupedServiceName = groupName + "@@" + serviceName;
    String serviceNameWithGroup = NamingUtils.getGroupedName(serviceName, groupName);
    // key = !isEmpty(clusters) ? serviceNameWithGroup + "@@" + clusters : serviceNameWithGroup;
    String serviceKey = ServiceInfo.getKey(serviceNameWithGroup, clusters);
    // 标记1设置定时任务
    this.serviceInfoUpdateService.scheduleUpdateIfAbsent(serviceName, groupName, clusters);
    ServiceInfo result = (ServiceInfo)this.serviceInfoHolder.getServiceInfoMap().get(serviceKey);
    if (null == result || !this.isSubscribed(serviceName, groupName, clusters)) {
	// 标记2通过GRPC的方式拉取服务端的数据
        result = this.grpcClientProxy.subscribe(serviceName, groupName, clusters);
    }

    this.serviceInfoHolder.processServiceInfo(result);
    return result;
}
```
查看标记1设置定时任务的方法，跟进ServiceInfoUpdateService的subscribe方法
```java
public void scheduleUpdateIfAbsent(String serviceName, String groupName, String clusters) {
    // 是否异步查询服务，默认是不开启的，可以通过yaml配置enable-instance-data-refresher开启，相比于1版本，2版本定时对比机制也保留了，只不过这个定时对比的机制默认是关闭状态，之所以默认关闭，主要还是因为GRPC长连接还是比较稳定的原因
    if (this.asyncQuerySubscribeService) {
         // 服务的key
        String serviceKey = ServiceInfo.getKey(NamingUtils.getGroupedName(serviceName, groupName), clusters);
        // this.futureMap是 Map<String, ScheduledFuture<?>>用于缓存，服务的定时任务
        if (this.futureMap.get(serviceKey) == null) {
            // 为了线程安全
            synchronized(this.futureMap) {
                if (this.futureMap.get(serviceKey) == null) {
                    // 如果没有就创建定时任务
                    ScheduledFuture<?> future = this.addTask(new UpdateTask(serviceName, groupName, clusters));
                    this.futureMap.put(serviceKey, future);
                }
            }
        }
    }
}

```
看看UpdateTask定时任务做了什么？
```java
public void run() {

    long delayTime = 1000L;

    try {
        if (ServiceInfoUpdateService.this.changeNotifier.isSubscribed(this.groupName, this.serviceName, this.clusters) || ServiceInfoUpdateService.this.futureMap.containsKey(this.serviceKey)) {
            // 又一次从本地缓存中取
            ServiceInfo serviceObj = (ServiceInfo)ServiceInfoUpdateService.this.serviceInfoHolder.getServiceInfoMap().get(this.serviceKey);
           // 如果还是没有取到就，通过发送请求的方式拉取服务
            if (serviceObj == null) {
                serviceObj = ServiceInfoUpdateService.this.namingClientProxy.queryInstancesOfService(this.serviceName, this.groupName, this.clusters, 0, false);
                // 将结果保存在本地缓存中
                ServiceInfoUpdateService.this.serviceInfoHolder.processServiceInfo(serviceObj);
                this.lastRefTime = serviceObj.getLastRefTime();
                return;
            }
	    // 如果本地缓存中的ServiceInfo对象的lastRefTime属性 小于等于了 lastRefTime也要发送请求。大部分情况下 下面的if都会满足，因为每一次发送获取服务实例列表的请求后都会更新lastRefTime的值，下一次执行该任务这个就会相等， 那么就又要继续发送请求
            if (serviceObj.getLastRefTime() <= this.lastRefTime) {
		 // 查询服务最新数据
                serviceObj = ServiceInfoUpdateService.this.namingClientProxy.queryInstancesOfService(this.serviceName, this.groupName, this.clusters, 0, false);
                // 更新本地缓存
                ServiceInfoUpdateService.this.serviceInfoHolder.processServiceInfo(serviceObj);
            }
	     // 请求后后都会更新lastRefTime的值
            this.lastRefTime = serviceObj.getLastRefTime();
            if (CollectionUtils.isEmpty(serviceObj.getHosts())) {
                // 如果获取失败，失败次数+1
                this.incFailCount();
                return;
            }
	    // 更新缓存的有效时间
            delayTime = serviceObj.getCacheMillis() * 6L;
	    // 重置失败次数
            this.resetFailCount();
            return;
        }

        LogUtils.NAMING_LOGGER.info("update task is stopped, service:{}, clusters:{}", this.groupedServiceName, this.clusters);
        this.isCancel = true;
    } catch (NacosException var8) {
        this.handleNacosException(var8);
        return;
    } catch (Throwable var9) {
        this.handleUnknownException(var9);
        return;
    } finally {
       // 嵌套调用自己，6s <= 间隔时间 <= 60s，间隔时间和失败次数有关
        if (!this.isCancel) {
            ServiceInfoUpdateService.this.executor.schedule(this, Math.min(delayTime << this.failCount, 60000L), TimeUnit.MILLISECONDS);
        }

    }

}

```

查看标记2通过GRPC的方式拉取服务端的数据的方法，跟进NamingGrpcClientProxy的subscribe方法：
```java
public ServiceInfo subscribe(String serviceName, String groupName, String clusters) throws NacosException {
    if (LogUtils.NAMING_LOGGER.isDebugEnabled()) {
        LogUtils.NAMING_LOGGER.debug("[GRPC-SUBSCRIBE] service:{}, group:{}, cluster:{} ", new Object[]{serviceName, groupName, clusters});
    }
    // 
    this.redoService.cacheSubscriberForRedo(serviceName, groupName, clusters);
    return this.doSubscribe(serviceName, groupName, clusters);
}

// 真正去获取实例列表的方法
public ServiceInfo doSubscribe(String serviceName, String groupName, String clusters) throws NacosException {
    // 创建请求
    SubscribeServiceRequest request = new SubscribeServiceRequest(this.namespaceId, groupName, serviceName, clusters, true);
     // 发送请求
    SubscribeServiceResponse response = (SubscribeServiceResponse)this.requestToServer(request, SubscribeServiceResponse.class);
    // 
    this.redoService.subscriberRegistered(serviceName, groupName, clusters);
     // 返回获取的实例列表
    return response.getServiceInfo();
}

// 缓存拉取请求的
public void cacheSubscriberForRedo(String serviceName, String groupName, String cluster) {
    String key = ServiceInfo.getKey(NamingUtils.getGroupedName(serviceName, groupName), cluster);
    SubscriberRedoData redoData = SubscriberRedoData.build(serviceName, groupName, cluster);
    synchronized(this.subscribes) {
        this.subscribes.put(key, redoData);
    }
}

public void subscriberRegistered(String serviceName, String groupName, String cluster) {
    String key = ServiceInfo.getKey(NamingUtils.getGroupedName(serviceName, groupName), cluster);
    synchronized(this.subscribes) {
        SubscriberRedoData redoData = (SubscriberRedoData)this.subscribes.get(key);
        if (null != redoData) {
            redoData.setRegistered(true);
        }

    }
}


```
