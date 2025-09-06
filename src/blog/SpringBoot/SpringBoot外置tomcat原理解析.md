---
icon: file-lines
# 标题
title: 'SpringBoot外置tomcat原理解析'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-17
# 一个页面可以有多个分类
category:
  - SpringBoot
# 一个页面可以有多个标签
tag:
  - 常用
  - SpringBoot
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，SpringBoot外置tomcat原理解析

#### 1.1 如何使用外置的tomcat

第一步：修改pom文件：

```xml
<!--打包方式  默认是jar-->
<packaging>war</packaging>
<!--让它不参与打包部署-->
<dependency>
    <artifactId>spring-boot-starter-tomcat</artifactId>
    <groupId>org.springframework.boot</groupId>
    <scope>provided</scope>
</dependency>
```

第二步：编写启动类

```java
public class TomcatStartSpringBoot extends SpringBootServletInitializer {
    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder builder) {
        return builder.sources(Application.class); // Application是springBoot的启动类
    }
}
```

tomcat不可能直接运行Application是springBoot的启动类的Main方法，所以需要编写启动类。

第三步：打包后放在tomcat的webapp文件夹下，或者在idea中配置一个tomcat

#### 1.2  SPI是什么

​	SPI ，全称为 Service Provider Interface(服务提供者接口)，是一种服务发现机制。它通过在ClassPath路径下的META-INF/services文件夹查找文件，自动加载文件里所定义的类。

一个简单的例子：首先定义一个接口`Registry`, 这个接口只有一个功能，就是向注册中心注册一个服务，但是我现在并不确定我选的是什么注册中心，于是提供了一个统一的接口，由各个厂商进行实现：

```java
package top.zouyh.Registry
public interface Registry {
    void  registry(String host, int port);
}
```

厂商实现好后，需要在其`META-INF/services`文件夹下新增一个文件，文件名为该接口的全限定名即：`top.zouyh.Registry`, 内容为接口实现的全限定名，这里我写了两个

```
top.zouyh.spi.EurekaRegistry
top.zouyh.spi.ZookeeperRegistry
```

EurekaRegistry类：

```java
package top.zouyh.spi
public interface EurekaRegistry {
    @Override
    public void registry(String host, int port) {
        System.out.println(this + "registry , host = " + host +"  port = " + port);
    }
}
```

ZookeeperRegistry类：

```java
package top.zouyh.spi
public interface ZookeeperRegistry {
    @Override
    public void registry(String host, int port) {
        System.out.println(this + "registry , host = " + host +"  port = " + port);
    }
}
```

下面编写测试主类，通过 `ServiceLoader` 加载 `Registry` 实现

```java
public class MainTest {
    public static void main(String[] args) {
        ServiceLoader<Registry> load = ServiceLoader.load(Registry.class);
        Iterator<Registry> iterator = load.iterator();
        while (iterator.hasNext()){
            Registry registry = iterator.next();
            registry.registry("127.0.0.1", 10086);
        }
    }
}
```

运行结果:

```
top.zouyh.spi.Eureka Registry@12a3a380registry , host = 127.0.0.1  port = 10086
top.zouyh.spi.Zookeeper Registry@29453f44registry , host = 127.0.0.1  port = 10086
```

#### 1.3 SpringBoot如何实现的

外置tomcat的的启动通过命令就可以启动，但是tomcat是如何去运行SpringApplication的run方法的

servlet3.0 规范官方文档：当servlet容器启动时候 就会去`META-INF/services` 文件夹中找到`javax.servlet.ServletContainerInitializer`文件， 这个文件内容肯定绑定一个ServletContainerInitializer的实现类的全类名，   当servlet容器启动时候，就会去该文件中找到ServletContainerInitializer的实现类，从而创建它的实例调用onstartUp方法。

​	我们查看spring-web的jar包`META-INF/services` 文件夹中找到`javax.servlet.ServletContainerInitializer`文件，文件内容如下图所示：

