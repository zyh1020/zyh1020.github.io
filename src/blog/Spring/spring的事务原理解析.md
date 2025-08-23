---
icon: document
# 标题
title: 'spring的事务原理解析'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-10
# 一个页面可以有多个分类
category:
  - Spring
# 一个页面可以有多个标签
tag:
  - 偏僻
  - Spring
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---



### 一，spring事务源码解析

#### 1.1开启事务

来分析注解驱动事务的原理，同样的我们从@EnableTransactionManagement开始：

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Import({TransactionManagementConfigurationSelector.class})
public @interface EnableTransactionManagement {
    boolean proxyTargetClass() default false;
    AdviceMode mode() default AdviceMode.PROXY; // 使用代理的方式，绝大部分情况下，我们都不会使用AspectJ的静态代理的
    int order() default 2147483647;
}
```

和开始SpringAop的`@EnableAspectJAutoProxy`注解一个套路。不同之处只在于spring事务开启的注解是`@EnableTransactionManagement`通过@Import导入配置类。查看导入了什么配置类`TransactionManagementConfigurationSelector`源码：

```java
public class TransactionManagementConfigurationSelector extends AdviceModeImportSelector<EnableTransactionManagement> {
    public TransactionManagementConfigurationSelector() {
    }

    protected String[] selectImports(AdviceMode adviceMode) {
        switch(adviceMode) {
        case PROXY: // 绝大部分情况下，我们都不会使用AspectJ的静态代理的~
            return new String[]{AutoProxyRegistrar.class.getName(), ProxyTransactionManagementConfiguration.class.getName()};
        case ASPECTJ:
            return new String[]{this.determineTransactionAspectClass()};
        default:
            return null;
        }
    }

    private String determineTransactionAspectClass() {
        return ClassUtils.isPresent("javax.transaction.Transactional", this.getClass().getClassLoader()) ? "org.springframework.transaction.aspectj.AspectJJtaTransactionManagementConfiguration" : "org.springframework.transaction.aspectj.AspectJTransactionManagementConfiguration";
    }
}
```

`TransactionManagementConfigurationSelector`是AdviceModeImportSelector子类，AdviceModeImportSelector目前所知的三个子类是：`AsyncConfigurationSelector`(Spring的异步)、`TransactionManagementConfigurationSelector`（spring的事务）、`CachingConfigurationSelector`（spring的缓存）。

`TransactionManagementConfigurationSelector`为容器添加两个类`AutoProxyRegistrar`和`ProxyTransactionManagementConfiguration`我们先看AutoProxyRegistrar类。

##### 1.1.1AutoProxyRegistrar

从名字是意思是：自动代理注册器，实现了ImportBeanDefinitionRegistrar，向容器里注册BeanPostProcessor的Bean定义信息AutoProxyRegistrar源码如下：

```java
public class AutoProxyRegistrar implements ImportBeanDefinitionRegistrar {
    private final Log logger = LogFactory.getLog(this.getClass());

    public AutoProxyRegistrar() {
    }

