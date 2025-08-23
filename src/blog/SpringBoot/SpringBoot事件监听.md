---
icon: document
# 标题
title: 'SpringBoot事件监听'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-26
# 一个页面可以有多个分类
category:
  - SpringBoot
# 一个页面可以有多个标签
tag:
  - 必看
  - SpringBoot
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，自定义事件
事件：
```java
public class CustomEvent extends ApplicationEvent {
    private String name;
    public CustomEvent(Object source,String name) {
        super(source);
        this.name = name;
    }

    public String getName() {
        return name;
    }
}
```
监听事件
方式一，实现接口
```java
@Component
public class CustomListener implements ApplicationListener<CustomEvent> {
    @Override
    public void onApplicationEvent(CustomEvent event) {
        System.out.println("====start===event-name:"+event.getName());
        try {
            Thread.sleep(3000);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
        System.out.println("====end===event-name:"+event.getName());
    }
}
```
方式二：注解`@EventListener`
```java
@Component
public class CustomAnnotaionListener {
    @EventListener(CustomEvent.class)
    public void onApplicationEvent(CustomEvent event) {
        System.out.println(Thread.currentThread().getName()+"==== Annotaion ====start===event-name:"+event.getName());
        try {
            Thread.sleep(3000);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
        System.out.println(Thread.currentThread().getName()+"==== Annotaion ====end===event-name:"+event.getName());
    }
}

```
测试发布事件：
```java
@SpringBootTest
class TestSpringbootApplicationTests {
    @Autowired
    private ApplicationContext applicationContext;
    @Test
    void contextLoads() {
        System.out.println("=====start=====");
	//  发布事件
        applicationContext.publishEvent(new CustomEvent(this,"zyh"));
        System.out.println("=====end=====");
    }

}
```
结果：
```
main=====start=====
main==== implements ====start===event-name:zyh
main==== implements ====end===event-name:zyh
main==== Annotaion ====start===event-name:zyh
main==== Annotaion ====end===event-name:zyh
main=====end=====
```
结果是成功的，但是不是异步的，如何实现异步？继续往下看

开启异步通过`@EnableAsync`注解
```java
@SpringBootTest
@EnableAsync
class TestSpringbootApplicationTests {

    @Autowired
    private ApplicationContext applicationContext;
    @Test
    void contextLoads() {
        System.out.println(Thread.currentThread().getName()+"=====start=====");
	// 发布事件
        applicationContext.publishEvent(new CustomEvent(this,"zyh"));
        System.out.println(Thread.currentThread().getName()+"=====end=====");
    }

}
```
然后在方法上加`@Async`注解
方式一，实现接口
```java
@Component
public class CustomListener implements ApplicationListener<CustomEvent> {
    @Async
    @Override
    public void onApplicationEvent(CustomEvent event) {
        System.out.println("====start===event-name:"+event.getName());
        try {
            Thread.sleep(3000);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
        System.out.println("====end===event-name:"+event.getName());
    }
}
```
方式二：注解`@EventListener`
```java
@Component
public class CustomAnnotaionListener {
    @Async
    @EventListener(CustomEvent.class)
    public void onApplicationEvent(CustomEvent event) {
        System.out.println(Thread.currentThread().getName()+"==== Annotaion ====start===event-name:"+event.getName());
        try {
            Thread.sleep(3000);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
        System.out.println(Thread.currentThread().getName()+"==== Annotaion ====end===event-name:"+event.getName());
    }
}

```
结果：
```
main=====start=====
task-1==== implements ====start===event-name:zyh
main=====end=====
task-2==== Annotaion ====start===event-name:zyh
```
### 二，源码解析
AbstractApplicationContext在refresh()这个容器启动方法：
```java
public void refresh() throws BeansException, IllegalStateException {
    synchronized(this.startupShutdownMonitor) {
        StartupStep contextRefresh = this.applicationStartup.start("spring.context.refresh");
        this.prepareRefresh();
        ConfigurableListableBeanFactory beanFactory = this.obtainFreshBeanFactory();
        this.prepareBeanFactory(beanFactory);

        try {
            this.postProcessBeanFactory(beanFactory);
            StartupStep beanPostProcess = this.applicationStartup.start("spring.context.beans.post-process");
            this.invokeBeanFactoryPostProcessors(beanFactory);
            this.registerBeanPostProcessors(beanFactory);
            beanPostProcess.end();
            this.initMessageSource();
	    // 创建事件广播器
            this.initApplicationEventMulticaster();
            this.onRefresh();
	    // 注册监听
            this.registerListeners();
            this.finishBeanFactoryInitialization(beanFactory);
            this.finishRefresh();
        } catch (BeansException var10) {
            if (this.logger.isWarnEnabled()) {
                this.logger.warn("Exception encountered during context initialization - cancelling refresh attempt: " + var10);
            }

            this.destroyBeans();
            this.cancelRefresh(var10);
            throw var10;
        } finally {
            this.resetCommonCaches();
            contextRefresh.end();
        }

    }
}

```

