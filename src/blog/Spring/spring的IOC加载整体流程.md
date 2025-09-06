---
icon: file-lines
# 标题
title: 'spring的IOC加载整体流程'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-17
# 一个页面可以有多个分类
category:
  - Spring
# 一个页面可以有多个标签
tag:
  - 基础
  - Spring
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---



加载spring的上下文：

```java
public static void main(String[] args) {
    // 加载spring上下文
    AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext(MainConfig.class);
}
```

AnnotationConfigApplicationContext的构造方法

```java
public AnnotationConfigApplicationContext(Class... componentClasses) {
    this(); // 一，调用自己的无参构造
    this.register(componentClasses); // 二，注册配置类
    this.refresh(); // 三，刷新容器
}
```

### 一，调用自己的无参构造

AnnotationConfigApplicationContext的无参构造方法：

```java
public AnnotationConfigApplicationContext() {
    // ①，隐式调用父类的构造方法
    // ②，初始化一个Bean读取器
    this.reader = new AnnotatedBeanDefinitionReader(this)
    // ③，初始化一个扫描器，它仅仅是在我们外部手动调用 .scan 等方法才有用，常规方式是不会用到scanner对象的
    this.scanner = new ClassPathBeanDefinitionScanner(this);
}
```

#### **1.1，隐式调用父类的构造方法**

AnnotationConfigApplicationContext的无参构造方法,会先调用父类GenericApplicationContext的构造函数

```java
public GenericApplicationContext() {
    this.customClassLoader = false;
    this.refreshed = new AtomicBoolean();
    this.beanFactory = new DefaultListableBeanFactory(); // 创建了Bean工厂
}
```

DefaultListableBeanFactory是相当重要的，从字面意思就可以看出它是一个Bean的工厂，什么是Bean的工厂？当然就是用来生产和获得Bean的。

DefaultListableBeanFactory的继承关系图：

<img src="http://img.zouyh.top/article-img/20240917134945121.png" alt="image-20221116103840050" style="zoom: 67%;" />

#### **1.2，初始化一个Bean读取器**

让我们把目光回到AnnotationConfigApplicationContext的无参构造方法，让我们看看Spring在初始化AnnotatedBeanDefinitionReader的时候做了什么：

```java
public AnnotationConfigApplicationContext() {
    // ①，隐式调用父类的构造方法
    // ②，初始化一个Bean读取器
    this.reader = new AnnotatedBeanDefinitionReader(this)
    // ③，初始化一个扫描器，它仅仅是在我们外部手动调用 .scan 等方法才有用，常规方式是不会用到scanner对象的
    this.scanner = new ClassPathBeanDefinitionScanner(this);
}
```


AnnotationConfigApplicationContext的无参构造方法中通过`this.reader = new AnnotatedBeanDefinitionReader(this)`来创建AnnotatedBeanDefinitionReader对象，所以传入的参数thisBeanDefinitionRegistry当然就是AnnotationConfigApplicationContext的实例了。

AnnotatedBeanDefinitionReader的构造方法:

```java
public AnnotatedBeanDefinitionReader(BeanDefinitionRegistry registry) {
    this(registry, getOrCreateEnvironment(registry));
}
```

这里又直接调用了AnnotatedBeanDefinitionReader类其他的构造方法：

```java
public AnnotatedBeanDefinitionReader(BeanDefinitionRegistry registry, Environment environment) {
    this.beanNameGenerator = AnnotationBeanNameGenerator.INSTANCE;
    this.scopeMetadataResolver = new AnnotationScopeMetadataResolver();
    this.registry = registry;
    this.conditionEvaluator = new ConditionEvaluator(registry, environment, (ResourceLoader)null);
    AnnotationConfigUtils.registerAnnotationConfigProcessors(this.registry); // 重点方法
}
```

让我们把目光移动到这个方法的最后一行，进入registerAnnotationConfigProcessors方法:

```java
public static void registerAnnotationConfigProcessors(BeanDefinitionRegistry registry) {
    registerAnnotationConfigProcessors(registry, (Object)null);
}
```

这又是一个门面方法，再点进去,由于registerAnnotationConfigProcessors这个方法内容比较多，这里就把最核心的贴出来。如下：:

```java
// 判断容器中是否已经存在了ConfigurationClassPostProcessor Bean
if (!registry.containsBeanDefinition(CONFIGURATION_ANNOTATION_PROCESSOR_BEAN_NAME)) { 
    RootBeanDefinition def = new RootBeanDefinition(ConfigurationClassPostProcessor.class);
    def.setSource(source);
    // registerPostProcessor注册ConfigurationClassPostProcessor的bean定义
    beanDefs.add(registerPostProcessor(registry, def, CONFIGURATION_ANNOTATION_PROCESSOR_BEAN_NAME));
 }
```



registerAnnotationConfigProcessors这个方法的核心就是注册Spring内置的多个Bean：在这其中最重要的一个Bean（没有之一）就是ConfigurationClassPostProcessor Bean。ConfigurationClassPostProcessor实现BeanDefinitionRegistryPostProcessor接口，BeanDefinitionRegistryPostProcessor接口又是BeanFactoryPostProcessor扩展接口，BeanFactoryPostProcessor是Spring的扩展点之一，ConfigurationClassPostProcessor是Spring极为重要的一个类，必须牢牢的记住上面所说的这个类和它的继承关系。