    public void registerBeanDefinitions(AnnotationMetadata importingClassMetadata, BeanDefinitionRegistry registry) {
        boolean candidateFound = false;
        //  这里面需要特别注意的是：这里是拿到所有的注解类型~~~而不是只拿@EnableAspectJAutoProxy这个类型的
        // 因为mode、proxyTargetClass等属性会直接影响到代理得方式，而拥有这些属性的注解至少有：
        // @EnableTransactionManagement、@EnableAsync、@EnableCaching等~~~~
        // 甚至还有启用AOP的注解：@EnableAspectJAutoProxy它也能设置`proxyTargetClass`这个属性的值，因此也会产生关联影响~
        Set<String> annTypes = importingClassMetadata.getAnnotationTypes();
        Iterator var5 = annTypes.iterator();

        while(var5.hasNext()) {
            String annType = (String)var5.next();
            AnnotationAttributes candidate = AnnotationConfigUtils.attributesFor(importingClassMetadata, annType);
            if (candidate != null) {
                 // 说明：如果你是比如@Configuration或者别的注解的话 他们就是null了
                Object mode = candidate.get("mode");
                Object proxyTargetClass = candidate.get("proxyTargetClass");
                // 如果存在mode且存在proxyTargetClass 属性
                // 并且两个属性的class类型也是对的，才会进来此处（因此其余注解相当于都挡外面了~）
                if (mode != null && proxyTargetClass != null && AdviceMode.class == mode.getClass() && Boolean.class == proxyTargetClass.getClass()) {
                    candidateFound = true;
                    if (mode == AdviceMode.PROXY) {
                        // AopConfigUtils的registerAutoProxyCreatorIfNecessary方法注册
                        AopConfigUtils.registerAutoProxyCreatorIfNecessary(registry);
                        if ((Boolean)proxyTargetClass) {
                            AopConfigUtils.forceAutoProxyCreatorToUseClassProxying(registry);
                            return;
                        }
                    }
                }
            }
        }

        if (!candidateFound && this.logger.isInfoEnabled()) {
            String name = this.getClass().getSimpleName();
            this.logger.info(String.format("%s was imported but no annotations were found having both 'mode' and 'proxyTargetClass' attributes of type AdviceMode and boolean respectively. This means that auto proxy creator registration and configuration may not have occurred as intended, and components may not be proxied as expected. Check to ensure that %s has been @Import'ed on the same class where these annotations are declared; otherwise remove the import of %s altogether.", name, name, name));
        }

    }
}
```

AopConfigUtils的registerAutoProxyCreatorIfNecessary方法：

```java
public abstract class AopConfigUtils {
    public static final String AUTO_PROXY_CREATOR_BEAN_NAME = "org.springframework.aop.config.internalAutoProxyCreator";
    private static final List<Class<?>> APC_PRIORITY_LIST = new ArrayList(3);
    static {
        APC_PRIORITY_LIST.add(InfrastructureAdvisorAutoProxyCreator.class);
        APC_PRIORITY_LIST.add(AspectJAwareAdvisorAutoProxyCreator.class);
        APC_PRIORITY_LIST.add(AnnotationAwareAspectJAutoProxyCreator.class);
    }
}
    public AopConfigUtils() {
    }

    // 注册事务的BeanPost
    @Nullable
    public static BeanDefinition registerAutoProxyCreatorIfNecessary(BeanDefinitionRegistry registry, @Nullable Object source) {
        return registerOrEscalateApcAsRequired(InfrastructureAdvisorAutoProxyCreator.class, registry, source);
    }
    
   // 注册Aop切面的 BeanPost
    @Nullable
    public static BeanDefinition registerAspectJAutoProxyCreatorIfNecessary(BeanDefinitionRegistry registry, @Nullable Object source) {
        return registerOrEscalateApcAsRequired(AspectJAwareAdvisorAutoProxyCreator.class, registry, source);
    }      
   // 注册Aop切面的 BeanPost
    @Nullable
    public static BeanDefinition registerAspectJAnnotationAutoProxyCreatorIfNecessary(BeanDefinitionRegistry registry, @Nullable Object source) {
        return registerOrEscalateApcAsRequired(AnnotationAwareAspectJAutoProxyCreator.class, registry, source);
    }


    @Nullable
    private static BeanDefinition registerOrEscalateApcAsRequired(Class<?> cls, BeanDefinitionRegistry registry, @Nullable Object source) {
        Assert.notNull(registry, "BeanDefinitionRegistry must not be null");
        if (registry.containsBeanDefinition("org.springframework.aop.config.internalAutoProxyCreator")) {
            BeanDefinition apcDefinition = registry.getBeanDefinition("org.springframework.aop.config.internalAutoProxyCreator");
            // 比较传入的cls的类和apcDefinition.getBeanClassName()注册在beanDefinition的类是否相同
            if (!cls.getName().equals(apcDefinition.getBeanClassName())) {
                // 不相同就获取优先级
                int currentPriority = findPriorityForClass(apcDefinition.getBeanClassName());
                int requiredPriority = findPriorityForClass(cls);
                if (currentPriority < requiredPriority) { // 传入的优先级大于注册在beanDefinition的
                // 优先级： AOP（AnnotationAwareAspectJAutoProxyCreator） 
                 //       > （AspectJAwareAdvisorAutoProxyCreator） > 事务（InfrastructureAdvisorAutoProxyCreator）
               
                    apcDefinition.setBeanClassName(cls.getName());// 修改注册在beanDefinition的类
                }
            }
    
            return null;
        } else {
            RootBeanDefinition beanDefinition = new RootBeanDefinition(cls);
            beanDefinition.setSource(source);
            beanDefinition.getPropertyValues().add("order", -2147483648);
            beanDefinition.setRole(2);
            registry.registerBeanDefinition("org.springframework.aop.config.internalAutoProxyCreator", beanDefinition);
            return beanDefinition;
        }
    }
}
```

这一步最重要的就是向Spring容器注入了一个自动代理创建器：org.springframework.aop.config.internalAutoProxyCreator，这里有个小细节注意一下，由于spring的AOP和事务注册的都是名字都是org.springframework.aop.config.internalAutoProxyCreator的BeanPostProcessor，但是只会保留一个，AOP的会覆盖事务的， 因为AOP优先级更大。所以假如`@EnableTransactionManagement`和`@EnableAspectJAutoProxy `同时存在， 那么AOP的AutoProxyCreator 会进行覆盖，即AnnotationAwareAspectJAutoProxyCreator会覆盖InfrastructureAdvisorAutoProxyCreator。

##### 1.1.2ProxyTransactionManagementConfiguration

ProxyTransactionManagementConfiguration的源码：

```java
@Configuration(proxyBeanMethods = false)
@Role(2)
public class ProxyTransactionManagementConfiguration extends AbstractTransactionManagementConfiguration {
    public ProxyTransactionManagementConfiguration() {
    }

    // BeanFactoryTransactionAttributeSourceAdvisor是事务的核心
    @Bean(name = {"org.springframework.transaction.config.internalTransactionAdvisor"})
    @Role(2)
    public BeanFactoryTransactionAttributeSourceAdvisor transactionAdvisor(TransactionAttributeSource transactionAttributeSource, TransactionInterceptor transactionInterceptor) {
        BeanFactoryTransactionAttributeSourceAdvisor advisor = new BeanFactoryTransactionAttributeSourceAdvisor();
        // transactionAttributeSource解析@Transaction注解
        advisor.setTransactionAttributeSource(transactionAttributeSource);
        advisor.setAdvice(transactionInterceptor); // 增强
        if (this.enableTx != null) {
            advisor.setOrder((Integer)this.enableTx.getNumber("order"));
        }

        return advisor;
    }

    @Bean
    @Role(2)
     // transactionAttributeSource解析@Transaction注解
    public TransactionAttributeSource transactionAttributeSource() {
        return new AnnotationTransactionAttributeSource();
    }

    @Bean
    @Role(2)
    // 事务拦截器它是个`MethodInterceptor`，它也是Spring处理事务最为核心的部分
    public TransactionInterceptor transactionInterceptor(TransactionAttributeSource transactionAttributeSource) {
        TransactionInterceptor interceptor = new TransactionInterceptor();
        interceptor.setTransactionAttributeSource(transactionAttributeSource);
        if (this.txManager != null) {
            interceptor.setTransactionManager(this.txManager);
        }

        return interceptor;
    }
}
```

`ProxyTransactionManagementConfiguration`的父类`AbstractTransactionManagementConfiguration`

```java
@Configuration
public abstract class AbstractTransactionManagementConfiguration implements ImportAware {
    @Nullable
    protected AnnotationAttributes enableTx;
    @Nullable
    protected TransactionManager txManager;

    public AbstractTransactionManagementConfiguration() {
    }

    public void setImportMetadata(AnnotationMetadata importMetadata) {
        // 此处：只拿到@EnableTransactionManagement这个注解的就成作为AnnotationAttributes保存起来
        this.enableTx = AnnotationAttributes.fromMap(importMetadata.getAnnotationAttributes(EnableTransactionManagement.class.getName()));
       // 这个@EnableTransactionManagement注解是必须的
         if (this.enableTx == null) {
            throw new IllegalArgumentException("@EnableTransactionManagement is not present on importing class " + importMetadata.getClassName());
        }
    }

