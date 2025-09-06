---
icon: file-lines
# 标题
title: 'SpringBoot内嵌tomcat原理解析'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-08
# 一个页面可以有多个分类
category:
  - SpringBoot
# 一个页面可以有多个标签
tag:
  - 进阶
  - SpringBoot
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，SpringBoot内嵌tomcat原理解析

#### 1.1 测试案例

在看内嵌tomcat的创建启动流程方法之前，先简单的介绍一下内嵌的tomcat，SpringBoot创建web应用时要引入`spring-boot-starter-web`，而`spring-boot-starter-web`这个依赖引入了tomcat依赖，SpringBoot自动装配的方式加载，使其它应用程序能够非常方便的将Tomcat嵌入到自身的应用来。

<img src="http://img.zouyh.top/article-img/20240917135059324.png" alt="image-20230315143608936" style="zoom:80%;" />

下面是从网络上找的一个自身的程序嵌入如何实现嵌入式Tomcat，达到和Springboot类似的效果：

第一步，新建一个maven项目，引入如下依赖：

```xml
<dependency>
  <groupId>org.apache.tomcat.maven</groupId>
  <artifactId>tomcat7-maven-plugin</artifactId>
  <version>2.2</version>
</dependency>
```

第二步，创建一个servlet提供服务：

```java
public class TestServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse response) throws ServletException, IOException {
        response.setContentType("text/html");
        response.setCharacterEncoding("UTF-8");
        PrintWriter out = response.getWriter();
        out.println("<h1>嵌入式tomcat</h1>");
    }
}
```

第三步，定义一个TestApplication类，主程序执行入口：

```java
public class TestApplication {
    public static void main(String[] args) throws LifecycleException {
        Tomcat tomcat = new Tomcat(); // 创建一个tomcat
        tomcat.setPort(8085);
        tomcat.setHostname("localhost");
        String classpath = System.getProperty("user.dir");//把目录的绝对的路径获取到
        tomcat.addContext( "/", classpath);
        Wrapper wrapper = tomcat.addServlet("/", "TestServlet", new TestServlet());
        wrapper.addMapping("/test");
        tomcat.start();// Tomcat跑起来
        tomcat.getServer().await();//强制Tomcat server等待，避免main线程执行结束后关闭
    }
}
```

运行TestApplication的main方法后，在浏览器中输入即可访问

<img src="http://img.zouyh.top/article-img/20240917135059323.png" alt="image-20230315151053714" style="zoom: 80%;" />

好了，到这里就演示完毕了，我们目光回到onRefresh方法，看看SpringBoot时如何实现内嵌tomcat的启动的

#### 1.2 流程跟进

SpringBoot项目的启动类。

```java
@SpringBootApplication
public class TestApplication {
    public static void main(String[] args) {
        SpringApplication.run(TestApplication.class, args);
    }
}
```

跟进`SpringApplication.run(TestApplication.class, args);`方法：

```java
public static ConfigurableApplicationContext run(Class<?> primarySource, String... args) {
	return run(new Class[]{primarySource}, args);
}
public static ConfigurableApplicationContext run(Class<?>[] primarySources, String[] args) {
	return (new SpringApplication(primarySources)).run(args);
}
```

跟进SpringApplication的run方法：

