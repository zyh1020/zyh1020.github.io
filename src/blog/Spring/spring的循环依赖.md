---
icon: file-lines
# 标题
title: 'spring的循环依赖'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-18
# 一个页面可以有多个分类
category:
  - Spring
# 一个页面可以有多个标签
tag:
  - 进阶
  - Spring
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，循环依赖产生的原因

所谓的循环依赖是指，A 依赖 B，B 又依赖 A，它们之间形成了循环依赖。

```java
@Component
public class A {
    @Autowired
    private B b;
}
```

```java
@Component
public class B {
    @Autowired
    private A a;
}
```

### 二，Spring源码解析

下图链接地址https://www.processon.com/view/link/6386be8a7d9c086a817680ee

![spring的生命周期](http://img.zouyh.top/article-img/20240917134947125.png)



#### 步骤1，调用getBean获取Bean

```java
public Object getBean(String name) throws BeansException {
        this.assertBeanFactoryActive();
        return this.getBeanFactory().getBean(name);
}
```

```java
public Object getBean(String name) throws BeansException {
        return this.doGetBean(name, (Class)null, (Object[])null, false);
}
```

```java
protected <T> T doGetBean(String name, @Nullable Class<T> requiredType, @Nullable Object[] args, boolean typeCheckOnly) throws BeansException {
    String beanName = this.transformedBeanName(name);
    Object sharedInstance = this.getSingleton(beanName); // 获取从缓存池中获取bean
    Object beanInstance;
    if (sharedInstance != null && args == null) {
        if (this.logger.isTraceEnabled()) {
            if (this.isSingletonCurrentlyInCreation(beanName)) {
                this.logger.trace("Returning eagerly cached instance of singleton bean '" + beanName + "' that is not fully initialized yet - a consequence of a circular reference");
            } else {
                this.logger.trace("Returning cached instance of singleton bean '" + beanName + "'");
            }
        }

        beanInstance = this.getObjectForBeanInstance(sharedInstance, name, beanName, (RootBeanDefinition)null);
    } else { // 没有获取到，创建bean
        if (this.isPrototypeCurrentlyInCreation(beanName)) {
            throw new BeanCurrentlyInCreationException(beanName);
        }

        BeanFactory parentBeanFactory = this.getParentBeanFactory();
        if (parentBeanFactory != null && !this.containsBeanDefinition(beanName)) {
            String nameToLookup = this.originalBeanName(name);
            if (parentBeanFactory instanceof AbstractBeanFactory) {
                return ((AbstractBeanFactory)parentBeanFactory).doGetBean(nameToLookup, requiredType, args, typeCheckOnly);
            }

            if (args != null) {
                return parentBeanFactory.getBean(nameToLookup, args);
            }

            if (requiredType != null) {
                return parentBeanFactory.getBean(nameToLookup, requiredType);
            }

            return parentBeanFactory.getBean(nameToLookup);
        }

        if (!typeCheckOnly) {
            this.markBeanAsCreated(beanName);
        }

        StartupStep beanCreation = this.applicationStartup.start("spring.beans.instantiate").tag("beanName", name);

        try {
            if (requiredType != null) {
                beanCreation.tag("beanType", requiredType::toString);
            }

            RootBeanDefinition mbd = this.getMergedLocalBeanDefinition(beanName);
            this.checkMergedBeanDefinition(mbd, beanName, args);
            String[] dependsOn = mbd.getDependsOn();
            String[] var12;
            if (dependsOn != null) {
                var12 = dependsOn;
                int var13 = dependsOn.length;

                for(int var14 = 0; var14 < var13; ++var14) {
                    String dep = var12[var14];
                    if (this.isDependent(beanName, dep)) {
                        throw new BeanCreationException(mbd.getResourceDescription(), beanName, "Circular depends-on relationship between '" + beanName + "' and '" + dep + "'");
                    }

                    this.registerDependentBean(dep, beanName);

                    try {
                        this.getBean(dep);
                    } catch (NoSuchBeanDefinitionException var31) {
                        throw new BeanCreationException(mbd.getResourceDescription(), beanName, "'" + beanName + "' depends on missing bean '" + dep + "'", var31);
                    }
                }
            }

            if (mbd.isSingleton()) { // 如果是单例，创建bean
                sharedInstance = this.getSingleton(beanName, () -> {
                    try {
                        // 创建createBean
                        return this.createBean(beanName, mbd, args);
                    } catch (BeansException var5) {
                        this.destroySingleton(beanName);
                        throw var5;
                    }
                });
                beanInstance = this.getObjectForBeanInstance(sharedInstance, name, beanName, mbd);
            } else if (mbd.isPrototype()) { // 多例创建bean
                var12 = null;

                Object prototypeInstance;
                try {
                    this.beforePrototypeCreation(beanName);
                    prototypeInstance = this.createBean(beanName, mbd, args);
                } finally {
                    this.afterPrototypeCreation(beanName);
                }

                beanInstance = this.getObjectForBeanInstance(prototypeInstance, name, beanName, mbd);
            } else {
                String scopeName = mbd.getScope();
                if (!StringUtils.hasLength(scopeName)) {
                    throw new IllegalStateException("No scope name defined for bean '" + beanName + "'");
                }

                Scope scope = (Scope)this.scopes.get(scopeName);
                if (scope == null) {
                    throw new IllegalStateException("No Scope registered for scope name '" + scopeName + "'");
                }

                try {
                    Object scopedInstance = scope.get(beanName, () -> {
                        this.beforePrototypeCreation(beanName);

                        Object var4;
                        try {
                            var4 = this.createBean(beanName, mbd, args);
                        } finally {
                            this.afterPrototypeCreation(beanName);
                        }

                        return var4;
                    });
                    beanInstance = this.getObjectForBeanInstance(scopedInstance, name, beanName, mbd);
                } catch (IllegalStateException var30) {
                    throw new ScopeNotActiveException(beanName, scopeName, var30);
                }
            }
        } catch (BeansException var32) {
            beanCreation.tag("exception", var32.getClass().toString());
            beanCreation.tag("message", String.valueOf(var32.getMessage()));
            this.cleanupAfterBeanCreationFailure(beanName);
            throw var32;
        } finally {
            beanCreation.end();
        }
    }
    
    return this.adaptBeanInstance(name, beanInstance, requiredType);
}

```

步骤一会调用三次，第一次是获取A，第二次是获取A，发现依赖B获取B调用，第三次是获取B时发现依赖A获取A调用.



#### 步骤2，调用getSingleton从缓存池中获取Bean

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
                            singletonObject = singletonFactory.getObject(); // 创建对象
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

步骤二调用情况一：获取A

- 一级缓存(singletonObjects)：空的
- 二级缓存为(singletonFactories)：空的
- 三级缓存(singletonFactories)：空的
- isSingletonCurrentlyInCreation：不包含A，因为还没有真正创建A，调用createBean方法

步骤二调用情况二：创建A发现依赖B，获取B

- 一级缓存(singletonObjects)：空的
- 二级缓存为(singletonFactories)：空的
- 三级缓存(singletonFactories)：A

- isSingletonCurrentlyInCreation：包含A，不包含B，因为还没有真正创建B，调用createBean方法

步骤二调用情况三：创建B发现依赖A，再次获取A

- 一级缓存(singletonObjects)：空的

- 二级缓存为(singletonFactories)：A

- 三级缓存(singletonFactories)：~~A(移除)~~,B

- isSingletonCurrentlyInCreation：包含A，包含B

  

#### 步骤3，调用createBean创建Bean

```java
if (mbd.isSingleton()) {
    sharedInstance = this.getSingleton(beanName, () -> {
 		try {
            	// 创建createBean
             	return this.createBean(beanName, mbd, args);
            } catch (BeansException var5) {
            	this.destroySingleton(beanName);
            	throw var5;
           }
    });
}
```

this.getSingleton的源码：

```java
//  beanName参数是bean的名字
//  singletonFactory参数是函数式接口，只有一个getObject()。是三级缓存中存储的
public Object getSingleton(String beanName, ObjectFactory<?> singletonFactory) {
    synchronized(this.singletonObjects) { // 加锁
        // 获取一级缓存中的bean
        Object singletonObject = this.singletonObjects.get(beanName);
        if (singletonObject == null) { // 没有获取到，开始创建bean
            if (this.singletonsCurrentlyInDestruction) {
                throw new BeanCreationNotAllowedException(beanName, "Singleton bean creation not allowed while singletons of this factory are in destruction (Do not request a bean from a BeanFactory in a destroy method implementation!)");
            }

            if (this.logger.isDebugEnabled()) {
                this.logger.debug("Creating shared instance of singleton bean '" + beanName + "'");
            }

            this.beforeSingletonCreation(beanName);
            boolean newSingleton = false;
            boolean recordSuppressedExceptions = this.suppressedExceptions == null;
            if (recordSuppressedExceptions) {
                this.suppressedExceptions = new LinkedHashSet();
            }

            try {
                singletonObject = singletonFactory.getObject(); // 通过工厂的方式创建bean
                newSingleton = true; // 标记为单例
            } catch (IllegalStateException var16) {
                singletonObject = this.singletonObjects.get(beanName);
                if (singletonObject == null) {
                    throw var16;
                }
            } catch (BeanCreationException var17) {
                BeanCreationException ex = var17;
                if (recordSuppressedExceptions) {
                    Iterator var8 = this.suppressedExceptions.iterator();

                    while(var8.hasNext()) {
                        Exception suppressedException = (Exception)var8.next();
                        ex.addRelatedCause(suppressedException);
                    }
                }

                throw ex;
            } finally {
                if (recordSuppressedExceptions) {
                    this.suppressedExceptions = null;
                }

                this.afterSingletonCreation(beanName);
            }

            if (newSingleton) { 
                // 放入一缓存
                this.addSingleton(beanName, singletonObject);
            }
        }

        return singletonObject;
    }
}
```

singletonFactory是函数接口:

```java
@FunctionalInterface
public interface ObjectFactory<T> {
    T getObject() throws BeansException;
}
```

所以函数式接口`singletonFactory.getObject(); `通过工厂的方式创建bean，是`this.createBean(beanName, mbd, args)`的返回值.createBean方法的源码如下：

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
        // 这个地方是BeanPostpress的执行的地方，也是扩展点之一，在实例化之前执行的
        beanInstance = this.resolveBeforeInstantiation(beanName, mbdToUse);
        if (beanInstance != null) {
            return beanInstance;
        }
    } catch (Throwable var10) {
        throw new BeanCreationException(mbdToUse.getResourceDescription(), beanName, "BeanPostProcessor before instantiation of bean failed", var10);
    }

    try {
        beanInstance = this.doCreateBean(beanName, mbdToUse, args); // 真正创建bean的方法
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

doCreateBean：真正创建bean的方法

```java
protected Object doCreateBean(String beanName, RootBeanDefinition mbd, @Nullable Object[] args) throws BeanCreationException {
    BeanWrapper instanceWrapper = null;
    if (mbd.isSingleton()) {
        instanceWrapper = (BeanWrapper)this.factoryBeanInstanceCache.remove(beanName);
    }

    if (instanceWrapper == null) {
        instanceWrapper = this.createBeanInstance(beanName, mbd, args);
    }

    Object bean = instanceWrapper.getWrappedInstance(); // 实例化Bean
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

        // mbd.isSingleton()判断是否是单例的
        // this.allowCircularReferences是否允许循环依赖
        // this.isSingletonCurrentlyInCreation(beanName) beanname是否是正在创建的bean
    boolean earlySingletonExposure = mbd.isSingleton() && this.allowCircularReferences && this.isSingletonCurrentlyInCreation(beanName);
    if (earlySingletonExposure) {
        if (this.logger.isTraceEnabled()) {
            this.logger.trace("Eagerly caching bean '" + beanName + "' to allow for resolving potential circular references");
        }
		 // 实例化后将创建对象的方法放入三级缓存
        this.addSingletonFactory(beanName, () -> {
            return this.getEarlyBeanReference(beanName, mbd, bean);
        });
    }

    Object exposedObject = bean; // 

    try {
        this.populateBean(beanName, mbd, instanceWrapper); // 属性赋值
        exposedObject = this.initializeBean(beanName, exposedObject, mbd); // 初始化
    } catch (Throwable var18) {
        if (var18 instanceof BeanCreationException && beanName.equals(((BeanCreationException)var18).getBeanName())) {
            throw (BeanCreationException)var18;
        }

        throw new BeanCreationException(mbd.getResourceDescription(), beanName, "Initialization of bean failed", var18);
    }

    if (earlySingletonExposure) { // 再次从二级缓存中获取：目的是解决二级缓存中的是代理后的对象而exposedObject引用的是实例对象
        Object earlySingletonReference = this.getSingleton(beanName, false); // 获取缓存中的对象
        if (earlySingletonReference != null) {
            if (exposedObject == bean) {
                exposedObject = earlySingletonReference; // 二级缓存中的是代理后的对象替换
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
        return exposedObject; // 返回对象
    } catch (BeanDefinitionValidationException var16) {
        throw new BeanCreationException(mbd.getResourceDescription(), beanName, "Invalid destruction signature", var16);
    }
}
```

#### 步骤4，实例化对象

```java
 Object bean = instanceWrapper.getWrappedInstance(); // 实例化Bean
```



#### 步骤5，放入三级缓存：

```java
protected void addSingletonFactory(String beanName, ObjectFactory<?> singletonFactory) {
        Assert.notNull(singletonFactory, "Singleton factory must not be null");
        synchronized(this.singletonObjects) {
            if (!this.singletonObjects.containsKey(beanName)) {
                // 放入三级缓存
                this.singletonFactories.put(beanName, singletonFactory);
                this.earlySingletonObjects.remove(beanName);
                this.registeredSingletons.add(beanName);
            }

        }
    }
```

放入的 函数是：getEarlyBeanReference（）

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

通过Bean的后置处理器创建Bean，这也是判断是否需要生成代理对象的地方。



#### 步骤6，属性赋值

```java
this.populateBean(beanName, mbd, instanceWrapper);
```

用于向 A 这个原始对象中填充属性，当它检测到 A依赖于B时，会首先去实例化 B,调用B的getBean方法获取Bean。

#### 步骤7，初始化

```java
 exposedObject = this.initializeBean(beanName, exposedObject, mbd);
```

#### 步骤8，再次调用getSingleton从缓存池中获取Bean

```java
if (earlySingletonExposure) { // 再次从二级缓存中获取：目的是解决二级缓存中的是代理后的对象而exposedObject引用的是实例对象
        Object earlySingletonReference = this.getSingleton(beanName, false); // 获取缓存中的对象
        if (earlySingletonReference != null) {
            if (exposedObject == bean) {
                exposedObject = earlySingletonReference; // 二级缓存中的是代理后的对象替换
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
```

再次获取目的是解决二级缓存中的是代理后的对象而exposedObject引用的是实例对象。



#### 步骤9，放入一级缓存

在步骤3中创建对象调用得了addSingleton方法，将创建好的对象放入一级缓存中。

```java
 protected void addSingleton(String beanName, Object singletonObject) {
        synchronized(this.singletonObjects) {
            this.singletonObjects.put(beanName, singletonObject);
            this.singletonFactories.remove(beanName);
            this.earlySingletonObjects.remove(beanName);
            this.registeredSingletons.add(beanName);
        }
    }
```

### 三，其它问题

#### 1，为什么一级缓存不能解决循环依赖？

首先一级缓存能解决依赖循环依赖，但是无法保证获取的Bean已经完成了属性赋值。

​	假设线程Q1调用getBean方法获取A，执行到步骤5将创建对象放入一级缓存后，被阻塞了，此时线程Q2也要获取A，在步骤二中从缓存中拿到了直接返回，但是这个返回的对象并没有完成属性赋值，是一个不完整的对象。

#### 2，为什么二级缓存不能解决要使用三级级缓存解决循环依赖？

首先二级缓存如何解决不安全问题：

在步骤2中从缓存中读取和存储都加锁了：

```java
protected Object getSingleton(String beanName, boolean allowEarlyReference) {
    Object singletonObject = this.singletonObjects.get(beanName);
    if (singletonObject == null && this.isSingletonCurrentlyInCreation(beanName)) {
        singletonObject = this.earlySingletonObjects.get(beanName);
        if (singletonObject == null && allowEarlyReference) {
            synchronized(this.singletonObjects) { // 加锁
                singletonObject = this.singletonObjects.get(beanName); // 一级缓存中拿值
                if (singletonObject == null) {
                    singletonObject = this.earlySingletonObjects.get(beanName); //  二级缓存中拿值
                    if (singletonObject == null) { 
                        // 三级缓存中获取创建代理对象的方法
                        ObjectFactory<?> singletonFactory = (ObjectFactory)this.singletonFactories.get(beanName);
                        if (singletonFactory != null) {
                            singletonObject = singletonFactory.getObject(); // 创建对象
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

在步骤3中在缓存中存值加锁了：

```java
//  beanName参数是bean的名字
//  singletonFactory参数是函数式接口，只有一个getObject()。是三级缓存中存储的
public Object getSingleton(String beanName, ObjectFactory<?> singletonFactory) {
    synchronized(this.singletonObjects) { // 加锁
        // 获取一级缓存中的bean
        Object singletonObject = this.singletonObjects.get(beanName);
        if (singletonObject == null) { // 没有获取到，开始创建bean
            if (this.singletonsCurrentlyInDestruction) {
                throw new BeanCreationNotAllowedException(beanName, "Singleton bean creation not allowed while singletons of this factory are in destruction (Do not request a bean from a BeanFactory in a destroy method implementation!)");
            }

            if (this.logger.isDebugEnabled()) {
                this.logger.debug("Creating shared instance of singleton bean '" + beanName + "'");
            }

            this.beforeSingletonCreation(beanName);
            boolean newSingleton = false;
            boolean recordSuppressedExceptions = this.suppressedExceptions == null;
            if (recordSuppressedExceptions) {
                this.suppressedExceptions = new LinkedHashSet();
            }

            try {
                singletonObject = singletonFactory.getObject(); // 通过工厂的方式创建bean
                newSingleton = true; // 标记为单例
            } catch (IllegalStateException var16) {
                singletonObject = this.singletonObjects.get(beanName);
                if (singletonObject == null) {
                    throw var16;
                }
            } catch (BeanCreationException var17) {
                BeanCreationException ex = var17;
                if (recordSuppressedExceptions) {
                    Iterator var8 = this.suppressedExceptions.iterator();

                    while(var8.hasNext()) {
                        Exception suppressedException = (Exception)var8.next();
                        ex.addRelatedCause(suppressedException);
                    }
                }

                throw ex;
            } finally {
                if (recordSuppressedExceptions) {
                    this.suppressedExceptions = null;
                }

                this.afterSingletonCreation(beanName);
            }

            if (newSingleton) { // 如果是单例加入缓存
                this.addSingleton(beanName, singletonObject);
            }
        }

        return singletonObject;
    }
}
```



#### 3，**为什么多例Bean不能解决循环依赖？**

我们自己手写了解决循环依赖的代码，可以看到，核心是利用一个map，来解决这个问题的，这个map就相当于缓存。为什么可以这么做，因为我们的bean是单例的，而且是字段注入（setter注入）的，单例意味着只需要创建一次对象，后面就可以从缓存中取出来，字段注入，意味着我们无需调用构造方法进行注入。如果是原型bean，那么就意味着每次都要去创建对象，无法利用缓存；如果是构造方法注入，那么就意味着需要调用构造方法注入，也无法利用缓存。

#### 4，**为什么Spring不能解决构造器的循环依赖？**

从流程图应该不难看出来，在Bean调用构造器实例化之前，一二三级缓存并没有Bean的任何相关信息，在实例化之后才放入三级缓存中，因此当getBean的时候缓存并没有命中，这样就抛出了循环依赖的异常了。



#### **5，循环依赖可以关闭吗？**

可以，Spring提供了这个功能，我们需要这么写：

```java
public class Main {
    public static void main(String[] args) {
        AnnotationConfigApplicationContext applicationContext = new AnnotationConfigApplicationContext();
        applicationContext.setAllowCircularReferences(false); // 设置false
        applicationContext.register(AppConfig.class);
        applicationContext.refresh();
    }
}
```



#### **6，如何进行拓展？**

bean可以通过实现SmartInstantiationAwareBeanPostProcessor接口（一般这个接口供spring内部使用）的getEarlyBeanReference方法进行拓展。

#### **7，何时进行拓展？**

进行bean的实例化时

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

getEarlyBeanReference方法：

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