![image-20221116110403214](http://img.zouyh.top/article-img/20240917134946123.png)

registerPostProcessor(registry, def, CONFIGURATION_ANNOTATION_PROCESSOR_BEAN_NAME)方法：

```java
private static BeanDefinitionHolder registerPostProcessor(BeanDefinitionRegistry registry, RootBeanDefinition definition, String beanName) {
    definition.setRole(2);
    registry.registerBeanDefinition(beanName, definition);
    return new BeanDefinitionHolder(definition, beanName);
}
```

这方法为BeanDefinition设置了一个Role，2代表这是spring内部的，并非用户定义的，然后又调用了registerBeanDefinition方法，再点进去，你会发现它是一个接口，没办法直接点进去了，首先要知道registry实现类是什么？答案是GenericApplicationContext类的方法，但本质是DefaultListableBeanFactory。首先registerPostProcessor方法的registry参数是AnnotationConfigApplicationContext在无参构造方法中通过`this.reader = new AnnotatedBeanDefinitionReader(this)`来创建AnnotatedBeanDefinitionReader，这个this就是BeanDefinitionRegistry registry也是AnnotationConfigApplicationContext对象，而AnnotationConfigApplicationContext继承GenericApplicationContext，所以我们先点进GenericApplicationContextregisterBeanDefinition方法：

```java
 public void registerBeanDefinition(String beanName, BeanDefinition beanDefinition) throws BeanDefinitionStoreException {
        // 调用的是 this.beanFactory.registerBeanDefinition
        this.beanFactory.registerBeanDefinition(beanName, beanDefinition); 
    }
```

this.beanFactory是什么呢？还记的AnnotationConfigApplicationContext()构造方法中隐式调用了父类GenericApplicationContext的构造函数中实例化了DefaultListableBeanFactory，所以this.beanFactory就是DefaultListableBeanFactory

![image-20221116112634626](http://img.zouyh.top/article-img/20240917134946124.png)

DefaultListableBeanFactory的registerBeanDefinition方法中核心：

```
//beanDefinitionMap是Map 
//这里就是把beanName作为key，beanDefinition作为value，推到map里面 
this.beanDefinitionMap.put(beanName, beanDefinition) 
//beanDefinitionNames就是一个List这里就是把beanName放到List中去 
this.beanDefinitionNames.add(beanName);
```

DefaultListableBeanFactory中的beanDefinitionMap，beanDefinitionNames也是相当重要的，以后会经常看到它，最好看到它，第一时间就可以反应出它里面放了什么数据，这里**仅仅是注册，并没有实例化**。

#### 1.3，初始化一个Bean扫描器

让我们把目光回到AnnotationConfigApplicationContext的无参构造方法，让我们看看Spring在初始化ClassPathBeanDefinitionScanner的时候做了什么：

```java
public AnnotationConfigApplicationContext() {
    // ①，隐式调用父类的构造方法
    // ②，初始化一个Bean读取器
    this.reader = new AnnotatedBeanDefinitionReader(this)
    // ③，初始化一个扫描器，它仅仅是在我们外部手动调用 .scan 等方法才有用，常规方式是不会用到scanner对象的
    this.scanner = new ClassPathBeanDefinitionScanner(this);
}
```

初始化一个扫描器，它仅仅是在我们外部手动调用 .scan 等方法才有用，常规方式是不会AnnotationConfigApplicationContext里面的scanner的，这里的scanner仅仅是为了程序员可以手动调用AnnotationConfigApplicationContext对象的scan方法。所以这里就不看scanner是如何被实例化的了。



总结：AnnotationConfigApplicationContext的构造方方中的this()，我们已经看完了，这个方法的主要作用创建了

AnnotatedBeanDefinitionReader实例和ClassPathBeanDefinitionScanner实例，在创建AnnotatedBeanDefinitionReader的时候

注册了ConfigurationClassPostProcessor的bean定义。



### 二，注册配置类

把目光回到最开始，AnnotationConfigApplicationContext的构造方法中的第二行代码，解析配置类：

```java
public AnnotationConfigApplicationContext(Class... componentClasses) {
    this(); // 一，调用自己的无参构造
    this.register(componentClasses); // 二，注册配置类
    this.refresh(); // 三，刷新容器
}
```

 this.register(componentClasses)方法：

```java
public void register(Class... componentClasses) {
    this.reader.register(componentClasses);
}
```

这里的this.reader就是在 一，调用自己的无参构造中初始化AnnotatedBeanDefinitionReader

 this.reader.register(componentClasses)方法：

```java
public void register(Class... componentClasses) {
        Class[] var2 = componentClasses;
        int var3 = componentClasses.length;

        for(int var4 = 0; var4 < var3; ++var4) {
            Class<?> componentClass = var2[var4];
            this.registerBean(componentClass);
        }

    }
```

 this.registerBean(componentClass)方法：

```java
public void registerBean(Class<?> beanClass) {
        this.doRegisterBean(beanClass, (String)null, (Class[])null, (Supplier)null, (BeanDefinitionCustomizer[])null);
    }
```

this.doRegisterBean(beanClass, (String)null, (Class[])null, (Supplier)null, (BeanDefinitionCustomizer[])null)方法：

```java
private <T> void doRegisterBean(Class<T> beanClass, @Nullable String name, @Nullable Class<? extends Annotation>[] qualifiers, @Nullable Supplier<T> supplier, @Nullable BeanDefinitionCustomizer[] customizers) {
   //AnnotatedGenericBeanDefinition可以理解为一种数据结构，是用来描述Bean的，这里的作用就是把传入的标记了注解的类 
   //转为AnnotatedGenericBeanDefinition数据结构，里面有一个getMetadata方法，可以拿到类上的注解
     AnnotatedGenericBeanDefinition abd = new AnnotatedGenericBeanDefinition(beanClass);
     //判断是否需要跳过注解，spring中有一个@Condition注解，当不满足条件，这个bean就不会被解析
    if (!this.conditionEvaluator.shouldSkip(abd.getMetadata())) {
        // 解析bean的作用域，如果没有设置的话，默认为单例
        abd.setInstanceSupplier(supplier); 
        ScopeMetadata scopeMetadata = this.scopeMetadataResolver.resolveScopeMetadata(abd);
        abd.setScope(scopeMetadata.getScopeName());
        //获得beanName
        String beanName = name != null ? name : this.beanNameGenerator.generateBeanName(abd, this.registry);
        // 为abd设置默认值Lazy，Primary，DependsOn，Role，Description
        AnnotationConfigUtils.processCommonDefinitionAnnotations(abd);
        int var10;
        int var11;
        if (qualifiers != null) {
            Class[] var9 = qualifiers;
            var10 = qualifiers.length;

            for(var11 = 0; var11 < var10; ++var11) {
                Class<? extends Annotation> qualifier = var9[var11];
                if (Primary.class == qualifier) {// Primary注解优先
                    abd.setPrimary(true);
                } else if (Lazy.class == qualifier) { // Lazy注解
                    abd.setLazyInit(true);
                } else {
                    abd.addQualifier(new AutowireCandidateQualifier(qualifier));
                }
            }
        }

        if (customizers != null) {
            BeanDefinitionCustomizer[] var13 = customizers;
            var10 = customizers.length;

            for(var11 = 0; var11 < var10; ++var11) {
                BeanDefinitionCustomizer customizer = var13[var11];
                customizer.customize(abd);
            }
        }
        // 这个方法用处不大，就是把AnnotatedGenericBeanDefinition数据结构和beanName封装到一个对象中
        BeanDefinitionHolder definitionHolder = new BeanDefinitionHolder(abd, beanName);
        definitionHolder = AnnotationConfigUtils.applyScopedProxyMode(scopeMetadata, definitionHolder, this.registry);
        //注册，最终会调用DefaultListableBeanFactory中的registerBeanDefinition方法去注册，
         //DefaultListableBeanFactory维护着一系列信息，比如beanDefinitionNames，beanDefinitionMap
        BeanDefinitionReaderUtils.registerBeanDefinition(definitionHolder, this.registry);
    }
  }
```

BeanDefinitionReaderUtils.registerBeanDefinition(definitionHolder, this.registry)方法：

```java
 public static void registerBeanDefinition(BeanDefinitionHolder definitionHolder, BeanDefinitionRegistry registry) throws BeanDefinitionStoreException {
        String beanName = definitionHolder.getBeanName();
        // 注册bean
        registry.registerBeanDefinition(beanName, definitionHolder.getBeanDefinition());
        String[] aliases = definitionHolder.getAliases();
        if (aliases != null) {
            String[] var4 = aliases;
            int var5 = aliases.length;

            for(int var6 = 0; var6 < var5; ++var6) {
                String alias = var4[var6];
                registry.registerAlias(beanName, alias);
            }
        }

    }
```

BeanDefinitionReaderUtils.registerBeanDefinition(definitionHolder, this.registry)方法的this.registry是AnnotatedBeanDefinitionReader的成员变量，在1.2初始化一个Bean读取器的时候传入的AnnotationConfigApplicationContext的实例了，AnnotationConfigApplicationContext继承GenericApplicationContext类，本质是DefaultListableBeanFactory

的registerBeanDefinition方法。



### 三，刷新容器

把目光回到最开始，AnnotationConfigApplicationContext的构造方法中的第三行代码，解析刷新容器：

```java
public AnnotationConfigApplicationContext(Class... componentClasses) {
    this(); // 一，调用自己的无参构造
    this.register(componentClasses); // 二，注册配置类
    this.refresh(); // 三，刷新容器
}
```

大家可以看到其实到这里，Spring还没有进行扫描，只是实例化了一个工厂（DefaultListableBeanFactory），注册了一些内置的Bean和我们传进去的配置类，真正的大头是在第三行代码，这个方法做了很多事情，让我们点开这个方法：

```java
public void refresh() throws BeansException, IllegalStateException {
    synchronized(this.startupShutdownMonitor) {
        // 刷新预处理，和主流程关系不大，就是保存了容器的启动时间，启动标志等
        this.prepareRefresh();
         // 和主流程关系也不大，最终获得了DefaultListableBeanFactory，
         // DefaultListableBeanFactory实现了ConfigurableListableBeanFactory
        ConfigurableListableBeanFactory beanFactory = this.obtainFreshBeanFactory();
        //还是一些准备工作，添加了两个后置处理器：ApplicationContextAwareProcessor，ApplicationListenerDetector
        // 还设置了 忽略自动装配 和 允许自动装配 的接口,如果不存在某个bean的时候，spring就自动注册singleton bean
        // 还设置了bean表达式解析器等
        this.prepareBeanFactory(beanFactory);

        try {
            // 这是一个空方法
            this.postProcessBeanFactory(beanFactory);
            // 执行自定义的BeanFactoryProcessor和内置的BeanFactoryProcessor
            this.invokeBeanFactoryPostProcessors(beanFactory);
            // 注册BeanPostProcessor
            this.registerBeanPostProcessors(beanFactory);
            beanPostProcess.end();
            this.initMessageSource();
            this.initApplicationEventMulticaster();
            this.onRefresh();
            this.registerListeners();
            // 实例化创建bean
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

refresh()方法内容特别多，今天就先看看this.invokeBeanFactoryPostProcessors(beanFactory)方法：

```java
protected void invokeBeanFactoryPostProcessors(ConfigurableListableBeanFactory beanFactory) {
    PostProcessorRegistrationDelegate.invokeBeanFactoryPostProcessors(beanFactory, this.getBeanFactoryPostProcessors());
   
    if (!NativeDetector.inNativeImage() && beanFactory.getTempClassLoader() == null && beanFactory.containsBean("loadTimeWeaver")) {
        beanFactory.addBeanPostProcessor(new LoadTimeWeaverAwareProcessor(beanFactory));
        beanFactory.setTempClassLoader(new ContextTypeMatchClassLoader(beanFactory.getBeanClassLoader()));
    }

}
```

this.getBeanFactoryPostProcessors()方法真是坑，第一次看到这里的时候，愣住了，总觉得获得的永远都是空的集合，掉入坑里，久久无法自拔，后来才知道spring允许我们手动添加BeanFactoryPostProcessor，即：`annotationConfigApplicationContext.addBeanFactoryPostProcessor(XXX);`



让我们点开PostProcessorRegistrationDelegate.invokeBeanFactoryPostProcessors()方法：

```java
public static void invokeBeanFactoryPostProcessors(ConfigurableListableBeanFactory beanFactory, List<BeanFactoryPostProcessor> beanFactoryPostProcessors) {
    Set<String> processedBeans = new HashSet(); // 用于后续
    ArrayList regularPostProcessors;  // regularPostProcessors 用来存放BeanFactoryPostProcessor
    ArrayList registryProcessors;   // BeanDefinitionRegistryPostProcessor扩展了BeanFactoryPostProcessor
    int var9;
    ArrayList currentRegistryProcessors;
    String[] postProcessorNames;
    // beanFactory是DefaultListableBeanFactory，是BeanDefinitionRegistry的实现类，所以肯定满足if
    if (beanFactory instanceof BeanDefinitionRegistry) {
        BeanDefinitionRegistry registry = (BeanDefinitionRegistry)beanFactory;
        regularPostProcessors = new ArrayList();  // regularPostProcessors 用来存放BeanFactoryPostProcessor，
        //BeanDefinitionRegistryPostProcessor扩展了BeanFactoryPostProcessor
        registryProcessors = new ArrayList();//registryProcessors 用来存放BeanDefinitionRegistryPostProcessor
        
        // 循环传进来的beanFactoryPostProcessors，正常情况下，beanFactoryPostProcessors肯定没有数据
        // 因为beanFactoryPostProcessors是获得手动添加的，而不是spring扫描的
        // 只有手动调用annotationConfigApplicationContext.addBeanFactoryPostProcessor(XXX)才会有数据
        Iterator var6 = beanFactoryPostProcessors.iterator();

        while(var6.hasNext()) {
            BeanFactoryPostProcessor postProcessor = (BeanFactoryPostProcessor)var6.next();
            // 判断postProcessor是不是BeanDefinitionRegistryPostProcessor，因为BeanDefinitionRegistryPostProcessor
            // 扩展了BeanFactoryPostProcessor，所以这里先要判断是不是BeanDefinitionRegistryPostProcessor
            // 是的话，直接执行postProcessBeanDefinitionRegistry方法，然后把对象装到registryProcessors里面去
            if (postProcessor instanceof BeanDefinitionRegistryPostProcessor) {
                BeanDefinitionRegistryPostProcessor registryProcessor = (BeanDefinitionRegistryPostProcessor)postProcessor;
                registryProcessor.postProcessBeanDefinitionRegistry(registry);
                registryProcessors.add(registryProcessor);
            } else {//不是的话，就装到regularPostProcessors
                regularPostProcessors.add(postProcessor);
            }
        }
         // 一个临时变量，用来装载BeanDefinitionRegistryPostProcessor
         // BeanDefinitionRegistry继承了PostProcessorBeanFactoryPostProcessor
        currentRegistryProcessors = new ArrayList();
        // 获得实现BeanDefinitionRegistryPostProcessor接口的类的BeanName:org.springframework.context.annotation.internalConfigurationAnnotationProcessor
        // 并且装入数组postProcessorNames，我理解一般情况下，只会找到一个
        // 这里又有一个坑，为什么我自己创建了一个实现BeanDefinitionRegistryPostProcessor接口的类，也打上了@Component注解
        // 配置类也加上了@Component注解，但是这里却没有拿到
        // 因为直到这一步，Spring还没有去扫描，扫描是在ConfigurationClassPostProcessor类中完成的，也就是下面的第一个
        // invokeBeanDefinitionRegistryPostProcessors方法
        postProcessorNames = beanFactory.getBeanNamesForType(BeanDefinitionRegistryPostProcessor.class, true, false);
        String[] var16 = postProcessorNames;
        var9 = postProcessorNames.length;

        int var10;
        String ppName;
        for(var10 = 0; var10 < var9; ++var10) {
            ppName = var16[var10];
            if (beanFactory.isTypeMatch(ppName, PriorityOrdered.class)) {
           //获得ConfigurationClassPostProcessor类，并且放到currentRegistryProcessors
           //ConfigurationClassPostProcessor是很重要的一个类，它实现了BeanDefinitionRegistryPostProcessor接口
           //BeanDefinitionRegistryPostProcessor接口又实现了BeanFactoryPostProcessor接口
           //ConfigurationClassPostProcessor是极其重要的类
           //里面执行了扫描Bean，Import，ImportResouce等各种操作
           //用来处理配置类（有两种情况 一种是传统意义上的配置类，一种是普通的bean）的各种逻辑
           // 调用工厂的getBean的方法获取实例
            currentRegistryProcessors.add(beanFactory.getBean(ppName, BeanDefinitionRegistryPostProcessor.class));
                
                // 把name放到processedBeans，后续会根据这个集合来判断处理器是否已经被执行过了
                processedBeans.add(ppName);
            }
        }
        // 处理排序
        sortPostProcessors(currentRegistryProcessors, beanFactory);
        // 合并Processors，为什么要合并，因为registryProcessors是装载BeanDefinitionRegistryPostProcessor的
        // 一开始的时候，spring只会执行BeanDefinitionRegistryPostProcessor独有的方法
        // 而不会执行BeanDefinitionRegistryPostProcessor父类的方法，即BeanFactoryProcessor的方法
        // 所以这里需要把处理器放入一个集合中，后续统一执行父类的方法
        // 即BeanDefinitionRegistryPostProcessor独有的方法和BeanDefinitionRegistryPostProcessor父类的方法都会执行
        registryProcessors.addAll(currentRegistryProcessors);
        // 可以理解为执行ConfigurationClassPostProcessor的postProcessBeanDefinitionRegistry方法
        // Spring热插播的体现，像ConfigurationClassPostProcessor就相当于一个组件，Spring很多事情就是交给组件去管理
        // 如果不想用这个组件，直接把注册组件的那一步去掉就可以
        invokeBeanDefinitionRegistryPostProcessors(currentRegistryProcessors, registry, beanFactory.getApplicationStartup());
        // 因为currentRegistryProcessors是一个临时变量，所以需要清除
        currentRegistryProcessors.clear();
         // 上面的代码是执行了实现了PriorityOrdered接口的BeanDefinitionRegistryPostProcessor，
         // 下面的代码是执行了实现了Ordered接口的BeanDefinitionRegistryPostProcessor，
        // 再次根据BeanDefinitionRegistryPostProcessor获得BeanName，看这个BeanName是否已经被执行过了，有没有实现Ordered接口       
        postProcessorNames = beanFactory.getBeanNamesForType(BeanDefinitionRegistryPostProcessor.class, true, false);
        var16 = postProcessorNames;
        var9 = postProcessorNames.length;
        for(var10 = 0; var10 < var9; ++var10) {
            ppName = var16[var10];
             // 如果没有被执行过，也实现了Ordered接口的话，把对象推送到currentRegistryProcessors，名称推送到processedBeans
        // 如果没有实现Ordered接口的话，这里不把数据加到currentRegistryProcessors，processedBeans中，后续再做处理
        // 这里才可以获得我们定义的实现了BeanDefinitionRegistryPostProcessor的Bean
            if (!processedBeans.contains(ppName) && beanFactory.isTypeMatch(ppName, Ordered.class)) {
                currentRegistryProcessors.add(beanFactory.getBean(ppName, BeanDefinitionRegistryPostProcessor.class));
                processedBeans.add(ppName);
            }
        }
        // 处理排序
        sortPostProcessors(currentRegistryProcessors, beanFactory);
        // 合并Processors
        registryProcessors.addAll(currentRegistryProcessors);
        // 执行我们自定义的BeanDefinitionRegistryPostProcessor
        invokeBeanDefinitionRegistryPostProcessors(currentRegistryProcessors, registry, beanFactory.getApplicationStartup());
        // 清空临时变量
        currentRegistryProcessors.clear();
        boolean reiterate = true;
        // 上面的代码是执行了实现了Ordered接口的BeanDefinitionRegistryPostProcessor，
        // 下面的代码就是执行没有实现PriorityOrdered和Ordered接口的BeanDefinitionRegistryPostProcessor
        while(reiterate) {
            reiterate = false;
            // 再次根据BeanDefinitionRegistryPostProcessor获得BeanName，
            postProcessorNames = beanFactory.getBeanNamesForType(BeanDefinitionRegistryPostProcessor.class, true, false);
            String[] var19 = postProcessorNames;
            var10 = postProcessorNames.length;

            for(int var26 = 0; var26 < var10; ++var26) {
                String ppName = var19[var26];
                //看这个BeanName是否已经被执行过了
                if (!processedBeans.contains(ppName)) {
                    currentRegistryProcessors.add(beanFactory.getBean(ppName, BeanDefinitionRegistryPostProcessor.class));
                    processedBeans.add(ppName);
                    reiterate = true;
                }
            }
            // 处理排序
            sortPostProcessors(currentRegistryProcessors, beanFactory);
            // 合并Processors
            registryProcessors.addAll(currentRegistryProcessors);
            // 执行我们自定义的BeanDefinitionRegistryPostProcessor
            invokeBeanDefinitionRegistryPostProcessors(currentRegistryProcessors, registry, beanFactory.getApplicationStartup());
            currentRegistryProcessors.clear();
        }
        // 上面的代码是执行子类独有的方法，这里需要再把父类的方法也执行一次
        // 执行父类BeanFactoryPostProcessor
        // 但是regularPostProcessors一般情况下，是不会有数据的，只有在外面手动添加BeanFactoryPostProcessor，才会有数据
        invokeBeanFactoryPostProcessors((Collection)regularPostProcessors, (ConfigurableListableBeanFactory)beanFactory);
    } else {
         // 执行父类BeanFactoryPostProcessor
        invokeBeanFactoryPostProcessors((Collection)beanFactoryPostProcessors, (ConfigurableListableBeanFactory)beanFactory);
    }
    // 找到BeanFactoryPostProcessor实现类的BeanName数组
    String[] postProcessorNames = beanFactory.getBeanNamesForType(BeanFactoryPostProcessor.class, true, false);
    regularPostProcessors = new ArrayList();
    registryProcessors = new ArrayList();
    currentRegistryProcessors = new ArrayList();
    postProcessorNames = postProcessorNames;
    int var20 = postProcessorNames.length;

    String ppName;
    // 循环BeanName数组
    for(var9 = 0; var9 < var20; ++var9) {
        ppName = postProcessorNames[var9];
        // 如果这个Bean被执行过了，跳过
        if (!processedBeans.contains(ppName)) {
            // 如果实现了PriorityOrdered接口，加入到priorityOrderedPostProcessors
            if (beanFactory.isTypeMatch(ppName, PriorityOrdered.class)) {
                regularPostProcessors.add(beanFactory.getBean(ppName, BeanFactoryPostProcessor.class));
            } else if (beanFactory.isTypeMatch(ppName, Ordered.class)) {
                // 如果实现了Ordered接口，加入到orderedPostProcessorNames
                registryProcessors.add(ppName);
            } else {// 如果既没有实现PriorityOrdered，也没有实现Ordered。加入到nonOrderedPostProcessorNames
                currentRegistryProcessors.add(ppName);
            }
        }
    }
   // 排序处理priorityOrderedPostProcessors，即实现了PriorityOrdered接口的BeanFactoryPostProcessor
    sortPostProcessors(regularPostProcessors, beanFactory);
    // 执行实现了Ordered接口的BeanFactoryPostProcessor
    invokeBeanFactoryPostProcessors((Collection)regularPostProcessors, (ConfigurableListableBeanFactory)beanFactory);
    
    // 执行实现了Ordered接口的BeanFactoryPostProcessor
    List<BeanFactoryPostProcessor> orderedPostProcessors = new ArrayList(registryProcessors.size());
    Iterator var21 = registryProcessors.iterator();
    while(var21.hasNext()) {
        String postProcessorName = (String)var21.next();
        orderedPostProcessors.add(beanFactory.getBean(postProcessorName, BeanFactoryPostProcessor.class));
    }

    sortPostProcessors(orderedPostProcessors, beanFactory);
    invokeBeanFactoryPostProcessors((Collection)orderedPostProcessors, (ConfigurableListableBeanFactory)beanFactory);
   
     // 执行既没有实现PriorityOrdered接口，也没有实现Ordered接口的BeanFactoryPostProcessor
    List<BeanFactoryPostProcessor> nonOrderedPostProcessors = new ArrayList(currentRegistryProcessors.size());
    Iterator var24 = currentRegistryProcessors.iterator();
    while(var24.hasNext()) {
        ppName = (String)var24.next();
        nonOrderedPostProcessors.add(beanFactory.getBean(ppName, BeanFactoryPostProcessor.class));
    }

    invokeBeanFactoryPostProcessors((Collection)nonOrderedPostProcessors, (ConfigurableListableBeanFactory)beanFactory);
    beanFactory.clearMetadataCache();
}
```

invokeBeanFactoryPostProcessors()方法的大体流程是：

1，将手动添加的BeanFactoryPostProcessor，区分为实现BeanDefinitionRegistryPostProcessor的BeanFactoryPostProcessor和未实现BeanDefinitionRegistryPostProcessor的BeanFactoryPostProcessor。

2，通过`postProcessorNames = beanFactory.getBeanNamesForType(BeanDefinitionRegistryPostProcessor.class, true, false);`获取是继承BeanDefinitionRegistryPostProcessor的bean定义名称。

3，通过bean定义名称和`beanFactory.isTypeMatch(ppName, PriorityOrdered.class)`判断实现PriorityOrdered的BeanDefinitionRegistryPostProcessor，通过`currentRegistryProcessors.add(beanFactory.getBean(ppName, BeanDefinitionRegistryPostProcessor.class))`getbean的方式实例化后放入将要执行的currentRegistryProcessors。

4，通过sortPostProcessors方法排序，放入registryProcessors集合中，这个集合是为了方便后续后续统一执行BeanDefinitionRegistryPostProcessor父类的方法，即BeanFactoryProcessor的方法
所以这里需要把处理器放入一个集合中。

5，通过调用invokeBeanDefinitionRegistryPostProcessors方法执行类型是BeanDefinitionRegistryPostProcessor并且实现PriorityOrdered的bean的PostProcessor方法。

6，然后再次判断是BeanDefinitionRegistryPostProcessor类型并且实现Ordere的bean，排序，合并、执行。

7，然后再次判断是BeanDefinitionRegistryPostProcessor类型的bean，排序，合并、执行。

8，然后通过`String[] postProcessorNames = beanFactory.getBeanNamesForType(BeanFactoryPostProcessor.class, true, false);`方法获取是继承BeanFactoryPostProcessor的bean定义名称。

9，然后判断是BeanFactoryPostProcessor并且实现PriorityOrdered的bean，排序，合并、执行。

10，然后判断是BeanFactoryPostProcessor并且实现Ordere的bean，排序，合并、执行。

11，然后判断既没有实现PriorityOrdered接口，也没有实现Ordered接口的BeanFactoryPostProcessor执行。



总结一下：

一，调用自己的无参构造，做了三件事：

​	1.1隐式的调用了父类的构造方法，在父类的构造方法中创建了DefaultListableBeanFactory，bean创建工厂。

​	1.2初始了一个Bean读取器和**ConfigurationClassPostProcessor的Bean定义**，在二，注册配置类中使用这个bean读取器，创建配置类的Bean定义。

​	1.3初始化一个Bean扫描器，用于手动调用scan扫描配置（不重要）

二，注册配置类，使用1.2初始了一个Bean读取器创建配置类的Bean定义。

三，刷新容器，刷新容器会调用是所有实现BeanFactoryPostProcessor接口的方法，ConfigurationClassPostProcessor实现了BeanFactoryPostProcessor，所以会调用ConfigurationClassPostProcessor的方法，而ConfigurationClassPostProcessor的方法就是解析配置类的核心。

### 四，ConfigurationClassPostProcessor

​	ConfigurationClassPostProcessor实现BeanDefinitionRegistryPostProcessor接口

​    ConfigurationClassPostProcessor也实现了BeanFactoryPostProcessor接口

BeanFactoryPostProcessor是Spring的扩展点之一，ConfigurationClassPostProcessor是Spring极为重要的一个类，必须牢牢的记住上面所说的这个类和它的继承关系。

![image-20221116154631455](http://img.zouyh.top/article-img/20240917134944119.png)



#### 4.1postProcessBeanDefinitionRegistry方法



ConfigurationClassPostProcessor实现BeanDefinitionRegistryPostProcessor接口，所以也会调用postProcessBeanDefinitionRegistry

```java
private static void invokeBeanDefinitionRegistryPostProcessors(Collection<? extends BeanDefinitionRegistryPostProcessor> postProcessors, BeanDefinitionRegistry registry, ApplicationStartup applicationStartup) {
    Iterator var3 = postProcessors.iterator();

    while(var3.hasNext()) {
        BeanDefinitionRegistryPostProcessor postProcessor = (BeanDefinitionRegistryPostProcessor)var3.next();
        StartupStep var10000 = applicationStartup.start("spring.context.beandef-registry.post-process");
        postProcessor.getClass();
        StartupStep postProcessBeanDefRegistry = var10000.tag("postProcessor", postProcessor::toString);
        postProcessor.postProcessBeanDefinitionRegistry(registry); // postProcessBeanDefinitionRegistry方法
        postProcessBeanDefRegistry.end();
    }

}
```

![image-20221116155209907](http://img.zouyh.top/article-img/20240917134945122.png)

点进ConfigurationClassPostProcessor的postProcessBeanDefinitionRegistry方法：

```java
public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) {
    int registryId = System.identityHashCode(registry);
    if (this.registriesPostProcessed.contains(registryId)) {
        throw new IllegalStateException("postProcessBeanDefinitionRegistry already called on this post-processor against " + registry);
    } else if (this.factoriesPostProcessed.contains(registryId)) {
        throw new IllegalStateException("postProcessBeanFactory already called on this post-processor against " + registry);
    } else {
        this.registriesPostProcessed.add(registryId); // registriesPostProcessed保存已注册的
        this.processConfigBeanDefinitions(registry);
    }
}
```

这个方法是门面方法，会调用processConfigBeanDefinitions方法：

```java
public void processConfigBeanDefinitions(BeanDefinitionRegistry registry) {
    List<BeanDefinitionHolder> configCandidates = new ArrayList();
    //1，获得所有的BeanDefinition的Name，放入candidateNames数组
    String[] candidateNames = registry.getBeanDefinitionNames();
    String[] var4 = candidateNames;
    int var5 = candidateNames.length;
   // 2，循环candidateNames数组
    for(int var6 = 0; var6 < var5; ++var6) {
        String beanName = var4[var6];
        // 获取BeanDefinition
        BeanDefinition beanDef = registry.getBeanDefinition(beanName);
        // 3，当我们注册配置类的时候，
        // 可以不加Configuration注解，直接使用Component ComponentScan Import ImportResource注解，称之为Lite配置类
        // 如果加了Configuration注解，就称之为Full配置类
        if (beanDef.getAttribute(ConfigurationClassUtils.CONFIGURATION_CLASS_ATTRIBUTE) != null) {
            if (this.logger.isDebugEnabled()) {
                this.logger.debug("Bean definition has already been processed as a configuration class: " + beanDef);
            }
            //判断是否为配置类（有两种情况 一种是传统意义上的配置类，一种是普通的bean），
            //在这个方法内部，会做判断，这个配置类是Full配置类，还是Lite配置类，并且做上标记
            //满足条件，加入到configCandidates
        } else if (ConfigurationClassUtils.checkConfigurationClassCandidate(beanDef, this.metadataReaderFactory)) {
            configCandidates.add(new BeanDefinitionHolder(beanDef, beanName));
        }
    }
   // 如果没有配置类，直接返回
    if (!configCandidates.isEmpty()) {
        // 5，处理排序
        configCandidates.sort((bd1, bd2) -> {
            int i1 = ConfigurationClassUtils.getOrder(bd1.getBeanDefinition());
            int i2 = ConfigurationClassUtils.getOrder(bd2.getBeanDefinition());
            return Integer.compare(i1, i2);
        });
        SingletonBeanRegistry sbr = null;
        // DefaultListableBeanFactory 实现 SingletonBeanRegistry接口，所以可以进入到这个if
        if (registry instanceof SingletonBeanRegistry) {
            sbr = (SingletonBeanRegistry)registry;
            if (!this.localBeanNameGeneratorSet) {
                // spring中可以修改默认的bean命名方式，这里就是看用户有没有自定义bean命名方式，虽然一般没有人会这么做
                BeanNameGenerator generator = (BeanNameGenerator)sbr.getSingleton("org.springframework.context.annotation.internalConfigurationBeanNameGenerator");
                if (generator != null) {
                    this.componentScanBeanNameGenerator = generator;
                    this.importBeanNameGenerator = generator;
                }
            }
        }

        if (this.environment == null) {
            this.environment = new StandardEnvironment();
        }

        ConfigurationClassParser parser = new ConfigurationClassParser(this.metadataReaderFactory, this.problemReporter, this.environment, this.resourceLoader, this.componentScanBeanNameGenerator, registry);
        Set<BeanDefinitionHolder> candidates = new LinkedHashSet(configCandidates);
        HashSet alreadyParsed = new HashSet(configCandidates.size());

        do {
            parser.parse(candidates); // 6，解析配置类（传统意义上的配置类或者是普通bean，核心来了）
            parser.validate();
            Set<ConfigurationClass> configClasses = new LinkedHashSet(parser.getConfigurationClasses());
            configClasses.removeAll(alreadyParsed);
            if (this.reader == null) {
                this.reader = new ConfigurationClassBeanDefinitionReader(registry, this.sourceExtractor, this.resourceLoader, this.environment, this.importBeanNameGenerator, parser.getImportRegistry());
            }
            // 7，直到loadBeanDefinitions这一步才把@Import，@Bean @ImportRosource 转换成BeanDefinition
            this.reader.loadBeanDefinitions(configClasses);
            //把configClasses加入到alreadyParsed，代表已经解析了
            alreadyParsed.addAll(configClasses);
            processConfig.tag("classCount", () -> {
                return String.valueOf(configClasses.size());
            }).end();
            candidates.clear();
            //获得注册器里面BeanDefinition的数量 和 candidateNames进行比较
            //如果大于的话，说明有新的BeanDefinition注册进来了
            if (registry.getBeanDefinitionCount() > candidateNames.length) {
                String[] newCandidateNames = registry.getBeanDefinitionNames();
                Set<String> oldCandidateNames = new HashSet(Arrays.asList(candidateNames));
                Set<String> alreadyParsedClasses = new HashSet();
                Iterator var13 = alreadyParsed.iterator();

                while(var13.hasNext()) {
                    ConfigurationClass configurationClass = (ConfigurationClass)var13.next();
                    alreadyParsedClasses.add(configurationClass.getMetadata().getClassName());
                }

                String[] var24 = newCandidateNames;
                int var25 = newCandidateNames.length;

                for(int var15 = 0; var15 < var25; ++var15) {
                    String candidateName = var24[var15];
                    if (!oldCandidateNames.contains(candidateName)) {
                        BeanDefinition bd = registry.getBeanDefinition(candidateName);
                        if (ConfigurationClassUtils.checkConfigurationClassCandidate(bd, this.metadataReaderFactory) && !alreadyParsedClasses.contains(bd.getBeanClassName())) {
                            candidates.add(new BeanDefinitionHolder(bd, candidateName));
                        }
                    }
                }

                candidateNames = newCandidateNames;
            }
        } while(!candidates.isEmpty());

        if (sbr != null && !sbr.containsSingleton(IMPORT_REGISTRY_BEAN_NAME)) {
            sbr.registerSingleton(IMPORT_REGISTRY_BEAN_NAME, parser.getImportRegistry());
        }

        if (this.metadataReaderFactory instanceof CachingMetadataReaderFactory) {
            ((CachingMetadataReaderFactory)this.metadataReaderFactory).clearCache();
        }

    }
}
```

1. 获得所有的BeanName，放入candidateNames数组。

2. 循环candidateNames数组，根据beanName获得BeanDefinition，判断此BeanDefinition是否已经被处理过了。

3. 判断是否是配置类，如果是的话。加入到configCandidates数组，在判断的时候，还会标记配置类属于Full配置类，还是Lite配置类，这里会引发一连串的知识盲点：

   - 当我们注册配置类的时候，可以不加@Configuration注解，直接使用@Component @ComponentScan @Import@ImportResource等注解，Spring把这种配置类称之为Lite配置类， 如果加了@Configuration注解，就称之为Full配置类。

   - 如果我们注册了Lite配置类，我们getBean这个配置类，会发现它就是原本的那个配置类，如果我们注册了Full配置类，我们getBean这个配置类，会发现它已经不是原本那个配置类了，而是已经被cgilb代理的类了。

   - 写一个A类，其中有一个构造方法，打印出“你好”，再写一个配置类，里面有两个被@bean注解的方法，其中一个方法new了A类，并且返回A的对象，把此方法称之为getA，第二个方法又调用了getA方法，如果配置类是Lite配置类，会发现打印了两次“你好”，也就是说A类被new了两次，如果配置类是Full配置类，会发现只打印了一次“你好”，也就是说A类只被new了一次，因为这个类被cgilb代理了，方法已经被改写。

4. 如果没有配置类直接返回。

5. 处理排序。

6. 解析配置类，可能是Full配置类，也有可能是Lite配置类，这个小方法是此方法的核心，稍后具体说明。

7. 在第6步的时候，只是注册了部分Bean，像 @Import @Bean等，是没有被注册的，这里统一对这些进行注册。

   

   下面是解析配置类的过程parse方法：

```java
public void parse(Set<BeanDefinitionHolder> configCandidates) {
    Iterator var2 = configCandidates.iterator();

    while(var2.hasNext()) {
        BeanDefinitionHolder holder = (BeanDefinitionHolder)var2.next();
        BeanDefinition bd = holder.getBeanDefinition();
        try {
            if (bd instanceof AnnotatedBeanDefinition) { // 如果获得BeanDefinition是AnnotatedBeanDefinition的实例
                this.parse(((AnnotatedBeanDefinition)bd).getMetadata(), holder.getBeanName());
            } else if (bd instanceof AbstractBeanDefinition && ((AbstractBeanDefinition)bd).hasBeanClass()) {
                this.parse(((AbstractBeanDefinition)bd).getBeanClass(), holder.getBeanName());
            } else {
                this.parse(bd.getBeanClassName(), holder.getBeanName());
            }
        } catch (BeanDefinitionStoreException var6) {
            throw var6;
        } catch (Throwable var7) {
            throw new BeanDefinitionStoreException("Failed to parse configuration class [" + bd.getBeanClassName() + "]", var7);
        }
    }
   //执行DeferredImportSelector
    this.deferredImportSelectorHandler.process();
}
```

因为可以有多个配置类，所以需要循环处理。我们的配置类的BeanDefinition是AnnotatedBeanDefinition的实例，所以会进入第一个if：

```java
protected final void parse(AnnotationMetadata metadata, String beanName) throws IOException {
    this.processConfigurationClass(new ConfigurationClass(metadata, beanName), DEFAULT_EXCLUSION_FILTER);
}
```

这是门面方法，真正执行的是processConfigurationClass方法：

```java
protected void processConfigurationClass(ConfigurationClass configClass, Predicate<String> filter) throws IOException {
    // 判断不需要跳过的配置
    if (!this.conditionEvaluator.shouldSkip(configClass.getMetadata(), ConfigurationPhase.PARSE_CONFIGURATION)) {
        ConfigurationClass existingClass = (ConfigurationClass)this.configurationClasses.get(configClass);
        if (existingClass != null) {
            if (configClass.isImported()) {
                if (existingClass.isImported()) {
                    existingClass.mergeImportedBy(configClass);
                }

                return;
            }

            this.configurationClasses.remove(configClass);
            this.knownSuperclasses.values().removeIf(configClass::equals);
        }

        ConfigurationClassParser.SourceClass sourceClass = this.asSourceClass(configClass, filter);

        do {
            // 解析配置类包含的类
            sourceClass = this.doProcessConfigurationClass(configClass, sourceClass, filter);
        } while(sourceClass != null);

        // 重点在于doProcessConfigurationClass方法，需要特别注意，最后一行代码，会把configClass放入一个Map，
        // 会在loadBeanDefinitions这一步才把@Import，@Bean @ImportRosource 真正的转换成BeanDefinition
        this.configurationClasses.put(configClass, configClass);
    }
}
```

需要特别注意，最后一行代码，会把configClass放入一个Map，会在上面第7步中用到。

doProcessConfigurationClass方法如下：

```java
protected final ConfigurationClassParser.SourceClass doProcessConfigurationClass(ConfigurationClass configClass, ConfigurationClassParser.SourceClass sourceClass, Predicate<String> filter) throws IOException {
    if (configClass.getMetadata().isAnnotated(Component.class.getName())) {
        this.processMemberClasses(configClass, sourceClass, filter); //处理内部类，一般不会写内部类
    }

    Iterator var4 = AnnotationConfigUtils.attributesForRepeatable(sourceClass.getMetadata(), PropertySources.class, PropertySource.class).iterator();

    AnnotationAttributes importResource;
    // 2，处理@PropertySource注解，@PropertySource注解用来加载properties文件
    while(var4.hasNext()) {
        importResource = (AnnotationAttributes)var4.next();
        if (this.environment instanceof ConfigurableEnvironment) {
            this.processPropertySource(importResource);
        } else {
            this.logger.info("Ignoring @PropertySource annotation on [" + sourceClass.getMetadata().getClassName() + "]. Reason: Environment must implement ConfigurableEnvironment");
        }
    }
    // 3，获得ComponentScan注解具体的内容，ComponentScan注解除了最常用的basePackage之外，还有
    // includeFilters，excludeFilters等
    Set<AnnotationAttributes> componentScans = AnnotationConfigUtils.attributesForRepeatable(sourceClass.getMetadata(), ComponentScans.class, ComponentScan.class);
    // 4，如果没有打上ComponentScan，或者被@Condition条件跳过，就不再进入这个if
    if (!componentScans.isEmpty() && !this.conditionEvaluator.shouldSkip(sourceClass.getMetadata(), ConfigurationPhase.REGISTER_BEAN)) {
        Iterator var14 = componentScans.iterator();

        while(var14.hasNext()) {
            AnnotationAttributes componentScan = (AnnotationAttributes)var14.next();
            // componentScan就是@ComponentScan上的具体内容，sourceClass.getMetadata().getClassName()就是配置类的名称
            // 4.1解析ComponentScan
            Set<BeanDefinitionHolder> scannedBeanDefinitions = this.componentScanParser.parse(componentScan, sourceClass.getMetadata().getClassName());
            Iterator var8 = scannedBeanDefinitions.iterator();

            while(var8.hasNext()) {
                BeanDefinitionHolder holder = (BeanDefinitionHolder)var8.next();
                BeanDefinition bdCand = holder.getBeanDefinition().getOriginatingBeanDefinition();
                if (bdCand == null) {
                    bdCand = holder.getBeanDefinition();
                }

                if (ConfigurationClassUtils.checkConfigurationClassCandidate(bdCand, this.metadataReaderFactory)) {                    // 4.2递归调用，因为可能组件类有被@Bean标记的方法，或者组件类本身也有ComponentScan等注解
                    this.parse(bdCand.getBeanClassName(), holder.getBeanName());
                }
            }
        }
    }
    // 5.处理@Import注解
    // @Import注解是spring中很重要的一个注解，Springboot大量应用这个注解
    // @Import三种类，一种是Import普通类，一种是Import ImportSelector，还有一种是Import ImportBeanDefinitionRegistrar
    // 6.getImports(sourceClass)是获得import的内容，返回的是一个set
    this.processImports(configClass, sourceClass, this.getImports(sourceClass), filter, true);
    importResource = AnnotationConfigUtils.attributesFor(sourceClass.getMetadata(), ImportResource.class);
    if (importResource != null) {
        String[] resources = importResource.getStringArray("locations");
        Class<? extends BeanDefinitionReader> readerClass = importResource.getClass("reader");
        String[] var20 = resources;
        int var22 = resources.length;

        for(int var23 = 0; var23 < var22; ++var23) {
            String resource = var20[var23];
            String resolvedResource = this.environment.resolveRequiredPlaceholders(resource);
            configClass.addImportedResource(resolvedResource, readerClass);
        }
    }
    // 7.处理@Bean的方法，可以看到获得了带有@Bean的方法后，不是马上转换成BeanDefinition，而是先用一个set接收
    // Process individual @Bean methods
    Set<MethodMetadata> beanMethods = this.retrieveBeanMethodMetadata(sourceClass);
    Iterator var18 = beanMethods.iterator();

    while(var18.hasNext()) {
        MethodMetadata methodMetadata = (MethodMetadata)var18.next();
        configClass.addBeanMethod(new BeanMethod(methodMetadata, configClass));
    }

    this.processInterfaces(configClass, sourceClass);
    if (sourceClass.getMetadata().hasSuperClass()) {
        String superclass = sourceClass.getMetadata().getSuperClassName();
        if (superclass != null && !superclass.startsWith("java") && !this.knownSuperclasses.containsKey(superclass)) {
            this.knownSuperclasses.put(superclass, configClass);
            return sourceClass.getSuperClass();
        }
    }

    return null;
}
```

1. 递归处理内部类，一般不会使用内部类。
2. 处理@PropertySource注解，@PropertySource注解用来加载properties文件。
3. 获得ComponentScan注解具体的内容，ComponentScan注解除了最常用的basePackage之外，还有includeFilters，excludeFilters等。
4. 判断有没有被@ComponentScans标记，或者被@Condition条件带过，如果满足条件的话，进入if，进行如下操作：

   1. 执行扫描操作，把扫描出来的放入set，这个方法稍后再详细说明。
   2.  循环set，判断是否是配置类，是的话，递归调用parse方法，因为被扫描出来的类，还是一个配置类，有@ComponentScans注解，或者其中有被@Bean标记的方法 等等，所以需要再次被解析。
5. 处理@Import注解，@Import是Spring中很重要的一个注解，正是由于它的存在，让Spring非常灵活，不管是Spring内部，还是与Spring整合的第三方技术，都大量的运用了@Import注解，@Import有三种情况，一种是Import普通类，一种是ImportImportSelector，还有一种是Import ImportBeanDefinitionRegistrar，getImports(sourceClass)是获得import的内容，返回的是一个set，这个方法稍后再详细说明。
6. 处理@ImportResource注解。
7. 处理@Bean的方法，可以看到获得了带有@Bean的方法后，不是马上转换成BeanDefinition，而是先用一个set接收。



##### 4.1.1@ComponentScans解析：

```java
public Set<BeanDefinitionHolder> parse(AnnotationAttributes componentScan, String declaringClass) {
     //扫描器，还记不记在new AnnotationConfigApplicationContext的时候
     //会调用AnnotationConfigApplicationContext的构造方法
     //构造方法里面有一句 this.scanner = new ClassPathBeanDefinitionScanner(this);
     //当时说这个对象不重要，这里就是证明了。常规用法中，实际上执行扫描的只会是这里的scanner对象
    ClassPathBeanDefinitionScanner scanner = new ClassPathBeanDefinitionScanner(this.registry, componentScan.getBoolean("useDefaultFilters"), this.environment, this.resourceLoader);
    //判断是否重写了默认的命名规则
    Class<? extends BeanNameGenerator> generatorClass = componentScan.getClass("nameGenerator");
    boolean useInheritedGenerator = BeanNameGenerator.class == generatorClass;
    scanner.setBeanNameGenerator(useInheritedGenerator ? this.beanNameGenerator : (BeanNameGenerator)BeanUtils.instantiateClass(generatorClass));
    ScopedProxyMode scopedProxyMode = (ScopedProxyMode)componentScan.getEnum("scopedProxy");
    if (scopedProxyMode != ScopedProxyMode.DEFAULT) {
        scanner.setScopedProxyMode(scopedProxyMode);
    } else {
        Class<? extends ScopeMetadataResolver> resolverClass = componentScan.getClass("scopeResolver");
        scanner.setScopeMetadataResolver((ScopeMetadataResolver)BeanUtils.instantiateClass(resolverClass));
    }

    scanner.setResourcePattern(componentScan.getString("resourcePattern"));
    AnnotationAttributes[] var15 = componentScan.getAnnotationArray("includeFilters");
    int var8 = var15.length;
    //addIncludeFilter addExcludeFilter,最终是往Lis里面填充数据
     //TypeFilter是一个函数式接口，函数式接口在java8的时候大放异彩，只定义了一个虚方法的接口被称为函数式接口
     //当调用scanner.addIncludeFilter scanner.addExcludeFilter 仅仅把 定义的规则塞进去，并么有真正去执行匹配过程
     // 处理includeFilters
    int var9;
    AnnotationAttributes excludeFilterAttributes;
    List typeFilters;
    Iterator var12;
    TypeFilter typeFilter;
    for(var9 = 0; var9 < var8; ++var9) {
        excludeFilterAttributes = var15[var9];
        typeFilters = TypeFilterUtils.createTypeFiltersFor(excludeFilterAttributes, this.environment, this.resourceLoader, this.registry);
        var12 = typeFilters.iterator();

        while(var12.hasNext()) {
            typeFilter = (TypeFilter)var12.next();
            scanner.addIncludeFilter(typeFilter);
        }
    }

    var15 = componentScan.getAnnotationArray("excludeFilters");
    var8 = var15.length;
    // 处理excludeFilters
    for(var9 = 0; var9 < var8; ++var9) {
        excludeFilterAttributes = var15[var9];
        typeFilters = TypeFilterUtils.createTypeFiltersFor(excludeFilterAttributes, this.environment, this.resourceLoader, this.registry);
        var12 = typeFilters.iterator();

        while(var12.hasNext()) {
            typeFilter = (TypeFilter)var12.next();
            scanner.addExcludeFilter(typeFilter);
        }
    }

    boolean lazyInit = componentScan.getBoolean("lazyInit");
    if (lazyInit) {
        scanner.getBeanDefinitionDefaults().setLazyInit(true);
    }

    Set<String> basePackages = new LinkedHashSet();
    String[] basePackagesArray = componentScan.getStringArray("basePackages");
    String[] var19 = basePackagesArray;
    int var21 = basePackagesArray.length;

    int var22;
    for(var22 = 0; var22 < var21; ++var22) {
        String pkg = var19[var22];
        String[] tokenized = StringUtils.tokenizeToStringArray(this.environment.resolvePlaceholders(pkg), ",; \t\n");
        Collections.addAll(basePackages, tokenized);
    }
// 从下面的代码可以看出ComponentScans指定扫描目标，除了最常用的basePackages，还有两种方式
 // 1.指定basePackageClasses，就是指定多个类，只要是与这几个类同级的，或者在这几个类下级的都可以被扫描到，这种方式其实是spring比较推荐的
  // 因为指定basePackages没有IDE的检查，容易出错，但是指定一个类，就有IDE的检查了，不容易出错，经常会用一个空的类来作为basePackageClasses59 
  // 2.直接不指定，默认会把与配置类同级，或者在配置类下级的作为扫描目标
    Class[] var20 = componentScan.getClassArray("basePackageClasses");
    var21 = var20.length;

    for(var22 = 0; var22 < var21; ++var22) {
        Class<?> clazz = var20[var22];
        basePackages.add(ClassUtils.getPackageName(clazz));
    }

    if (basePackages.isEmpty()) {
        basePackages.add(ClassUtils.getPackageName(declaringClass));
    }
    //把规则填充到排除规则这里就把 注册类自身当作排除规则，真正执行匹配的时候，会把自身给排除
    scanner.addExcludeFilter(new AbstractTypeHierarchyTraversingFilter(false, false) {
        protected boolean matchClassName(String className) {
            return declaringClass.equals(className);
        }
    });
    return scanner.doScan(StringUtils.toStringArray(basePackages));
}
```

1. 定义了一个扫描器scanner，还记不记在new AnnotationConfigApplicationContext的时候，会调用AnnotationConfigApplicationContext的构造方法，构造方法里面有一句 `this.scanner = newClassPathBeanDefinitionScanner(this);`当时说这个对象不重要，这里就是证明了。常规用法中，实际上执行扫描的只会是这里的scanner对象。
2. 处理includeFilters，就是把规则添加到scanner。
3. 处理excludeFilters，就是把规则添加到scanner。
4. 解析basePackages，获得需要扫描哪些包。
5. 添加一个默认的排除规则：排除自身。
6. 执行扫描，稍后详细说明。这里需要做一个补充说明，添加规则的时候，只是把具体的规则放入规则类的集合中去，规则类是一个函数式接口，只定义了一个虚方法的接口被称为函数式接口，函数式接口在java8的时候大放异彩，这里只是把规则方塞进去，并没有真正执行匹配规则。我们来看看到底是怎么执行扫描的

```java
protected Set<BeanDefinitionHolder> doScan(String... basePackages) {
    Assert.notEmpty(basePackages, "At least one base package must be specified");
    
    Set<BeanDefinitionHolder> beanDefinitions = new LinkedHashSet();
    String[] var3 = basePackages;
    int var4 = basePackages.length;
    // 循环处理basePackages
    for(int var5 = 0; var5 < var4; ++var5) {
        String basePackage = var3[var5];
        // 根据包名找到符合条件的BeanDefinition集合
        Set<BeanDefinition> candidates = this.findCandidateComponents(basePackage);
        Iterator var8 = candidates.iterator();

        while(var8.hasNext()) {
            BeanDefinition candidate = (BeanDefinition)var8.next();
            ScopeMetadata scopeMetadata = this.scopeMetadataResolver.resolveScopeMetadata(candidate);
            candidate.setScope(scopeMetadata.getScopeName());
            String beanName = this.beanNameGenerator.generateBeanName(candidate, this.registry);
            //由findCandidateComponents内部可知，这里的candidate是ScannedGenericBeanDefinition
            //而ScannedGenericBeanDefinition是AbstractBeanDefinition和AnnotatedBeanDefinition的之类
            //所以下面的两个if都会进入
            if (candidate instanceof AbstractBeanDefinition) {
                //内部会设置默认值
                this.postProcessBeanDefinition((AbstractBeanDefinition)candidate, beanName);
            }

            if (candidate instanceof AnnotatedBeanDefinition) {
                //如果是AnnotatedBeanDefinition，还会再设置一次值
                AnnotationConfigUtils.processCommonDefinitionAnnotations((AnnotatedBeanDefinition)candidate);
            }

            if (this.checkCandidate(beanName, candidate)) { // 检查是否符合要求，有没有被排除，有没有是实体类等等
                BeanDefinitionHolder definitionHolder = new BeanDefinitionHolder(candidate, beanName);
                definitionHolder = AnnotationConfigUtils.applyScopedProxyMode(scopeMetadata, definitionHolder, this.registry);
                beanDefinitions.add(definitionHolder);
                this.registerBeanDefinition(definitionHolder, this.registry); // 生成bean定义
                
            }
        }
    }

    return beanDefinitions;
}
```

下面再来看看根据包名找到符合条件的BeanDefinition集合的findCandidateComponents方法:

```java
public Set<BeanDefinition> findCandidateComponents(String basePackage) {
    // spring支持component索引技术，需要引入一个组件，因为大部分情况不会引入这个组件
    // 所以不会进入到这个if
    return this.componentsIndex != null && this.indexSupportsIncludeFilters() ? this.addCandidateComponentsFromIndex(this.componentsIndex, basePackage) : this.scanCandidateComponents(basePackage);
}
```

Spring支持component索引技术，需要引入一个组件，大部分项目没有引入这个组件，所以会进入scanCandidateComponents方法：

```java
private Set<BeanDefinition> scanCandidateComponents(String basePackage) {
    LinkedHashSet candidates = new LinkedHashSet();

    try {
        //把 传进来的类似 命名空间形式的字符串转换成类似类文件地址的形式，然后在前面加上classpath*:
         //即：com.xx=>classpath*:com/xx/**/*.class
        String packageSearchPath = "classpath*:" + this.resolveBasePackage(basePackage) + '/' + this.resourcePattern;
        //根据packageSearchPath，获得符合要求的文件
        Resource[] resources = this.getResourcePatternResolver().getResources(packageSearchPath);
        boolean traceEnabled = this.logger.isTraceEnabled();
        boolean debugEnabled = this.logger.isDebugEnabled();
        Resource[] var7 = resources;
        int var8 = resources.length;
        //循环资源
        for(int var9 = 0; var9 < var8; ++var9) { 
            Resource resource = var7[var9];
            if (traceEnabled) { 
                this.logger.trace("Scanning " + resource);
            }

            try {//判断资源是否可读，并且不是一个目录
                MetadataReader metadataReader = this.getMetadataReaderFactory().getMetadataReader(resource);
                if (this.isCandidateComponent(metadataReader)) {
                    ScannedGenericBeanDefinition sbd = new ScannedGenericBeanDefinition(metadataReader);
                    sbd.setSource(resource);
                    //在isCandidateComponent方法内部会真正执行匹配规则
                    //注册配置类自身会被排除，不会进入到这个if
                    if (this.isCandidateComponent((AnnotatedBeanDefinition)sbd)) {
                        if (debugEnabled) {
                            this.logger.debug("Identified candidate component class: " + resource);
                        }

                        candidates.add(sbd);
                    } else if (debugEnabled) {
                        this.logger.debug("Ignored because not a concrete top-level class: " + resource);
                    }
                } else if (traceEnabled) {
                    this.logger.trace("Ignored because not matching any filter: " + resource);
                }
            } catch (FileNotFoundException var13) {
                if (traceEnabled) {
                    this.logger.trace("Ignored non-readable " + resource + ": " + var13.getMessage());
                }
            } catch (Throwable var14) {
                throw new BeanDefinitionStoreException("Failed to read candidate component class: " + resource, var14);
            }
        }

        return candidates;
    } catch (IOException var15) {
        throw new BeanDefinitionStoreException("I/O failure during classpath scanning", var15);
    }
}
```

1. 把传进来的类似命名空间形式的字符串转换成类似类文件地址的形式，然后在前面加上classpath，即：com.xx=>classpath:com/xx/**/*.class。
2. 根据packageSearchPath，获得符合要求的文件。
3. 循环符合要求的文件，进一步进行判断。最终会把符合要求的文件，转换为BeanDefinition，并且返回。

##### 4.1.2@Import解析：

```java
private void processImports(ConfigurationClass configClass, ConfigurationClassParser.SourceClass currentSourceClass, Collection<ConfigurationClassParser.SourceClass> importCandidates, Predicate<String> exclusionFilter, boolean checkForCircularImports) {
    if (!importCandidates.isEmpty()) {
        if (checkForCircularImports && this.isChainedImportOnStack(configClass)) { 
            this.problemReporter.error(new ConfigurationClassParser.CircularImportProblem(configClass, this.importStack));
        } else { 
            this.importStack.push(configClass);

            try {
                Iterator var6 = importCandidates.iterator();

                while(var6.hasNext()) {
                    ConfigurationClassParser.SourceClass candidate = (ConfigurationClassParser.SourceClass)var6.next();
                    Class candidateClass;
                    if (candidate.isAssignable(ImportSelector.class)) { // 循环importCandidates，判断属于哪种情况
                        candidateClass = candidate.loadClass();
                        ImportSelector selector = (ImportSelector)ParserStrategyUtils.instantiateClass(candidateClass, ImportSelector.class, this.environment, this.resourceLoader, this.registry);
                        Predicate<String> selectorFilter = selector.getExclusionFilter();
                        if (selectorFilter != null) {
                            exclusionFilter = exclusionFilter.or(selectorFilter);
                        }

                        if (selector instanceof DeferredImportSelector) {
                            this.deferredImportSelectorHandler.handle(configClass, (DeferredImportSelector)selector);
                        } else {
                            String[] importClassNames = selector.selectImports(currentSourceClass.getMetadata());
                            Collection<ConfigurationClassParser.SourceClass> importSourceClasses = this.asSourceClasses(importClassNames, exclusionFilter);
                            this.processImports(configClass, currentSourceClass, importSourceClasses, exclusionFilter, false);
                        }
                    } else if (candidate.isAssignable(ImportBeanDefinitionRegistrar.class)) {
                        candidateClass = candidate.loadClass();
                        ImportBeanDefinitionRegistrar registrar = (ImportBeanDefinitionRegistrar)ParserStrategyUtils.instantiateClass(candidateClass, ImportBeanDefinitionRegistrar.class, this.environment, this.resourceLoader, this.registry);
                        configClass.addImportBeanDefinitionRegistrar(registrar, currentSourceClass.getMetadata());
                    } else { // 如果是普通类，会进到else，调用processConfigurationClass方法
                        this.importStack.registerImport(currentSourceClass.getMetadata(), candidate.getMetadata().getClassName());
                        this.processConfigurationClass(candidate.asConfigClass(configClass), exclusionFilter);
                    }
                }
            } catch (BeanDefinitionStoreException var17) {
                throw var17;
            } catch (Throwable var18) {
                throw new BeanDefinitionStoreException("Failed to process import candidates for configuration class [" + configClass.getMetadata().getClassName() + "]", var18);
            } finally {
                this.importStack.pop();
            }
        }

    }
}

```

这个方法内部相当相当复杂，importCandidates是Import的内容，调用这个方法的时候，已经说过可能有三种情况
1.Import普通类，
2.Import ImportSelector，
3.Import ImportBeanDefinitionRegistrar

#### 4.2postProcessBeanFactory方法

在IOC加载的整体流程中也会调用postProcessBeanFactory方法：

AnnotationConfigApplicationContext的构造方法 ---调用----> this.refresh(); ---调用---->this.invokeBeanFactoryPostProcessors(beanFactory); ---调用---->invokeBeanFactoryPostProcessors---调用---->

BeanDefinitionRegistryPostProcessor的postProcessBeanFactory方法：



invokeBeanFactoryPostProcessors方法：

```java
private static void invokeBeanFactoryPostProcessors(Collection<? extends BeanFactoryPostProcessor> postProcessors, ConfigurableListableBeanFactory beanFactory) {
    Iterator var2 = postProcessors.iterator();

    while(var2.hasNext()) {
        BeanFactoryPostProcessor postProcessor = (BeanFactoryPostProcessor)var2.next();
        StartupStep var10000 = beanFactory.getApplicationStartup().start("spring.context.bean-factory.post-process");
        postProcessor.getClass();
        StartupStep postProcessBeanFactory = var10000.tag("postProcessor", postProcessor::toString);
        postProcessor.postProcessBeanFactory(beanFactory);
        postProcessBeanFactory.end();
    }

}
```

postProcessBeanFactory方法：

![image-20221123104827911](http://img.zouyh.top/article-img/20240917134944120.png)

```java
public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) {
    int factoryId = System.identityHashCode(beanFactory);
    if (this.factoriesPostProcessed.contains(factoryId)) {
        throw new IllegalStateException("postProcessBeanFactory already called on this post-processor against " + beanFactory);
    } else {
        this.factoriesPostProcessed.add(factoryId);
        if (!this.registriesPostProcessed.contains(factoryId)) {
            this.processConfigBeanDefinitions((BeanDefinitionRegistry)beanFactory);
        }

        this.enhanceConfigurationClasses(beanFactory); // 核心
        beanFactory.addBeanPostProcessor(new ConfigurationClassPostProcessor.ImportAwareBeanPostProcessor(beanFactory));
    }
}
```

enhanceConfigurationClasses方法：

```java
public void enhanceConfigurationClasses(ConfigurableListableBeanFactory beanFactory) {
    StartupStep enhanceConfigClasses = this.applicationStartup.start("spring.context.config-classes.enhance");
    Map<String, AbstractBeanDefinition> configBeanDefs = new LinkedHashMap();
    String[] var4 = beanFactory.getBeanDefinitionNames();
    int var5 = var4.length;

    for(int var6 = 0; var6 < var5; ++var6) {
        String beanName = var4[var6];
        BeanDefinition beanDef = beanFactory.getBeanDefinition(beanName);
        Object configClassAttr = beanDef.getAttribute(ConfigurationClassUtils.CONFIGURATION_CLASS_ATTRIBUTE);
        AnnotationMetadata annotationMetadata = null;
        MethodMetadata methodMetadata = null;
        if (beanDef instanceof AnnotatedBeanDefinition) {
            AnnotatedBeanDefinition annotatedBeanDefinition = (AnnotatedBeanDefinition)beanDef;
            annotationMetadata = annotatedBeanDefinition.getMetadata();
            methodMetadata = annotatedBeanDefinition.getFactoryMethodMetadata();
        }

        if ((configClassAttr != null || methodMetadata != null) && beanDef instanceof AbstractBeanDefinition) {
            AbstractBeanDefinition abd = (AbstractBeanDefinition)beanDef;
            if (!abd.hasBeanClass()) {
                boolean liteConfigurationCandidateWithoutBeanMethods = "lite".equals(configClassAttr) && annotationMetadata != null && !ConfigurationClassUtils.hasBeanMethods(annotationMetadata);
                if (!liteConfigurationCandidateWithoutBeanMethods) {
                    try {
                        abd.resolveBeanClass(this.beanClassLoader);
                    } catch (Throwable var15) {
                        throw new IllegalStateException("Cannot load configuration class: " + beanDef.getBeanClassName(), var15);
                    }
                }
            }
        }

         // 有@Configuratiog注解的才是full
        if ("full".equals(configClassAttr)) {
            if (!(beanDef instanceof AbstractBeanDefinition)) {
                throw new BeanDefinitionStoreException("Cannot enhance @Configuration bean definition '" + beanName + "' since it is not stored in an AbstractBeanDefinition subclass");
            }

            if (this.logger.isInfoEnabled() && beanFactory.containsSingleton(beanName)) {
                this.logger.info("Cannot enhance @Configuration bean definition '" + beanName + "' since its singleton instance has been created too early. The typical cause is a non-static @Bean method with a BeanDefinitionRegistryPostProcessor return type: Consider declaring such methods as 'static'.");
            }

            configBeanDefs.put(beanName, (AbstractBeanDefinition)beanDef);
        }
    }

    if (!configBeanDefs.isEmpty() && !NativeDetector.inNativeImage()) {
        // 采用cglib的方式实现动态代理
        ConfigurationClassEnhancer enhancer = new ConfigurationClassEnhancer();
        Iterator var17 = configBeanDefs.entrySet().iterator();

        while(var17.hasNext()) {
            Entry<String, AbstractBeanDefinition> entry = (Entry)var17.next();
            AbstractBeanDefinition beanDef = (AbstractBeanDefinition)entry.getValue();
            beanDef.setAttribute(AutoProxyUtils.PRESERVE_TARGET_CLASS_ATTRIBUTE, Boolean.TRUE);
            Class<?> configClass = beanDef.getBeanClass();
            Class<?> enhancedClass = enhancer.enhance(configClass, this.beanClassLoader);
            if (configClass != enhancedClass) {
                if (this.logger.isTraceEnabled()) {
                    this.logger.trace(String.format("Replacing bean definition '%s' existing class '%s' with enhanced class '%s'", entry.getKey(), configClass.getName(), enhancedClass.getName()));
                }

                beanDef.setBeanClass(enhancedClass);
            }
        }

        enhanceConfigClasses.tag("classCount", () -> {
            return String.valueOf(configBeanDefs.keySet().size());
        }).end();
    } else {
        enhanceConfigClasses.end();
    }
}
```

ConfigurationClassEnhancer中静态内部类

```java
private static class BeanMethodInterceptor implements MethodInterceptor, ConfigurationClassEnhancer.ConditionalCallback {
    private BeanMethodInterceptor() {
    }