```java
public ConfigurableApplicationContext run(String... args) {
    // 计时
	StopWatch stopWatch = new StopWatch();
	stopWatch.start();
	DefaultBootstrapContext bootstrapContext = this.createBootstrapContext();
    // 它是任何spring上下文的接口， 所以可以接收任何ApplicationContext实现
	ConfigurableApplicationContext context = null;
	this.configureHeadlessProperty();
    // 去spring.factroies中读取了SpringApplicationRunListener的组件，EventPublishingRunListener就是用来发布事件或者运行监听器
	SpringApplicationRunListeners listeners = this.getRunListeners(args);
    // 发布ApplicationStartingEvent事件，启动事件监听
	listeners.starting(bootstrapContext, this.mainApplicationClass);

	try {
         // 根据命令行参数实例化一个ApplicationArguments
		ApplicationArguments applicationArguments = new DefaultApplicationArguments(args);
        // 标记①，预初始化环境：读取环境变量，读取配置文件信息（基于监听器）
		ConfigurableEnvironment environment = this.prepareEnvironment(listeners, bootstrapContext, applicationArguments);
        // 忽略beaninfo的bean
		this.configureIgnoreBeanInfo(environment);
        // 打印Banner 横幅
		Banner printedBanner = this.printBanner(environment);
        // 标记②，根据webApplicationType创建Spring上下文 
		context = this.createApplicationContext();
		context.setApplicationStartup(this.applicationStartup);
        // 标记③，预初始化spring上下文
		this.prepareContext(bootstrapContext, context, environment, listeners, applicationArguments, printedBanner);
         // 加载spring ioc 容器相当重要,由于是使用AnnotationConfigServletWebServerApplicationContext启动的spring容器所以springboot对它做了扩展：加载自动配置类：invokeBeanFactoryPostProcessors ，创建servlet容器onRefresh
        // 标记④，刷新容器
		this.refreshContext(context);
		this.afterRefresh(context, applicationArguments);
		stopWatch.stop();
		if (this.logStartupInfo) {
			(new StartupInfoLogger(this.mainApplicationClass)).logStarted(this.getApplicationLog(), stopWatch);
		}

		listeners.started(context);
		this.callRunners(context, applicationArguments);
	} catch (Throwable var10) {
		this.handleRunFailure(context, var10, listeners);
		throw new IllegalStateException(var10);
	}

	try {
		listeners.running(context);
		return context;
	} catch (Throwable var9) {
		this.handleRunFailure(context, var9, (SpringApplicationRunListeners)null);
		throw new IllegalStateException(var9);
	}
}
```

这里不看其它的，重点关注`this.refreshContext(context);`方法：接着调用`org.springframework.context.support.AbstractApplicationContext#refresh`父类的refresh方法：

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
			this.initApplicationEventMulticaster();
			this.onRefresh(); // 关注
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

跟进这个`this.onRefresh();`方法：

```java
protected void onRefresh() {
	super.onRefresh();
	try {
		this.createWebServer(); // 创建webServer
	} catch (Throwable var2) {
		throw new ApplicationContextException("Unable to start web server", var2);
	}
}
```

#### 1.3 tomcat创建，启动和挂起流程

跟进`this.createWebServer();`方法：

```java
private void createWebServer() {
	WebServer webServer = this.webServer;
	ServletContext servletContext = this.getServletContext();
    // 判断webServer是否为空，为空的话就是内嵌tomcat的逻辑
	if (webServer == null && servletContext == null) {
		StartupStep createWebServer = this.getApplicationStartup().start("spring.boot.webserver.create");
        // 获取ServletWebServerFactory，获取ServletWebServerFactory是ServletWebServerFactoryAutoConfiguration自动装配的，判断没有org.apache.catalina.startup.Tomcat的情况下
		ServletWebServerFactory factory = this.getWebServerFactory();
		createWebServer.tag("factory", factory.getClass().toString());
        // 标记①，通过getWebServer方法获取的工厂类创建webServer，
        // 标记②，tomcat启动后会回调getSelfInitializer方法
		this.webServer = factory.getWebServer(new ServletContextInitializer[]{this.getSelfInitializer()});
		createWebServer.end();
		this.getBeanFactory().registerSingleton("webServerGracefulShutdown", new WebServerGracefulShutdownLifecycle(this.webServer));
		this.getBeanFactory().registerSingleton("webServerStartStop", new WebServerStartStopLifecycle(this, this.webServer));
	} else if (servletContext != null) {
		try {
			this.getSelfInitializer().onStartup(servletContext);
		} catch (ServletException var5) {
			throw new ApplicationContextException("Cannot initialize servlet context", var5);
		}
	}

	this.initPropertySources();
}
```

标记①，通过getWebServer方法获取的工厂类，跟进`this.webServer = factory.getWebServer(new ServletContextInitializer[]{this.getSelfInitializer()});`方法，这里会有很多的实现，我们选择`org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory#getWebServer`:

```java
 public WebServer getWebServer(ServletContextInitializer... initializers) {
	if (this.disableMBeanRegistry) {
		Registry.disableRegistry();
	}

	Tomcat tomcat = new Tomcat(); // 创建tomcat和测试案例一样
	File baseDir = this.baseDirectory != null ? this.baseDirectory : this.createTempDir("tomcat");
	tomcat.setBaseDir(baseDir.getAbsolutePath()); // 设置classpath和测试案例一样
	Iterator var4 = this.serverLifecycleListeners.iterator();

	while(var4.hasNext()) {
		LifecycleListener listener = (LifecycleListener)var4.next();
		tomcat.getServer().addLifecycleListener(listener);
	}

	Connector connector = new Connector(this.protocol);
	connector.setThrowOnFailure(true);
	tomcat.getService().addConnector(connector);
	this.customizeConnector(connector);
	tomcat.setConnector(connector);
	tomcat.getHost().setAutoDeploy(false);
	this.configureEngine(tomcat.getEngine());
	Iterator var8 = this.additionalTomcatConnectors.iterator();

	while(var8.hasNext()) {
		Connector additionalConnector = (Connector)var8.next();
		tomcat.getService().addConnector(additionalConnector);
	}
    // 现在先别看prepareContext方法，后面ServletContainerInitializer章节介绍
	this.prepareContext(tomcat.getHost(), initializers);  
	return this.getTomcatWebServer(tomcat); // 启动tomcat
}
```

**启动tomcat**，跟进`this.getTomcatWebServer(tomcat)`方法：

```java
protected TomcatWebServer getTomcatWebServer(Tomcat tomcat) {
    // 创建了TomcatWebServer
	return new TomcatWebServer(tomcat, this.getPort() >= 0, this.getShutdown());
}
```

```java
public TomcatWebServer(Tomcat tomcat, boolean autoStart, Shutdown shutdown) {
	this.monitor = new Object();
	this.serviceConnectors = new HashMap();
	Assert.notNull(tomcat, "Tomcat Server must not be null");
	this.tomcat = tomcat;
	this.autoStart = autoStart;
	this.gracefulShutdown = shutdown == Shutdown.GRACEFUL ? new GracefulShutdown(tomcat) : null;
	this.initialize(); // 关注
}
```

继续跟进`this.initialize();`方法：

```java
private void initialize() throws WebServerException {
	logger.info("Tomcat initialized with port(s): " + this.getPortsDescription(false));
	synchronized(this.monitor) {
		try {
			this.addInstanceIdToEngineName();
			Context context = this.findContext();
			context.addLifecycleListener((event) -> {
				if (context.equals(event.getSource()) && "start".equals(event.getType())) {
					this.removeServiceConnectors();
				}

			});
			this.tomcat.start(); // 启动tomcat和测试案例一样
			this.rethrowDeferredStartupExceptions();

			try {
				ContextBindings.bindClassLoader(context, context.getNamingToken(), this.getClass().getClassLoader());
			} catch (NamingException var5) {
			}

			this.startDaemonAwaitThread(); // 挂起tomcat
		} catch (Exception var6) {
			this.stopSilently();
			this.destroySilently();
			throw new WebServerException("Unable to start embedded Tomcat", var6);
		}

	}
}
```

**挂起tomcat**，跟进`this.startDaemonAwaitThread(); `方法：

```java
private void startDaemonAwaitThread() {
	Thread awaitThread = new Thread("container-" + containerCounter.get()) {
		public void run() {
			TomcatWebServer.this.tomcat.getServer().await(); // 挂起tomcat和测试案例一样
		}
	};
	awaitThread.setContextClassLoader(this.getClass().getClassLoader());
	awaitThread.setDaemon(false);
	awaitThread.start();
}
```

#### 1.4 ServletContainerInitializer的onStartup方法

我们在上面的流程中跟到通过TomcatServletWebServerFactory类的getWebServer方法创建tomcat中没有介绍getWebServer，现在介绍`org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory#getWebServer`:

```java
public WebServer getWebServer(ServletContextInitializer... initializers) {
	if (this.disableMBeanRegistry) {
		Registry.disableRegistry();
	}

	Tomcat tomcat = new Tomcat(); // 创建tomcat和测试案例一样
	File baseDir = this.baseDirectory != null ? this.baseDirectory : this.createTempDir("tomcat");
	tomcat.setBaseDir(baseDir.getAbsolutePath()); // 设置classpath和测试案例一样
	Iterator var4 = this.serverLifecycleListeners.iterator();

	while(var4.hasNext()) {
		LifecycleListener listener = (LifecycleListener)var4.next();
		tomcat.getServer().addLifecycleListener(listener);
	}

	Connector connector = new Connector(this.protocol);
	connector.setThrowOnFailure(true);
	tomcat.getService().addConnector(connector);
	this.customizeConnector(connector);
	tomcat.setConnector(connector);
	tomcat.getHost().setAutoDeploy(false);
	this.configureEngine(tomcat.getEngine());
	Iterator var8 = this.additionalTomcatConnectors.iterator();

	while(var8.hasNext()) {
		Connector additionalConnector = (Connector)var8.next();
		tomcat.getService().addConnector(additionalConnector);
	}

	this.prepareContext(tomcat.getHost(), initializers); // 本次重点关注
	return this.getTomcatWebServer(tomcat); // 启动tomcat
}
```

我们回过头看看`this.prepareContext(tomcat.getHost(), initializers); `方法：

```java
protected void prepareContext(Host host, ServletContextInitializer[] initializers) {
	File documentRoot = this.getValidDocumentRoot();
    // 注意创建了TomcatEmbeddedContext
	TomcatEmbeddedContext context = new TomcatEmbeddedContext();
	if (documentRoot != null) {
		context.setResources(new TomcatServletWebServerFactory.LoaderHidingResourceRoot(context));
	}
	// 省略部分代码
	context.addLifecycleListener(new TomcatServletWebServerFactory.StaticResourceConfigurer(context));
    // 合并
	ServletContextInitializer[] initializersToUse = this.mergeInitializers(initializers);
	host.addChild(context);
	this.configureContext(context, initializersToUse); // 关注
	this.postProcessContext(context);
}
```

跟进`this.configureContext(context, initializersToUse);`方法：

```java
protected void configureContext(Context context, ServletContextInitializer[] initializers) {
 	// 创建了TomcatStarter并把ServletContextInitializer封装为一个容器初始化器
	TomcatStarter starter = new TomcatStarter(initializers);
	if (context instanceof TomcatEmbeddedContext) {
		TomcatEmbeddedContext embeddedContext = (TomcatEmbeddedContext)context;
		embeddedContext.setStarter(starter);
		embeddedContext.setFailCtxIfServletStartFails(true);
	}
	// 给TomcatEmbeddedContext加入一个容器初始化器TomcatStarter
	context.addServletContainerInitializer(starter, NO_CLASSES);
	// 省略部分代码

}
```

什么时候执行注册的容器初始化器？TomcatEmbeddedContext继承了StandardContext，而StandardContext继承了LifecycleBase类，所以tomcat启动时会回调startInternal方法，而在startInternal方法中就有一段调用ServletContainerInitializer的onStartup方法：

```java
// 遍历initializers
Iterator var27 = this.initializers.entrySet().iterator();
while(var27.hasNext()) {
	Entry entry = (Entry)var27.next();

	try {
        // 回调ServletContainerInitializer的onStartup方法
		((ServletContainerInitializer)entry.getKey()).onStartup((Set)entry.getValue(), this.getServletContext());
	} catch (ServletException var22) {
		log.error(sm.getString("standardContext.sciFail"), var22);
		ok = false;
		break;
	}
}
```

跟进`this.getServletContext()`方法，创建了ServletContext

```java
public ServletContext getServletContext() {
	if (this.context == null) {
		this.context = new ApplicationContext(this);
		if (this.altDDName != null) {
			this.context.setAttribute("org.apache.catalina.deploy.alt_dd", this.altDDName);
		}
	}

	return this.context.getFacade();
}
```

标记②，我们回过头tomcat启动后会回调getSelfInitializer方法：

```java
private ServletContextInitializer getSelfInitializer() {
    // 此处this::selfInitialize返回的是函数式方法实现，类似匿名内部类，而不是直接调用,此处会返回一个ServletContextInitialzer的实现。所以在创建tomcatServer之前没有调用selfInitialize，而是返回一个匿名内部类的对象，然后进入getWebServer方法。
	// 而后续在prepareContext（）方法里，会把ServletContextInitialzer包装为容器初始化器，tomcat.start启动时会把调用ServletContextInitialzer的onstartup方法，而它的onstartup方法就是selfInitialize方法，
	return this::selfInitialize;
}

private void selfInitialize(ServletContext servletContext) throws ServletException {
	this.prepareWebApplicationContext(servletContext);
    // 注册Servlet作用域application到BeanFactory中，前面研究springboot启动时注入过session+request
	this.registerApplicationScope(servletContext);
    // 注册servlet环境的bean到BeanFactory中
	WebApplicationContextUtils.registerEnvironmentBeans(this.getBeanFactory(), servletContext);
    // 标记③
	Iterator var2 = this.getServletContextInitializerBeans().iterator();
	while(var2.hasNext()) {
        // 将DispatchServlet加入servletContext，后面有分析该过程
		ServletContextInitializer beans = (ServletContextInitializer)var2.next();
        // 标记④，调用onStartup方法
		beans.onStartup(servletContext);
	}

}
```

