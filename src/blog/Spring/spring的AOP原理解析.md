---
icon: file-lines
# 标题
title: 'spring的AOP原理解析'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-07
# 一个页面可以有多个分类
category:
  - Spring
# 一个页面可以有多个标签
tag:
  - 必看
  - Spring
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，Spring AOP 配置使用

目前 Spring AOP 一共有三种配置方式，Spring 做到了很好地向下兼容，所以大家可以放心使用。

- Spring 1.2 基于接口的配置：最早的 Spring AOP 是完全基于几个接口的，想看源码的同学可以从这里起步。 
- Spring 2.0 schema-based 配置：Spring 2.0 以后使用 XML 的方式来配置，使用 命名空间  
- Spring 2.0 @AspectJ 配置：使用注解的方式来配置，这种方式感觉是最方便的，还有，这里虽然叫 做 @AspectJ，但是这个和 AspectJ 其实没啥关系。 

​	Spring 1.2 中的配置 这节我们将介绍 Spring 1.2 中的配置，这是最古老的配置，但是由于 Spring 提供了很好的向后兼容，以及很多人根本 不知道什么配置是什么版本的，以及是否有更新更好的配置方法替代，所以还是会有很多代码是采用这种古老的配置方 式的（比如声明式事务），这里说的古老并没有贬义的意思。

首先定义需要被增强的类：接口：Calculate.java， 实现类：TulingCalculate.java

Calculate.java代码如下：

```java
public interface Calculate {
     // 加法    
     int add(int numA, int numB);
     // 减法    
     int sub(int numA, int numB);
     // 除法
     int div(int numA, int numB);
     // 乘法     
     int multi(int numA, int numB);
     // 取余
     int mod(int numA, int numB);
}
```

TulingCalculate.java代码如下：

```java
@Component
public class TulingCalculate implements Calculate {
    public int add(int numA, int numB) {
        System.out.println("执行目标方法:add");
        return numA+numB;
    
    public int sub(int numA, int numB) {
        System.out.println("执行目标方法:reduce");
        return numA-numB;

    public int div(int numA, int numB) {
        System.out.println("执行目标方法:div");
        return numA/numB;
    }
    public int multi(int numA, int numB) {
        System.out.println("执行目标方法:multi")
        return numA*numB;
    }
    public int mod(int numA,int numB){
        System.out.println("执行目标方法:mod");

        int retVal = ((Calculate)AopContext.currentProxy()).add(numA,numB);
        //int retVal = this.add(numA,numB);

        return retVal%numA;

        //return numA%numB;
    }

}
```

接下来，我们定义 advice或Interceptor：

Advice通知：

```java
public class TulingLogAdvice implements MethodBeforeAdvice {
    @Override
    public void before(Method method, Object[] args, Object target) throws Throwable {
        String methodName = method.getName();
        System.out.println("执行目标方法【" + methodName + "】的前置通知,入参" + Arrays.asList(args));
    }

}
```

Interceptor拦截：

```java
public class TulingLogInterceptor implements MethodInterceptor {
    @Override
    public Object invoke(MethodInvocation invocation) throws Throwable {
        System.out.println(getClass()+"调用方法前");
        Object ret = invocation.proceed();
        System.out.println(getClass()+"调用方法后");
        return ret;
    }

}
```

基础配置EalyAopMainConfig：

```java
public class EalyAopMainConfig {
    // 被代理对象
    @Bean
    public Calculate tulingCalculate() {
        return new TulingCalculate();
    }
    // Advice 方式
    @Bean
    public TulingLogAdvice tulingLogAdvice(){
        return new TulingLogAdvice();
    }
    // Interceptor方式，可以理解为环绕通知
    @Bean
    public TulingLogInterceptor tulingLogInterceptor() {
        return new TulingLogInterceptor();
    }
}
```

#### 1.1**FactoryBean方式创建单个代理**

基础配置EalyAopMainConfig中新增如下代码：

```java
/**
 * FactoryBean方式单个： ProxyFactoryBean
 * 此中方法有个致命的问题，如果我们只能指定单一的Bean的AOP，
 * 如果多个Bean需要创建多个ProxyFactoryBean 。
 * 而且，我们看到，我们的拦截器的粒度只控制到了类级别，类中所有的方法都进行了拦截。
 * 接下来，我们看看怎么样只拦截特定的方法。
 * @return
 */
@Bean
public ProxyFactoryBean calculateProxy(){
     ProxyFactoryBean userService = new ProxyFactoryBean();
     userService.setInterceptorNames("tulingLogAdvice","tulingLogInterceptor");  // 根据指定的顺序执行
     userService.setTarget(tulingCalculate());
     return userService;
}
```

接下来，我们跑起来看看：

```java
public static void main(String[] args) {
    AnnotationConfigApplicationContext ctx = new AnnotationConfigApplicationContext(EalyAopMainConfig.class);
    Calculate calculateProxy = ctx.getBean("calculateProxy",Calculate.class); // 获取代理对象
    calculateProxy.div(1,1);
}
```

查看输出结果：