    // 反射会调用该方法
    @Nullable
    public Object intercept(Object enhancedConfigInstance, Method beanMethod, Object[] beanMethodArgs, MethodProxy cglibMethodProxy) throws Throwable {
        ConfigurableBeanFactory beanFactory = this.getBeanFactory(enhancedConfigInstance);
        String beanName = BeanAnnotationHelper.determineBeanNameFor(beanMethod);
        if (BeanAnnotationHelper.isScopedProxy(beanMethod)) {
            String scopedBeanName = ScopedProxyCreator.getTargetBeanName(beanName);
            if (beanFactory.isCurrentlyInCreation(scopedBeanName)) {
                beanName = scopedBeanName;
            }
        }

        if (this.factoryContainsBean(beanFactory, "&" + beanName) && this.factoryContainsBean(beanFactory, beanName)) {
            Object factoryBean = beanFactory.getBean("&" + beanName); // 通过beanFactory获取bean
            if (!(factoryBean instanceof ScopedProxyFactoryBean)) {
                return this.enhanceFactoryBean(factoryBean, beanMethod.getReturnType(), beanFactory, beanName);
            }
        }

        if (this.isCurrentlyInvokedFactoryMethod(beanMethod)) {
            if (ConfigurationClassEnhancer.logger.isInfoEnabled() && BeanFactoryPostProcessor.class.isAssignableFrom(beanMethod.getReturnType())) {
                ConfigurationClassEnhancer.logger.info(String.format("@Bean method %s.%s is non-static and returns an object assignable to Spring's BeanFactoryPostProcessor interface. This will result in a failure to process annotations such as @Autowired, @Resource and @PostConstruct within the method's declaring @Configuration class. Add the 'static' modifier to this method to avoid these container lifecycle issues; see @Bean javadoc for complete details.", beanMethod.getDeclaringClass().getSimpleName(), beanMethod.getName()));
            }

            return cglibMethodProxy.invokeSuper(enhancedConfigInstance, beanMethodArgs);
        } else {
            return this.resolveBeanReference(beanMethod, beanMethodArgs, beanFactory, beanName);
        }
    }

```