![image-20230315173950058](http://img.zouyh.top/article-img/20240917135101328.png)

`javax.servlet.ServletContainerInitializer`的实现类是`org.springframework.web.SpringServletContainerInitializer`

```java
@HandlesTypes({WebApplicationInitializer.class})
public class SpringServletContainerInitializer implements ServletContainerInitializer {
    public SpringServletContainerInitializer() {
    }

    public void onStartup(@Nullable Set<Class<?>> webAppInitializerClasses, ServletContext servletContext) throws ServletException {
        List<WebApplicationInitializer> initializers = Collections.emptyList();
        Iterator var4;
        if (webAppInitializerClasses != null) {
            initializers = new ArrayList(webAppInitializerClasses.size());
            var4 = webAppInitializerClasses.iterator();

            while(var4.hasNext()) {
                Class<?> waiClass = (Class)var4.next();
                if (!waiClass.isInterface() && !Modifier.isAbstract(waiClass.getModifiers()) && WebApplicationInitializer.class.isAssignableFrom(waiClass)) {
                    try {
                        ((List)initializers).add((WebApplicationInitializer)ReflectionUtils.accessibleConstructor(waiClass, new Class[0]).newInstance());
                    } catch (Throwable var7) {
                        throw new ServletException("Failed to instantiate WebApplicationInitializer class", var7);
                    }
                }
            }
        }

        if (((List)initializers).isEmpty()) {
            servletContext.log("No Spring WebApplicationInitializer types detected on classpath");
        } else {
            servletContext.log(((List)initializers).size() + " Spring WebApplicationInitializers detected on classpath");
            AnnotationAwareOrderComparator.sort((List)initializers);
            var4 = ((List)initializers).iterator();

            while(var4.hasNext()) {
                WebApplicationInitializer initializer = (WebApplicationInitializer)var4.next();
                initializer.onStartup(servletContext);// 调用
            }

        }
    }
}
```

`@HandlesTypes(WebApplicationInitializer.class)`注解会自动在classpath中找到 WebApplicationInitializer类型的，作为参数赋值给onStartup方法的webAppInitializerClasses中。再看一遍我们在使用外置tomcat的时候会编写一个启动类如下：

```java
public class TomcatStartSpringBoot extends SpringBootServletInitializer {
    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder builder) {
        return builder.sources(Application.class); // Application是springBoot的启动类
    }
}
```

我们编写启动类TomcatStartSpringBoot继承SpringBootServletInitializer，SpringBootServletInitializer类刚好实现了WebApplicationInitializer，所以`@HandlesTypes(WebApplicationInitializer.class)`注解就会将我们编写的TomcatStartSpringBoot赋值到onStartup方法的webAppInitializerClasses参数。我们编写的TomcatStartSpringBoot并没有重写onStartup方法，所以我们看看父类`org.springframework.web.SpringServletContainerInitializer#onStartup`方法：

```java
public void onStartup(@Nullable Set<Class<?>> webAppInitializerClasses, ServletContext servletContext) throws ServletException {
	List<WebApplicationInitializer> initializers = Collections.emptyList();
	Iterator var4;
	if (webAppInitializerClasses != null) {
		initializers = new ArrayList(webAppInitializerClasses.size());
		var4 = webAppInitializerClasses.iterator();

		while(var4.hasNext()) {
			Class<?> waiClass = (Class)var4.next();
            // 如果不是接口不是抽象跟WebApplicationInitializer有关系就会实例化
			if (!waiClass.isInterface() && !Modifier.isAbstract(waiClass.getModifiers()) && WebApplicationInitializer.class.isAssignableFrom(waiClass)) {
				try {
                // 通过反射实例化
		((List)initializers).add((WebApplicationInitializer)ReflectionUtils.accessibleConstructor(waiClass, new Class[0]).newInstance());
				} catch (Throwable var7) {
					throw new ServletException("Failed to instantiate WebApplicationInitializer class", var7);
				}
			}
		}
	}

	if (((List)initializers).isEmpty()) {
		servletContext.log("No Spring WebApplicationInitializer types detected on classpath");
	} else {
		servletContext.log(((List)initializers).size() + " Spring WebApplicationInitializers detected on classpath");
        // 排序
		AnnotationAwareOrderComparator.sort((List)initializers);
		var4 = ((List)initializers).iterator();
		while(var4.hasNext()) {
			WebApplicationInitializer initializer = (WebApplicationInitializer)var4.next();
            // 调用onStartup方法
			initializer.onStartup(servletContext);
		}

	}
}
```

继续跟进`initializer.onStartup(servletContext);`方法：

```java
public void onStartup(ServletContext servletContext) throws ServletException {
	servletContext.setAttribute("logging.register-shutdown-hook", false);
	this.logger = LogFactory.getLog(this.getClass());
    // 创建了一个WebApplicationContext
	WebApplicationContext rootApplicationContext = this.createRootApplicationContext(servletContext);
	if (rootApplicationContext != null) {
        // 添加一个监听器
		servletContext.addListener(new SpringBootServletInitializer.SpringBootContextLoaderListener(rootApplicationContext, servletContext));
	} else {
		this.logger.debug("No ContextLoaderListener registered, as createRootApplicationContext() did not return an application context");
	}

}
```

跟进`this.createRootApplicationContext(servletContext);`方法：

```java
protected WebApplicationContext createRootApplicationContext(ServletContext servletContext) {
	SpringApplicationBuilder builder = this.createSpringApplicationBuilder();
	builder.main(this.getClass());
    // 判断servletContext中是否存在
	ApplicationContext parent = this.getExistingRootWebApplicationContext(servletContext);
	if (parent != null) {
		this.logger.info("Root context already created (using as parent).");
		servletContext.setAttribute(WebApplicationContext.ROOT_WEB_APPLICATION_CONTEXT_ATTRIBUTE, (Object)null);
		builder.initializers(new ApplicationContextInitializer[]{new ParentContextApplicationContextInitializer(parent)});
	}

	builder.initializers(new ApplicationContextInitializer[]{new ServletContextApplicationContextInitializer(servletContext)});
	builder.contextFactory((webApplicationType) -> {
		return new AnnotationConfigServletWebServerApplicationContext();
	});
     // 标记①，调用configure，我们编写的TomcatStartSpringBoot重写了configure方法，通过该方法将springBoot的启动类传进去
	builder = this.configure(builder);
	builder.listeners(new ApplicationListener[]{new SpringBootServletInitializer.WebEnvironmentPropertySourceInitializer(servletContext)});
    // 根据传入的Springboot启动类来构建一个SpringApplication 
	SpringApplication application = builder.build();
	if (application.getAllSources().isEmpty() && MergedAnnotations.from(this.getClass(), SearchStrategy.TYPE_HIERARCHY).isPresent(Configuration.class)) {
		application.addPrimarySources(Collections.singleton(this.getClass()));
	}

	Assert.state(!application.getAllSources().isEmpty(), "No SpringApplication sources have been defined. Either override the configure method or add an @Configuration annotation");
	if (this.registerErrorPageFilter) {
		application.addPrimarySources(Collections.singleton(ErrorPageFilterConfiguration.class));
	}

	application.setRegisterShutdownHook(false);
	return this.run(application); // 标记②，启动
}
```

在上面的源码中调用了`builder = this.configure(builder);`方法，我们编写的启动类TomcatStartSpringBoot重写了SpringBootServletInitializer的configure方法，所以这个builder是启动了返回的，再看一下启动类TomcatStartSpringBoot的代码：

```java
public class TomcatStartSpringBoot extends SpringBootServletInitializer {
    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder builder) {
        return builder.sources(Application.class); // Application是springBoot的启动类
    }
}
```

根据传入的Springboot启动类来构建一个SpringApplication，查看`SpringApplication application = builder.build();`方法：

```java
public SpringApplication build(String... args) {
	this.configureAsChildIfNecessary(args);
	this.application.addPrimarySources(this.sources); // sources是在启动类TomcatStartSpringBoot中添加的
	return this.application;
}
```

标记②，启动调用`this.run(application); `

```java
protected WebApplicationContext run(SpringApplication application) {
   return (WebApplicationContext) application.run();
}
```

相当于：

```java
public static void main(String[] args) {
    SpringApplication.run(Application.class, args);
}
```

调用了run方法后，就不说了基本上和内嵌的tomcat差不多，不一样的是，内嵌的tomcat创建dispacherServlet是通过自动装配的方式，外置的tomcat是没有引入tomcat的相关jar包的，是无法实现自动注入的，外置的tomcat是使用SPI的方式，通过AbstractContextLoaderInitializer和AbstractDispatcherServletInitializer。

<img src="http://img.zouyh.top/article-img/20240917135100327.png" alt="image-20230316101204674" style="zoom: 67%;" />

AbstractContextLoaderInitializer简单看一下：

```java
public abstract class AbstractContextLoaderInitializer implements WebApplicationInitializer {
    public void onStartup(ServletContext servletContext) throws ServletException {
        this.registerContextLoaderListener(servletContext); // 注册一个ContextLoaderListener
    }

    protected void registerContextLoaderListener(ServletContext servletContext) {
        WebApplicationContext rootAppContext = this.createRootApplicationContext();
        if (rootAppContext != null) {
            // 创建了ContextLoaderListener通过Spring的上下文有构造
            ContextLoaderListener listener = new ContextLoaderListener(rootAppContext);
            listener.setContextInitializers(this.getRootApplicationContextInitializers());
            servletContext.addListener(listener); // 添加listener
        } else {
            this.logger.debug("No ContextLoaderListener registered, as createRootApplicationContext() did not return an application context");
        }

    }
    // .....
}
```

AbstractDispatcherServletInitializer简单看一下：

```java
public abstract class AbstractDispatcherServletInitializer extends AbstractContextLoaderInitializer {
    public void onStartup(ServletContext servletContext) throws ServletException {
        super.onStartup(servletContext); // 就是上面刚说的AbstractContextLoaderInitializer
        this.registerDispatcherServlet(servletContext); // 注册一个DispatcherServlet
    }

    protected void registerDispatcherServlet(ServletContext servletContext) {
        String servletName = this.getServletName(); // servletName
        Assert.hasLength(servletName, "getServletName() must not return null or empty");
        WebApplicationContext servletAppContext = this.createServletApplicationContext();
        Assert.notNull(servletAppContext, "createServletApplicationContext() must not return null");
        FrameworkServlet dispatcherServlet = this.createDispatcherServlet(servletAppContext);
        Assert.notNull(dispatcherServlet, "createDispatcherServlet(WebApplicationContext) must not return null");
        dispatcherServlet.setContextInitializers(this.getServletApplicationContextInitializers());
        Dynamic registration = servletContext.addServlet(servletName, dispatcherServlet); // 添加
        if (registration == null) {
            throw new IllegalStateException("Failed to register servlet with name '" + servletName + "'. Check if there is another servlet registered under the same name.");
        } else {
            registration.setLoadOnStartup(1);
            registration.addMapping(this.getServletMappings()); // 添加映射
            registration.setAsyncSupported(this.isAsyncSupported());
            Filter[] filters = this.getServletFilters();
            if (!ObjectUtils.isEmpty(filters)) {
                Filter[] var7 = filters;
                int var8 = filters.length;
                for(int var9 = 0; var9 < var8; ++var9) {
                    Filter filter = var7[var9];
                    this.registerServletFilter(servletContext, filter);
                }
            }
            this.customizeRegistration(registration);
        }
    }
    // ........
}
```

