---
icon: file-lines
# 标题
title: 'dubbo中的spi机制'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-26
# 一个页面可以有多个分类
category:
  - Dubbo
# 一个页面可以有多个标签
tag:
  - 基础
  - Dubbo
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，spi是什么？

![img](http://img.zouyh.top/article-img/20240917135120387.png)

SPI（Service Provider Interface）是JDK内置的一种服务提供发现机制，可以用来启用框架扩展和替换组件，主要是被框架的开发人员使用。当服务的提供者提供了一种接口的实现之后，需要在classpath下的`META-INF/services/`目录里创建一个以服务接口命名的文件，这个文件里的内容就是这个接口的具体的实现类。

#### 1.1 java的spi入门案例

首先，我们定义一个接口，名称为 `Car`。

```java
public interface Protocol {
    String getProtocolName();
}
```

接下来定义两个实现类，分别为 `BlackCar` 和 `RedCar`。

```java
public class HttpProtocol implements Protocol {
    @Override
    public String getProtocolName() {
        return "HttpProtocol";
    }
}


public class NettyProtocol implements Protocol {
    @Override
    public String getProtocolName() {
        return "NettyProtocol";
    }
}
```

接下来 META-INF/services 文件夹下创建一个文件,名称为 `Protocol`的全限定名` top.zouyh.spi.Protocol`,文件内容为实现类的全限定的类名，如下：

```java
top.zouyh.spi.imp.HttpProtocol
top.zouyh.spi.imp.NettyProtocol
```

做好所需的准备工作，接下来编写代码进行测试：

```java
public class JavaSPITest {
    @Test
    public void getProtocolName() throws Exception {
       ServiceLoader<Protocol> protocols = ServiceLoader.load(Protocol.class);
        for (Protocol protocol : protocols) {
            System.out.println(protocol.getProtocolName());
        }
    }
}
```

看测试结果：

```java
HttpProtocol
NettyProtocol
```

从测试结果可以看出，我们的两个实现类被成功的加载，并输出了相应的内容。



**优点：**使用 Java SPI 机制的优势是实现解耦，使得接口的定义与具体业务实现分离，而不是耦合在一起。应用进程可以根据实际业务情况启用或替换具体组件。

**缺点：**

- 不能按需加载。虽然 `ServiceLoader` 做了延迟载入，但是基本只能通过遍历全部获取，也就是接口的实现类得全部载入并实例化一遍。如果你并不想用某些实现类，或者某些类实例化很耗时，它也被载入并实例化了，这就造成了浪费。
- 获取某个实现类的方式不够灵活，只能通过 遍历的方式形式获取，不能根据某个参数来获取对应的实现类。
- 多个并发多线程使用 ServiceLoader 类的实例是不安全的。

### 二，什么是dubbo的spi机制？

针对于java的spi的缺点，Dubbo 并未使用 Java SPI，而是重新实现了一套功能更强的 SPI 机制。Dubbo SPI 的相关逻辑被封装在了 ExtensionLoader 类中，通过 ExtensionLoader，我们可以加载指定的实现类

#### 2.1 dubbo的spi入门案例

接口和接口的实现类的代码和java的spi入门案例一致，更改spi文件和测试类。

更该META-INF/services 文件夹下名称为 `Protocol`的全限定名`top.zouyh.spi.Protocol`,文件内容下：

```java
http=top.zouyh.spi.imp.HttpProtocol
netty=top.zouyh.spi.imp.NettyProtocol
```

测试类如下：

```java
public class DubboSPITest {
    @Test
    public void getProtocolName() throws Exception {
       ExtensionLoader<Protocol> extensionLoader = ExtensionLoader.getExtensionLoader(Protocol.class);
       Protocol protocol = extensionLoader.getExtension("http");
       System.out.println(protocol);
    }
}
```

#### 2.2 源码解析

上面简单演示了 Dubbo SPI 的使用方法，首先通过 ExtensionLoader 的 getExtensionLoader 方法获取一个 ExtensionLoader 实例，然后再通过 ExtensionLoader 的 getExtension 方法获取拓展类对象。下面我们从 ExtensionLoader 的 getExtension 方法作为入口，对拓展类对象的获取过程进行详细的分析：

```java
@SuppressWarnings("unchecked")
    public T getExtension(String name) {
        if (StringUtils.isEmpty(name)) {
            throw new IllegalArgumentException("Extension name == null");
        }
        // 获取默认扩展类
        if ("true".equals(name)) {
            return getDefaultExtension();
        }
        final Holder<Object> holder = getOrCreateHolder(name); // 获取对应的持有人
        Object instance = holder.get();
        // 如果有两个线程同时来获取同一个name的扩展点对象，那只会有一个线程会进行创建
        if (instance == null) {
            synchronized (holder) { // 一个name对应一把锁
                instance = holder.get();
                if (instance == null) {
                    // 创建扩展点实例对象
                    instance = createExtension(name);   // 创建扩展点对象
                    holder.set(instance);
                }
            }
        }
        return (T) instance;
    }
```

上面代码的逻辑比较简单，首先检查对应的持有人是否有缓存，缓存未命中则创建拓展对象`createExtension(name)`。这里可能会有人有疑问，为什么通过name获取持有人，而不是直接获取对应的实例，你可以这样考虑，synchronized加锁需要一个对象，如果对应的实例还没有成功创建，那么通过name获取的对象就是null了，所以需要持有人holder来加锁。好了下面我们来看一下创建拓展对象的过程是怎样的:

```java
@SuppressWarnings("unchecked")
    private T createExtension(String name) {
        // 标记①，从配置文件中加载所有的拓展类，可得到“配置项名称”到“配置类”的映射关系表{name: Class}  key-Value
        Class<?> clazz = getExtensionClasses().get(name);
        if (clazz == null) {
            throw findException(name);
        }
        try {
            // 获取实例缓存
            T instance = (T) EXTENSION_INSTANCES.get(clazz);
            if (instance == null) {
                // 存入EXTENSION_INSTANCES是ConcurrentMap中
                EXTENSION_INSTANCES.putIfAbsent(clazz, clazz.newInstance());
                instance = (T) EXTENSION_INSTANCES.get(clazz);
            }

            // 依赖注入 IOC
            injectExtension(instance);

            // 标记④，AOP，拓展对象包裹在相应的 Wrapper 对象中
            Set<Class<?>> wrapperClasses = cachedWrapperClasses;
            if (CollectionUtils.isNotEmpty(wrapperClasses)) {
                for (Class<?> wrapperClass : wrapperClasses) {
                    // 将当前 instance 作为参数传给 Wrapper 的构造方法，并通过反射创建 Wrapper 实例。
                   // 然后向 Wrapper 实例中注入依赖，最后将 Wrapper 实例再次赋值给 instance 变量
                    instance = injectExtension((T) wrapperClass.getConstructor(type).newInstance(instance));
                }
            }

            return instance;
        } catch (Throwable t) {
            throw new IllegalStateException("Extension instance (name: " + name + ", class: " +
                    type + ") couldn't be instantiated: " + t.getMessage(), t);
        }
    }
```

createExtension 方法的逻辑稍复杂一下，包含了如下的步骤：

标记①：通过 getExtensionClasses 获取所有的拓展类。

标记②：向拓展对象中注入依赖-IOC。

标记③：将拓展对象包裹在相应的 Wrapper 对象中-AOP。

下面我逐步解析标记点。

##### 标记①：通过 getExtensionClasses 获取所有的拓展类。

```java
  private Map<String, Class<?>> getExtensionClasses() {
        // cachedClasses是一个Holder对象，持有的就是一个Map<String, Class<?>>
        // 为什么要多此一举，也是为了解决并发，Holder对象用来作为锁
        Map<String, Class<?>> classes = cachedClasses.get();
        if (classes == null) {
            synchronized (cachedClasses) {
                classes = cachedClasses.get();
                if (classes == null) {
                    classes = loadExtensionClasses(); // 加载、解析文件 Map
                    cachedClasses.set(classes);
                }
            }
        }
        return classes;
    }
```

继续跟进`loadExtensionClasses();`方法：

```java
private Map<String, Class<?>> loadExtensionClasses() {
        // 小点①，cache接口默认的扩展类
        cacheDefaultExtensionName();
        // 解析的结果存储在extensionClasses中
        Map<String, Class<?>> extensionClasses = new HashMap<>();
        // 小点②，loadDirectory方法解析文件
    	// DUBBO_INTERNAL_DIRECTORY = META-INF/dubbo/internal/
        loadDirectory(extensionClasses, DUBBO_INTERNAL_DIRECTORY, type.getName());
    
        loadDirectory(extensionClasses, DUBBO_INTERNAL_DIRECTORY, type.getName().replace("org.apache", "com.alibaba"));
        loadDirectory(extensionClasses, DUBBO_DIRECTORY, type.getName());
        loadDirectory(extensionClasses, DUBBO_DIRECTORY, type.getName().replace("org.apache", "com.alibaba"));
        loadDirectory(extensionClasses, SERVICES_DIRECTORY, type.getName());
        loadDirectory(extensionClasses, SERVICES_DIRECTORY, type.getName().replace("org.apache", "com.alibaba"));
        return extensionClasses;
    }
```

跟进小点①，cache接口默认的扩展类的`cacheDefaultExtensionName();`方法

```java
  private void cacheDefaultExtensionName() {
      	// 标有spi注解的
        final SPI defaultAnnotation = type.getAnnotation(SPI.class);
        if (defaultAnnotation == null) {
            return;
        }
        // 获取注解的默认值
        String value = defaultAnnotation.value();
        if ((value = value.trim()).length() > 0) {
            // 根据","作为分割符
            String[] names = NAME_SEPARATOR.split(value);
            if (names.length > 1) { // 多个抛异常
                throw new IllegalStateException("More than 1 default extension name on extension " + type.getName()
                        + ": " + Arrays.toString(names));
            }
            if (names.length == 1) { // 一个就是cachedDefaultName
                cachedDefaultName = names[0];
            }
        }
    }
```

小点②，loadDirectory方法解析文件，跟进loadDirectory方法：

```java
private void loadDirectory(Map<String, Class<?>> extensionClasses, String dir, String type) {
        String fileName = dir + type;
        try {
            // 根据文件中的内容得到urls， 每个url表示一个扩展 http=org.apache.dubbo.rpc.protocol.http.HttpProtocol
            Enumeration<java.net.URL> urls;
            // 获取类加载器
            ClassLoader classLoader = findClassLoader();
            if (classLoader != null) {
                urls = classLoader.getResources(fileName);
            } else {
                urls = ClassLoader.getSystemResources(fileName);
            }
            if (urls != null) {
                while (urls.hasMoreElements()) {
                    java.net.URL resourceURL = urls.nextElement();
                    // 遍历url进行加载,把扩展类添加到extensionClasses中
                    loadResource(extensionClasses, classLoader, resourceURL);
                }
            }
        } catch (Throwable t) {
            logger.error("Exception occurred when loading extension class (interface: " +
                    type + ", description file: " + fileName + ").", t);
        }
    }
```

继续跟进`loadResource(extensionClasses, classLoader, resourceURL);`方法：

```java
 private void loadResource(Map<String, Class<?>> extensionClasses, ClassLoader classLoader, java.net.URL resourceURL) {
        try {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(resourceURL.openStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) { // 一行一行的读文件
                    final int ci = line.indexOf('#');
                    if (ci >= 0) {
                        line = line.substring(0, ci);
                    }
                    line = line.trim();
                    if (line.length() > 0) {
                        try {
                            String name = null;
                            int i = line.indexOf('='); // 获取=对应的下标
                            if (i > 0) {
                                name = line.substring(0, i).trim(); // 等号前面的作为key
                                line = line.substring(i + 1).trim(); // 等号后面的作为值
                            }
                            if (line.length() > 0) {
                                // 加载类，并添加到extensionClasses中，forName反射创建实例，注意这里已经创建实例了
                                loadClass(extensionClasses, resourceURL, Class.forName(line, true, classLoader), name);
                            }
                        } catch (Throwable t) {
                            IllegalStateException e = new IllegalStateException("Failed to load extension class (interface: " + type + ", class line: " + line + ") in " + resourceURL + ", cause: " + t.getMessage(), t);
                            exceptions.put(line, e);
                        }
                    }
                }
            }
        } catch (Throwable t) {
            logger.error("Exception occurred when loading extension class (interface: " +
                    type + ", class file: " + resourceURL + ") in " + resourceURL, t);
        }
    }
```

 跟进`loadClass(extensionClasses, resourceURL, Class.forName(line, true, classLoader),name);`方法，加载类，并添加到extensionClasses中：

```java
private void loadClass(Map<String, Class<?>> extensionClasses, java.net.URL resourceURL, Class<?> clazz, String name) throws NoSuchMethodException {
        if (!type.isAssignableFrom(clazz)) {
            throw new IllegalStateException("Error occurred when loading extension class (interface: " +
                    type + ", class line: " + clazz.getName() + "), class "
                    + clazz.getName() + " is not subtype of interface.");
        }
        // 当前接口手动指定了Adaptive类
        if (clazz.isAnnotationPresent(Adaptive.class)) {
            cacheAdaptiveClass(clazz);
        } else if (isWrapperClass(clazz)) { // 判断为包装类的约定是该类必须有一个构造函数，且参数为该扩展类
            cacheWrapperClass(clazz);// 保存在cachedWrapperClasses类中
        } else {
            // 需要有无参的构造方法
            clazz.getConstructor();
            // 在文件中没有name，但是在类上指定了Extension的注解上指定了name
            if (StringUtils.isEmpty(name)) {
                name = findAnnotationName(clazz);
                if (name.length() == 0) {
                    throw new IllegalStateException("No such extension name for the class " + clazz.getName() + " in the config " + resourceURL);
                }
            }
            // 根据","分割
            String[] names = NAME_SEPARATOR.split(name);
            if (ArrayUtils.isNotEmpty(names)) {
                // 缓存一下被Activate注解了的类
                cacheActivateClass(clazz, names[0]);
                // 有多个名字
                for (String n : names) {
                    // clazz: name
                    cacheName(clazz, n);
                    // 最终保存在extensionClasses中
                    saveInExtensionClass(extensionClasses, clazz, n);
                }
            }
        }
    }
```

跟进`saveInExtensionClass(extensionClasses, clazz, n);`方法，最终保存在extensionClasses中

```java
 private void saveInExtensionClass(Map<String, Class<?>> extensionClasses, Class<?> clazz, String name) {
        Class<?> c = extensionClasses.get(name);
        if (c == null) {
            // 存储在map中
            extensionClasses.put(name, clazz);
        } else if (c != clazz) {
            String duplicateMsg = "Duplicate extension " + type.getName() + " name " + name + " on " + c.getName() + " and " + clazz.getName();
            logger.error(duplicateMsg);
            throw new IllegalStateException(duplicateMsg);
        }
    }
```

##### 标记②：向拓展对象中注入依赖-IOC

看`injectExtension(instance);`方法

```java
 private T injectExtension(T instance) {
        if (objectFactory == null) {
            return instance;
        }
        try {
            for (Method method : instance.getClass().getMethods()) {
                if (!isSetter(method)) {
                    continue;
                }

                // 利用set方法注入
                /**
                 * 如果方法上存在DisableInject注解不需要需要对此属性进行自动注入
                 */
                if (method.getAnnotation(DisableInject.class) != null) {
                    continue;
                }

                // set方法中的参数类型
                Class<?> pt = method.getParameterTypes()[0]; 
                if (ReflectUtils.isPrimitives(pt)) {
                    continue;
                }

                try {
                    // 得到setXxx中的xxx
                    String property = getSetterProperty(method);   // person
                    // 根据参数类型或属性名，从objectFactory中获取到对象，然后调用set方法进行注入
                    // AdaptiveExtensionFactory
                    Object object = objectFactory.getExtension(pt, property); 
                    if (object != null) {
                        method.invoke(instance, object);
                    }
                } catch (Exception e) {
                    logger.error("Failed to inject via method " + method.getName()
                            + " of interface " + type.getName() + ": " + e.getMessage(), e);
                }

            }
        } catch (Exception e) {
            logger.error(e.getMessage(), e);
        }
        return instance;
    }
```

核心是`Object object = objectFactory.getExtension(pt, property); `方法，该方法有如下实现

![img](http://img.zouyh.top/article-img/20240917135121388.png)

我们应该选择那个实现呢？我们这里选择AdaptiveExtensionFactory，为什么？这里选择AdaptiveExtensionFactory，为什我们后面说，先看AdaptiveExtensionFactory的源码如下

```java
@Adaptive
public class AdaptiveExtensionFactory implements ExtensionFactory {

    private final List<ExtensionFactory> factories;

    public AdaptiveExtensionFactory() {
        // 支持哪些ExtensionFactory (Spi, SPring)
        ExtensionLoader<ExtensionFactory> loader = ExtensionLoader.getExtensionLoader(ExtensionFactory.class);

        List<ExtensionFactory> list = new ArrayList<ExtensionFactory>();

        for (String name : loader.getSupportedExtensions()) { // spi, spring
            list.add(loader.getExtension(name));
        }
        factories = Collections.unmodifiableList(list);
    }

    @Override
    public <T> T getExtension(Class<T> type, String name) {
        // 遍历两个ExtensionFactory，从ExtensionFactory中得到实例，只要从某个ExtensionFactory中获取到对象实例就可以了
        for (ExtensionFactory factory : factories) {
            T extension = factory.getExtension(type, name);  // SpringExtensionFactory, SpiExtensionFactory
            if (extension != null) {
                return extension;
            }
        }
        return null;
    }

}
```

SpringExtensionFactory的getExtension方法：

```java
public <T> T getExtension(Class<T> type, String name) {

        //SPI should be get from SpiExtensionFactory
        // 如果接口上存在SPI注解，就不从spring中获取对象实例了
        if (type.isInterface() && type.isAnnotationPresent(SPI.class)) {
            return null;
        }

        // 从ApplicationContext中获取bean, byname
        for (ApplicationContext context : CONTEXTS) {
            if (context.containsBean(name)) {
                Object bean = context.getBean(name);
                if (type.isInstance(bean)) {
                    return (T) bean;
                }
            }
        }

        logger.warn("No spring extension (bean) named:" + name + ", try to find an extension (bean) of type " + type.getName());
        if (Object.class == type) {
            return null;
        }

        // byType
        for (ApplicationContext context : CONTEXTS) {
            try {
                return context.getBean(type);
            } catch (NoUniqueBeanDefinitionException multiBeanExe) {
                logger.warn("Find more than 1 spring extensions (beans) of type " + type.getName() + ", will stop auto injection. Please make sure you have specified the concrete parameter type and there's only one extension of that type.");
            } catch (NoSuchBeanDefinitionException noBeanExe) {
                if (logger.isDebugEnabled()) {
                    logger.debug("Error when get spring extension(bean) for type:" + type.getName(), noBeanExe);
                }
            }
        }
        logger.warn("No spring extension (bean) named:" + name + ", type:" + type.getName() + " found, stop get bean.");
        return null;
    }
```

SpiExtensionFactory的getExtension方法：

```java
public class SpiExtensionFactory implements ExtensionFactory {
    @Override
    public <T> T getExtension(Class<T> type, String name) {
        // 接口上存在SPI注解
        if (type.isInterface() && type.isAnnotationPresent(SPI.class)) {
            ExtensionLoader<T> loader = ExtensionLoader.getExtensionLoader(type);
            if (!loader.getSupportedExtensions().isEmpty()) {
                return loader.getAdaptiveExtension(); // 接口的Adaptive类（代理对象）
            }
        }
        return null;
    }

}
```

好的，我们从上面就可以发现，依赖注入的方式：先从spring中取依赖的对象，如果接口上存在SPI注解，就不从spring中获取对象实例了，然后通过SpiExtensionFactory获取对象。

##### 标记③，将拓展对象包裹在相应的 Wrapper 对象中-AOP

什么是wapper类？答：判断为包装类的约定是该类必须有一个构造函数，且参数为该扩展类，如下：

```java
public class PayWrapper implements Pay{
    private Pay pay;
    public PayWrapper(Pay pay) {
        this.pay = pay;
    }
    @Override
    public void pay(URL url) {
        System.out.println("pay before...");
        pay.pay(url);
        System.out.println("pay after...");
    }
}
```

好了，知道什么是wapper类了，继续看如何使用Aop的

```java
// 标记④，AOP，拓展对象包裹在相应的 Wrapper 对象中
Set<Class<?>> wrapperClasses = cachedWrapperClasses;
if (CollectionUtils.isNotEmpty(wrapperClasses)) {
    for (Class<?> wrapperClass : wrapperClasses) {
        // 将当前 instance 作为参数传给 Wrapper 的构造方法，并通过反射创建 Wrapper 实例。
       // 然后向 Wrapper 实例中注入依赖，最后将 Wrapper 实例再次赋值给 instance 变量
        instance = injectExtension((T) wrapperClass.getConstructor(type).newInstance(instance));
    }
}
```

由上代码可知，通过遍历的方式+装饰者模式进行增强的。

#### 2.3 获取自适应拓展类

前面我们留了一个疑问，`Object object = objectFactory.getExtension(pt, property); `方法，该方法有如下实现：

![img](http://img.zouyh.top/article-img/20240917135121388.png)

我们这里选择为什么AdaptiveExtensionFactory，我们看一下objectFactory是什么？objectFactory是ExtensionLoader的成员变量`private final ExtensionFactory objectFactory;`成员变量的赋值如下：

```java
private ExtensionLoader(Class<?> type) {
        this.type = type;
        // objectFactory表示当前ExtensionLoader内部的一个对象工厂，可以用来获取对象  AdaptiveExtensionFactory
        objectFactory = (type == ExtensionFactory.class ? null : ExtensionLoader.getExtensionLoader(ExtensionFactory.class).getAdaptiveExtension());
    }
```

你们有没有发现，选择为什么AdaptiveExtensionFactory和依赖注入中通过SpiExtensionFactory获取对象如下代码：

```java
public class SpiExtensionFactory implements ExtensionFactory {
    @Override
    public <T> T getExtension(Class<T> type, String name) {
        // 接口上存在SPI注解
        if (type.isInterface() && type.isAnnotationPresent(SPI.class)) {
            ExtensionLoader<T> loader = ExtensionLoader.getExtensionLoader(type);
            if (!loader.getSupportedExtensions().isEmpty()) {
                return loader.getAdaptiveExtension(); // 接口的Adaptive类（代理对象）
            }
        }
        return null;
    }

}
```

都会使用到`ExtensionLoader.getExtensionLoader(Class<T> type).getAdaptiveExtension()`方法,getAdaptiveExtension方法到底做了什么？

```java
public T getAdaptiveExtension() {
    // 获取缓存的Adaptive即获取又@Adaptive注解的，这里解释了为什么AdaptiveExtensionFactory
    Object instance = cachedAdaptiveInstance.get();
    if (instance == null) {
        if (createAdaptiveInstanceError != null) {
            throw new IllegalStateException("Failed to create adaptive instance: " +
                    createAdaptiveInstanceError.toString(),
                    createAdaptiveInstanceError);
        }
	// cachedAdaptiveInstance是缓存对象的持有者
        synchronized (cachedAdaptiveInstance) {
            instance = cachedAdaptiveInstance.get();
            if (instance == null) {
                try {
                    // 创建对象
                    instance = createAdaptiveExtension();
                    cachedAdaptiveInstance.set(instance);
                } catch (Throwable t) {
                    createAdaptiveInstanceError = t;
                    throw new IllegalStateException("Failed to create adaptive instance: " + t.toString(), t);
                }
            }
        }
    }

    return (T) instance;
}
```

由上代码可知，继续跟进`createAdaptiveExtension();`方法：

```java
private T createAdaptiveExtension() {
    try {
        // injectExtension方法递归调用为生成的对象也进行属性注入
        // getAdaptiveExtensionClass方法获取类
        // newInstance方法反射创建实例
        return injectExtension((T) getAdaptiveExtensionClass().newInstance());
    } catch (Exception e) {
        throw new IllegalStateException("Can't create adaptive extension " + type + ", cause: " + e.getMessage(), e);
    }
}
```

继续跟进getAdaptiveExtensionClass方法：

```java
  private Class<?> getAdaptiveExtensionClass() {
    // 获取当前接口的所有扩展类
    getExtensionClasses();
    // 缓存了@Adaptive注解标记的类
    if (cachedAdaptiveClass != null) {
        return cachedAdaptiveClass;
    }
    // 如果某个接口没有手动指定一个Adaptive类，那么就自动生成一个Adaptive类
    return cachedAdaptiveClass = createAdaptiveExtensionClass();
}
```

继续跟进`createAdaptiveExtensionClass()`方法： 

```java
 private Class<?> createAdaptiveExtensionClass() {
    // cachedDefaultName表示接口默认的扩展类
    // code就是生成的代码
    String code = new AdaptiveClassCodeGenerator(type, cachedDefaultName).generate();
	
    ClassLoader classLoader = findClassLoader();
    org.apache.dubbo.common.compiler.Compiler compiler = ExtensionLoader.getExtensionLoader(org.apache.dubbo.common.compiler.Compiler.class).getAdaptiveExtension();
    // 根据代码，通过编译器生成类
     return compiler.compile(code, classLoader);
}
```

代理逻辑就是在`**new** AdaptiveClassCodeGenerator(**type**, **cachedDefaultName**).generate()`方法，type就是接口，cacheDefaultName就是该接口默认的扩展点实现的名字，`@Spi`注解对应的name。
看个例子，Protocol接口的Adaptive类：

```java
package org.apache.dubbo.rpc;
import org.apache.dubbo.common.extension.ExtensionLoader;
public class Protocol$Adaptive implements org.apache.dubbo.rpc.Protocol {
	public void destroy()  {
		throw new UnsupportedOperationException("The method public abstract void org.apache.dubbo.rpc.Protocol.destroy() of interface org.apache.dubbo.rpc.Protocol is not adaptive method!");
	}
    public int getDefaultPort()  {
		throw new UnsupportedOperationException("The method public abstract int org.apache.dubbo.rpc.Protocol.getDefaultPort() of interface org.apache.dubbo.rpc.Protocol is not adaptive method!");
	}
    
	public org.apache.dubbo.rpc.Exporter export(org.apache.dubbo.rpc.Invoker arg0) throws org.apache.dubbo.rpc.RpcException {
		if (arg0 == null) 
            throw new IllegalArgumentException("org.apache.dubbo.rpc.Invoker argument == null");
		if (arg0.getUrl() == null) 
            throw new IllegalArgumentException("org.apache.dubbo.rpc.Invoker argument getUrl() == null");
		
        org.apache.dubbo.common.URL url = arg0.getUrl();
		
        String extName = ( url.getProtocol() == null ? "dubbo" : url.getProtocol() );

        if(extName == null) 
            throw new IllegalStateException("Failed to get extension (org.apache.dubbo.rpc.Protocol) name from url (" + url.toString() + ") use keys([protocol])");
        
        org.apache.dubbo.rpc.Protocol extension = (org.apache.dubbo.rpc.Protocol)ExtensionLoader.getExtensionLoader(org.apache.dubbo.rpc.Protocol.class).getExtension(extName);
 		
        return extension.export(arg0);
	}

    public org.apache.dubbo.rpc.Invoker refer(java.lang.Class arg0, org.apache.dubbo.common.URL arg1) throws org.apache.dubbo.rpc.RpcException {

        if (arg1 == null) throw new IllegalArgumentException("url == null");

        org.apache.dubbo.common.URL url = arg1;

        String extName = ( url.getProtocol() == null ? "dubbo" : url.getProtocol() );

        if(extName == null) throw new IllegalStateException("Failed to get extension (org.apache.dubbo.rpc.Protocol) name from url (" + url.toString() + ") use keys([protocol])");

        org.apache.dubbo.rpc.Protocol extension = (org.apache.dubbo.rpc.Protocol)ExtensionLoader.getExtensionLoader(org.apache.dubbo.rpc.Protocol.class).getExtension(extName);

        return extension.refer(arg0, arg1);
	}
}
```

可以看到，Protocol接口中有四个方法，但是只有export和refer两个方法进行代理。为什么？因为Protocol接口中在export方法和refer方法上加了@Adaptive注解，不是只要在方法上加了@Adaptive注解就可以进行代理，还有其他条件，比如：

1. 该方法如果是无参的，那么则会报错
2. 该方法有参数，可以有多个，并且其中某个参数类型是URL，那么则可以进行代理
3. 该方法有参数，可以有多个，但是没有URL类型的参数，那么则不能进行代理
4. 该方法有参数，可以有多个，没有URL类型的参数，但是如果这些参数类型，对应的类中存在getUrl方法（返回值类型为URL），那么也可以进行代理

所以，可以发现，某个接口的Adaptive对象，在调用某个方法时，是通过该方法中的URL参数，通过调用`ExtensionLoader.getExtensionLoader(com.luban.Car.class).getExtension(extName);`得到一个扩展点实例，然后调用该实例对应的方法。



上文说到，每个扩展点都有一个name，通过这个name可以获得该name对应的扩展点实例，但是有的场景下，希望一次性获得多个扩展点实例，例如：

```java
ExtensionLoader<Filter> extensionLoader = ExtensionLoader.getExtensionLoader(Filter.class);
URL url = new URL("http://", "localhost", 8080);
url = url.addParameter("cache", "test");

List<Filter> activateExtensions = extensionLoader.getActivateExtension(url, 
                                                      new String[]{"validation"},
                                                      CommonConstants.CONSUMER);
for (Filter activateExtension : activateExtensions) {
	System.out.println(activateExtension);
}
```

会找到5个Filter：

```java
org.apache.dubbo.rpc.filter.ConsumerContextFilter@4566e5bd
org.apache.dubbo.rpc.protocol.dubbo.filter.FutureFilter@1ed4004b
org.apache.dubbo.monitor.support.MonitorFilter@ff5b51f
org.apache.dubbo.cache.filter.CacheFilter@25bbe1b6
org.apache.dubbo.validation.filter.ValidationFilter@5702b3b1
```

- 前三个是通过CommonConstants.CONSUMER找到的
- CacheFilter是通过url中的参数找到的
- ValidationFilter是通过指定的name找到的

在一个扩展点类上，可以添加@Activate注解，这个注解的属性有：

1. `String[] group()`：表示这个扩展点是属于哪组的，这里组通常分为PROVIDER和CONSUMER，表示该扩展点能在服务提供者端，或者消费端使用
2. `String[] value()`：表示的是URL中的某个参数key，当利用getActivateExtension方法来寻找扩展点时，如果传入的url中包含的参数的所有key中，包括了当前扩展点中的value值，那么则表示当前url可以使用该扩展点。