    @Autowired(required = false)
    // 可以配置一个Bean实现这个接口。然后给注解驱动的给一个默认的事务管理器~~
    void setConfigurers(Collection<TransactionManagementConfigurer> configurers) {
        if (!CollectionUtils.isEmpty(configurers)) {
            if (configurers.size() > 1) { //  同样的，最多也只允许你去配置一个
                throw new IllegalStateException("Only one TransactionManagementConfigurer may exist");
            } else {
                TransactionManagementConfigurer configurer = (TransactionManagementConfigurer)configurers.iterator().next();
                this.txManager = configurer.annotationDrivenTransactionManager();
            }
        }
    }

    //  注册一个监听器工厂，用以支持@TransactionalEventListener注解标注的方法，来监听事务相关的事件
    @Bean(name = {"org.springframework.transaction.config.internalTransactionalEventListenerFactory"})
    @Role(2)
    public static TransactionalEventListenerFactory transactionalEventListenerFactory() {
        return new TransactionalEventListenerFactory();
    }
}
```

##### 1.1.3BeanFactoryTransactionAttributeSourceAdvisor

`BeanFactoryTransactionAttributeSourceAdvisor`是事务的核心

```java
public class BeanFactoryTransactionAttributeSourceAdvisor extends AbstractBeanFactoryPointcutAdvisor {
    @Nullable
    private TransactionAttributeSource transactionAttributeSource;
    // pointcut切点
    private final TransactionAttributeSourcePointcut pointcut = new TransactionAttributeSourcePointcut() {
        @Nullable
        protected TransactionAttributeSource getTransactionAttributeSource() {
            return BeanFactoryTransactionAttributeSourceAdvisor.this.transactionAttributeSource;
        }
    };

    public BeanFactoryTransactionAttributeSourceAdvisor() {
    }

    public void setTransactionAttributeSource(TransactionAttributeSource transactionAttributeSource) {
        this.transactionAttributeSource = transactionAttributeSource;
    }

    public void setClassFilter(ClassFilter classFilter) {
        this.pointcut.setClassFilter(classFilter);
    }

    public Pointcut getPointcut() {
        return this.pointcut;
    }
}

```

`TransactionAttributeSourcePointcut`决定了哪些类需要生成代理对象从而应用事务，查看TransactionAttributeSourcePointcut匹配规则：

```java
abstract class TransactionAttributeSourcePointcut extends StaticMethodMatcherPointcut implements Serializable {
        private TransactionAttributeSourceClassFilter() {
        }
		// 匹配
        private class TransactionAttributeSourceClassFilter implements ClassFilter {
        private TransactionAttributeSourceClassFilter() {
        }

        public boolean matches(Class<?> clazz) {
            // 实现了如下三个接口的子类，就不需要被代理了 直接放行
            // TransactionalProxy它是SpringProxy的子类。 如果是被TransactionProxyFactoryBean生产出来的Bean，就会自动实现此接口，那么就不会被这里再次代理了
            // PlatformTransactionManager：spring抽象的事务管理器~~~
			// PersistenceExceptionTranslator对RuntimeException转换成DataAccessException的转换接口
            if (!TransactionalProxy.class.isAssignableFrom(clazz) && !TransactionManager.class.isAssignableFrom(clazz) && !PersistenceExceptionTranslator.class.isAssignableFrom(clazz)) {
                // 重要：拿到事务属性源
				// 如果tas == null表示没有配置事务属性源，那是全部匹配的 也就是说所有的方法都匹配
				// 或者 标注了@Transaction这样的注解的方法才会给与匹配~~~
                TransactionAttributeSource tas = TransactionAttributeSourcePointcut.this.getTransactionAttributeSource();
                return tas == null || tas.isCandidateClass(clazz);
            } else {
                return false;
            }
        }
 }
```

关于matches方法的调用时机：只要是容器内的每个Bean，都会经过AbstractAutoProxyCreator#postProcessAfterInitialization从 而会调用wrapIfNecessary方法，因此容器内所有的Bean的所有方法在容器启动时候都会执行此matche方法，因此请注意缓存的使用。





#### 1.2advisor解析流程

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

通过`beanNamesForTypeIncludingAncestors`方法容器中获取所有Advisor类型的beanName,过@Import 的ImportSelect 注册的配置类,`ProxyTransactionManagementConfiguration` 中设置的BeanFactoryTransactionAttributeSourceAdvisor就是Adisor类型：

![image-20221215105350412](http://img.zouyh.top/article-img/20240917134949132.png)



#### 1.3创建动态代理

在Spring AOP中有过过介绍，区别在于匹配方式的不同： 

- AOP是按照Aspectj提供的API 结合切点表达式进行匹配。
-  事务是根据方法或者类或者接口上面的@Transactional进行匹配。

方法调用链createBean ---> doCreateBean --->initializeBean --->applyBeanPostProcessorsAfterInitialization--->postProcessAfterInitialization--->wrapIfNecessary--->getAdvicesAndAdvisorsForBean-->findEligibleAdvisors--->findAdvisorsThatCanApply --->findAdvisorsThatCanApply (AopUtils)-->canApply

从该方法开始跟AOP有所区别了：AOP是按照Aspectj提供的API 结合切点表达式进行匹配，而事务是根据方法或者类或者接口上面的@Transactional进行匹配

```java
public static boolean canApply(Pointcut pc, Class<?> targetClass, boolean hasIntroductions) {
    Assert.notNull(pc, "Pointcut must not be null");
    if (!pc.getClassFilter().matches(targetClass)) { // 粗筛，事务的初筛一直是true
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
                    if (introductionAwareMethodMatcher != null) { // AspectJ方式
                        if (introductionAwareMethodMatcher.matches(method, targetClass, hasIntroductions)) {
                            return true;
                        }
                    } else if (methodMatcher.matches(method, targetClass)) { //Aop 接口的方式 所以事务时直接调用methodMatcher.matches进行匹
                        return true;
                    }
                }
            }

            return false;
        }
    }
}

```

①，匹配方式

TransactionAttributeSourceointcut的matches方法：

```java

abstract class TransactionAttributeSourcePointcut extends StaticMethodMatcherPointcut implements Serializable {
    protected TransactionAttributeSourcePointcut() {
        this.setClassFilter(new TransactionAttributeSourcePointcut.TransactionAttributeSourceClassFilter());
    }