![image-20221202144231252](http://img.zouyh.top/article-img/20240917134947126.png)



从结果可以看到，使用了责任链方式对advice和Interceptor都进行调用。这个例子理解起来应该非常简单，就是通过调用FactoryBean的getObject方法创建一个代理实现。上面方法有个致命的问题，如果我们只能指定单一的Bean的AOP， 如果多个Bean需要创建多个ProxyFactoryBean 。而且我们看到，我们的拦截器的粒度只控制到了类级别，类中所有的方法都进行了拦截。接下来，我们看看怎么样只拦截特定的方法。

#### 1.2FactoryBean方式**拦截特定的方法**

基础配置中EalyAopMainConfig中新增如下代码：

```java
/**
 * Advisor 种类很多：
 * RegexpMethodPointcutAdvisor 按正则匹配类
 * NameMatchMethodPointcutAdvisor 按方法名匹配
 * DefaultBeanFactoryPointcutAdvisor xml解析的Advisor   <aop:before
 * InstantiationModelAwarePointcutAdvisorImpl  注解解析的advisor(@Before @After....)
 * @return
 * */
@Bean
public NameMatchMethodPointcutAdvisor tulingLogAspectAdvisor() {
    NameMatchMethodPointcutAdvisor advisor = new NameMatchMethodPointcutAdvisor();
    // 通知(Advice)  ：是我们的通知类 没有带切点
    // 通知者(Advisor)：是经过包装后的细粒度控制方式。 带了切点
    advisor.setAdvice(tulingLogAdvice());
    advisor.setMappedNames("div");
    return  advisor;
}
 /**
 * FactoryBean方式单个： ProxyFactoryBean
 *  控制粒度到方法
 *  问题：如果我们只能指定单一的Bean的AOP，
 *      如果多个Bean需要创建多个ProxyFactoryBean 。
 * @return
  * */
@Bean
public ProxyFactoryBean calculateProxy(){
    ProxyFactoryBean userService=new ProxyFactoryBean();
    userService.setInterceptorNames("tulingLogAspectAdvisor");
    userService.setTarget(tulingCalculate());
    return userService;
}
```

在上面的配置中，配置拦截器的时候，interceptorNames 除了指定为 Advice，是还可以指定为 Interceptor 和Advisor的。这里我们来理解 Advisor 的概念，它也比较简单，它内部需要指定一个 Advice，Advisor 决定该拦截哪些方法，拦截后需要完成的工作还是内部的 Advice 来做。它有好几个实现类，这里我们使用实现类 NameMatchMethodPointcutAdvisor 来演示，从名字上就可以看出来，它需要我们给它提供方法名字，这样符合该配置的方法才会做拦截。

我们可以看到，calculateProxy这个 bean 配置了一个 advisor，advisor 内部有一个 advice。advisor 负责匹配方法，内部的 advice 负责实现方法包装。注意，这里的 mappedNames 配置是可以指定多个的，用逗号分隔，可以是不同类中的方法。相比直接指定 advice，advisor 实现了更细粒度的控制，因为在这里配置 advice 的话，所有方法都会被拦截。

接下来，我们跑起来看看：

```java
public static void main(String[] args) {
    AnnotationConfigApplicationContext ctx = new AnnotationConfigApplicationContext(EalyAopMainConfig.class);
    Calculate calculateProxy = ctx.getBean("calculateProxy",Calculate.class); // 获取代理对象
    calculateProxy.div(1,1);
}
```

输出结果如下，只有 div方法被拦截：

![image-20221202144729885](http://img.zouyh.top/article-img/20240917134948127.png)

上面我们介绍完了 Advice、Advisor、Interceptor 三个概念，相信大家应该很容易就看懂它们了。它们有个共同的问题，那就是我们得为每个 bean 都配置一个代理，之后获取 bean 的时候需要获取这个代理类的 bean实例：

```java
ctx.getBean("calculateProxy",Calculate.class)
```

​	这显然非常不方便，不利于我们之后要使用的自动根据类型注入。下面介绍 autoproxy 的解决方案。autoproxy：从名字我们也可以看出来，它是实现自动代理，也就是说当 Spring 发现一个 bean 需要被切面织入的时候，Spring 会自动生成这个 bean 的一个代理来拦截方法的执行，确保定义的切面能被执行。这里强调自动，也就是说Spring会自动做这件事，而不用像前面介绍的，我们需要显式地指定代理类的bean。我们去掉原来的ProxyFactoryBean的配置，改为使用BeanNameAutoProxyCreato来配置。

#### 1.3**自动生成代理方式创建代理**

基础配置中EalyAopMainConfig中新增如下代码：

```java
/**
 * Advisor 种类很多：
 * RegexpMethodPointcutAdvisor 按正则匹配类
 * NameMatchMethodPointcutAdvisor 按方法名匹配
 * DefaultBeanFactoryPointcutAdvisor xml解析的Advisor   <aop:before
 * InstantiationModelAwarePointcutAdvisorImpl  注解解析的advisor(@Before @After....)
 * @return
 * */
@Bean
public NameMatchMethodPointcutAdvisor tulingLogAspectAdvisor() {
    NameMatchMethodPointcutAdvisor advisor = new NameMatchMethodPointcutAdvisor();
    // 通知(Advice)  ：是我们的通知类 没有带切点
    // 通知者(Advisor)：是经过包装后的细粒度控制方式。 带了切点
    advisor.setAdvice(tulingLogAdvice());
    advisor.setMappedNames("div");
    return  advisor;
}
/**
 *   autoProxy: BeanPostProcessor手动指定Advice方式  BeanNameAutoProxyCreator
 *   @return   
 **/
 @Bean
 public BeanNameAutoProxyCreator autoProxyCreator() {
     BeanNameAutoProxyCreator beanNameAutoProxyCreator = new BeanNameAutoProxyCreator();
     //设置要创建代理的那些Bean的名字
     beanNameAutoProxyCreator.setBeanNames("tuling*");
     //设置拦截链名字(这些拦截器是有先后顺序的)
     beanNameAutoProxyCreator.setInterceptorNames("tulingLogAspectAdvisor");
     return beanNameAutoProxyCreator;
 }
```

​	配置很简单，beanNames 中可以使用正则来匹配 bean 的名字来增强多个类。 也就是说不再是配置某个 bean 的代理了。注意，这里的 InterceptorNames 和前面一样，也是可以配置成 Advisor 和 Interceptor 的。

然后我们修改下使用的地方：

```java
public static void main(String[] args) {
    AnnotationConfigApplicationContext ctx = new AnnotationConfigApplicationContext(EalyAopMainConfig.class);
    Calculate tulingCalculate = ctx.getBean("tulingCalculate",Calculate.class); // 获取自身对象
    tulingCalculate.div(1,1);
}
```

发现没有，我们在使用的时候，完全不需要关心代理了，直接使用原来的类型就可以了，这是非常方便的。

输出结果就是 OrderService 和 UserService 中的每个方法都得到了拦截：

![image-20221202145207278](http://img.zouyh.top/article-img/20240917134949130.png)

到这里，是不是发现 BeanNameAutoProxyCreator 非常好用，它需要指定被拦截类名的模式(如 *ServiceImpl)，它可以配置多次，这样就可以用来匹配不同模式的类了。另外，在 BeanNameAutoProxyCreator 同一个包中，还有一个非常有用的类 DefaultAdvisorAutoProxyCreator，比上面的 BeanNameAutoProxyCreator 还要方便。之前我们说过，advisor 内部包装了 advice，advisor 负责决定拦截哪些方法，内部 advice 定义拦截后的逻辑。所以，仔细想想其实就是只要让我们的 advisor 全局生效就能实现我们需要的自定义拦截功能、拦截后的逻辑处理。BeanNameAutoProxyCreator 是自己匹配方法，然后交由内部配置 advice 来拦截处理；而 DefaultAdvisorAutoProxyCreator 是让 ioc 容器中的所有 advisor 来匹配方法，advisor 内部都是有 advice 的，让它们内部的 advice 来执行拦截处理。之后，我们需要配置 DefaultAdvisorAutoProxyCreator，它的配置非常简单，直接使用下面这段配置就可以了，它就会使得所有的 Advisor 自动生效，无须其他配置。

我们需要再回头看下 Advisor 的配置，上面我们用了 NameMatchMethodPointcutAdvisor 这个类：

```java
 @Bean
 public BeanNameAutoProxyCreator autoProxyCreator() {
     BeanNameAutoProxyCreator beanNameAutoProxyCreator = new BeanNameAutoProxyCreator();
     //设置要创建代理的那些Bean的名字
     beanNameAutoProxyCreator.setBeanNames("tuling*");
     //设置拦截链名字(这些拦截器是有先后顺序的)
     beanNameAutoProxyCreator.setInterceptorNames("tulingLogAspectAdvisor");
     return beanNameAutoProxyCreator;
 }
```

其实 Advisor 还有一个更加灵活的实现类 RegexpMethodPointcutAdvisor，它能实现正则匹配，如

```java
// RegexpMethodPointcutAdvisor 按正则匹配类
@Bean
public RegexpMethodPointcutAdvisor tulingLogAspectInterceptor() {
	RegexpMethodPointcutAdvisor advisor=new RegexpMethodPointcutAdvisor();
	advisor.setAdvice(tulingLogInterceptor());
	advisor.setPattern("tuling.TulingCalculate.*");
	return advisor;
}
```

也就是说，我们能通过配置 Advisor，精确定位到需要被拦截的方法，然后使用内部的 Advice 执行逻辑处理。

在基础配置中EalyAopMainConfig中新增如下代码：

```java
/**
* BeanPostProcessor自动扫描Advisor方式DefaultAdvisorAutoProxyCreator
* @return
**/
@Bean
public DefaultAdvisorAutoProxyCreator autoProxyCreator() {
    return new DefaultAdvisorAutoProxyCreator();
}
```

到这里，Spring 1.2 的配置就要介绍完了，Spring 2.0 @AspectJ 配置 和 Spring 2.0 schema-based 配置 这里就不过多赘述了



### 二，sprinpAop的源码解析

#### 2.1注册Bean定义

一、切面类的解析spring通过`@EnableAspectJAutoProxy`开启aop切面，在注解类上面发现`@Import(AspectJAutoProxyRegistrar.class)`，AspectJAutoProxyRegistrar实现了ImportBeanDefinitionRegistrar，所以AspectJAutoProxyRegistrar会通过registerBeanDefinitions方法为我们容器导入beanDefinition.

AspectJAutoProxyRegistrar的registerBeanDefinitions方法如下：

```java
public void registerBeanDefinitions(AnnotationMetadata importingClassMetadata, BeanDefinitionRegistry registry) {
    AopConfigUtils.registerAspectJAnnotationAutoProxyCreatorIfNecessary(registry); //注册BeanDefinition
    AnnotationAttributes enableAspectJAutoProxy = AnnotationConfigUtils.attributesFor(importingClassMetadata, EnableAspectJAutoProxy.class);
    if (enableAspectJAutoProxy != null) {
        if (enableAspectJAutoProxy.getBoolean("proxyTargetClass")) {
            AopConfigUtils.forceAutoProxyCreatorToUseClassProxying(registry);
        }

        if (enableAspectJAutoProxy.getBoolean("exposeProxy")) {
            AopConfigUtils.forceAutoProxyCreatorToExposeProxy(registry);
        }
    }

}
```

继续跟进`AopConfigUtils.registerAspectJAnnotationAutoProxyCreatorIfNecessary(registry)`方法：

```java
@Nullable
public static BeanDefinition registerAspectJAnnotationAutoProxyCreatorIfNecessary(BeanDefinitionRegistry registry, @Nullable Object source) {
    return registerOrEscalateApcAsRequired(AnnotationAwareAspectJAutoProxyCreator.class, registry, source);
}
```

由上方代码可知registerAspectJAnnotationAutoProxyCreatorIfNecessary方法会注册AnnotationAwareAspectJAutoProxyCreator类

查看AnnotationAwareAspectJAutoProxyCreator类的继承关系图：

![ ](http://img.zouyh.top/article-img/20240917134948128.png)

AnnotationAwareAspectJAutoProxyCreator继承AbstractAutoProxyCreator类：

- AbstractAutoProxyCreator的postProcessBeforeInstantiation方法是真正实现InstantionAwareBeanPostProcessor接口用于解析切面类生成Advisor。
- AbStorctAutoProxyCreator的postProcessAfterInitialization方法是真正实现BeanPostProcessor接口用于判断是否需要生成代理，需要就生成返回代理。

所以AbstractAutoProxyCreator是非常重要的。



#### 2.2创建实例

，AnnotationConfigApplicationContext的构造方法中的第三行代码，解析刷新容器：

```java
public AnnotationConfigApplicationContext(Class... componentClasses) {
    this(); // 一，调用自己的无参构造
    this.register(componentClasses); // 二，注册配置类
    this.refresh(); // 三，刷新容器
}
```



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

在refresh()方法中通过`this.invokeBeanFactoryPostProcessors(beanFactory);`解析注解生成Bean定义，在`this.registerBeanPostProcessors(beanFactory);`将`AnnotationAwareAspectJAutoProxyCreator`实例化：

registerBeanPostProcessors方法源码：

```java
public static void registerBeanPostProcessors(ConfigurableListableBeanFactory beanFactory, AbstractApplicationContext applicationContext) {
    	// 获取所有BeanPostProcessor的beanName
        String[] postProcessorNames = beanFactory.getBeanNamesForType(BeanPostProcessor.class, true, false);
        int beanProcessorTargetCount = beanFactory.getBeanPostProcessorCount() + 1 + postProcessorNames.length;
        beanFactory.addBeanPostProcessor(new PostProcessorRegistrationDelegate.BeanPostProcessorChecker(beanFactory, beanProcessorTargetCount));
        List<BeanPostProcessor> priorityOrderedPostProcessors = new ArrayList();
        List<BeanPostProcessor> internalPostProcessors = new ArrayList();
        List<String> orderedPostProcessorNames = new ArrayList();
        List<String> nonOrderedPostProcessorNames = new ArrayList();
        String[] var8 = postProcessorNames;
        int var9 = postProcessorNames.length; // 获取BeanPostProcessor的beanName的数组长度

        String ppName;
        BeanPostProcessor pp;
        for(int var10 = 0; var10 < var9; ++var10) {
            ppName = var8[var10];
            if (beanFactory.isTypeMatch(ppName, PriorityOrdered.class)) { // 判断是否实现PriorityOrdered
                // 通过getBean方法创建实例
                pp = (BeanPostProcessor)beanFactory.getBean(ppName, BeanPostProcessor.class);
                priorityOrderedPostProcessors.add(pp); // 存入实现PriorityOrdered的BeanPostProcessor集合中
                if (pp instanceof MergedBeanDefinitionPostProcessor) {
                    internalPostProcessors.add(pp);
                }
            } else if (beanFactory.isTypeMatch(ppName, Ordered.class)) {
                orderedPostProcessorNames.add(ppName);  // 存入实现Ordered的BeanPostProcessor集合中
            } else {
                nonOrderedPostProcessorNames.add(ppName);// 存入既没有实现PriorityOrdered也没有Ordered的BeanPostProcessor集合中
            }
        }

        // 排序
        sortPostProcessors(priorityOrderedPostProcessors, beanFactory);
       // 将priorityOrderedPostProcessors保存到beanFactory的成员变量private final List<BeanPostProcessor> beanPostProcessors中
        registerBeanPostProcessors(beanFactory, (List)priorityOrderedPostProcessors);
        List<BeanPostProcessor> orderedPostProcessors = new ArrayList(orderedPostProcessorNames.size());
        Iterator var14 = orderedPostProcessorNames.iterator();

        while(var14.hasNext()) {
            String ppName = (String)var14.next();
             // 通过getBean方法创建实例
            BeanPostProcessor pp = (BeanPostProcessor)beanFactory.getBean(ppName, BeanPostProcessor.class);
            orderedPostProcessors.add(pp);
            if (pp instanceof MergedBeanDefinitionPostProcessor) {
                internalPostProcessors.add(pp);
            }
        }
		// 排序
        sortPostProcessors(orderedPostProcessors, beanFactory);
    // 将orderedPostProcessors保存到beanFactory的成员变量private final List<BeanPostProcessor> beanPostProcessors中
        registerBeanPostProcessors(beanFactory, (List)orderedPostProcessors);
        List<BeanPostProcessor> nonOrderedPostProcessors = new ArrayList(nonOrderedPostProcessorNames.size());
        Iterator var17 = nonOrderedPostProcessorNames.iterator();

        while(var17.hasNext()) {
            ppName = (String)var17.next();
            // 通过getBean方法创建实例
            pp = (BeanPostProcessor)beanFactory.getBean(ppName, BeanPostProcessor.class);
            nonOrderedPostProcessors.add(pp);
            if (pp instanceof MergedBeanDefinitionPostProcessor) {
                internalPostProcessors.add(pp);
            }
        }
    // 将nonOrderedPostProcessorss保存到beanFactory的成员变量private final List<BeanPostProcessor> beanPostProcessors中
        registerBeanPostProcessors(beanFactory, (List)nonOrderedPostProcessors);
        sortPostProcessors(internalPostProcessors, beanFactory);
        registerBeanPostProcessors(beanFactory, (List)internalPostProcessors);
        beanFactory.addBeanPostProcessor(new ApplicationListenerDetector(applicationContext));
    }
```

registerBeanPostProcessors方法将实现BeanPostProcessor接口的Bean进行实例化，**优先注册**实现了`PriorityOrdered`接口的`BeanPostProcessor`，再给容器中注册实现了`Ordered`接口的`BeanPostProcessor`，最后才注册没有实现优先级接口的`BeanPostProcessor`。



#### 2.3**解析切面的过程**

spring的生命周期中创建bean的方法如下：

```java
protected Object createBean(String beanName, RootBeanDefinition mbd, @Nullable Object[] args) throws BeanCreationException {
    if (this.logger.isTraceEnabled()) {
        this.logger.trace("Creating instance of bean '" + beanName + "'");
    }

    RootBeanDefinition mbdToUse = mbd;
    Class<?> resolvedClass = this.resolveBeanClass(mbd, beanName, new Class[0]);
    if (resolvedClass != null && !mbd.hasBeanClass() && mbd.getBeanClassName() != null) {
        mbdToUse = new RootBeanDefinition(mbd);
        mbdToUse.setBeanClass(resolvedClass);
    }

    try {
        mbdToUse.prepareMethodOverrides();
    } catch (BeanDefinitionValidationException var9) {
        throw new BeanDefinitionStoreException(mbdToUse.getResourceDescription(), beanName, "Validation of method overrides failed", var9);
    }

    Object beanInstance;
    try {
        beanInstance = this.resolveBeforeInstantiation(beanName, mbdToUse); // 调用实现BeanPostProcessor
        if (beanInstance != null) {
            return beanInstance;
        }
    } catch (Throwable var10) {
        throw new BeanCreationException(mbdToUse.getResourceDescription(), beanName, "BeanPostProcessor before instantiation of bean failed", var10);
    }

    try {
        beanInstance = this.doCreateBean(beanName, mbdToUse, args); // 创建bean
        if (this.logger.isTraceEnabled()) {
            this.logger.trace("Finished creating instance of bean '" + beanName + "'");
        }

        return beanInstance;
    } catch (ImplicitlyAppearedSingletonException | BeanCreationException var7) {
        throw var7;
    } catch (Throwable var8) {
        throw new BeanCreationException(mbdToUse.getResourceDescription(), beanName, "Unexpected exception during bean creation", var8);
    }
}
```

在调用doCreateBeanf方法之前通过resolveBeforeInstantiation方法调用实现BeanPostProcessor：

```java
protected Object resolveBeforeInstantiation(String beanName, RootBeanDefinition mbd) {
    Object bean = null;
    if (!Boolean.FALSE.equals(mbd.beforeInstantiationResolved)) {
        if (!mbd.isSynthetic() && this.hasInstantiationAwareBeanPostProcessors()) {
            Class<?> targetType = this.determineTargetType(beanName, mbd);
            if (targetType != null) {
                // 第一处调用beanPostProcessor地方
                bean = this.applyBeanPostProcessorsBeforeInstantiation(targetType, beanName);
                // 如果获取bean对象，说明生成了代理对象
                if (bean != null) {
                    bean = this.applyBeanPostProcessorsAfterInitialization(bean, beanName);
                }
            }
        }

        mbd.beforeInstantiationResolved = bean != null;
    }

    return bean;
}
```

继续查看applyBeanPostProcessorsBeforeInstantiation方法：

```java
@Nullable
protected Object applyBeanPostProcessorsBeforeInstantiation(Class<?> beanClass, String beanName) {
    Iterator var3 = this.getBeanPostProcessorCache().instantiationAware.iterator();
    Object result;
    do {
        if (!var3.hasNext()) {
            return null;
        }
        InstantiationAwareBeanPostProcessor bp = (InstantiationAwareBeanPostProcessor)var3.next();
        result = bp.postProcessBeforeInstantiation(beanClass, beanName);
    } while(result == null);

    return result;
}
```

看到`InstantiationAwareBeanPostProcessor`这个接口，你会发现spring通过`@EnableAspectJAutoProxy`开启aop切面，会为我们容器导入beanDefinition.这个beanDefinition就是`AnnotationAwareAspectJAutoProxyCreator`类，`AnnotationAwareAspectJAutoProxyCreator`实现了InstantiationAwareBeanPostProcessor这个接口。所以我们继续查看AnnotationAwareAspectJAutoProxyCreator的postProcessBeforeInstantiation方法，发现AnnotationAwareAspectJAutoProxyCreator中没有重写postProcessBeforeInstantiation方法，但是其父类AbstractAutoProxyCreator实现了postProcessBeforeInstantiation方法：

```java
public Object postProcessBeforeInstantiation(Class<?> beanClass, String beanName) {
    Object cacheKey = this.getCacheKey(beanClass, beanName);
    if (!StringUtils.hasLength(beanName) || !this.targetSourcedBeans.contains(beanName)) {
        if (this.advisedBeans.containsKey(cacheKey)) { // 是否解析过
            return null;
        }

         // isInfrastructureClass方法判断是切面，通知，切点
         // shouldSkip方法获取候选的advisors
        if (this.isInfrastructureClass(beanClass) || this.shouldSkip(beanClass, beanName)) {
            this.advisedBeans.put(cacheKey, Boolean.FALSE);
            return null;
        }
    }
    // ，，，，省略代码
}
```

shouldSkip方法：

```java
protected boolean shouldSkip(Class<?> beanClass, String beanName) {
    //  获取所有的Advisor
    List<Advisor> candidateAdvisors = this.findCandidateAdvisors();
    Iterator var4 = candidateAdvisors.iterator();
    Advisor advisor;
    do {
        if (!var4.hasNext()) {
            return super.shouldSkip(beanClass, beanName);
        }

        advisor = (Advisor)var4.next();
        /// while中的判断是跳过通过xml配置的AspectJPointcutAdvisor
    } while(!(advisor instanceof AspectJPointcutAdvisor) || !((AspectJPointcutAdvisor)advisor).getAspectName().equals(beanName));

    return true;
}
```

findCandidateAdvisors方法获取所有的Advisor：

```java
protected List<Advisor> findCandidateAdvisors() {
    // 获取实现Advisor接口的，事务通过这个findCandidateAdvisors方法获取
    List<Advisor> advisors = super.findCandidateAdvisors();
    if (this.aspectJAdvisorsBuilder != null) {
        // 解析注解的通过spectJAdvisorsBuilder.buildAspectJAdvisors()方式构建
        advisors.addAll(this.aspectJAdvisorsBuilder.buildAspectJAdvisors());
    }
    return advisors;
}
```

findCandidateAdvisors方法获取

```java
public List<Advisor> findAdvisorBeans() {
        // 获取缓存的值
        String[] advisorNames = this.cachedAdvisorBeanNames;
        if (advisorNames == null) {
            // 从容器中获取所有Advisor类型的beanName
            advisorNames = BeanFactoryUtils.beanNamesForTypeIncludingAncestors(this.beanFactory, Advisor.class, true, false);
            // 加入缓存
            this.cachedAdvisorBeanNames = advisorNames;
        }

        if (advisorNames.length == 0) {
            return new ArrayList();
        } else {
            List<Advisor> advisors = new ArrayList();
            String[] var3 = advisorNames;
            int var4 = advisorNames.length; // 遍历

            for(int var5 = 0; var5 < var4; ++var5) {
                String name = var3[var5];
                // isEligibleBean方法判断名字是否符合
                if (this.isEligibleBean(name)) {
                    // 判断工厂是否已经创建过
                    if (this.beanFactory.isCurrentlyInCreation(name)) {
                        if (logger.isTraceEnabled()) {
                            logger.trace("Skipping currently created advisor '" + name + "'");
                        }
                    } else {
                        try {
                            // 没创建通过getBean创建
                            advisors.add(this.beanFactory.getBean(name, Advisor.class));
                        } catch (BeanCreationException var11) {
                            Throwable rootCause = var11.getMostSpecificCause();
                            if (rootCause instanceof BeanCurrentlyInCreationException) {
                                BeanCreationException bce = (BeanCreationException)rootCause;
                                String bceBeanName = bce.getBeanName();
                                if (bceBeanName != null && this.beanFactory.isCurrentlyInCreation(bceBeanName)) {
                                    if (logger.isTraceEnabled()) {
                                        logger.trace("Skipping advisor '" + name + "' with dependency on currently created bean: " + var11.getMessage());
                                    }
                                    continue;
                                }
                            }

                            throw var11;
                        }
                    }
                }
            }

            return advisors;
        }
    }
```

buildAspectJAdvisors构建：

```java
public List<Advisor> buildAspectJAdvisors() {
    List<String> aspectNames = this.aspectBeanNames;
    if (aspectNames == null) {
        synchronized(this) {
            aspectNames = this.aspectBeanNames;
            if (aspectNames == null) {
                List<Advisor> advisors = new ArrayList();
                List<String> aspectNames = new ArrayList();
                // 获取所有的bean
                String[] beanNames = BeanFactoryUtils.beanNamesForTypeIncludingAncestors(this.beanFactory, Object.class, true, false);
                String[] var18 = beanNames;
                int var19 = beanNames.length;

                for(int var7 = 0; var7 < var19; ++var7) {
                    String beanName = var18[var7];
                    if (this.isEligibleBean(beanName)) {
                        Class<?> beanType = this.beanFactory.getType(beanName, false);
                        // 判断是否有@AspectJ
                        if (beanType != null && this.advisorFactory.isAspect(beanType)) {
                            // 存储切面类的缓存
                            aspectNames.add(beanName);
                            AspectMetadata amd = new AspectMetadata(beanType, beanName);
                            if (amd.getAjType().getPerClause().getKind() == PerClauseKind.SINGLETON) {
                                MetadataAwareAspectInstanceFactory factory = new BeanFactoryAspectInstanceFactory(this.beanFactory, beanName);
                                // 解析获取Advisors
                                List<Advisor> classAdvisors = this.advisorFactory.getAdvisors(factory);
                                // 加入到缓存中
                                if (this.beanFactory.isSingleton(beanName)) {
                                    this.advisorsCache.put(beanName, classAdvisors);
                                } else {
                                    this.aspectFactoryCache.put(beanName, factory);
                                }

                                advisors.addAll(classAdvisors);
                            } else {
                                if (this.beanFactory.isSingleton(beanName)) {
                                    throw new IllegalArgumentException("Bean with name '" + beanName + "' is a singleton, but aspect instantiation model is not singleton");
                                }

                                MetadataAwareAspectInstanceFactory factory = new PrototypeAspectInstanceFactory(this.beanFactory, beanName);
                                this.aspectFactoryCache.put(beanName, factory);
                                advisors.addAll(this.advisorFactory.getAdvisors(factory));
                            }
                        }
                    }
                }

                this.aspectBeanNames = aspectNames;
                return advisors;
            }
        }
    }
    // ,,, 不重要省略代码

}
```

getAdvisors解析获取Advisors：

```java
public List<Advisor> getAdvisors(MetadataAwareAspectInstanceFactory aspectInstanceFactory) {
    Class<?> aspectClass = aspectInstanceFactory.getAspectMetadata().getAspectClass();
    String aspectName = aspectInstanceFactory.getAspectMetadata().getAspectName();
    this.validate(aspectClass);
    MetadataAwareAspectInstanceFactory lazySingletonAspectInstanceFactory = new LazySingletonAspectInstanceFactoryDecorator(aspectInstanceFactory);
    List<Advisor> advisors = new ArrayList();
    // 获取切面类的除了标记所有方法
    Iterator var6 = this.getAdvisorMethods(aspectClass).iterator();
    while(var6.hasNext()) {
        Method method = (Method)var6.next();
        //遍历方法生成advisor
        Advisor advisor = this.getAdvisor(method, lazySingletonAspectInstanceFactory, 0, aspectName);
        if (advisor != null) {
            advisors.add(advisor);
        }
    }
    // ，，，，，， 非核心代码省略
    return advisors;
}
```

getAdvisorMethods获取切面类的除了标记所有方法：

```java
private List<Method> getAdvisorMethods(Class<?> aspectClass) {
    List<Method> methods = new ArrayList();
    //aspectClass通过adviceMethodFilter排除pointCut方法，其余的方法保存在methods
    ReflectionUtils.doWithMethods(aspectClass, methods::add, adviceMethodFilter);
    if (methods.size() > 1) {
        methods.sort(adviceMethodComparator); // 简单排序会按照before、after、afterReturning、AfterThrowing顺序
    }

    return methods;
}
```

getAdvisor遍历方法生成advisor：

```java
public Advisor getAdvisor(Method candidateAdviceMethod, MetadataAwareAspectInstanceFactory aspectInstanceFactory, int declarationOrderInAspect, String aspectName) {
    this.validate(aspectInstanceFactory.getAspectMetadata().getAspectClass());
    // 获取Pointcut，Advisor是由Advisor和增强组成的
    AspectJExpressionPointcut expressionPointcut = this.getPointcut(candidateAdviceMethod, aspectInstanceFactory.getAspectMetadata().getAspectClass());
    return expressionPointcut == null ? null : new InstantiationModelAwarePointcutAdvisorImpl(expressionPointcut, candidateAdviceMethod, this, aspectInstanceFactory, declarationOrderInAspect, aspectName);
}
```

InstantiationModelAwarePointcutAdvisorImpl构造方法：

```java
public InstantiationModelAwarePointcutAdvisorImpl(AspectJExpressionPointcut declaredPointcut, Method aspectJAdviceMethod, AspectJAdvisorFactory aspectJAdvisorFactory, MetadataAwareAspectInstanceFactory aspectInstanceFactory, int declarationOrder, String aspectName) {
    this.declaredPointcut = declaredPointcut;
    this.declaringClass = aspectJAdviceMethod.getDeclaringClass();
    this.methodName = aspectJAdviceMethod.getName();
    this.parameterTypes = aspectJAdviceMethod.getParameterTypes();
    this.aspectJAdviceMethod = aspectJAdviceMethod;
    this.aspectJAdvisorFactory = aspectJAdvisorFactory;
    this.aspectInstanceFactory = aspectInstanceFactory;
    this.declarationOrder = declarationOrder;
    this.aspectName = aspectName;
    if (aspectInstanceFactory.getAspectMetadata().isLazilyInstantiated()) {
        Pointcut preInstantiationPointcut = Pointcuts.union(aspectInstanceFactory.getAspectMetadata().getPerClausePointcut(), this.declaredPointcut);
        this.pointcut = new InstantiationModelAwarePointcutAdvisorImpl.PerTargetInstantiationModelPointcut(this.declaredPointcut, preInstantiationPointcut, aspectInstanceFactory);
        this.lazy = true;
    } else {
        this.pointcut = this.declaredPointcut;
        this.lazy = false;
        this.instantiatedAdvice = this.instantiateAdvice(this.declaredPointcut); // 创建Advice
    }

}
```

instantiateAdvice 创建Advice：

```java
private Advice instantiateAdvice(AspectJExpressionPointcut pointcut) {
    // 通过getAdvice创建Advice
    Advice advice = this.aspectJAdvisorFactory.getAdvice(this.aspectJAdviceMethod, pointcut, this.aspectInstanceFactory, this.declarationOrder, this.aspectName);
    return advice != null ? advice : EMPTY_ADVICE;
}
```

getAdvice创建Advice：

```java
public Advice getAdvice(Method candidateAdviceMethod, AspectJExpressionPointcut expressionPointcut, MetadataAwareAspectInstanceFactory aspectInstanceFactory, int declarationOrder, String aspectName) {
    Class<?> candidateAspectClass = aspectInstanceFactory.getAspectMetadata().getAspectClass();
    this.validate(candidateAspectClass);
    AspectJAnnotation<?> aspectJAnnotation = AbstractAspectJAdvisorFactory.findAspectJAnnotationOnMethod(candidateAdviceMethod);
    if (aspectJAnnotation == null) {
        return null;
    } else if (!this.isAspect(candidateAspectClass)) {
        throw new AopConfigException("Advice must be declared inside an aspect type: Offending method '" + candidateAdviceMethod + "' in class [" + candidateAspectClass.getName() + "]");
    } else {
        if (this.logger.isDebugEnabled()) {
            this.logger.debug("Found AspectJ method: " + candidateAdviceMethod);
        }

        Object springAdvice;
        // 根据不同的注解生成不同的Advice
        switch(aspectJAnnotation.getAnnotationType()) {
        case AtPointcut:
            if (this.logger.isDebugEnabled()) {
                this.logger.debug("Processing pointcut '" + candidateAdviceMethod.getName() + "'");
            }

            return null;
        case AtAround:
            springAdvice = new AspectJAroundAdvice(candidateAdviceMethod, expressionPointcut, aspectInstanceFactory);
            break;
        case AtBefore:
            springAdvice = new AspectJMethodBeforeAdvice(candidateAdviceMethod, expressionPointcut, aspectInstanceFactory);
            break;
        case AtAfter:
            springAdvice = new AspectJAfterAdvice(candidateAdviceMethod, expressionPointcut, aspectInstanceFactory);
            break;
        case AtAfterReturning:
            springAdvice = new AspectJAfterReturningAdvice(candidateAdviceMethod, expressionPointcut, aspectInstanceFactory);
            AfterReturning afterReturningAnnotation = (AfterReturning)aspectJAnnotation.getAnnotation();
            if (StringUtils.hasText(afterReturningAnnotation.returning())) {
                ((AbstractAspectJAdvice)springAdvice).setReturningName(afterReturningAnnotation.returning());
            }
            break;
        case AtAfterThrowing:
            springAdvice = new AspectJAfterThrowingAdvice(candidateAdviceMethod, expressionPointcut, aspectInstanceFactory);
            AfterThrowing afterThrowingAnnotation = (AfterThrowing)aspectJAnnotation.getAnnotation();
            if (StringUtils.hasText(afterThrowingAnnotation.throwing())) {
                ((AbstractAspectJAdvice)springAdvice).setThrowingName(afterThrowingAnnotation.throwing());
            }
            break;
        default:
            throw new UnsupportedOperationException("Unsupported advice type on method: " + candidateAdviceMethod);
        }

        ((AbstractAspectJAdvice)springAdvice).setAspectName(aspectName);
        ((AbstractAspectJAdvice)springAdvice).setDeclarationOrder(declarationOrder);
        String[] argNames = this.parameterNameDiscoverer.getParameterNames(candidateAdviceMethod);
        if (argNames != null) {
            ((AbstractAspectJAdvice)springAdvice).setArgumentNamesFromStringArray(argNames);
        }

        ((AbstractAspectJAdvice)springAdvice).calculateArgumentBindings();
        return (Advice)springAdvice;
    }
}
```

#### 2.4**创建代理的过程**

创建代理正常情况下是在初始化之后创建的，发生循环依赖的情况下是在实例化之后，属性赋值之前创建的。

下面是常情况下代理对象的创建：

createBean创建：

```java
protected Object createBean(String beanName, RootBeanDefinition mbd, @Nullable Object[] args) throws BeanCreationException {
    if (this.logger.isTraceEnabled()) {
        this.logger.trace("Creating instance of bean '" + beanName + "'");
    }

    RootBeanDefinition mbdToUse = mbd;
    Class<?> resolvedClass = this.resolveBeanClass(mbd, beanName, new Class[0]);
    if (resolvedClass != null && !mbd.hasBeanClass() && mbd.getBeanClassName() != null) {
        mbdToUse = new RootBeanDefinition(mbd);
        mbdToUse.setBeanClass(resolvedClass);
    }

    try {
        mbdToUse.prepareMethodOverrides();
    } catch (BeanDefinitionValidationException var9) {
        throw new BeanDefinitionStoreException(mbdToUse.getResourceDescription(), beanName, "Validation of method overrides failed", var9);
    }

    Object beanInstance;
    try {
        // bean的BeanPostProcessor，生成Advisors的地方
        beanInstance = this.resolveBeforeInstantiation(beanName, mbdToUse);
        if (beanInstance != null) {
            return beanInstance;
        }
    } catch (Throwable var10) {
        throw new BeanCreationException(mbdToUse.getResourceDescription(), beanName, "BeanPostProcessor before instantiation of bean failed", var10);
    }

    try {
        // 创建bean实例
        beanInstance = this.doCreateBean(beanName, mbdToUse, args);
        if (this.logger.isTraceEnabled()) {
            this.logger.trace("Finished creating instance of bean '" + beanName + "'");
        }

        return beanInstance;
    } catch (ImplicitlyAppearedSingletonException | BeanCreationException var7) {
        throw var7;
    } catch (Throwable var8) {
        throw new BeanCreationException(mbdToUse.getResourceDescription(), beanName, "Unexpected exception during bean creation", var8);
    }
}



```

doCreateBean方法：

```java

protected Object doCreateBean(String beanName, RootBeanDefinition mbd, @Nullable Object[] args) throws BeanCreationException {
    BeanWrapper instanceWrapper = null;
    if (mbd.isSingleton()) {
        instanceWrapper = (BeanWrapper)this.factoryBeanInstanceCache.remove(beanName);
    }

    if (instanceWrapper == null) {
        instanceWrapper = this.createBeanInstance(beanName, mbd, args); // 实例化bean
    }

    Object bean = instanceWrapper.getWrappedInstance();
    Class<?> beanType = instanceWrapper.getWrappedClass();
    if (beanType != NullBean.class) {
        mbd.resolvedTargetType = beanType;
    }

    synchronized(mbd.postProcessingLock) {
        if (!mbd.postProcessed) {
            try {
                this.applyMergedBeanDefinitionPostProcessors(mbd, beanType, beanName);
            } catch (Throwable var17) {
                throw new BeanCreationException(mbd.getResourceDescription(), beanName, "Post-processing of merged bean definition failed", var17);
            }

            mbd.postProcessed = true;
        }
    }

    boolean earlySingletonExposure = mbd.isSingleton() && this.allowCircularReferences && this.isSingletonCurrentlyInCreation(beanName);
    if (earlySingletonExposure) {
        if (this.logger.isTraceEnabled()) {
            this.logger.trace("Eagerly caching bean '" + beanName + "' to allow for resolving potential circular references");
        }

        this.addSingletonFactory(beanName, () -> {
            return this.getEarlyBeanReference(beanName, mbd, bean);
        });
    }

    Object exposedObject = bean;

    try {
        this.populateBean(beanName, mbd, instanceWrapper); // 属性赋值
        exposedObject = this.initializeBean(beanName, exposedObject, mbd); // 初始化bean
    } catch (Throwable var18) {
        if (var18 instanceof BeanCreationException && beanName.equals(((BeanCreationException)var18).getBeanName())) {
            throw (BeanCreationException)var18;
        }

        throw new BeanCreationException(mbd.getResourceDescription(), beanName, "Initialization of bean failed", var18);
    }

    if (earlySingletonExposure) {
        Object earlySingletonReference = this.getSingleton(beanName, false);
        if (earlySingletonReference != null) {
            if (exposedObject == bean) {
                exposedObject = earlySingletonReference;
            } else if (!this.allowRawInjectionDespiteWrapping && this.hasDependentBean(beanName)) {
                String[] dependentBeans = this.getDependentBeans(beanName);
                Set<String> actualDependentBeans = new LinkedHashSet(dependentBeans.length);
                String[] var12 = dependentBeans;
                int var13 = dependentBeans.length;

                for(int var14 = 0; var14 < var13; ++var14) {
                    String dependentBean = var12[var14];
                    if (!this.removeSingletonIfCreatedForTypeCheckOnly(dependentBean)) {
                        actualDependentBeans.add(dependentBean);
                    }
                }

                if (!actualDependentBeans.isEmpty()) {
                    throw new BeanCurrentlyInCreationException(beanName, "Bean with name '" + beanName + "' has been injected into other beans [" + StringUtils.collectionToCommaDelimitedString(actualDependentBeans) + "] in its raw version as part of a circular reference, but has eventually been wrapped. This means that said other beans do not use the final version of the bean. This is often the result of over-eager type matching - consider using 'getBeanNamesForType' with the 'allowEagerInit' flag turned off, for example.");
                }
            }
        }
    }

    try {
        this.registerDisposableBeanIfNecessary(beanName, bean, mbd);
        return exposedObject;
    } catch (BeanDefinitionValidationException var16) {
        throw new BeanCreationException(mbd.getResourceDescription(), beanName, "Invalid destruction signature", var16);
    }
}
```

initializeBean初始化Bean:

```java
protected Object initializeBean(String beanName, Object bean, @Nullable RootBeanDefinition mbd) {
    if (System.getSecurityManager() != null) {
        AccessController.doPrivileged(() -> {
            this.invokeAwareMethods(beanName, bean);
            return null;
        }, this.getAccessControlContext());
    } else {
        this.invokeAwareMethods(beanName, bean);
    }

    Object wrappedBean = bean;
    if (mbd == null || !mbd.isSynthetic()) {
        // 初始化之前调用bean的BeanPostProcessor
        wrappedBean = this.applyBeanPostProcessorsBeforeInitialization(bean, beanName);
    }

    try {
        this.invokeInitMethods(beanName, wrappedBean, mbd); // 初始化
    } catch (Throwable var6) {
        throw new BeanCreationException(mbd != null ? mbd.getResourceDescription() : null, beanName, "Invocation of init method failed", var6);
    }

    if (mbd == null || !mbd.isSynthetic()) {
        // 调用bean的BeanPostProcessor
        wrappedBean = this.applyBeanPostProcessorsAfterInitialization(wrappedBean, beanName);
    }

    return wrappedBean;
}
```

applyBeanPostProcessorsAfterInitialization调用bean的BeanPostProcessor：

```java
public Object applyBeanPostProcessorsAfterInitialization(Object existingBean, String beanName) throws BeansException {
    Object result = existingBean;

    Object current;
    for(Iterator var4 = this.getBeanPostProcessors().iterator(); var4.hasNext(); result = current) {
        BeanPostProcessor processor = (BeanPostProcessor)var4.next();
        current = processor.postProcessAfterInitialization(result, beanName);
        if (current == null) {
            return result;
        }
    }

    return result;
}
```

看到`BeanPostProcessor`这个接口，你会发现spring通过`@EnableAspectJAutoProxy`开启aop切面，会为我们容器导入beanDefinition.这个beanDefinition就是`AnnotationAwareAspectJAutoProxyCreator`类，`AnnotationAwareAspectJAutoProxyCreator`实现了BeanPostProcessor这个接口。所以我们继续查看AnnotationAwareAspectJAutoProxyCreator的postProcessAfterInitialization方法，发现AnnotationAwareAspectJAutoProxyCreator中没有重写postProcessAfterInitialization方法，但是其父类AbstractAutoProxyCreator实现了postProcessAfterInitialization方法：

```java
public Object postProcessAfterInitialization(@Nullable Object bean, String beanName) {
    if (bean != null) {
        Object cacheKey = this.getCacheKey(bean.getClass(), beanName);
        // earlyProxyReferences排除之前循环依赖时创建的动态代理
        if (this.earlyProxyReferences.remove(cacheKey) != bean) {
            return this.wrapIfNecessary(bean, beanName, cacheKey); // 判断是否需要创建代理。
        }
    }

    return bean;
}
```

wrapIfNecessary判断是否需要创建代理对象：

```java
protected Object wrapIfNecessary(Object bean, String beanName, Object cacheKey) {
    // 已经处理过的
    if (StringUtils.hasLength(beanName) && this.targetSourcedBeans.contains(beanName)) {
        return bean;
        // advisedBean不需要增强
    } else if (Boolean.FALSE.equals(this.advisedBeans.get(cacheKey))) {
        return bean;
        // isInfrastructureClass方法判断是切面，通知，切点
         // shouldSkip方法获取候选的advisors。
    } else if (!this.isInfrastructureClass(bean.getClass()) && !this.shouldSkip(bean.getClass(), beanName)) {
        Object[] specificInterceptors = this.getAdvicesAndAdvisorsForBean(bean.getClass(), beanName, (TargetSource)null);// 1，获取当前bean匹配的Advisor
        if (specificInterceptors != DO_NOT_PROXY) {
            this.advisedBeans.put(cacheKey, Boolean.TRUE);
            // 2，createProxy创建动态代理
            Object proxy = this.createProxy(bean.getClass(), beanName, specificInterceptors, new SingletonTargetSource(bean));
            this.proxyTypes.put(cacheKey, proxy.getClass());
            return proxy;
        } else {
            this.advisedBeans.put(cacheKey, Boolean.FALSE);
            return bean;
        }
    } else {
        this.advisedBeans.put(cacheKey, Boolean.FALSE);
        return bean;
    }
}
```

##### 2.4.1**获取当前bean匹配的Advisor流程**

getAdvicesAndAdvisorsForBean方法获取当前bean匹配的Advisor：

```java
protected List<Advisor> findEligibleAdvisors(Class<?> beanClass, String beanName) {
    // 获取实现接口方式的Aop
    List<Advisor> candidateAdvisors = this.findCandidateAdvisors();
    // 获取命中的的Advisors
    List<Advisor> eligibleAdvisors = this.findAdvisorsThatCanApply(candidateAdvisors, beanClass, beanName);
    this.extendAdvisors(eligibleAdvisors); // 这个一步会自动给我们添加一个advisors，这个advisors会在调用时体现作用
    if (!eligibleAdvisors.isEmpty()) {
        eligibleAdvisors = this.sortAdvisors(eligibleAdvisors); /// 排序
    }

    return eligibleAdvisors;
}
```

findAdvisorsThatCanApply获取命中的的Advisors：

```java
protected List<Advisor> findAdvisorsThatCanApply(List<Advisor> candidateAdvisors, Class<?> beanClass, String beanName) {
    ProxyCreationContext.setCurrentProxiedBeanName(beanName);

    List var4;
    try {
        var4 = AopUtils.findAdvisorsThatCanApply(candidateAdvisors, beanClass);
    } finally {
        ProxyCreationContext.setCurrentProxiedBeanName((String)null);
    }

    return var4;
}
```

继续跟进findAdvisorsThatCanApply：

```java
public static List<Advisor> findAdvisorsThatCanApply(List<Advisor> candidateAdvisors, Class<?> clazz) {
    if (candidateAdvisors.isEmpty()) {
        return candidateAdvisors;
    } else {
        List<Advisor> eligibleAdvisors = new ArrayList();
        Iterator var3 = candidateAdvisors.iterator(); // 循环所有Advisors
        while(var3.hasNext()) {
            Advisor candidate = (Advisor)var3.next();
            // 判断是否是引用的Advisor
            if (candidate instanceof IntroductionAdvisor && canApply(candidate, clazz)) {
                eligibleAdvisors.add(candidate);
            }
        }

        boolean hasIntroductions = !eligibleAdvisors.isEmpty();
        Iterator var7 = candidateAdvisors.iterator();// 循环所有Advisors
        while(var7.hasNext()) {
            Advisor candidate = (Advisor)var7.next();
            // 判断Advisor是否命中
            if (!(candidate instanceof IntroductionAdvisor) && canApply(candidate, clazz, hasIntroductions)) {
                eligibleAdvisors.add(candidate);
            }
        }

        return eligibleAdvisors;
    }
}
```

canApply判断Advisor是否命中：

```java
public static boolean canApply(Pointcut pc, Class<?> targetClass, boolean hasIntroductions) {
    Assert.notNull(pc, "Pointcut must not be null");
    if (!pc.getClassFilter().matches(targetClass)) { // 粗筛
        return false;
    } else {
        MethodMatcher methodMatcher = pc.getMethodMatcher();
        if (methodMatcher == MethodMatcher.TRUE) {
            return true;
        } else {
            IntroductionAwareMethodMatcher introductionAwareMethodMatcher = null;
            if (methodMatcher instanceof IntroductionAwareMethodMatcher) {
                introductionAwareMethodMatcher = (IntroductionAwareMethodMatcher)methodMatcher;
            }

            Set<Class<?>> classes = new LinkedHashSet();
            if (!Proxy.isProxyClass(targetClass)) {
                classes.add(ClassUtils.getUserClass(targetClass));
            }

            // 获取类的接口对象
            classes.addAll(ClassUtils.getAllInterfacesForClassAsSet(targetClass));
            Iterator var6 = classes.iterator();

            while(var6.hasNext()) {
                Class<?> clazz = (Class)var6.next();
                // 获取接口的所有方法
                Method[] methods = ReflectionUtils.getAllDeclaredMethods(clazz);
                Method[] var9 = methods;
                int var10 = methods.length;

                for(int var11 = 0; var11 < var10; ++var11) { // 遍历方法
                    Method method = var9[var11];
                    // 进行精筛
                    if (introductionAwareMethodMatcher != null) {
                        if (introductionAwareMethodMatcher.matches(method, targetClass, hasIntroductions)) {
                            return true;
                        }
                    } else if (methodMatcher.matches(method, targetClass)) {
                        return true;
                    }
                }
            }

            return false;
        }
    }
}

```

##### 2.4.2**createProxy创建动态代理流程**

> 获取命中的advidsor后创建代理对象

createProxy方法创建:

```java
protected Object createProxy(Class<?> beanClass, @Nullable String beanName, @Nullable Object[] specificInterceptors, TargetSource targetSource) {
    if (this.beanFactory instanceof ConfigurableListableBeanFactory) {
        AutoProxyUtils.exposeTargetClass((ConfigurableListableBeanFactory)this.beanFactory, beanName, beanClass);
    }

    ProxyFactory proxyFactory = new ProxyFactory();
    proxyFactory.copyFrom(this);
    if (proxyFactory.isProxyTargetClass()) { //判断是否设置ProxyTargetClass = true，强制使用cglib
        if (Proxy.isProxyClass(beanClass) || ClassUtils.isLambdaClass(beanClass)) {
            Class[] var6 = beanClass.getInterfaces();
            int var7 = var6.length;

            for(int var8 = 0; var8 < var7; ++var8) {
                Class<?> ifc = var6[var8];
                proxyFactory.addInterface(ifc);
            }
        }
    } else if (this.shouldProxyTargetClass(beanClass, beanName)) {
        proxyFactory.setProxyTargetClass(true);
    } else {
        this.evaluateProxyInterfaces(beanClass, proxyFactory);
    }

    Advisor[] advisors = this.buildAdvisors(beanName, specificInterceptors);
    proxyFactory.addAdvisors(advisors);
    proxyFactory.setTargetSource(targetSource);
    this.customizeProxyFactory(proxyFactory);
    proxyFactory.setFrozen(this.freezeProxy);
    if (this.advisorsPreFiltered()) {
        proxyFactory.setPreFiltered(true);
    }

    ClassLoader classLoader = this.getProxyClassLoader();
    if (classLoader instanceof SmartClassLoader && classLoader != beanClass.getClassLoader()) {
        classLoader = ((SmartClassLoader)classLoader).getOriginalClassLoader();
    }

    // 真正创建代理的地方
    return proxyFactory.getProxy(classLoader);
}
```

getProxy真正创建代理的地方:

```
public Object getProxy(@Nullable ClassLoader classLoader) {
    return this.createAopProxy().getProxy(classLoader);
}
```

![image-20221202103630504](http://img.zouyh.top/article-img/20240917134948129.png)

createAopProxy：判断使用那种方式

```java
public AopProxy createAopProxy(AdvisedSupport config) throws AopConfigException {

    if (NativeDetector.inNativeImage() || !config.isOptimize() && !config.isProxyTargetClass() && !this.hasNoUserSuppliedProxyInterfaces(config)) {
        return new JdkDynamicAopProxy(config); // 没有强制使用clglib代理，实现接口使用JdkDynamicAopProxy的代理方式
    } else {
        Class<?> targetClass = config.getTargetClass();
        if (targetClass == null) {
            throw new AopConfigException("TargetSource cannot determine target class: Either an interface or a target is required for proxy creation.");
        } else {
            return (AopProxy)(!targetClass.isInterface() && !Proxy.isProxyClass(targetClass) && !ClassUtils.isLambdaClass(targetClass) ? new ObjenesisCglibAopProxy(config) : new JdkDynamicAopProxy(config));
        }
    }
}
```

##### 2.4.3调用流程

创建完成代理对象后，代理对象会替代原来的对象放在一级缓存中，我们使用的是一级缓存中的代理对象，在调用方法时会调用代理对象的invoke方法，下面以Jdk动态代理的方式：

```java
@Nullable
public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    Object oldProxy = null;
    boolean setProxyContext = false;
    TargetSource targetSource = this.advised.targetSource;
    Object target = null;

    Class var8;
    try {
        // equals方法不执行动态代理
        if (!this.equalsDefined && AopUtils.isEqualsMethod(method)) {
            Boolean var18 = this.equals(args[0]);
            return var18;
        }
        // hashCode方法不执行动态代理
        if (!this.hashCodeDefined && AopUtils.isHashCodeMethod(method)) {
            Integer var17 = this.hashCode();
            return var17;
        }
         // 没有实现DecoratingProxy接口
        if (method.getDeclaringClass() != DecoratingProxy.class) {
            Object retVal;
            
            // 判断没有实现Advised接口
            if (!this.advised.opaque && method.getDeclaringClass().isInterface() && method.getDeclaringClass().isAssignableFrom(Advised.class)) {
                retVal = AopUtils.invokeJoinpointUsingReflection(this.advised, method, args);
                return retVal;
            }

            // 判断是否需要暴露当前代理对象
            if (this.advised.exposeProxy) {
                oldProxy = AopContext.setCurrentProxy(proxy);
                setProxyContext = true;
            }
            target = targetSource.getTarget();
            Class<?> targetClass = target != null ? target.getClass() : null;
            // 把aop的advice全部转换为Intercept拦截器，通过责任链的方式依次调用
            List<Object> chain = this.advised.getInterceptorsAndDynamicInterceptionAdvice(method, targetClass);
            
            if (chain.isEmpty()) {
                Object[] argsToUse = AopProxyUtils.adaptArgumentsIfNecessary(method, args);
                retVal = AopUtils.invokeJoinpointUsingReflection(target, method, argsToUse);
            } else {
                 //创建ReflectiveMethodInvocation对象通过反射的方式调用Intercept的proceed方法
                MethodInvocation invocation = new ReflectiveMethodInvocation(proxy, target, method, args, targetClass, chain);
                retVal = invocation.proceed();
            }

            Class<?> returnType = method.getReturnType();
            if (retVal != null && retVal == target && returnType != Object.class && returnType.isInstance(proxy) && !RawTargetAccess.class.isAssignableFrom(method.getDeclaringClass())) {
                retVal = proxy;
            } else if (retVal == null && returnType != Void.TYPE && returnType.isPrimitive()) {
                throw new AopInvocationException("Null return value from advice does not match primitive return type for: " + method);
            }

            Object var12 = retVal;
            return var12;
        }

        var8 = AopProxyUtils.ultimateTargetClass(this.advised);
    } finally {
        if (target != null && !targetSource.isStatic()) {
            targetSource.releaseTarget(target);
        }

        if (setProxyContext) {
            AopContext.setCurrentProxy(oldProxy);
        }

    }

    return var8;
}
```

ReflectiveMethodInvocation的构造方法：

```java
 protected ReflectiveMethodInvocation(Object proxy, @Nullable Object target, Method method, @Nullable Object[] arguments, @Nullable Class<?> targetClass, List<Object> interceptorsAndDynamicMethodMatchers) {
        this.proxy = proxy;
        this.target = target;
        this.targetClass = targetClass;
        this.method = BridgeMethodResolver.findBridgedMethod(method);
        this.arguments = AopProxyUtils.adaptArgumentsIfNecessary(method, arguments);
        this.interceptorsAndDynamicMethodMatchers = interceptorsAndDynamicMethodMatchers;
    }

```

ReflectiveMethodInvocation的proceed方法：

```java
public Object proceed() throws Throwable {
    // 递归调用出口，currentInterceptorIndex当前拦截器是最后一个拦截器
    if (this.currentInterceptorIndex == this.interceptorsAndDynamicMethodMatchers.size() - 1) {
        return this.invokeJoinpoint();
    } else {
        // 获取下一个拦截器
        Object interceptorOrInterceptionAdvice = this.interceptorsAndDynamicMethodMatchers.get(++this.currentInterceptorIndex);
        if (interceptorOrInterceptionAdvice instanceof InterceptorAndDynamicMethodMatcher) {
            InterceptorAndDynamicMethodMatcher dm = (InterceptorAndDynamicMethodMatcher)interceptorOrInterceptionAdvice;
            Class<?> targetClass = this.targetClass != null ? this.targetClass : this.method.getDeclaringClass();
            return dm.methodMatcher.matches(this.method, targetClass, this.arguments) ? dm.interceptor.invoke(this) : this.proceed();
        } else {
            // 调用拦截器的invoke方法
            return ((MethodInterceptor)interceptorOrInterceptionAdvice).invoke(this);
        }
    }
}
```

org.springframework.aop.interceptor.ExposeInvocationInterceptor#invoke

```java
public Object invoke(MethodInvocation mi) throws Throwable {
	MethodInvocation oldInvocation = invocation.get();
	invocation.set(mi);
	try {
		return mi.proceed();
	}
	finally {
		invocation.set(oldInvocation);
	}
}
```

org.springframework.aop.aspectj.AspectJAfterThrowingAdvice#invoke 异常拦截器，当方法调用异常会被执行

```java
public Object invoke(MethodInvocation mi) throws Throwable {
	try {
		return mi.proceed(); // 递归调用
	}catch (Throwable ex) {
		if (shouldInvokeOnThrowing(ex)) {
			invokeAdviceMethod(getJoinPointMatch(), null, ex); // 捕捉到异常调用通知
		}
		throw ex;
	}
}
```

org.springframework.aop.framework.adapter.AfterReturningAdviceInterceptor#invoke 返回拦截器，方法执行失败，不会调用

```java
public Object invoke(MethodInvocation mi) throws Throwable {
	Object retVal = mi.proceed(); // 这里递归调用，失败程序终止不会继续执行
	this.advice.afterReturning(retVal, mi.getMethod(), mi.getArguments(), mi.getThis());// 调用后置通知
	return retVal;
}
```

org.springframework.aop.aspectj.AspectJAfterAdvice#invoke 最终拦截器，总是执行

```java
public Object invoke(MethodInvocation mi) throws Throwable {
	try {
		return mi.proceed();// 这里递归调用
	}finally {
		invokeAdviceMethod(getJoinPointMatch(), null, null); // 调用最终通知。finally总是执行
	}
}
```

org.springframework.aop.framework.adapter.MethodBeforeAdviceInterceptor#invoke 前置拦截器

```java
public Object invoke(MethodInvocation mi) throws Throwable {
	this.advice.before(mi.getMethod(), mi.getArguments(), mi.getThis()); // 调用前置通知
	return mi.proceed(); // 这里递归调用
}
```



##### 2.4.4循环依赖下代理对象的创建

> 假设A依赖B，B依赖A，A先创建。

在A对象实例化之后，会将对象添加的三级缓存中，如下代码：

```java
protected Object doCreateBean(final String beanName, final RootBeanDefinition mbd, final Object[]args)throws BeanCreationException {
    //省略其他代码，只保留了关键代码
    boolean earlySingletonExposure = (mbd.isSingleton() && this.allowCircularReferences &&
     isSingletonCurrentlyInCreation(beanName));
     if (earlySingletonExposure) 
         if (logger.isDebugEnabled()) {
             logger.debug("Eagerly caching bean '" + beanName +11 "' to allow for resolving potential circular references");
         }
          //添加到三级缓存中
          addSingletonFactory(beanName, new ObjectFactory
          @Override
          public Object getObject()throws BeansException {
           //执行拓展的后置处理器
            return getEarlyBeanReference(beanName, mbd, bean);
          }
         });
    }
}
```

在A属性赋值之前发现依赖B，创建B时候发现依赖A，再次获取A的时候可以从三级缓存中得到，并调用放入三级缓存的`getObject()`方法

如下代码：

```java
protected Object getSingleton(String beanName, boolean allowEarlyReference) {
    // singletonObjects 从一级缓存中获取对象
    Object singletonObject = this.singletonObjects.get(beanName);
    // 一级缓存未获取的对象 并且 isSingletonCurrentlyInCreation方法判断当前获取的对象是否在创建中，如果是说明产生了循环依赖，产生循环依赖才会，进入下面的代码.只有调用createBean才会将beanName放入正在创建的集合中。
    if (singletonObject == null && this.isSingletonCurrentlyInCreation(beanName)) {
        // earlySingletonObjects 从二级缓存中获取对象
        singletonObject = this.earlySingletonObjects.get(beanName);
        // 一级缓存未获取的对象 并且 allowEarlyReference参数表示是否允许循环依赖
        if (singletonObject == null && allowEarlyReference) {
            synchronized(this.singletonObjects) { // 类似于单例模式中的懒汉式
                singletonObject = this.singletonObjects.get(beanName); // 一级缓存中拿值
                if (singletonObject == null) {
                    singletonObject = this.earlySingletonObjects.get(beanName); //  二级缓存中拿值
                    if (singletonObject == null) { 
                        // 三级缓存中获取创建代理对象的方法
                        ObjectFactory<?> singletonFactory = (ObjectFactory)this.singletonFactories.get(beanName);
                        if (singletonFactory != null) {
                            singletonObject = singletonFactory.getObject(); // 调用getObject创建对象
                            this.earlySingletonObjects.put(beanName, singletonObject); // 放入二级缓存中
                            this.singletonFactories.remove(beanName); // 移出三级缓存中的值
                        }
                    }
                }
            }
        }
    }

    return singletonObject;
}
```

getObject方法调用会调用getEarlyBeanReference方法：

```java
protected Object getEarlyBeanReference(String beanName, RootBeanDefinition mbd, Object bean) {
    Object exposedObject = bean;
    //判读我们容器中是否有InstantiationAwareBeanPostProcessors类型的后置处理器
    if (!mbd.isSynthetic() && hasInstantiationAwareBeanPostProcessors()) {
        //获取我们所有的后置处理器
        for (BeanPostProcessor bp : getBeanPostProcessors()) {
            //判断我们的后置处理器是不是实现了SmartInstantiationAwareBeanPostProcessor接口
            if (bp instanceof SmartInstantiationAwareBeanPostProcessor) {
                //进行强制转换
                SmartInstantiationAwareBeanPostProcessor ibp = (SmartInstantiationAwareBeanPostProcessor) bp;
                //挨个调用SmartInstantiationAwareBeanPostProcessor的getEarlyBeanReference
                exposedObject = ibp.getEarlyBeanReference(exposedObject, beanName);
              }
        }
    }
    return exposedObject;
}
```

判断是否是InstantiationAwareBeanPostProcessors类型的后置处理器，是否实现SmartInstantiationAwareBeanPostProcessor接口，而`@EnableAspectJAutoProxy`注解就为添加AnnotationAwareAspectJAutoProxyCreator类的继承关系图：

![ ](http://img.zouyh.top/article-img/20240917134948128.png)

AnnotationAwareAspectJAutoProxyCreator就是InstantiationAwareBeanPostProcessors类型的后置处理器，实现SmartInstantiationAwareBeanPostProcessor接口,

调用getEarlyBeanReference方法获取早期对象：

![image-20221206175131925](http://img.zouyh.top/article-img/20240917134949131.png)

AnnotationAwareAspectJAutoProxyCreator没有实现getEarlyBeanReference方法，但是他继承了父类的getEarlyBeanReference：

```java
public Object getEarlyBeanReference(Object bean, String beanName) {
        Object cacheKey = this.getCacheKey(bean.getClass(), beanName);
        this.earlyProxyReferences.put(cacheKey, bean);
        return this.wrapIfNecessary(bean, beanName, cacheKey);
    }
```

看到wrapIfNecessary方法你就会发现你很熟悉，在2.2创建代理的过程中，用来判断生成代理对象的.
