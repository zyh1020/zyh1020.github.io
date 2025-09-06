---
icon: file-lines
# 标题
title: 'springMvc源码解析'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-12
# 一个页面可以有多个分类
category:
  - SpringMvc
# 一个页面可以有多个标签
tag:
  - 干货
  - SpringMvc
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，SpringMvc源码解析

#### 1.1核心流程图解

![image-20221221160008734](http://img.zouyh.top/article-img/20240917134951135.png)

1、用户发送请求至前端控制器DispatcherServlet

2、DispatcherServlet收到请求调用HandlerMapping处理器映射器。

3、处理器映射器根据请求url找到具体的处理器，生成处理器对象及处理器拦截器(如果有则生成)一并返回给DispatcherServlet。

4、DispatcherServlet通过HandlerAdapter处理器适配器调用处理器

5、执行处理器(Controller，也叫后端控制器)。

6、Controller执行完成返回ModelAndView

7、HandlerAdapter将controller执行结果ModelAndView返回给DispatcherServlet

8、DispatcherServlet将ModelAndView传给ViewReslover视图解析器

9、ViewReslover解析后返回具体View

10、DispatcherServlet对View进行渲染视图（即将模型数据填充至视图中）。

11、DispatcherServlet响应用户



#### 1.2初始化

首先，我们再使用SpringMvc除了导入相应的jar以外，都会在web.xml中配置如下代码：

```xml
<servlet>
  <servlet-name>sprinMvc</servlet-name>
  <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>
  <init-param>
    <param-name>contextConfigLocation</param-name>
    <param-value>classpath:springmvc.xml</param-value>
  </init-param>
</servlet>
<servlet-mapping>
  <servlet-name>sprinMvc</servlet-name>
  <url-pattern>/</url-pattern>
</servlet-mapping>
```

DispatcherServlet的继承图如下所示：

![](http://img.zouyh.top/article-img/20240917134952136.png)

然后在springmvc.xml的配置文件中配置:

```xml
<!-- 1,处理器映射器 -->
<bean class="org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping"/>
<!-- 2,处理器适配器 -->
<bean class="org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter"/> 
<!-- 3，视图解析器 -->
<bean class="org.springframework.web.servlet.view.InternalResourceViewResolver">
    <property name="prefix" value="/WEB-INF/jsp/"/>
    <property name="suffix" value=".jsp"/>
</bean>
```

其次我们知道，Servlet初始化时，Servlet的 `init()`方法会被调用。我们进入 `DispatcherServlet`中，发现并没有该方法，那么肯定在它集成的父类上。`DispatcherServlet` 继承于 `FrameworkServlet`，结果还是没找到，继续找它的父类 `HttpServletBean`

`HttpServletBean` 继承于 `HttpServlet`，我们来看下这个 `init()` 方法：

```java
public final void init() throws ServletException {
        PropertyValues pvs = new HttpServletBean.ServletConfigPropertyValues(this.getServletConfig(), this.requiredProperties);
        if (!pvs.isEmpty()) {
            try {
                BeanWrapper bw = PropertyAccessorFactory.forBeanPropertyAccess(this);
                ResourceLoader resourceLoader = new ServletContextResourceLoader(this.getServletContext());
                bw.registerCustomEditor(Resource.class, new ResourceEditor(resourceLoader, this.getEnvironment()));
                this.initBeanWrapper(bw);
                bw.setPropertyValues(pvs, true);
            } catch (BeansException var4) {
                if (this.logger.isErrorEnabled()) {
                    this.logger.error("Failed to set bean properties on servlet '" + this.getServletName() + "'", var4);
                }

                throw var4;
            }
        }

        // 子类FrameworkServlet，重写了它
        this.initServletBean();
    }
```

子类FrameworkServlet的initServletBean方法

```java
protected final void initServletBean() throws ServletException {
        this.getServletContext().log("Initializing Spring " + this.getClass().getSimpleName() + " '" + this.getServletName() + "'");
        if (this.logger.isInfoEnabled()) {
            this.logger.info("Initializing Servlet '" + this.getServletName() + "'");
        }

        long startTime = System.currentTimeMillis();

        try {
            // 创建了web容器
            this.webApplicationContext = this.initWebApplicationContext();
            this.initFrameworkServlet();
        } catch (RuntimeException | ServletException var4) {
            this.logger.error("Context initialization failed", var4);
            throw var4;
        }

        if (this.logger.isDebugEnabled()) {
            String value = this.enableLoggingRequestDetails ? "shown which may lead to unsafe logging of potentially sensitive data" : "masked to prevent unsafe logging of potentially sensitive data";
            this.logger.debug("enableLoggingRequestDetails='" + this.enableLoggingRequestDetails + "': request parameters and headers will be " + value);
        }

        if (this.logger.isInfoEnabled()) {
            this.logger.info("Completed initialization in " + (System.currentTimeMillis() - startTime) + " ms");
        }

    }
```

initWebApplicationContext方法：

```java
protected WebApplicationContext initWebApplicationContext() {
        WebApplicationContext rootContext = WebApplicationContextUtils.getWebApplicationContext(this.getServletContext());
        WebApplicationContext wac = null;
       // 有参数构造方法，传入webApplicationContext对象，就会进入该判断
        if (this.webApplicationContext != null) {
            wac = this.webApplicationContext;
            if (wac instanceof ConfigurableWebApplicationContext) {
                ConfigurableWebApplicationContext cwac = (ConfigurableWebApplicationContext)wac;
                if (!cwac.isActive()) {
                    //设置父容器
                    if (cwac.getParent() == null) {
                        cwac.setParent(rootContext);
                    }

                    this.configureAndRefreshWebApplicationContext(cwac);
                }
            }
        }

        if (wac == null) {
            // 获取ServletContext，之前通过setAttribute设置到了ServletContext中，现在通过getAttribute获取到
            wac = this.findWebApplicationContext();
        }

        if (wac == null) {
            // 创建WebApplicationContext，设置环境environment、父容器，本地资源文件
            wac = this.createWebApplicationContext(rootContext);
        }

        if (!this.refreshEventReceived) {
            synchronized(this.onRefreshMonitor) {
                // 刷新，空方法，让子类重写进行逻辑处理，而子类DispatcherServlet重写了它
                this.onRefresh(wac);
            }
        }

        if (this.publishContext) {
            String attrName = this.getServletContextAttributeName();
            this.getServletContext().setAttribute(attrName, wac);
        }

        return wac;
    }
```

该方法是初始化 `WebApplicationContext`的，而它集成于 `ApplicationContext`，所以它也是一个IoC容器。

所以 `FrameworkServlet`类的职责是将 `Spring` 和 `Servler` 进行一个关联。

这个方法，除了初始化WebApplicationContext外，还调用了一个 `onRefresh()`方法，又是模板模式，空方法，让子类复写进行逻辑处理，例如子类DispatcherServlet重写了它：

```java
protected void onRefresh(ApplicationContext context) {
        this.initStrategies(context);
    }

    protected void initStrategies(ApplicationContext context) {
        // 解析请求
        this.initMultipartResolver(context);
        // 国际化
        this.initLocaleResolver(context);
        // 主题
        this.initThemeResolver(context);
        // 处理Controller的方法和url映射关系
        this.initHandlerMappings(context);
        // 初始化适配器，多样写法Controller的适配处理
        this.initHandlerAdapters(context);
        // 初始化异常处理器
        this.initHandlerExceptionResolvers(context);
        // 初始化视图转发
        this.initRequestToViewNameTranslator(context);
        // 初始化视图解析器，将ModelAndView保存的视图信息，转换为一个视图，输出数据
        this.initViewResolvers(context);
        // 初始化映射处理器
        this.initFlashMapManager(context);
    }
```

以initHandlerMappings为例解析,其它的也基本是这个思路：

```java
private void initHandlerMappings(ApplicationContext context) {
        this.handlerMappings = null;
        //  detectAllHandlerMappings一个开关，默认为true，设置为false，才走else的逻辑
        if (this.detectAllHandlerMappings) {
            //重点：在容器中找到所有HandlerMapping
            Map<String, HandlerMapping> matchingBeans = BeanFactoryUtils.beansOfTypeIncludingAncestors(context, HandlerMapping.class, true, false);
            //找到了，进行排序，保证顺序
            if (!matchingBeans.isEmpty()) {
                this.handlerMappings = new ArrayList(matchingBeans.values());
                AnnotationAwareOrderComparator.sort(this.handlerMappings);
            }
        } else {
             // 指定搜寻指定名为 handlerMapping 的 HandlerMapping 实例
            try {
                HandlerMapping hm = (HandlerMapping)context.getBean("handlerMapping", HandlerMapping.class);
                this.handlerMappings = Collections.singletonList(hm);
            } catch (NoSuchBeanDefinitionException var4) {
            }
        }

       // 如果为空，如果你在容器中配置了获取到的就不是空，就不会使用默认的
        if (this.handlerMappings == null) {
            // 获取默认的
            this.handlerMappings = this.getDefaultStrategies(context, HandlerMapping.class);
            if (this.logger.isTraceEnabled()) {
                this.logger.trace("No HandlerMappings declared for servlet '" + this.getServletName() + "': using default strategies from DispatcherServlet.properties");
            }
        }

        Iterator var6 = this.handlerMappings.iterator();

        while(var6.hasNext()) {
            HandlerMapping mapping = (HandlerMapping)var6.next();
            if (mapping.usesPathPatterns()) {
                this.parseRequestPath = true;
                break;
            }
        }

    }
```

getDefaultStrategies方法获取默认的

```java
rotected <T> List<T> getDefaultStrategies(ApplicationContext context, Class<T> strategyInterface) {
        if (defaultStrategies == null) {
            try {
                // 获取资源文件
                ClassPathResource resource = new ClassPathResource("DispatcherServlet.properties", DispatcherServlet.class);
                defaultStrategies = PropertiesLoaderUtils.loadProperties(resource);
            } catch (IOException var15) {
                throw new IllegalStateException("Could not load 'DispatcherServlet.properties': " + var15.getMessage());
            }
        }	

        String key = strategyInterface.getName();
        String value = defaultStrategies.getProperty(key);
        if (value == null) {
            return Collections.emptyList();
        } else {
            String[] classNames = StringUtils.commaDelimitedListToStringArray(value);
            List<T> strategies = new ArrayList(classNames.length);
            String[] var7 = classNames;
            int var8 = classNames.length;

            for(int var9 = 0; var9 < var8; ++var9) {
                String className = var7[var9];

                try {
                    Class<?> clazz = ClassUtils.forName(className, DispatcherServlet.class.getClassLoader());
                    Object strategy = this.createDefaultStrategy(context, clazz);
                    strategies.add(strategy);
                } catch (ClassNotFoundException var13) {
                    throw new BeanInitializationException("Could not find DispatcherServlet's default strategy class [" + className + "] for interface [" + key + "]", var13);
                } catch (LinkageError var14) {
                    throw new BeanInitializationException("Unresolvable class definition for DispatcherServlet's default strategy class [" + className + "] for interface [" + key + "]", var14);
                }
            }

            return strategies;
        }
    }
```



```properties
# Default implementation classes for DispatcherServlet's strategy interfaces.
# Used as fallback when no matching beans are found in the DispatcherServlet context.
# Not meant to be customized by application developers.

org.springframework.web.servlet.LocaleResolver=org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver

org.springframework.web.servlet.ThemeResolver=org.springframework.web.servlet.theme.FixedThemeResolver

# 默认的处理Controller的方法和url映射关系
org.springframework.web.servlet.HandlerMapping=org.springframework.web.servlet.handler.BeanNameUrlHandlerMapping,\
	org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping,\
	org.springframework.web.servlet.function.support.RouterFunctionMapping

# 默认的处理器适配器
org.springframework.web.servlet.HandlerAdapter=org.springframework.web.servlet.mvc.HttpRequestHandlerAdapter,\
	org.springframework.web.servlet.mvc.SimpleControllerHandlerAdapter,\
	org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter,\
	org.springframework.web.servlet.function.support.HandlerFunctionAdapter


org.springframework.web.servlet.HandlerExceptionResolver=org.springframework.web.servlet.mvc.method.annotation.ExceptionHandlerExceptionResolver,\
	org.springframework.web.servlet.mvc.annotation.ResponseStatusExceptionResolver,\
	org.springframework.web.servlet.mvc.support.DefaultHandlerExceptionResolver

org.springframework.web.servlet.RequestToViewNameTranslator=org.springframework.web.servlet.view.DefaultRequestToViewNameTranslator

org.springframework.web.servlet.ViewResolver=org.springframework.web.servlet.view.InternalResourceViewResolver

org.springframework.web.servlet.FlashMapManager=org.springframework.web.servlet.support.SessionFlashMapManager
```





#### 1.3调用时机

DispatcherServlet继承了HttpServlet，并且在web.xml中配置`/`拦截所有的请求，当我们发请求的是交给HttpServlet的service方法处理

HttpServlet的service方法被FrameworkServlet重写，FrameworkServlet的service方法源码如下：

```java
@Override
protected void service(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        HttpMethod httpMethod = HttpMethod.resolve(request.getMethod());
        if (httpMethod != HttpMethod.PATCH && httpMethod != null) {
            // 父类的HttpServlet的service方法
            super.service(request, response);
        } else {// 如果是PATCH或获取不到，则走自己的processRequest()方法
            this.processRequest(request, response);
        }

    }


```

父类HttpServlet的service方法：

```java
 protected void service(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String method = req.getMethod();
        long lastModified;
        if (method.equals("GET")) {
            lastModified = this.getLastModified(req);
            if (lastModified == -1L) {
                 // 调用FrameworkServlet子类重写doGet方法
                this.doGet(req, resp);
            } else {
                long ifModifiedSince;
                try {
                    ifModifiedSince = req.getDateHeader("If-Modified-Since");
                } catch (IllegalArgumentException var9) {
                    ifModifiedSince = -1L;
                }

                if (ifModifiedSince < lastModified / 1000L * 1000L) {
                    this.maybeSetLastModified(resp, lastModified);
                    this.doGet(req, resp);
                } else {
                    resp.setStatus(304);
                }
            }
        } else if (method.equals("HEAD")) {
            lastModified = this.getLastModified(req);
            this.maybeSetLastModified(resp, lastModified);
            // 调用FrameworkServlet子类重写doHead方法
            this.doHead(req, resp);
        } else if (method.equals("POST")) {
            // 调用FrameworkServlet子类重写doPost方法
            this.doPost(req, resp);
        } else if (method.equals("PUT")) {
            // 调用FrameworkServlet子类重写doPut方法
            this.doPut(req, resp);
        } else if (method.equals("DELETE")) {
            // 调用FrameworkServlet子类重写doDelete方法
            this.doDelete(req, resp);
        } else if (method.equals("OPTIONS")) {
            // 调用FrameworkServlet子类重写doOptions方法
            this.doOptions(req, resp);
        } else if (method.equals("TRACE")) {
            // 调用FrameworkServlet子类重写doTrace方法
            this.doTrace(req, resp);
        } else {
            String errMsg = lStrings.getString("http.method_not_implemented");
            Object[] errArgs = new Object[]{method};
            errMsg = MessageFormat.format(errMsg, errArgs);
            resp.sendError(501, errMsg);
        }

    }
```

frameworkServlet子类重写方法：

```java
//处理GET请求
@Override
protected final void doGet(HttpServletRequest request, HttpServletResponse response)
        throws ServletException, IOException {
    processRequest(request, response);
}

//处理POST请求
@Override
protected final void doPost(HttpServletRequest request, HttpServletResponse response)
        throws ServletException, IOException {
    processRequest(request, response);
}

//出路PUT请求
@Override
protected final void doPut(HttpServletRequest request, HttpServletResponse response)
        throws ServletException, IOException {
    processRequest(request, response);
}

//处理DELETE请求
@Override
protected final void doDelete(HttpServletRequest request, HttpServletResponse response)
        throws ServletException, IOException {
    processRequest(request, response);
}

//处理OPTION请求
@Override
protected void doOptions(HttpServletRequest request, HttpServletResponse response)
        throws ServletException, IOException {
    if (this.dispatchOptionsRequest || CorsUtils.isPreFlightRequest(request)) {
        processRequest(request, response);
        if (response.containsHeader("Allow")) {
            // Proper OPTIONS response coming from a handler - we're done.
            return;
        }
    }
    // Use response wrapper in order to always add PATCH to the allowed methods
    super.doOptions(request, new HttpServletResponseWrapper(response) {
        @Override
        public void setHeader(String name, String value) {
            if ("Allow".equals(name)) {
                value = (StringUtils.hasLength(value) ? value + ", " : "") + HttpMethod.PATCH.name();
            }
            super.setHeader(name, value);
        }
    });
}

//处理Trace请求
@Override
protected void doTrace(HttpServletRequest request, HttpServletResponse response)
        throws ServletException, IOException {
    if (this.dispatchTraceRequest) {
        processRequest(request, response);
        if ("message/http".equals(response.getContentType())) {
            // Proper TRACE response coming from a handler - we're done.
            return;
        }
    }
    super.doTrace(request, response);
}
```

根据上面的代码追踪发现，最终都会调用到FrameworkServlet的processRequest方法：

```java
protected final void processRequest(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        long startTime = System.currentTimeMillis();
        Throwable failureCause = null;
        LocaleContext previousLocaleContext = LocaleContextHolder.getLocaleContext();
        LocaleContext localeContext = this.buildLocaleContext(request);
        RequestAttributes previousAttributes = RequestContextHolder.getRequestAttributes();
        ServletRequestAttributes requestAttributes = this.buildRequestAttributes(request, response, previousAttributes);
        WebAsyncManager asyncManager = WebAsyncUtils.getAsyncManager(request);
        asyncManager.registerCallableInterceptor(FrameworkServlet.class.getName(), new FrameworkServlet.RequestBindingInterceptor());
        this.initContextHolders(request, localeContext, requestAttributes);

        try {
            // 调用DispatcherServlet的doService
            this.doService(request, response);
        } catch (IOException | ServletException var16) {
            failureCause = var16;
            throw var16;
        } catch (Throwable var17) {
            failureCause = var17;
            throw new NestedServletException("Request processing failed", var17);
        } finally {
            this.resetContextHolders(request, previousLocaleContext, previousAttributes);
            if (requestAttributes != null) {
                requestAttributes.requestCompleted();
            }

            this.logResult(request, response, (Throwable)failureCause, asyncManager);
            this.publishRequestHandledEvent(request, response, startTime, (Throwable)failureCause);
        }

    }
```

DispatcherServlet的doService重写了FrameworkServlet的doService，DispatcherServlet的doService源码：

```java
 protected void doService(HttpServletRequest request, HttpServletResponse response) throws Exception {
        this.logRequest(request);
        Map<String, Object> attributesSnapshot = null;
        if (WebUtils.isIncludeRequest(request)) {
            attributesSnapshot = new HashMap();
            Enumeration attrNames = request.getAttributeNames();

            label116:
            while(true) {
                String attrName;
                do {
                    if (!attrNames.hasMoreElements()) {
                        break label116;
                    }

                    attrName = (String)attrNames.nextElement();
                } while(!this.cleanupAfterInclude && !attrName.startsWith("org.springframework.web.servlet"));

                attributesSnapshot.put(attrName, request.getAttribute(attrName));
            }
        }

        request.setAttribute(WEB_APPLICATION_CONTEXT_ATTRIBUTE, this.getWebApplicationContext());
        request.setAttribute(LOCALE_RESOLVER_ATTRIBUTE, this.localeResolver);
        request.setAttribute(THEME_RESOLVER_ATTRIBUTE, this.themeResolver);
        request.setAttribute(THEME_SOURCE_ATTRIBUTE, this.getThemeSource());
        if (this.flashMapManager != null) {
            FlashMap inputFlashMap = this.flashMapManager.retrieveAndUpdate(request, response);
            if (inputFlashMap != null) {
                request.setAttribute(INPUT_FLASH_MAP_ATTRIBUTE, Collections.unmodifiableMap(inputFlashMap));
            }

            request.setAttribute(OUTPUT_FLASH_MAP_ATTRIBUTE, new FlashMap());
            request.setAttribute(FLASH_MAP_MANAGER_ATTRIBUTE, this.flashMapManager);
        }

        RequestPath previousRequestPath = null;
        if (this.parseRequestPath) {
            previousRequestPath = (RequestPath)request.getAttribute(ServletRequestPathUtils.PATH_ATTRIBUTE);
            ServletRequestPathUtils.parseAndCache(request);
        }

        try {
            // 调用
            this.doDispatch(request, response);
        } finally {
            if (!WebAsyncUtils.getAsyncManager(request).isConcurrentHandlingStarted() && attributesSnapshot != null) {
                this.restoreAttributesAfterInclude(request, attributesSnapshot);
            }

            if (this.parseRequestPath) {
                ServletRequestPathUtils.setParsedRequestPath(previousRequestPath, request);
            }

        }

    }
```

继续跟进doDispatch方法

```java
protected void doDispatch(HttpServletRequest request, HttpServletResponse response) throws Exception {
        HttpServletRequest processedRequest = request;
        HandlerExecutionChain mappedHandler = null;
        boolean multipartRequestParsed = false;
        WebAsyncManager asyncManager = WebAsyncUtils.getAsyncManager(request);

        try {
            try {
                ModelAndView mv = null;
                Object dispatchException = null;

                try {
                    // 检查是否有文件上传
                    processedRequest = this.checkMultipart(request);
                    multipartRequestParsed = processedRequest != request;
                    // 1.3调用处理器映射器，返回处理器执行链
                    mappedHandler = this.getHandler(processedRequest);
                    if (mappedHandler == null) {
                        this.noHandlerFound(processedRequest, response);
                        return;
                    }
					//  1.4获取处理适配器
                    HandlerAdapter ha = this.getHandlerAdapter(mappedHandler.getHandler());
                    String method = request.getMethod();
                    boolean isGet = HttpMethod.GET.matches(method);
                    if (isGet || HttpMethod.HEAD.matches(method)) {
                        long lastModified = ha.getLastModified(request, mappedHandler.getHandler());
                        if ((new ServletWebRequest(request, response)).checkNotModified(lastModified) && isGet) {
                            return;
                        }
                    }
					// 1.5调用前置拦截器
                    if (!mappedHandler.applyPreHandle(processedRequest, response)) {
                        return;
                    }
					// 1.6处理适配器调用处理器方法，返回ModelAndView
                    mv = ha.handle(processedRequest, response, mappedHandler.getHandler());
                    if (asyncManager.isConcurrentHandlingStarted()) {
                        return;
                    }

                    this.applyDefaultViewName(processedRequest, mv);
                    // 1.7调用后置拦截器
                    mappedHandler.applyPostHandle(processedRequest, response, mv);
                } catch (Exception var20) {
                    dispatchException = var20;
                } catch (Throwable var21) {
                    dispatchException = new NestedServletException("Handler dispatch failed", var21);
                }

                // 1.8视图解析
                this.processDispatchResult(processedRequest, response, mappedHandler, mv, (Exception)dispatchException);
            } catch (Exception var22) {
                this.triggerAfterCompletion(processedRequest, response, mappedHandler, var22);
            } catch (Throwable var23) {
                this.triggerAfterCompletion(processedRequest, response, mappedHandler, new NestedServletException("Handler processing failed", var23));
            }

        } finally {
            if (asyncManager.isConcurrentHandlingStarted()) {
                if (mappedHandler != null) {
                    mappedHandler.applyAfterConcurrentHandlingStarted(processedRequest, response);
                }
            } else if (multipartRequestParsed) {
                this.cleanupMultipart(processedRequest);
            }

        }
    }
```

#### 1.4调用处理器映射器，返回处理器执行链

DispatcherServlet的doDispatch方法中：

```java
// 1.3调用处理器映射器，返回处理器执行链
mappedHandler = this.getHandler(processedRequest);
```

getHandler方法源码

```java
@Nullable
    protected HandlerExecutionChain getHandler(HttpServletRequest request) throws Exception {
        // handlerMappings是HandlerMapping集合
        if (this.handlerMappings != null) {
            Iterator var2 = this.handlerMappings.iterator();

            while(var2.hasNext()) {
                HandlerMapping mapping = (HandlerMapping)var2.next();
                // HandlerMapping通过调用getHandler获取符合的执行链
                HandlerExecutionChain handler = mapping.getHandler(request);
                if (handler != null) {
                    return handler;
                }
            }
        }

        return null;
    }
```

HandlerExecutionChain的结构：

```java
public class HandlerExecutionChain {
    private static final Log logger = LogFactory.getLog(HandlerExecutionChain.class);
    private final Object handler; //处理器
    private final List<HandlerInterceptor> interceptorList; // 拦截器
    private int interceptorIndex;
    ，，，，，
```

HandlerMapping处理器映射接口：

```java
public interface HandlerMapping {
    @Nullable
    HandlerExecutionChain getHandler(HttpServletRequest request) throws Exception;
}

```

HandlerMapping的子类 AbstractHandlerMapping 实现了该方法：

```java

public abstract class AbstractHandlerMapping extends WebApplicationObjectSupport
        implements HandlerMapping, Ordered, BeanNameAware {
    @Override
    @Nullable
    public final HandlerExecutionChain getHandler(HttpServletRequest request) throws Exception {
        //模板方法，获取处理器，具体子类进行实现
        Object handler = getHandlerInternal(request);
        //如果没有获取到，则使用默认的处理器
        if (handler == null) {
            handler = getDefaultHandler();
        }
        //默认的也没有，那就返回null了
        if (handler == null) {
            return null;
        }
        //如果处理器是字符串类型，则在IoC容器中搜寻实例
        if (handler instanceof String) {
            String handlerName = (String) handler;
            handler = obtainApplicationContext().getBean(handlerName);
        }

        //构成处理器执行链，主要是添加拦截器
        HandlerExecutionChain executionChain = getHandlerExecutionChain(handler, request);

        if (logger.isTraceEnabled()) {
            logger.trace("Mapped to " + handler);
        }
        else if (logger.isDebugEnabled() && !request.getDispatcherType().equals(DispatcherType.ASYNC)) {
            logger.debug("Mapped to " + executionChain.getHandler());
        }

        if (hasCorsConfigurationSource(handler)) {
            CorsConfiguration config = (this.corsConfigurationSource != null ? this.corsConfigurationSource.getCorsConfiguration(request) : null);
            CorsConfiguration handlerConfig = getCorsConfiguration(handler, request);
            config = (config != null ? config.combine(handlerConfig) : handlerConfig);
            executionChain = getCorsHandlerExecutionChain(request, executionChain, config);
        }
        return executionChain;
    }
    
    //组成处理器执行链，添加拦截器
    protected HandlerExecutionChain getHandlerExecutionChain(Object handler, HttpServletRequest request) {
        HandlerExecutionChain chain = (handler instanceof HandlerExecutionChain ?
                (HandlerExecutionChain) handler : new HandlerExecutionChain(handler));

        String lookupPath = this.urlPathHelper.getLookupPathForRequest(request, LOOKUP_PATH);
        for (HandlerInterceptor interceptor : this.adaptedInterceptors) {
            if (interceptor instanceof MappedInterceptor) {
                MappedInterceptor mappedInterceptor = (MappedInterceptor) interceptor;
                //和请求的url做匹配，匹配才加入
                if (mappedInterceptor.matches(lookupPath, this.pathMatcher)) {
                    chain.addInterceptor(mappedInterceptor.getInterceptor());
                }
            }
            else {
                chain.addInterceptor(interceptor);
            }
        }
        return chain;
    }
}
```



#### 1.5获取处理适配器

DispatcherServlet的doDispatch方法中：

```java
//  1.4获取处理适配器
HandlerAdapter ha = this.getHandlerAdapter(mappedHandler.getHandler());
```

继续跟进getHandlerAdapter方法：

```java
 protected HandlerAdapter getHandlerAdapter(Object handler) throws ServletException {
        if (this.handlerAdapters != null) {
            Iterator var2 = this.handlerAdapters.iterator();

            while(var2.hasNext()) {
                HandlerAdapter adapter = (HandlerAdapter)var2.next();
                if (adapter.supports(handler)) {
                    return adapter;
                }
            }
        }

        throw new ServletException("No adapter for handler [" + handler + "]: The DispatcherServlet configuration needs to include a HandlerAdapter that supports this handler");
    }

```

HandlerAdapter详解 这里Spring mvc 采用适配器模式来适配调用指定Handler，根据Handler的不同种类采用不同的 Adapter,其Handler与 HandlerAdapter 对应关系如下

| Handler类别        | 对应适配器                     | 描述                                                |
| ------------------ | ------------------------------ | --------------------------------------------------- |
| Controller         | SimpleControllerHandlerAdapter | 标准控制器，返回ModelAndView                        |
| HttpRequestHandler | HttpRequestHandlerAdapter      | 业务自行处理 请求，不需要通过 modelAndView 转到视图 |
| Servlet            | SimpleServletHandlerAdapter    | 基于标准的servlet 处理                              |
| HandlerMethod      | RequestMappingHandlerAdapter   | 基于@requestMapping对应方法处理                     |

第一个：`org.springframework.web.servlet.mvc.SimpleControllerHandlerAdapter` 使用此适配器，适用的控制器写法：要求实现 Controller 接口

```java
public class HelloController2 implements Controller {
	@Override
	public ModelAndView handleRequest(HttpServletRequest httpServletRequest,
	HttpServletResponse httpServletResponse) throws Exception {
		ModelAndView mv = new ModelAndView();
		mv.setViewName("success");
		return mv;
	}
}
```

同时要求我们在 springmvc.xml 中添加：

```xml
<bean id="simpleControllerHandlerAdapter " class="org.springframework.web.servlet.mvc.SimpleControllerHandlerAdapter"></bean>

<bean name="/sayhello2" class="com.web.controller.HelloController2"></bean>
```

第二个：`org.springframework.web.servlet.mvc.HttpRequestHandlerAdapter` 使用此适配器的控制器写法：要求实现 HttpRequestHandler 接口

```java
public class HelloController3 implements HttpRequestHandler {
	@Override
	public void handleRequest(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
	request.getRequestDispatcher("/WEB‐INF/pages/success.jsp").forward(request,response);
	}
}
```

同时要求我们在 springmvc.xml 中添加：

```xml
<bean id=" httpRequestHandlerAdapter" class="org.springframework.web.servlet.mvc.HttpRequestHandlerAdapter"></bean>

<bean name="/sayhello3" class="com.web.controller.HelloController3"></bean>
```

第三个： `org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter `这种方式也是我们实际开发中采用最多的。它的要求是我们用注解@Controller 配置控制器

```java
@Controller
public class HelloControler {
	@RequestMapping("hello")
	public String sayHello() {
		System.out.println("控制器方法执行了");
		return "success";
	}
}
```

同时要求我们在 springmvc.xml 中配置：

```xml
 <bean id="requestMappingHandlerAdapter" class="org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter"></bean>
```

不过通常情况下我们都是直接配置:

```xml
<mvc:annotation‐driven/>
```

#### 1.6调用前置拦截器

DispatcherServlet的doDispatch方法中：

```java
// 1.5调用前置拦截器
if (!mappedHandler.applyPreHandle(processedRequest, response)) { // applyPreHandle返回false表示不放行
   return;
}
```

继续跟进applyPreHandle方法：

```java
boolean applyPreHandle(HttpServletRequest request, HttpServletResponse response) throws Exception {
        for(int i = 0; i < this.interceptorList.size(); this.interceptorIndex = i++) {
            HandlerInterceptor interceptor = (HandlerInterceptor)this.interceptorList.get(i);
            // 调用拦截起的preHandle方法
            if (!interceptor.preHandle(request, response, this.handler)) {
                this.triggerAfterCompletion(request, response, (Exception)null);
                return false; // 返回false表示不放行
            }
        }

        return true;
    }
```



#### 1.7处理适配器调用处理器方法

DispatcherServlet的doDispatch方法中：

```java
// 1.6处理适配器调用处理器方法，返回ModelAndView
 mv = ha.handle(processedRequest, response, mappedHandler.getHandler());
```

`ha`是1.4获取到的处理器适配器，以RequestMappingHandlerAdapter为例查看RequestMappingHandlerAddapter方法：AbstractHandlerMethodAdapter是RequestMappingHandlerAdapter父类，真正实现handle方法的是RequestMappingHandlerAdapter抽象父类实现的：

```java
@Nullable
    public final ModelAndView handle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        return this.handleInternal(request, response, (HandlerMethod)handler);
    }

```

继续跟进handleInternal方法，就到了RequestMappingHandlerAdapter的handleInternal方法：

```java
protected ModelAndView handleInternal(HttpServletRequest request, HttpServletResponse response, HandlerMethod handlerMethod) throws Exception {
        this.checkRequest(request);
        ModelAndView mav;
        if (this.synchronizeOnSession) {
            HttpSession session = request.getSession(false);
            if (session != null) {
                Object mutex = WebUtils.getSessionMutex(session);
                synchronized(mutex) {
                    mav = this.invokeHandlerMethod(request, response, handlerMethod);
                }
            } else {
                mav = this.invokeHandlerMethod(request, response, handlerMethod);
            }
        } else {
            // 核心就是调用invokeHandlerMethod
            mav = this.invokeHandlerMethod(request, response, handlerMethod);
        }

        if (!response.containsHeader("Cache-Control")) {
            if (this.getSessionAttributesHandler(handlerMethod).hasSessionAttributes()) {
                this.applyCacheSeconds(response, this.cacheSecondsForSessionAttributeHandlers);
            } else {
                this.prepareResponse(response);
            }
        }

        return mav;
    }
```

跟进invokeHandlerMethod方法：

```java
@Nullable
    protected ModelAndView invokeHandlerMethod(HttpServletRequest request, HttpServletResponse response, HandlerMethod handlerMethod) throws Exception {
        ServletWebRequest webRequest = new ServletWebRequest(request, response);

        Object result;
        try {
            WebDataBinderFactory binderFactory = this.getDataBinderFactory(handlerMethod);
            ModelFactory modelFactory = this.getModelFactory(handlerMethod, binderFactory);
            ServletInvocableHandlerMethod invocableMethod = this.createInvocableHandlerMethod(handlerMethod);
            if (this.argumentResolvers != null) {
                invocableMethod.setHandlerMethodArgumentResolvers(this.argumentResolvers);
            }

            if (this.returnValueHandlers != null) {
                invocableMethod.setHandlerMethodReturnValueHandlers(this.returnValueHandlers);
            }

            invocableMethod.setDataBinderFactory(binderFactory);
            invocableMethod.setParameterNameDiscoverer(this.parameterNameDiscoverer);
            ModelAndViewContainer mavContainer = new ModelAndViewContainer();
            mavContainer.addAllAttributes(RequestContextUtils.getInputFlashMap(request));
            modelFactory.initModel(webRequest, mavContainer, invocableMethod);
            mavContainer.setIgnoreDefaultModelOnRedirect(this.ignoreDefaultModelOnRedirect);
            AsyncWebRequest asyncWebRequest = WebAsyncUtils.createAsyncWebRequest(request, response);
            asyncWebRequest.setTimeout(this.asyncRequestTimeout);
            WebAsyncManager asyncManager = WebAsyncUtils.getAsyncManager(request);
            asyncManager.setTaskExecutor(this.taskExecutor);
            asyncManager.setAsyncWebRequest(asyncWebRequest);
            asyncManager.registerCallableInterceptors(this.callableInterceptors);
            asyncManager.registerDeferredResultInterceptors(this.deferredResultInterceptors);
            if (asyncManager.hasConcurrentResult()) {
                result = asyncManager.getConcurrentResult();
                mavContainer = (ModelAndViewContainer)asyncManager.getConcurrentResultContext()[0];
                asyncManager.clearConcurrentResult();
                LogFormatUtils.traceDebug(this.logger, (traceOn) -> {
                    String formatted = LogFormatUtils.formatValue(result, !traceOn);
                    return "Resume with async result [" + formatted + "]";
                });
                invocableMethod = invocableMethod.wrapConcurrentResult(result);
            }
			// 继续调用invokeAndHandle方法
            invocableMethod.invokeAndHandle(webRequest, mavContainer, new Object[0]);
            if (!asyncManager.isConcurrentHandlingStarted()) {
                ModelAndView var15 = this.getModelAndView(mavContainer, modelFactory, webRequest);
                return var15;
            }

            result = null;
        } finally {
            webRequest.requestCompleted();
        }

        return (ModelAndView)result;
    }
```

继续调用invokeAndHandle方法：

```java
public void invokeAndHandle(ServletWebRequest webRequest, ModelAndViewContainer mavContainer, Object... providedArgs) throws Exception {
       // invokeForRequest调用处理器方法
        Object returnValue = this.invokeForRequest(webRequest, mavContainer, providedArgs);
        this.setResponseStatus(webRequest);
        if (returnValue == null) {
            if (this.isRequestNotModified(webRequest) || this.getResponseStatus() != null || mavContainer.isRequestHandled()) {
                this.disableContentCachingIfNecessary(webRequest);
                mavContainer.setRequestHandled(true);
                return;
            }
        } else if (StringUtils.hasText(this.getResponseStatusReason())) {
            mavContainer.setRequestHandled(true);
            return;
        }

        mavContainer.setRequestHandled(false);
        Assert.state(this.returnValueHandlers != null, "No return value handlers");

        try {
            this.returnValueHandlers.handleReturnValue(returnValue, this.getReturnValueType(returnValue), mavContainer, webRequest);
        } catch (Exception var6) {
            if (logger.isTraceEnabled()) {
                logger.trace(this.formatErrorForReturnValue(returnValue), var6);
            }

            throw var6;
        }
    }
```

 invokeForRequest调用处理器方法

```java
@Nullable
    public Object invokeForRequest(NativeWebRequest request, @Nullable ModelAndViewContainer mavContainer, Object... providedArgs) throws Exception {
        // 获取参数信息
        Object[] args = this.getMethodArgumentValues(request, mavContainer, providedArgs);
        if (logger.isTraceEnabled()) {
            logger.trace("Arguments: " + Arrays.toString(args));
        }
		// 调用处理器方法
        return this.doInvoke(args);
    }

```

doInvoke方法继续跟进：

```java
 @Nullable
    protected Object doInvoke(Object... args) throws Exception {
        // getBridgedMethod获取对应controller的方法
        Method method = this.getBridgedMethod();

        try {
            return KotlinDetector.isSuspendingFunction(method) ? CoroutinesUtils.invokeSuspendingFunction(method, this.getBean(), args) : method.invoke(this.getBean(), args);// method.invoke(this.getBean(), args);通过反射的方法调用
        } catch (IllegalArgumentException var5) {
            this.assertTargetBean(method, this.getBean(), args);
            String text = var5.getMessage() != null ? var5.getMessage() : "Illegal argument";
            throw new IllegalStateException(this.formatInvokeError(text, args), var5);
        } catch (InvocationTargetException var6) {
            Throwable targetException = var6.getTargetException();
            if (targetException instanceof RuntimeException) {
                throw (RuntimeException)targetException;
            } else if (targetException instanceof Error) {
                throw (Error)targetException;
            } else if (targetException instanceof Exception) {
                throw (Exception)targetException;
            } else {
                throw new IllegalStateException(this.formatInvokeError("Invocation failure", args), targetException);
            }
        }
    }
```



再扩展一下，以SimpleControllerHandlerAdapter为例，查看SimpleControllerHandlerAdapter的handle方法：

```java
@Nullable
public ModelAndView handle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
       // 将handler转换为Controller，因为SimpleControllerHandlerAdapter适配的都是实现Controller接口的。
        return ((Controller)handler).handleRequest(request, response);
}
```

#### 1.8调用后置拦截器

DispatcherServlet的doDispatch方法中：

```java
 // 1.7调用后置拦截器
mappedHandler.applyPostHandle(processedRequest, response, mv);
```

继续跟进applyPostHandle方法：

```java
void applyPostHandle(HttpServletRequest request, HttpServletResponse response, @Nullable ModelAndView mv) throws Exception {
        for(int i = this.interceptorList.size() - 1; i >= 0; --i) {
            HandlerInterceptor interceptor = (HandlerInterceptor)this.interceptorList.get(i);
            interceptor.postHandle(request, response, this.handler, mv);// 调用后置拦截的方法
        }

    }
```



#### 1.9视图解析

视图解析主要是为了解析，处理器适配器调用处理器后返回的ModelAndView。

DispatcherServlet的doDispatch方法中：

```java
 // 1.8视图解析
this.processDispatchResult(processedRequest, response, mappedHandler, mv, (Exception)dispatchException);
```

查看processDispatchResult方法：

```java
 private void processDispatchResult(HttpServletRequest request, HttpServletResponse response, @Nullable HandlerExecutionChain mappedHandler, @Nullable ModelAndView mv, @Nullable Exception exception) throws Exception {
        boolean errorView = false;
        if (exception != null) {
            if (exception instanceof ModelAndViewDefiningException) {
                this.logger.debug("ModelAndViewDefiningException encountered", exception);
                mv = ((ModelAndViewDefiningException)exception).getModelAndView();
            } else {
                Object handler = mappedHandler != null ? mappedHandler.getHandler() : null;
                mv = this.processHandlerException(request, response, handler, exception);
                errorView = mv != null;
            }
        }

        if (mv != null && !mv.wasCleared()) {
            // 调用render方法解析视图
            this.render(mv, request, response);
            if (errorView) {
                WebUtils.clearErrorRequestAttributes(request);
            }
        } else if (this.logger.isTraceEnabled()) {
            this.logger.trace("No view rendering, null ModelAndView returned.");
        }

        if (!WebAsyncUtils.getAsyncManager(request).isConcurrentHandlingStarted()) {
            if (mappedHandler != null) {
                mappedHandler.triggerAfterCompletion(request, response, (Exception)null);
            }

        }
    }
```

render方法：

```java
protected void render(ModelAndView mv, HttpServletRequest request, HttpServletResponse response) throws Exception {
        Locale locale = this.localeResolver != null ? this.localeResolver.resolveLocale(request) : request.getLocale();
        response.setLocale(locale);
        String viewName = mv.getViewName();
        View view;
        if (viewName != null) {
            // 调用resolveViewName，进行视图解析
            view = this.resolveViewName(viewName, mv.getModelInternal(), locale, request);
            if (view == null) {
                throw new ServletException("Could not resolve view with name '" + mv.getViewName() + "' in servlet with name '" + this.getServletName() + "'");
            }
        } else {
            view = mv.getView();
            if (view == null) {
                throw new ServletException("ModelAndView [" + mv + "] neither contains a view name nor a View object in servlet with name '" + this.getServletName() + "'");
            }
        }

        if (this.logger.isTraceEnabled()) {
            this.logger.trace("Rendering view [" + view + "] ");
        }

        try {
            if (mv.getStatus() != null) {
                request.setAttribute(View.RESPONSE_STATUS_ATTRIBUTE, mv.getStatus());
                response.setStatus(mv.getStatus().value());
            }
			// 这一步是渲染视图
            view.render(mv.getModelInternal(), request, response);
        } catch (Exception var8) {
            if (this.logger.isDebugEnabled()) {
                this.logger.debug("Error rendering view [" + view + "]", var8);
            }

            throw var8;
        }
    }
```

 view.render调用的是抽象类AbstractView的render方法

```java
 public void render(@Nullable Map<String, ?> model, HttpServletRequest request, HttpServletResponse response) throws Exception {
        if (this.logger.isDebugEnabled()) {
            this.logger.debug("View " + this.formatViewName() + ", model " + (model != null ? model : Collections.emptyMap()) + (this.staticAttributes.isEmpty() ? "" : ", static attributes " + this.staticAttributes));
        }

        Map<String, Object> mergedModel = this.createMergedOutputModel(model, request, response);
        this.prepareResponse(request, response);
       // 核心
        this.renderMergedOutputModel(mergedModel, this.getRequestToExpose(request), response);
    }
```

继续跟进InternalResourceView的renderMergedOutputModel方法：

```java
protected void renderMergedOutputModel(Map<String, Object> model, HttpServletRequest request, HttpServletResponse response) throws Exception {
        this.exposeModelAsRequestAttributes(model, request);
        this.exposeHelpers(request);
        String dispatcherPath = this.prepareForRendering(request, response);
        RequestDispatcher rd = this.getRequestDispatcher(request, dispatcherPath);
        if (rd == null) {
            throw new ServletException("Could not get RequestDispatcher for [" + this.getUrl() + "]: Check that the corresponding file exists within your web application archive!");
        } else {
            if (this.useInclude(request, response)) {
                response.setContentType(this.getContentType());
                if (this.logger.isDebugEnabled()) {
                    this.logger.debug("Including [" + this.getUrl() + "]");
                }
				// 重定向
                rd.include(request, response);
            } else {
                if (this.logger.isDebugEnabled()) {
                    this.logger.debug("Forwarding to [" + this.getUrl() + "]");
                }
				// 转发
                rd.forward(request, response);
            }

        }
    }
```