    public boolean matches(Method method, Class<?> targetClass) {
        TransactionAttributeSource tas = this.getTransactionAttributeSource();
        return tas == null || tas.getTransactionAttribute(method, targetClass) != null;
    }
```

getTransactionAttributeSource()这里获取到的时候 通过@Import 的ImportSelect 注册的配置类,`ProxyTransactionManagementConfiguration` 中设置的` AnnotationTransactionAttributeSource`：它是基于注解驱动的事务管理的事务属性源， 和`@Transaction`相关，也是现在使用得最最多的方式。 它的基本作用为：它遇上比如@Transaction标注的方法时，此类会分析此事务注解，最终组织形成一个 TransactionAttribute供随后的调用。

AbstractFallbackTransactionAttributeSource的getTransactionAttributef方法：

```java
 @Nullable
    public TransactionAttribute getTransactionAttribute(Method method, @Nullable Class<?> targetClass) {
        if (method.getDeclaringClass() == Object.class) {
            return null;
        } else {
             // 构建我们的缓存key
            Object cacheKey = this.getCacheKey(method, targetClass);
            // 先去我们的缓存中获取
            TransactionAttribute cached = (TransactionAttribute)this.attributeCache.get(cacheKey);
            // 缓存中不为空
            if (cached != null) {
                // 判断缓存中的对象是不是空事务属性的对象
                return cached == NULL_TRANSACTION_ATTRIBUTE ? null : cached; //不是的话 就进行返回
            } else {
                // 我们需要查找我们的事务注解 匹配在这体现
                TransactionAttribute txAttr = this.computeTransactionAttribute(method, targetClass);
                // 若解析出来的事务注解属性为空
                if (txAttr == null) {
                    this.attributeCache.put(cacheKey, NULL_TRANSACTION_ATTRIBUTE); // 往缓存中存放空事务注解属性
                } else {
                    // 我们执行方法的描述符 全类名+方法名
                    String methodIdentification = ClassUtils.getQualifiedMethodName(method, targetClass);
                    // 把方法描述设置到事务属性上去，记录当前需要执行事务的方法名，记录到Descriptor 方便后续调用时判断
                    if (txAttr instanceof DefaultTransactionAttribute) {
                        DefaultTransactionAttribute dta = (DefaultTransactionAttribute)txAttr;
                        dta.setDescriptor(methodIdentification);
                        dta.resolveAttributeStrings(this.embeddedValueResolver);
                    }

                    if (this.logger.isTraceEnabled()) {
                        this.logger.trace("Adding transactional method '" + methodIdentification + "' with attribute: " + txAttr);
                    }

                    this.attributeCache.put(cacheKey, txAttr); // 加入到缓存
                }

                return txAttr;
            }
        }
    }
```

AbstractFallbackTransactionAttributeSource的computeTransactionAttribute判断是否匹配：

```java
@Nullable
    protected TransactionAttribute computeTransactionAttribute(Method method, @Nullable Class<?> targetClass) {
        // 判断我们的事务方法上的修饰符是不是public的
        if (this.allowPublicMethodsOnly() && !Modifier.isPublic(method.getModifiers())) {
            return null;
        } else {          
            
            // 得到实现类方法，即如果method是接口方法，也会将从targetClass得到获取接口的实现类方法 
            //所以说无论传的是接口还是实现，都会先解析实现类，所以接口传进来基本没啥用，第三种和第四中基本可以忽视，
            // 因为 findTransactionAttribute方法本身就会去接口中解析
            Method specificMethod = AopUtils.getMostSpecificMethod(method, targetClass);
             // 第一种，我们先去目标class的方法上去找我们的事务注解
            TransactionAttribute txAttr = this.findTransactionAttribute(specificMethod);
            if (txAttr != null) {
                return txAttr;
            } else {
                // 第二种:去我们targetClass类[实现类]上找事务注解
                txAttr = this.findTransactionAttribute(specificMethod.getDeclaringClass());
                if (txAttr != null && ClassUtils.isUserLevelMethod(method)) {
                    return txAttr;
                } else {
                    if (specificMethod != method) {
                        //第三种:去我们的实现类的接口上的方法去找事务注解
                        txAttr = this.findTransactionAttribute(method);
                        if (txAttr != null) {
                            return txAttr;
                        }
						// 第四种：去我们的实现类的接口上去找事务注解
                        txAttr = this.findTransactionAttribute(method.getDeclaringClass());
                        if (txAttr != null && ClassUtils.isUserLevelMethod(method)) {
                            return txAttr;
                        }
                    }

                    return null;
                }
            }
        }
    }
```

findTransactionAttribute方法去匹配@Trasaction注解：

```java
@Nullable
protected TransactionAttribute findTransactionAttribute(Method method) {
        return this.determineTransactionAttribute(method);
}
```

继续跟进determineTransactionAttribute方法： 

```java
 @Nullable
    protected TransactionAttribute determineTransactionAttribute(AnnotatedElement element) {
        Iterator var2 = this.annotationParsers.iterator();

        TransactionAttribute attr;
        do {
            if (!var2.hasNext()) {
                return null;
            }

            TransactionAnnotationParser parser = (TransactionAnnotationParser)var2.next();
            attr = parser.parseTransactionAnnotation(element);
        } while(attr == null);

        return attr;
    }
```



![image-20221214164906994](http://img.zouyh.top/article-img/20240917134950133.png)

@Transactional简单解释 这个事务注解可以用在类上，也可以用在方法上。 将事务注解标记到服务组件类级别,相当于为该服务组件的每个服务方法都应用了这个注解 事务注解应用在方法级别，是更细粒度的一种事务注解方式 注意 : 如果某个方法和该方法所属类上都有事务注解属性，优先使用方法上的事务注解属性。 

Spring 支持三个不同的事务注解 : 

1. Spring 事务注解 org.springframework.transaction.annotation.Transactional（纯正血统，官方推荐） 
2. JTA事务注解 javax.transaction.Transactional 
3. EJB3 事务注解 javax.ejb.TransactionAttribute 上面三个注解虽然语义上一样，但是使用方式上不完全一样，若真要使其它的时请注意各自的使用方式

所以， 我们来看下Spring 事务注解：SpringTransactionAnnotationParser的解析。

```java
 @Nullable
    public TransactionAttribute parseTransactionAnnotation(AnnotatedElement element) {
        AnnotationAttributes attributes = AnnotatedElementUtils.findMergedAnnotationAttributes(element, Transactional.class, false, false);
        return attributes != null ? this.parseTransactionAnnotation(attributes) : null;
    }
```

```java
@Nullable
    public static AnnotationAttributes findMergedAnnotationAttributes(AnnotatedElement element, Class<? extends Annotation> annotationType, boolean classValuesAsString, boolean nestedAnnotationsAsMap) {
        MergedAnnotation<?> mergedAnnotation = findAnnotations(element).get(annotationType, (Predicate)null, MergedAnnotationSelectors.firstDirectlyDeclared());
        return getAnnotationAttributes(mergedAnnotation, classValuesAsString, nestedAnnotationsAsMap);
    }
```

我看的是spring5.2.9版本没有调用AnnotatedElementUtils#searchWithFindSemantics这是个公共方法， 根据传入的注解类型和元素进行匹配，调用的直接是`findAnnotations`方法获取注解类型，没有如下图所示的searchWithFindSemantics方法逻辑：

<img src="http://img.zouyh.top/article-img/20240917134951134.png" alt="image-20221215143514831" style="zoom: 80%;" />



最终会解析成TransactionAttribute，TransactionAttribute的descriptor属性记录当前需要执行事务的方法名，方便后续调用时判断

加入到缓存 this.attributeCache.put(cacheKey, txAttr); 如果txAttr!=null 说明解析成功，return true 匹配成功！

后面的创建代理的方式就和Aop一样了。



#### 1.4调用流程

调用开始和AOP是一样的，这里省略之前的代码，主要看看事务的TransactionInterceptor干了什么事情：



```java
@Nullable
    public Object invoke(MethodInvocation invocation) throws Throwable {
        Class<?> targetClass = invocation.getThis() != null ? AopUtils.getTargetClass(invocation.getThis()) : null;
        // 继续调用继承父类TransactionAspectSupport的invokeWithinTransaction
        return this.invokeWithinTransaction(invocation.getMethod(), targetClass, new CoroutinesInvocationCallback() {
            @Nullable
            public Object proceedWithInvocation() throws Throwable {
                return invocation.proceed();
            }

            public Object getTarget() {
                return invocation.getThis();
            }

            public Object[] getArguments() {
                return invocation.getArguments();
            }
        });
    }
```

父类TransactionAspectSupport的invokeWithinTransaction：

```java
@Nullable
    protected Object invokeWithinTransaction(Method method, @Nullable Class<?> targetClass, final TransactionAspectSupport.InvocationCallback invocation) throws Throwable {
        //获取我们的事务属源对象在配置类中添加的，在创建代理进行匹配的时候还用了它还记得吗（将解析的事务属性赋值进去了）
        TransactionAttributeSource tas = this.getTransactionAttributeSource();
        // 获取解析后的事务属性信息，
		// 创建代理的时候也调用了getTransactionAttribute还记得吗， 如果解析到了事务属性就可以创建代理，
		// 在这里是从解析后的缓存中获取
        TransactionAttribute txAttr = tas != null ? tas.getTransactionAttribute(method, targetClass) : null;
        // 获取我们配置的事务管理器对象 在我们自己的配置类里面配置的
        TransactionManager tm = this.determineTransactionManager(txAttr);
      
         // ，，，，，，，省略部分代码
           // 之前往descriptor中设置的还记得吧
            String joinpointIdentification = this.methodIdentification(method, targetClass, txAttr);
            if (txAttr != null && ptm instanceof CallbackPreferringPlatformTransactionManager) {
                // ，，，，，，省略部分代码，
            } else { // 声明式事务
                // 有没有必要创建事务
                TransactionAspectSupport.TransactionInfo txInfo = this.createTransactionIfNecessary(ptm, txAttr, joinpointIdentification);
                Object retVal;
                try {
                    // 调用钩子函数
                    retVal = invocation.proceedWithInvocation();
                } catch (Throwable var20) {
                    // 抛出异常进行回滚处理
                    this.completeTransactionAfterThrowing(txInfo, var20);
                    throw var20;
                } finally {
                    // 清空我们的线程变量中transactionInfo的值
                    this.cleanupTransactionInfo(txInfo);
                }

                if (retVal != null && vavrPresent && TransactionAspectSupport.VavrDelegate.isVavrTry(retVal)) {
                    TransactionStatus status = txInfo.getTransactionStatus();
                    if (status != null && txAttr != null) {
                        retVal = TransactionAspectSupport.VavrDelegate.evaluateTryFailure(retVal, txAttr, status);
                    }
                }
				// 最终提交事务	
                this.commitTransactionAfterReturning(txInfo);
                return retVal;
            }
        }
    }