标记③，调试一下看看`this.getServletContextInitializerBeans()`获取的什么？

<img src="http://img.zouyh.top/article-img/20240917135059325.png" alt="image-20230315154905833" style="zoom:67%;" />

以上图DispatcherServletRegistrationBean为例，先看一下DispatcherServletRegistrationBean是通过DispatcherServletAutoConfiguration类自动装配到IOC容器的

```java
@Conditional({DispatcherServletAutoConfiguration.DispatcherServletRegistrationCondition.class})
@ConditionalOnClass({ServletRegistration.class})
@EnableConfigurationProperties({WebMvcProperties.class})
@Import({DispatcherServletAutoConfiguration.DispatcherServletConfiguration.class})
protected static class DispatcherServletRegistrationConfiguration {
	protected DispatcherServletRegistrationConfiguration() {
	}

	@Bean(name = {"dispatcherServletRegistration"})
	@ConditionalOnBean(value = {DispatcherServlet.class},name = {"dispatcherServlet"})
	public DispatcherServletRegistrationBean dispatcherServletRegistration(DispatcherServlet dispatcherServlet, WebMvcProperties webMvcProperties, ObjectProvider<MultipartConfigElement> multipartConfig) {
        // 创建了DispatcherServletRegistrationBean，传入了dispatcherServlet和 /
		DispatcherServletRegistrationBean registration = new DispatcherServletRegistrationBean(dispatcherServlet, webMvcProperties.getServlet().getPath());
        
		registration.setName("dispatcherServlet");
		registration.setLoadOnStartup(webMvcProperties.getServlet().getLoadOnStartup());
		multipartConfig.ifAvailable(registration::setMultipartConfig);
		return registration;
	}
}
```

然后看一看DispatcherServletRegistrationBean的继承关系：

<img src="http://img.zouyh.top/article-img/20240917135059326.png" alt="image-20230317112427368" style="zoom:80%;" />

我们可以看到DispatcherServletRegistrationBean继承了ServletRegistrationBean，也实现了ServletContextInitializer接口，

```java
public class DispatcherServletRegistrationBean extends ServletRegistrationBean<DispatcherServlet> implements DispatcherServletPath {
    private final String path;
    public DispatcherServletRegistrationBean(DispatcherServlet servlet, String path) {
        super(servlet, new String[0]); // 调用父类的构造方法
        Assert.notNull(path, "Path must not be null");
        this.path = path;
        super.addUrlMappings(new String[]{this.getServletUrlMapping()});
    }
}
```

标记④，调用onStartup方法，DispatcherServletRegistrationBean并没有重写onStartup，我们继续跟进ServletContextInitializer的`beans.onStartup(servletContext);`方法：

```java
public final void onStartup(ServletContext servletContext) throws ServletException {
	String description = this.getDescription();
	if (!this.isEnabled()) {
		logger.info(StringUtils.capitalize(description) + " was not registered (disabled)");
	} else {
		this.register(description, servletContext);
	}
}
```

继续跟进`this.register(description, servletContext);`方法：

```java
protected final void register(String description, ServletContext servletContext) {
	D registration = this.addRegistration(description, servletContext);
	if (registration == null) {
		logger.info(StringUtils.capitalize(description) + " was not registered (possibly already registered?)");
	} else {
		this.configure(registration);
	}
}
```

继续跟进`this.addRegistration(description, servletContext);`方法：

```java
protected Dynamic addRegistration(String description, ServletContext servletContext) {
	String name = this.getServletName();
     // name和servlet是通过创建了DispatcherServletRegistrationBean，传入了dispatcherServlet
	return servletContext.addServlet(name, this.servlet); 
}
```

#### 