#### 2.1创建事件广播器
```java
protected void initApplicationEventMulticaster() {
    // 获取bean工厂
    ConfigurableListableBeanFactory beanFactory = this.getBeanFactory();
    // 判断是否有自定义的事件广播器
    if (beanFactory.containsLocalBean("applicationEventMulticaster")) {
        this.applicationEventMulticaster = (ApplicationEventMulticaster)beanFactory.getBean("applicationEventMulticaster", ApplicationEventMulticaster.class);
        if (this.logger.isTraceEnabled()) {
            this.logger.trace("Using ApplicationEventMulticaster [" + this.applicationEventMulticaster + "]");
        }
    } else {
	// 如果没有就使用默认的SimpleApplicationEventMulticaster事件广播器
        this.applicationEventMulticaster = new SimpleApplicationEventMulticaster(beanFactory);
        beanFactory.registerSingleton("applicationEventMulticaster", this.applicationEventMulticaster);
        if (this.logger.isTraceEnabled()) {
            this.logger.trace("No 'applicationEventMulticaster' bean, using [" + this.applicationEventMulticaster.getClass().getSimpleName() + "]");
        }
    }

}
```
#### 2.2 注册监听
监听器的注册有两种，通过实现 ApplicationListener接口或者添加@EventListener注解。
##### 2.2.1 实现 ApplicationListener接口注册
核心逻辑实现在refresh()中的registerListeners()方法里面
```java
protected void registerListeners() {
    Iterator var1 = this.getApplicationListeners().iterator();
    // 遍历应用程序中存在的监听器集合，并将对应的监听器添加到监听器的多路广播器中
    while(var1.hasNext()) {
        ApplicationListener<?> listener = (ApplicationListener)var1.next();
        this.getApplicationEventMulticaster().addApplicationListener(listener);
    }
    // 从容器中获取所有实现了ApplicationListener接口的bd的bdName
    String[] listenerBeanNames = this.getBeanNamesForType(ApplicationListener.class, true, false);
    String[] var7 = listenerBeanNames;
    int var3 = listenerBeanNames.length;

    for(int var4 = 0; var4 < var3; ++var4) {
        String listenerBeanName = var7[var4];
        this.getApplicationEventMulticaster().addApplicationListenerBean(listenerBeanName);
    }
   // 此处先发布早期的监听器集合
    Set<ApplicationEvent> earlyEventsToProcess = this.earlyApplicationEvents;
    this.earlyApplicationEvents = null;
    if (!CollectionUtils.isEmpty(earlyEventsToProcess)) {
        Iterator var9 = earlyEventsToProcess.iterator();

        while(var9.hasNext()) {
            ApplicationEvent earlyEvent = (ApplicationEvent)var9.next();
            this.getApplicationEventMulticaster().multicastEvent(earlyEvent);
        }
    }

}

```
如果监听器是懒加载的话（即有@Lazy 注解）。那么在这个时候创建监听器显然是不对的，这个时候不能创建监听器，
在 refresh()中prepareBeanFactory()方法中添加ApplicationListenerDetector：
```java
protected void prepareBeanFactory(ConfigurableListableBeanFactory beanFactory) {
    // 添加ApplicationListenerDetector的bean的后置处理器
    beanFactory.addBeanPostProcessor(new ApplicationListenerDetector(this));
}
```
![image.png](http://img.zouyh.top/article-img/20240917135145401.png)
ApplicationListenerDetector的继承图如上，可以看出实现BeanPostProcessor：
```java
public Object postProcessAfterInitialization(Object bean, String beanName) {
    // 判断是否实现ApplicationListener
    if (bean instanceof ApplicationListener) {
        Boolean flag = (Boolean)this.singletonNames.get(beanName);
        if (Boolean.TRUE.equals(flag)) {
	    // 添加监听
            this.applicationContext.addApplicationListener((ApplicationListener)bean);
        } else if (Boolean.FALSE.equals(flag)) {
            if (logger.isWarnEnabled() && !this.applicationContext.containsBean(beanName)) {
                logger.warn("Inner bean '" + beanName + "' implements ApplicationListener interface but is not reachable for event multicasting by its containing ApplicationContext because it does not have singleton scope. Only top-level listener beans are allowed to be of non-singleton scope.");
            }

            this.singletonNames.remove(beanName);
        }
    }

    return bean;
}
```
##### 2.2.2 @EventListener注解注册的逻辑：
在创建 AnnotationConfigApplicationContext 的构造方法中,会执行`org.springframework.context.annotation.AnnotationConfigUtils#registerAnnotationConfigProcessors(org.springframework.beans.factory.support.BeanDefinitionRegistry, java.lang.Object) `方法:
```java
if (!registry.containsBeanDefinition("org.springframework.context.event.internalEventListenerProcessor")) {
    def = new RootBeanDefinition(EventListenerMethodProcessor.class);
    def.setSource(source);
    beanDefs.add(registerPostProcessor(registry, def, "org.springframework.context.event.internalEventListenerProcessor"));
}

if (!registry.containsBeanDefinition("org.springframework.context.event.internalEventListenerFactory")) {
    def = new RootBeanDefinition(DefaultEventListenerFactory.class);
    def.setSource(source);
    beanDefs.add(registerPostProcessor(registry, def, "org.springframework.context.event.internalEventListenerFactory"));
}
```
- EventListenerMethodProcessor：事件监听器的BeanFactory后置处理器，在前期会创建 `DefaultEventListenerFactory `，后期在初始化Bean之后，根据 `@EventListener `注解，调用DefaultEventListenerFactory创建具体的 ApplicationListenerMethodAdapter 。
- DefaultEventListenerFactory：事件监听器的创建工厂，用来创建 `ApplicationListenerMethodAdapter`（实现了GenericApplicationListener接口）事件监听器对象.
在refreash的`invokeBeanFactoryPostProcessors()`中会调用 `EventListenerMethodProcessor#postProcessBeanFactory`方法，获取EventListenerFactory 类型的 Bean。代码如下：
```java
public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) {
    this.beanFactory = beanFactory;
    //  获取EventListenerFactory类型的bean
    Map<String, EventListenerFactory> beans = beanFactory.getBeansOfType(EventListenerFactory.class, false, false);
    List<EventListenerFactory> factories = new ArrayList(beans.values());
    AnnotationAwareOrderComparator.sort(factories);
    this.eventListenerFactories = factories;
}
```
Spring的生命周期中，在 `DefaultListableBeanFactory#preInstantiateSingletons` 方法中，创建完所有的单例 Bean 之后，会遍历所有BeanName查找Bean对象是否实现了 SmartInitializingSingleton 接口,会调用afterSingletonsInstantiated方法，EventListenerMethodProcessor实现了SmartInitializingSingleton接口：
```java
public void afterSingletonsInstantiated() {
    ConfigurableListableBeanFactory beanFactory = this.beanFactory;
    Assert.state(this.beanFactory != null, "No ConfigurableListableBeanFactory set");
    // 获取所有name
    String[] beanNames = beanFactory.getBeanNamesForType(Object.class);
    String[] var3 = beanNames;
    int var4 = beanNames.length;

    for(int var5 = 0; var5 < var4; ++var5) {
        String beanName = var3[var5];
        if (!ScopedProxyUtils.isScopedTarget(beanName)) {
            Class<?> type = null;

            try {
                type = AutoProxyUtils.determineTargetClass(beanFactory, beanName);
            } catch (Throwable var10) {
                if (this.logger.isDebugEnabled()) {
                    this.logger.debug("Could not resolve target class for bean with name '" + beanName + "'", var10);
                }
            }

            if (type != null) {
                if (ScopedObject.class.isAssignableFrom(type)) {
                    try {
                        Class<?> targetClass = AutoProxyUtils.determineTargetClass(beanFactory, ScopedProxyUtils.getTargetBeanName(beanName));
                        if (targetClass != null) {
                            type = targetClass;
                        }
                    } catch (Throwable var11) {
                        if (this.logger.isDebugEnabled()) {
                            this.logger.debug("Could not resolve target bean for scoped proxy '" + beanName + "'", var11);
                        }
                    }
                }

                try {
       		    // 核心调用
                    this.processBean(beanName, type);
                } catch (Throwable var9) {
                    throw new BeanInitializationException("Failed to process @EventListener annotation on bean with name '" + beanName + "'", var9);
                }
            }
        }
    }

}

```
继续跟进`this.processBean(beanName, type);`方法：
```java
private void processBean(final String beanName, final Class<?> targetType) {
    // 判断是否有EventListener注解
    if (!this.nonAnnotatedClasses.contains(targetType) && AnnotationUtils.isCandidateClass(targetType, EventListener.class) && !isSpringContainerClass(targetType)) {
        Map<Method, EventListener> annotatedMethods = null;

        try {
            //  检测当前类targetType上使用了注解@EventListener的方法
            annotatedMethods = MethodIntrospector.selectMethods(targetType, (methodx) -> {
                return (EventListener)AnnotatedElementUtils.findMergedAnnotation(methodx, EventListener.class);
            });
        } catch (Throwable var12) {
            if (this.logger.isDebugEnabled()) {
                this.logger.debug("Could not resolve methods for bean with name '" + beanName + "'", var12);
            }
        }

        if (CollectionUtils.isEmpty(annotatedMethods)) {
	    //  如果当前类targetType中没有任何使用了注解@EventListener的方法，则将该类保存到缓存nonAnnotatedClasses，从而
            // 避免当前处理方法重入该类，避免二次处理
            this.nonAnnotatedClasses.add(targetType);
            if (this.logger.isTraceEnabled()) {
                this.logger.trace("No @EventListener annotations found on bean class: " + targetType.getName());
            }
        } else {
            // 如果当前类targetType中有些方法使用了注解@EventListener，那么根据方法上的信息对应的创建和注册ApplicationListener实例
            ConfigurableApplicationContext context = this.applicationContext;
            Assert.state(context != null, "No ApplicationContext set");
            // 此处使用了this.eventListenerFactories,这些EventListenerFactory是在该类postProcessBeanFactory方法调用时被记录的
            List<EventListenerFactory> factories = this.eventListenerFactories;
            Assert.state(factories != null, "EventListenerFactory List not initialized");
            Iterator var6 = annotatedMethods.keySet().iterator();

            while(true) {
                while(var6.hasNext()) {
                    Method method = (Method)var6.next();
                    Iterator var8 = factories.iterator();

                    while(var8.hasNext()) {
                        EventListenerFactory factory = (EventListenerFactory)var8.next();
                        if (factory.supportsMethod(method)) {
                            Method methodToUse = AopUtils.selectInvocableMethod(method, context.getType(beanName));
			    // 如果当前EventListenerFactory支持处理该@EventListener注解的方法，则使用它创建 ApplicationListenerMethodAdapter
                            ApplicationListener<?> applicationListener = factory.createApplicationListener(beanName, targetType, methodToUse);
                            if (applicationListener instanceof ApplicationListenerMethodAdapter) {
                                ((ApplicationListenerMethodAdapter)applicationListener).init(context, this.evaluator);
                            }
                            // 将创建的ApplicationListener加入到容器中
                            context.addApplicationListener(applicationListener);
                            break;
                        }
                    }
                }

                if (this.logger.isDebugEnabled()) {
                    this.logger.debug(annotatedMethods.size() + " @EventListener methods processed on bean '" + beanName + "': " + annotatedMethods);
                }
                break;
            }
        }
    }

}
通过EventListenerFactory的factory.createApplicationListener方法创建ApplicationListener，DefaultEventListenerFactory实现了EventListenerFactory接口：
```java
public class DefaultEventListenerFactory implements EventListenerFactory, Ordered {
    private int order = Integer.MAX_VALUE;

    public DefaultEventListenerFactory() {
    }

    public void setOrder(int order) {
        this.order = order;
    }

    public int getOrder() {
        return this.order;
    }

    public boolean supportsMethod(Method method) {
        return true;
    }

    public ApplicationListener<?> createApplicationListener(String beanName, Class<?> type, Method method) {
        return new ApplicationListenerMethodAdapter(beanName, type, method);
    }
}

```
ApplicationListenerMethodAdapter实现了ApplicationListener
```java
// 方法
public ApplicationListenerMethodAdapter(String beanName, Class<?> targetClass, Method method) {
    this.beanName = beanName;
    this.method = BridgeMethodResolver.findBridgedMethod(method);
    this.targetMethod = !Proxy.isProxyClass(targetClass) ? AopUtils.getMostSpecificMethod(method, targetClass) : this.method;
    this.methodKey = new AnnotatedElementKey(this.targetMethod, targetClass);
    EventListener ann = (EventListener)AnnotatedElementUtils.findMergedAnnotation(this.targetMethod, EventListener.class);
    this.declaredEventTypes = resolveDeclaredEventTypes(method, ann);
    this.condition = ann != null ? ann.condition() : null;
    this.order = resolveOrder(this.targetMethod);
    String id = ann != null ? ann.id() : "";
    this.listenerId = !id.isEmpty() ? id : null;
}

public void onApplicationEvent(ApplicationEvent event) {
    this.processEvent(event);
}

public void processEvent(ApplicationEvent event) {
    Object[] args = this.resolveArguments(event);
    if (this.shouldHandle(event, args)) {
        // 方法调用
        Object result = this.doInvoke(args);
        if (result != null) {
            this.handleResult(result);
        } else {
            this.logger.trace("No result object given - no result to handle");
        }
    }

}
@Nullable
protected Object doInvoke(Object... args) {
    Object bean = this.getTargetBean();
    if (bean.equals((Object)null)) {
        return null;
    } else {
        ReflectionUtils.makeAccessible(this.method);

        try {
            // 方法调用
            return this.method.invoke(bean, args);
        } catch (IllegalArgumentException var6) {
            this.assertTargetBean(this.method, bean, args);
            throw new IllegalStateException(this.getInvocationErrorMessage(bean, var6.getMessage(), args), var6);
        } catch (IllegalAccessException var7) {
            throw new IllegalStateException(this.getInvocationErrorMessage(bean, var7.getMessage(), args), var7);
        } catch (InvocationTargetException var8) {
            Throwable targetException = var8.getTargetException();
            if (targetException instanceof RuntimeException) {
                throw (RuntimeException)targetException;
            } else {
                String msg = this.getInvocationErrorMessage(bean, "Failed to invoke event listener method", args);
                throw new UndeclaredThrowableException(targetException, msg);
            }
        }
    }
}

```

#### 2.3 发布事件
继续看AbstractApplicationContext的refresh()方法中的finishRefresh（）方法:
```java
protected void finishRefresh() {
    this.clearResourceCaches();
    this.initLifecycleProcessor();
    this.getLifecycleProcessor().onRefresh();
    // 发布事件
    this.publishEvent((ApplicationEvent)(new ContextRefreshedEvent(this)));
    if (!NativeDetector.inNativeImage()) {
        LiveBeansView.registerApplicationContext(this);
    }

}

```
查看AbstractApplicationContext的publishEvent方法
```java
public void publishEvent(ApplicationEvent event) {
    this.publishEvent(event, (ResolvableType)null);
}
protected void publishEvent(Object event, @Nullable ResolvableType eventType) {
    Assert.notNull(event, "Event must not be null");
    Object applicationEvent;
    // 判断event是否继承ApplicationEvent
    if (event instanceof ApplicationEvent) {
        applicationEvent = (ApplicationEvent)event;
    } else {
       // 如果不是转换成PayloadApplicationEvent<T> extends ApplicationEvent
        applicationEvent = new PayloadApplicationEvent(this, event);
        if (eventType == null) {
            eventType = ((PayloadApplicationEvent)applicationEvent).getResolvableType();
        }
    }
    // 添加到earlyApplicationEvents保存起来，待多博器初始化后才继续进行多播到适当的监听器
    if (this.earlyApplicationEvents != null) {
        //  将applicationEvent添加到 earlyApplicationEvents
        this.earlyApplicationEvents.add(applicationEvent);
    } else {
        //  获取多播器，调用多播器的发布事件方法 ，其中会找符合要求的事件监听器进行调用
        this.getApplicationEventMulticaster().multicastEvent((ApplicationEvent)applicationEvent, eventType);
    }
    // 通过父上下文发布事件
    if (this.parent != null) {
        if (this.parent instanceof AbstractApplicationContext) {
            // 将event多播到所有适合的监听器。如果event不是ApplicationEvent实例，会将其封装成PayloadApplicationEvent对象再进行多播
            ((AbstractApplicationContext)this.parent).publishEvent(event, eventType);
        } else {
           // 通知与event事件应用程序注册的所有匹配的监听器
            this.parent.publishEvent(event);
        }
    }

}
```
通过多播器，发布事件：
```java
public void multicastEvent(final ApplicationEvent event, @Nullable ResolvableType eventType) {
    ResolvableType type = eventType != null ? eventType : this.resolveDefaultEventType(event);
    // 获取线程池
    Executor executor = this.getTaskExecutor();
    Iterator var5 = this.getApplicationListeners(event, type).iterator();

    while(var5.hasNext()) {
        ApplicationListener<?> listener = (ApplicationListener)var5.next();
        // 如果线程池不为空
        if (executor != null) {
	    // 异步调用
            executor.execute(() -> {
                this.invokeListener(listener, event);
            });
        } else {
            this.invokeListener(listener, event);
        }
    }

}

```
事件的调用：
```java
protected void invokeListener(ApplicationListener<?> listener, ApplicationEvent event) {
    ErrorHandler errorHandler = this.getErrorHandler();
    if (errorHandler != null) {
        try {
            this.doInvokeListener(listener, event);
        } catch (Throwable var5) {
            errorHandler.handleError(var5);
        }
    } else {
        this.doInvokeListener(listener, event);
    }

}

private void doInvokeListener(ApplicationListener listener, ApplicationEvent event) {
    try {
        listener.onApplicationEvent(event);
    } catch (ClassCastException var6) {
        String msg = var6.getMessage();
        if (msg != null && !this.matchesClassCastMessage(msg, event.getClass()) && (!(event instanceof PayloadApplicationEvent) || !this.matchesClassCastMessage(msg, ((PayloadApplicationEvent)event).getPayload().getClass()))) {
            throw var6;
        }

        Log loggerToUse = this.lazyLogger;
        if (loggerToUse == null) {
            loggerToUse = LogFactory.getLog(this.getClass());
            this.lazyLogger = loggerToUse;
        }

        if (loggerToUse.isTraceEnabled()) {
            loggerToUse.trace("Non-matching event type for listener: " + listener, var6);
        }
    }

```