```



1. createTransactionIfNecessary 这个方法逻辑最多，事务传播行为等实现都是在这种方法

2. try 中回调"连接点（事务的方法）
3. catch中出现异常回滚事务
4. commitTransactionAfterReturning 提交事务

看一下createTransactionIfNecessary方法的逻辑实现

```java
 protected TransactionAspectSupport.TransactionInfo createTransactionIfNecessary(@Nullable PlatformTransactionManager tm, @Nullable TransactionAttribute txAttr, final String joinpointIdentification) {
      // 如果还没有定义名字，把连接点的ID定义成事务的名称
        if (txAttr != null && ((TransactionAttribute)txAttr).getName() == null) {
            txAttr = new DelegatingTransactionAttribute((TransactionAttribute)txAttr) {
                public String getName() {
                    return joinpointIdentification;
                }
            };
        }

        TransactionStatus status = null;
        if (txAttr != null) {
            if (tm != null) {
                //获取一个事务状态
                status = tm.getTransaction((TransactionDefinition)txAttr);
            } else if (this.logger.isDebugEnabled()) {
                this.logger.debug("Skipping transactional joinpoint [" + joinpointIdentification + "] because no transaction manager has been configured");
            }
        }
		// 把事物状态和事物属性等信息封装成一个TransactionInfo对象
        return this.prepareTransactionInfo(tm, (TransactionAttribute)txAttr, joinpointIdentification, status);
    }

```



将之前的Descriptor 作为事务名称，这里重点看下tm.getTransaction tm 是我们在配置类 中的transactionManager，

```java
@Bean
public PlatformTransactionManager transactionManager(DataSource dataSource) {
	return new DataSourceTransactionManager(dataSource);
}

```

所以重点看下getTransaction获取一个事务状态：

```java
public final TransactionStatus getTransaction(@Nullable TransactionDefinition definition) throws TransactionException {
    	// 判断传入的事务是否为空
        TransactionDefinition def = definition != null ? definition : TransactionDefinition.withDefaults();
        // 获取一个事务
        Object transaction = this.doGetTransaction(); 
       // 判断是否已存在事务对象
        if (this.isExistingTransaction(transaction)) {
            // 处理存在事务，用于处理嵌套事务
            return this.handleExistingTransaction(def, transaction, debugEnabled);
        } else if (def.getTimeout() < -1) { // 检查事务的超时时间
            throw new InvalidTimeoutException("Invalid transaction timeout", def.getTimeout());
        } else if (def.getPropagationBehavior() == 2) { //若当前的事务属性式2=PROPAGATION_MANDATORY 表示必须运行在事务中，若当前没有事务就抛出异常
            throw new IllegalTransactionStateException("No existing transaction found for transaction marked with propagation 'mandatory'"); //  由于isExistingTransaction(transaction)判断没有成功，说明当前是不存在事务的，那么就会抛出异常
        } else if (def.getPropagationBehavior() != 0 && def.getPropagationBehavior() != 3 && def.getPropagationBehavior() != 6) { // 不是0，3，6的进入
            // PROPAGATION_REQUIRED=0:当前存在事务就加入到当前的事务,没有就新开一个
            // PROPAGATION_REQUIRES_NEW=3:新开一个事务,若当前存在事务就挂起当前事务
            // PROPAGATION_NESTED=6:表示如果当前正有一个事务在运行中，则该方法应该运行在一个嵌套的事务中，被嵌套的事务可以独立于封装事务进行提交或者回滚(保存点)，如果封装事务不存在,行为就像 PROPAGATION_REQUIRES NEW
            if (def.getIsolationLevel() != -1 && this.logger.isWarnEnabled()) {
                this.logger.warn("Custom isolation level specified but no actual transaction initiated; isolation level will effectively be ignored: " + def);
            }

            boolean newSynchronization = this.getTransactionSynchronization() == 0;
            // prepareTransactionStatus挂起当前事务，在这里为啥传入null?因为逻辑走到这里了,经过了上面的isExistingTransaction(transaction) 判断当前是不存在事务的,所有再这里是挂起当前事务传递一个null进去
            return this.prepareTransactionStatus(def, (Object)null, true, newSynchronization, debugEnabled, (Object)null);
        } else {
            
            // 是0，3，6的进入
            AbstractPlatformTransactionManager.SuspendedResourcesHolder suspendedResources = this.suspend((Object)null);
            if (debugEnabled) {
                this.logger.debug("Creating new transaction with name [" + def.getName() + "]: " + def);
            }
            try {
                 // startTransaction创建新事务
                return this.startTransaction(def, transaction, debugEnabled, suspendedResources);
            } catch (Error | RuntimeException var7) {
                this.resume((Object)null, suspendedResources);
                throw var7;
            }
        }
    }
```

startTransaction方法创建新事务

```java
 private TransactionStatus startTransaction(TransactionDefinition definition, Object transaction, boolean debugEnabled, @Nullable AbstractPlatformTransactionManager.SuspendedResourcesHolder suspendedResources) {
        boolean newSynchronization = this.getTransactionSynchronization() != 2;
        // definition, 事务的属性；transaction, 事务的对象；true, 代表是一个新的事务
        DefaultTransactionStatus status = this.newTransactionStatus(definition, transaction, true, newSynchronization, debugEnabled, suspendedResources);
        // 创建一个新事务
        this.doBegin(transaction, definition);
        // 把当前的事务信息绑定到线程变量去: 为什么要绑定要线程变量呢？ 因为存在嵌套事务情况下需要用到
        this.prepareSynchronization(status, definition);
        return status;
    }
```

`Object transaction = doGetTransaction();` 获得事务对象，这里事务是否存在主要看它携带的ConnectionHolder（数据库连接持有者），如果 ConnectionHolder有则基本说明存在事务，什么情况下会存在已存在事务？ ——嵌套事务

`if (isExistingTransaction(transaction)) {` 

- 这里判断是否存在事务， 如果已存在就处理嵌套的事务逻辑， 这里我们待会作为分支再来跟进 
- 如果不存在就处理顶层的事务逻辑，下面将先介绍顶层的事务逻辑

顶层的事务逻辑 处理不同的传播行为，看这之前我们先了解一下事务的传播行为:

| 事务传播行为类型 | 第一层         |
| ---------------- | -------------- |
| REQUIRED（默认)  | 开启新的事务   |
| REQUIRES_NEW     | 开启新的事务   |
| NESTED           | 开启新的事务   |
| SUPPORTS         | 不开启新的事务 |
| NOT_SUPPORTED    | 不开启新的事务 |
| NEVER            | 不开启新的事务 |
| MANDATORY        | 抛出异常       |

看下doBegin：

```java
protected void doBegin(Object transaction, TransactionDefinition definition) {
    	// 强制转换为事务对象
        DataSourceTransactionManager.DataSourceTransactionObject txObject = (DataSourceTransactionManager.DataSourceTransactionObject)transaction;
        Connection con = null;

        try {
            // 判断事务对象没有数据库连接持有器
            if (!txObject.hasConnectionHolder() || txObject.getConnectionHolder().isSynchronizedWithTransaction()) {
                // 通过数据源获取一个数据库连接对象
                Connection newCon = this.obtainDataSource().getConnection();
                if (this.logger.isDebugEnabled()) {
                    this.logger.debug("Acquired Connection [" + newCon + "] for JDBC transaction");
                }
				// 把我们的数据库连接包装成一个ConnectionHolder对象 然后设置到我们的txObject对象中去
                txObject.setConnectionHolder(new ConnectionHolder(newCon), true);
            }
			// 标记当前的连接是一个同步事务
            txObject.getConnectionHolder().setSynchronizedWithTransaction(true);
            con = txObject.getConnectionHolder().getConnection();
            // 设置isReadOnly、隔离级别
            Integer previousIsolationLevel = DataSourceUtils.prepareConnectionForTransaction(con, definition);
            txObject.setPreviousIsolationLevel(previousIsolationLevel);
            txObject.setReadOnly(definition.isReadOnly());
            // setAutoCommit 默认为true，即每条SQL语句在各自的一个事务中执行。
            if (con.getAutoCommit()) {
                txObject.setMustRestoreAutoCommit(true);
                if (this.logger.isDebugEnabled()) {
                    this.logger.debug("Switching JDBC Connection [" + con + "] to manual commit");
                }

                con.setAutoCommit(false); // 开启事务
            }
           // 判断事务为只读事务
            this.prepareTransactionalConnection(con, definition);
            txObject.getConnectionHolder().setTransactionActive(true);
            int timeout = this.determineTimeout(definition);
            if (timeout != -1) {
                txObject.getConnectionHolder().setTimeoutInSeconds(timeout);
            }
			// 绑定我们的数据源和连接到我们的同步管理器上 把数据源作为key,数据库连接作为value 设置到线程变量中
            if (txObject.isNewConnectionHolder()) {
                TransactionSynchronizationManager.bindResource(this.obtainDataSource(), txObject.getConnectionHolder());
            }

        } catch (Throwable var7) {
            if (txObject.isNewConnectionHolder()) {
                DataSourceUtils.releaseConnection(con, this.obtainDataSource());
                txObject.setConnectionHolder((ConnectionHolder)null, false);
            }

            throw new CannotCreateTransactionException("Could not open JDBC Connection for transaction", var7);
        }
    }
```

` txObject.setConnectionHolder(new ConnectionHolder(newCon), true);`获取一个数据库Connection,封装到ConnectionHolder中, 是不是跟上面 `doGetTransaction();`上下呼应了。 所以假如存在嵌套事务， 就可以拿到ConnectionHolder了.到这里，如果不存在嵌套事务的话 事务的主要逻辑代码就是这些.



嵌套的事务逻辑

> 注意:要触发嵌套事务 如果是调用本类的方法一定要保证 将动态代理暴露在线程中： @EnableAspectJAutoProxy(exposeProxy = true) 通过当前线程代理调用才能触发本类方法的调用：((PayService)AopContext.currentProxy()).方法()

嵌套事务同样也会来到：

 org.springframework.transaction.interceptor.TransactionAspectSupport#invokeWithinTransaction org.springframework.transaction.interceptor.TransactionAspectSupport#createTransactionIfNecessary org.springframework.transaction.support.AbstractPlatformTransactionManager#getTransaction

```java
public final TransactionStatus getTransaction(@Nullable TransactionDefinition definition) throws TransactionException {
    	// 判断传入的事务是否为空
        TransactionDefinition def = definition != null ? definition : TransactionDefinition.withDefaults();
        // 获取一个事务
        Object transaction = this.doGetTransaction(); 
       // 判断是否已存在事务对象
        if (this.isExistingTransaction(transaction)) {
            // 处理存在事务，用于处理嵌套事务
            return this.handleExistingTransaction(def, transaction, debugEnabled);
        } else if (def.getTimeout() < -1) { // 检查事务的超时时间
            throw new InvalidTimeoutException("Invalid transaction timeout", def.getTimeout());
        } else if (def.getPropagationBehavior() == 2) { //若当前的事务属性式2=PROPAGATION_MANDATORY 表示必须运行在事务中，若当前没有事务就抛出异常
            throw new IllegalTransactionStateException("No existing transaction found for transaction marked with propagation 'mandatory'"); //  由于isExistingTransaction(transaction)判断没有成功，说明当前是不存在事务的，那么就会抛出异常
        } else if (def.getPropagationBehavior() != 0 && def.getPropagationBehavior() != 3 && def.getPropagationBehavior() != 6) { // 不是0，3，6的进入
            // PROPAGATION_REQUIRED=0:当前存在事务就加入到当前的事务,没有就新开一个
            // PROPAGATION_REQUIRES_NEW=3:新开一个事务,若当前存在事务就挂起当前事务
            // PROPAGATION_NESTED=6:表示如果当前正有一个事务在运行中，则该方法应该运行在一个嵌套的事务中，被嵌套的事务可以独立于封装事务进行提交或者回滚(保存点)，如果封装事务不存在,行为就像 PROPAGATION_REQUIRES NEW
            if (def.getIsolationLevel() != -1 && this.logger.isWarnEnabled()) {
                this.logger.warn("Custom isolation level specified but no actual transaction initiated; isolation level will effectively be ignored: " + def);
            }

            boolean newSynchronization = this.getTransactionSynchronization() == 0;
            // prepareTransactionStatus挂起当前事务，在这里为啥传入null?因为逻辑走到这里了,经过了上面的isExistingTransaction(transaction) 判断当前是不存在事务的,所有再这里是挂起当前事务传递一个null进去
            return this.prepareTransactionStatus(def, (Object)null, true, newSynchronization, debugEnabled, (Object)null);
        } else {
            
            // 是0，3，6的进入
            AbstractPlatformTransactionManager.SuspendedResourcesHolder suspendedResources = this.suspend((Object)null);
            if (debugEnabled) {
                this.logger.debug("Creating new transaction with name [" + def.getName() + "]: " + def);
            }
            try {
                 // startTransaction创建新事务
                return this.startTransaction(def, transaction, debugEnabled, suspendedResources);
            } catch (Error | RuntimeException var7) {
                this.resume((Object)null, suspendedResources);
                throw var7;
            }
        }
    }
```

`doGetTransaction `将能获得ConnectionHolder，因为顶层事务在开启事务时已经存储。 已经存在事务意味 着什么不用我说了吧 `if (isExistingTransaction(transaction)) { `成立！因为事务ConnectionHolder已经存在 并且 已经激活（在doBegin中激活的）。 执行嵌套事务`handleExistingTransaction`

```java
 private TransactionStatus handleExistingTransaction(TransactionDefinition definition, Object transaction, boolean debugEnabled) throws TransactionException {
       //  NEVER=5: 存在外部事务,抛出异常
        if (definition.getPropagationBehavior() == 5) {
            throw new IllegalTransactionStateException("Existing transaction found for transaction marked with propagation 'never'");
        } else {
            AbstractPlatformTransactionManager.SuspendedResourcesHolder suspendedResources;
            // NOT_SUPPORTED=4:存在外部事务,挂起外部事务
            if (definition.getPropagationBehavior() == 4) {
                if (debugEnabled) {
                    this.logger.debug("Suspending current transaction");
                }
				// 挂起存在的事务
                suspendedResources = this.suspend(transaction);
                boolean newSynchronization = this.getTransactionSynchronization() == 0;
                // 创建一个新的非事物状态(保存了上一个存在事物状态的属性),null 因为它不开启事务;false, 不是新事务;suspendedResources 挂起的事务对象，在事务提交或回滚后会调用重新放回线程变量中
                return this.prepareTransactionStatus(definition, (Object)null, false, newSynchronization, debugEnabled, suspendedResources);
            } else if (definition.getPropagationBehavior() == 3) {// REQUIRES_NEW=3: 存在外部事务,挂起外部事务，创建新的事务
                if (debugEnabled) {
                    this.logger.debug("Suspending current transaction, creating new transaction with name [" + definition.getName() + "]");
                }
				// 挂起存在的事务
                suspendedResources = this.suspend(transaction);
                try {
                    // 创建一个新的事物状态(包含了挂起的事务的属性);true, 代表是一个新的事务;
                    return this.startTransaction(definition, transaction, debugEnabled, suspendedResources);
                } catch (Error | RuntimeException var6) {
                    this.resumeAfterBeginException(transaction, suspendedResources, var6);
                    throw var6;
                }
            } else if (definition.getPropagationBehavior() == 6) { // NESTED=6存在外部事务,融合到外部事务中 应用层面和REQUIRED一样， 源码层面
                if (!this.isNestedTransactionAllowed()) {
                    throw new NestedTransactionNotSupportedException("Transaction manager does not allow nested transactions by default - specify 'nestedTransactionAllowed' property with value 'true'");
                } else {
                    if (debugEnabled) {
                        this.logger.debug("Creating nested transaction with name [" + definition.getName() + "]");
                    }
					// // 是否支持保存点：非JTA事务走这个分支。AbstractPlatformTransactionManager默认是true，JtaTransactionManager复写了该方法false，DataSourceTransactionManager没有复写，还是true,

                    if (this.useSavepointForNestedTransaction()) { 
                        // 开启一个新的事物;false代表不是一个新的事务,如果不是新事务，提交事务时： 由外层事务控制统一提交事务
                        DefaultTransactionStatus status = this.prepareTransactionStatus(definition, transaction, false, false, debugEnabled, (Object)null);
                        // 为事物设置一个回退点
						// savepoint 可以在一组事务中，设置一个回滚点，点以上的不受影响，点以下的回滚。（外层影响内层， 内层不会影响外层）
                        status.createAndHoldSavepoint();
                        return status;
                    } else {
                        // JTA事务走这个分支，创建新事务
                        return this.startTransaction(definition, transaction, debugEnabled, (AbstractPlatformTransactionManager.SuspendedResourcesHolder)null);
                    }
                }
            } else {
                if (debugEnabled) {
                    this.logger.debug("Participating in existing transaction");
                }

                if (this.isValidateExistingTransaction()) {
                    if (definition.getIsolationLevel() != -1) {
                        Integer currentIsolationLevel = TransactionSynchronizationManager.getCurrentTransactionIsolationLevel();
                        if (currentIsolationLevel == null || currentIsolationLevel != definition.getIsolationLevel()) {
                            Constants isoConstants = DefaultTransactionDefinition.constants;
                            throw new IllegalTransactionStateException("Participating transaction with definition [" + definition + "] specifies isolation level which is incompatible with existing transaction: " + (currentIsolationLevel != null ? isoConstants.toCode(currentIsolationLevel, "ISOLATION_") : "(unknown)"));
                        }
                    }

                    if (!definition.isReadOnly() && TransactionSynchronizationManager.isCurrentTransactionReadOnly()) {
                        throw new IllegalTransactionStateException("Participating transaction with definition [" + definition + "] is not marked as read-only but existing transaction is");
                    }
                }

                boolean newSynchronization = this.getTransactionSynchronization() != 2;
                return this.prepareTransactionStatus(definition, transaction, false, newSynchronization, debugEnabled, (Object)null);
            }
        }
    }
```

根据事务传播行为作处理

| 事务传播行为类型 | 第二层                                                       |
| ---------------- | ------------------------------------------------------------ |
| REQUIRED（默认)  | 融合到外部事务中                                             |
| REQUIRES_NEW     | 挂起外部事务，创建新的事务                                   |
| NESTED           | 融合到外部事务中,SavePoint 机制，外层影响内层，内层不会影响外层 |
| SUPPORTS         | 融合到外部事务中                                             |
| NOT_SUPPORTED    | 挂起外部事务                                                 |
| NEVER            | 抛出异常                                                     |
| MANDATORY        | 融合到外部事务中                                             |

`suspend(transaction); `挂起当前顶层事务，怎么挂呢？ 其实就是将线程变量里面的事务信息拿出来，再置空。 待事务提交或回滚后再放回线程变量中

```java
@Nullable
    protected final AbstractPlatformTransactionManager.SuspendedResourcesHolder suspend(@Nullable Object transaction) throws TransactionException {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            List suspendedSynchronizations = this.doSuspendSynchronization();

            try {
                Object suspendedResources = null;
                if (transaction != null) {
                    suspendedResources = this.doSuspend(transaction);
                }

                String name = TransactionSynchronizationManager.getCurrentTransactionName();
                TransactionSynchronizationManager.setCurrentTransactionName((String)null);
                boolean readOnly = TransactionSynchronizationManager.isCurrentTransactionReadOnly();
                TransactionSynchronizationManager.setCurrentTransactionReadOnly(false);
                Integer isolationLevel = TransactionSynchronizationManager.getCurrentTransactionIsolationLevel();
                TransactionSynchronizationManager.setCurrentTransactionIsolationLevel((Integer)null);
                boolean wasActive = TransactionSynchronizationManager.isActualTransactionActive();
                TransactionSynchronizationManager.setActualTransactionActive(false);
                return new AbstractPlatformTransactionManager.SuspendedResourcesHolder(suspendedResources, suspendedSynchronizations, name, readOnly, isolationLevel, wasActive);
            } catch (Error | RuntimeException var8) {
                this.doResumeSynchronization(suspendedSynchronizations);
                throw var8;
            }
        } else if (transaction != null) {
            Object suspendedResources = this.doSuspend(transaction);
            return new AbstractPlatformTransactionManager.SuspendedResourcesHolder(suspendedResources);
        } else {
            return null;
        }
    }
```

所以最终返回一个DefaultTransactionStatus， 后续回滚、提交 都可以根据改对象进行控制。 回滚提交逻 辑比较简单不在这里重复了.
