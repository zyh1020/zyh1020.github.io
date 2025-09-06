---
icon: file-lines
# 标题
title: '@DubboReference注解'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-17
# 一个页面可以有多个分类
category:
  - Dubbo
# 一个页面可以有多个标签
tag:
  - 必看
  - Dubbo
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

对于Dubbo用的最多的就是@DubboService用于服务的提供方，@DubboReference用于服务的调用方。
不管是服务端还是客户端，在使用Dubbo的时候都会先使用@EnableDubbo，比如下面的demo：
```java
@SpringBootApplication
@EnableDubbo
public class App {
    public static void main(String[] args) {
        SpringApplication.run(App.class, args);
    }
}
```
@EnableDubbo 是一个组合注解@EnableDubboConfig和@DubboComponentScan，这两个注解分别用于@DubboService、@DubboReference的解析：
```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Inherited
@Documented
@EnableDubboConfig
@DubboComponentScan
public @interface EnableDubbo {
	// 省略，，，，
}
```
@DubboComponentScan注解如下：
```java
@Import({DubboComponentScanRegistrar.class})
public @interface DubboComponentScan {
    String[] value() default {};
    String[] basePackages() default {};
    Class<?>[] basePackageClasses() default {};
}
```

### 一，注册ServiceAnnotationPostProcessor
@DubboComponentScan注解导入DubboComponentScanRegistrar类，org.apache.dubbo.config.spring.context.annotation.DubboComponentScanRegistrar#registerBeanDefinitions方法：
```java
public void registerBeanDefinitions(AnnotationMetadata importingClassMetadata, BeanDefinitionRegistry registry) {
    // 这个导入ReferenceAnnotationBeanPostProcessor用于解析@Reference注解
    DubboSpringInitializer.initialize(registry);
    Set<String> packagesToScan = this.getPackagesToScan(importingClassMetadata);
    // 这个注册ServiceAnnotationPostProcessor用于解析@Service注解
    this.registerServiceAnnotationPostProcessor(packagesToScan, registry);
}
```
org.apache.dubbo.config.spring.context.annotation.DubboComponentScanRegistrar#registerServiceAnnotationPostProcessor方法：
```java
private void registerServiceAnnotationPostProcessor(Set<String> packagesToScan, BeanDefinitionRegistry registry) {
    // 创建ServiceAnnotationPostProcessor的Bean定义
    BeanDefinitionBuilder builder = BeanDefinitionBuilder.rootBeanDefinition(ServiceAnnotationPostProcessor.class);
    builder.addConstructorArgValue(packagesToScan);
    builder.setRole(2);
    AbstractBeanDefinition beanDefinition = builder.getBeanDefinition();
    BeanDefinitionReaderUtils.registerWithGeneratedName(beanDefinition, registry);
}
```
### 二，解析@Service注解
ServiceAnnotationPostProcessor实现了
```java
public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) throws BeansException {
    this.registry = registry;
    this.scanServiceBeans(this.resolvedPackagesToScan, registry);
}
```

```java
public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) throws BeansException {
    this.registry = registry;
    this.scanServiceBeans(this.resolvedPackagesToScan, registry);
}
```

```java
private void scanServiceBeans(Set<String> packagesToScan, BeanDefinitionRegistry registry) {
    this.scanned = true;
    if (CollectionUtils.isEmpty(packagesToScan)) {
        if (this.logger.isWarnEnabled()) {
            this.logger.warn("5-29", "", "", "packagesToScan is empty , ServiceBean registry will be ignored!");
        }

    } else {
        DubboClassPathBeanDefinitionScanner scanner = new DubboClassPathBeanDefinitionScanner(registry, this.environment, this.resourceLoader);
        BeanNameGenerator beanNameGenerator = this.resolveBeanNameGenerator(registry);
        scanner.setBeanNameGenerator(beanNameGenerator);
        Iterator var5 = serviceAnnotationTypes.iterator();

        while(var5.hasNext()) {
            Class<? extends Annotation> annotationType = (Class)var5.next();
            scanner.addIncludeFilter(new AnnotationTypeFilter(annotationType));
        }
	// 排除扫描包
        ScanExcludeFilter scanExcludeFilter = new ScanExcludeFilter();
        scanner.addExcludeFilter(scanExcludeFilter);
        Iterator var13 = packagesToScan.iterator();

        while(true) {
	   // 遍历包
            while(var13.hasNext()) {
                String packageToScan = (String)var13.next();
                if (this.servicePackagesHolder.isPackageScanned(packageToScan)) {
                    if (this.logger.isInfoEnabled()) {
                        this.logger.info("Ignore package who has already bean scanned: " + packageToScan);
                    }
                } else {
		     // 扫包
                    scanner.scan(new String[]{packageToScan});
		     // 找到有@Serivce注解
                    Set<BeanDefinitionHolder> beanDefinitionHolders = this.findServiceBeanDefinitionHolders(scanner, packageToScan, registry, beanNameGenerator);
                    if (!CollectionUtils.isEmpty(beanDefinitionHolders)) {
                        if (this.logger.isInfoEnabled()) {
                            List<String> serviceClasses = new ArrayList(beanDefinitionHolders.size());
                            Iterator var10 = beanDefinitionHolders.iterator();

                            while(var10.hasNext()) {
                                BeanDefinitionHolder beanDefinitionHolder = (BeanDefinitionHolder)var10.next();
                                serviceClasses.add(beanDefinitionHolder.getBeanDefinition().getBeanClassName());
                            }

                            this.logger.info("Found " + beanDefinitionHolders.size() + " classes annotated by Dubbo @Service under package [" + packageToScan + "]: " + serviceClasses);
                        }

                        Iterator var14 = beanDefinitionHolders.iterator();
			// 遍历有@Serivce注解的BeanDefinition
                        while(var14.hasNext()) {
                            BeanDefinitionHolder beanDefinitionHolder = (BeanDefinitionHolder)var14.next();
			     // 生成ServiceBean
                            this.processScannedBeanDefinition(beanDefinitionHolder);
                            this.servicePackagesHolder.addScannedClass(beanDefinitionHolder.getBeanDefinition().getBeanClassName());
                        }
                    } else if (this.logger.isWarnEnabled()) {
                        this.logger.warn("5-28", "No annotations were found on the class", "", "No class annotated by Dubbo @DubboService or @Service was found under package [" + packageToScan + "], ignore re-scanned classes: " + scanExcludeFilter.getExcludedCount());
                    }

                    this.servicePackagesHolder.addScannedPackage(packageToScan);
                }
            }

            return;
        }
    }
}
```
### 三，创建ServiceBean的BeanDefinition
org.apache.dubbo.config.spring.beans.factory.annotation.ServiceAnnotationPostProcessor#processScannedBeanDefinition方法：
```java
private void processScannedBeanDefinition(BeanDefinitionHolder beanDefinitionHolder) {
    Class<?> beanClass = this.resolveClass(beanDefinitionHolder);
    Annotation service = this.findServiceAnnotation(beanClass);
    Map<String, Object> serviceAnnotationAttributes = AnnotationUtils.getAttributes(service, true);
    // 获取Service注解的interfaceName属性
    String serviceInterface = DubboAnnotationUtils.resolveInterfaceName(serviceAnnotationAttributes, beanClass);
    String annotatedServiceBeanName = beanDefinitionHolder.getBeanName();
    // 构建ServiceBean的name
    String beanName = this.generateServiceBeanName(serviceAnnotationAttributes, serviceInterface);
    AbstractBeanDefinition serviceBeanDefinition = this.buildServiceBeanDefinition(serviceAnnotationAttributes, serviceInterface, annotatedServiceBeanName);
    this.registerServiceBeanDefinition(beanName, serviceBeanDefinition, serviceInterface);
}
```
构建ServiceBean的name:
```java
private String generateServiceBeanName(Map<String, Object> serviceAnnotationAttributes, String serviceInterface) {
    ServiceBeanNameBuilder builder = ServiceBeanNameBuilder.create(serviceInterface, this.environment).group((String)serviceAnnotationAttributes.get("group")).version((String)serviceAnnotationAttributes.get("version"));
    return builder.build();
}
```
org.apache.dubbo.config.spring.beans.factory.annotation.ServiceBeanNameBuilder#build方法：
```java
public String build() {
    StringBuilder beanNameBuilder = new StringBuilder("ServiceBean");
    append(beanNameBuilder, this.interfaceClassName);
    append(beanNameBuilder, this.version);
    append(beanNameBuilder, this.group);
    String rawBeanName = beanNameBuilder.toString();
    return this.environment.resolvePlaceholders(rawBeanName);
}
```
可以看到ServiceBean的name = "ServiceBean" + Service注解的interfaceName属性 + Service注解的this.version属性 + Service注解的this.group属性。
org.apache.dubbo.config.spring.beans.factory.annotation.ServiceAnnotationPostProcessor#buildServiceBeanDefinition方法：
```java
private AbstractBeanDefinition buildServiceBeanDefinition(Map<String, Object> serviceAnnotationAttributes, String serviceInterface, String refServiceBeanName) {
    // 创建ServiceBean
    BeanDefinitionBuilder builder = BeanDefinitionBuilder.rootBeanDefinition(ServiceBean.class);
    AbstractBeanDefinition beanDefinition = builder.getBeanDefinition();
    beanDefinition.setAutowireMode(3);
    MutablePropertyValues propertyValues = beanDefinition.getPropertyValues();
    String[] ignoreAttributeNames = (String[])ObjectUtils.of(new String[]{"provider", "monitor", "application", "module", "registry", "protocol", "methods", "interfaceName", "parameters", "executor"});
    propertyValues.addPropertyValues(new AnnotationPropertyValuesAdapter(serviceAnnotationAttributes, this.environment, ignoreAttributeNames));
    this.addPropertyReference(builder, "ref", refServiceBeanName);
    builder.addPropertyValue("interface", serviceInterface);
    builder.addPropertyValue("parameters", DubboAnnotationUtils.convertParameters((String[])((String[])serviceAnnotationAttributes.get("parameters"))));
    List<MethodConfig> methodConfigs = this.convertMethodConfigs(serviceAnnotationAttributes.get("methods"));
    if (!methodConfigs.isEmpty()) {
        builder.addPropertyValue("methods", methodConfigs);
    }

    String providerConfigId = (String)serviceAnnotationAttributes.get("provider");
    if (StringUtils.hasText(providerConfigId)) {
        this.addPropertyValue(builder, "providerIds", providerConfigId);
    }

    String[] registryConfigIds = (String[])((String[])serviceAnnotationAttributes.get("registry"));
    if (registryConfigIds != null && registryConfigIds.length > 0) {
        this.resolveStringArray(registryConfigIds);
        builder.addPropertyValue("registryIds", StringUtils.join(registryConfigIds, ','));
    }

    String[] protocolConfigIds = (String[])((String[])serviceAnnotationAttributes.get("protocol"));
    if (protocolConfigIds != null && protocolConfigIds.length > 0) {
        this.resolveStringArray(protocolConfigIds);
        builder.addPropertyValue("protocolIds", StringUtils.join(protocolConfigIds, ','));
    }

    String monitorConfigId = (String)serviceAnnotationAttributes.get("monitor");
    if (StringUtils.hasText(monitorConfigId)) {
        this.addPropertyReference(builder, "monitor", monitorConfigId);
    }

    String moduleConfigId = (String)serviceAnnotationAttributes.get("module");
    if (StringUtils.hasText(moduleConfigId)) {
        this.addPropertyReference(builder, "module", moduleConfigId);
    }

    String executorBeanName = (String)serviceAnnotationAttributes.get("executor");
    if (StringUtils.hasText(executorBeanName)) {
        this.addPropertyReference(builder, "executor", executorBeanName);
    }

    builder.setLazyInit(false);
    return builder.getBeanDefinition();
}
```
### 四，ServiceBean
一般生成代理对象，都会有一个 invoker方法，但ServiceBean没有，这是因为ServiceBean 只是存储DubboService的相关信息，后面还会生成一个真正invoker
```java
public class ServiceBean<T> extends ServiceConfig<T> implements InitializingBean, DisposableBean, ApplicationContextAware, BeanNameAware, ApplicationEventPublisherAware {

```
实现了InitializingBean接口org.apache.dubbo.config.spring.ServiceBean#afterPropertiesSet方法：
```java
public void afterPropertiesSet() throws Exception {
    if (StringUtils.isEmpty(this.getPath()) && StringUtils.isNotEmpty(this.getInterface())) {
        this.setPath(this.getInterface());
    }
    // 获取ModuleModel
    ModuleModel moduleModel = DubboBeanUtils.getModuleModel(this.applicationContext);
    moduleModel.getConfigManager().addService(this);
    moduleModel.getDeployer().setPending();
}
```
此时服务并未真正导出，而是将配置保存到 ConfigManager 中，等待后续统一处理，当 Spring 容器初始化完成后，通过 DubboBootstrapApplicationListener 监听 ContextRefreshedEvent 事件，启动模块部署：
```java
public void onApplicationEvent(ApplicationEvent event) {
    if (this.isOriginalEventSource(event)) {
        if (event instanceof DubboConfigInitEvent) {
            this.initDubboConfigBeans();
        } else if (event instanceof ApplicationContextEvent) {
	    // spring的事件
            this.onApplicationContextEvent((ApplicationContextEvent)event);
        }
    }

}
private void onApplicationContextEvent(ApplicationContextEvent event) {
    if (DubboBootstrapStartStopListenerSpringAdapter.applicationContext == null) {
        DubboBootstrapStartStopListenerSpringAdapter.applicationContext = event.getApplicationContext();
    }

    if (event instanceof ContextRefreshedEvent) {
	// 刷新事件
        this.onContextRefreshedEvent((ContextRefreshedEvent)event);
    } else if (event instanceof ContextClosedEvent) {
        this.onContextClosedEvent((ContextClosedEvent)event);
    }

}

private void onContextRefreshedEvent(ContextRefreshedEvent event) {
    if (this.bootstrap.getTakeoverMode() == BootstrapTakeoverMode.SPRING) {
        this.moduleModel.getDeployer().start();
    }

}

```
org.apache.dubbo.config.deploy.DefaultModuleDeployer#start方法：
```java
public Future start() throws IllegalStateException {
    this.applicationDeployer.initialize();
    return this.startSync();
}

private synchronized Future startSync() throws IllegalStateException {
    if (!this.isStopping() && !this.isStopped() && !this.isFailed()) {
        try {
            if (this.isStarting() || this.isStarted()) {
                return this.startFuture;
            }

            this.onModuleStarting();
            this.initialize();
            this.exportServices();
            if (this.moduleModel != this.moduleModel.getApplicationModel().getInternalModule()) {
                this.applicationDeployer.prepareInternalModule();
            }

            this.referServices();
            if (this.asyncExportingFutures.isEmpty() && this.asyncReferringFutures.isEmpty()) {
                this.onModuleStarted();
                this.registerServices();
                this.checkReferences();
                this.completeStartFuture(true);
            } else {
                this.frameworkExecutorRepository.getSharedExecutor().submit(() -> {
                    try {
                        this.waitExportFinish();
                        this.waitReferFinish();
                        this.onModuleStarted();
                        this.registerServices();
                        this.checkReferences();
                    } catch (Throwable var5) {
                        logger.warn("5-23", "", "", "wait for export/refer services occurred an exception", var5);
                        this.onModuleFailed(this.getIdentifier() + " start failed: " + var5, var5);
                    } finally {
                        this.completeStartFuture(true);
                    }

                });
            }
        } catch (Throwable var2) {
            this.onModuleFailed(this.getIdentifier() + " start failed: " + var2, var2);
            throw var2;
        }

        return this.startFuture;
    } else {
        throw new IllegalStateException(this.getIdentifier() + " is stopping or stopped, can not start again");
    }
}

private void exportServices() {
    // 取出serviceBean
    Iterator var1 = this.configManager.getServices().iterator();

    while(var1.hasNext()) {
        ServiceConfigBase sc = (ServiceConfigBase)var1.next();
        this.exportServiceInternal(sc);
    }

}
private void exportServiceInternal(ServiceConfigBase sc) {
    ServiceConfig<?> serviceConfig = (ServiceConfig)sc;
    if (!serviceConfig.isRefreshed()) {
        serviceConfig.refresh();
    }

    if (!sc.isExported()) {
        if (!this.exportAsync && !sc.shouldExportAsync()) {
            if (!sc.isExported()) {
                sc.export(RegisterTypeEnum.AUTO_REGISTER_BY_DEPLOYER);
                this.exportedServices.add(sc);
            }
        } else {
            ExecutorService executor = this.executorRepository.getServiceExportExecutor();
            CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                try {
                    if (!sc.isExported()) {
                        sc.export();
                        this.exportedServices.add(sc);
                    }
                } catch (Throwable var3) {
                    logger.error("5-9", "", "", "Failed to async export service config: " + this.getIdentifier() + " , catch error : " + var3.getMessage(), var3);
                }

            }, executor);
            this.asyncExportingFutures.add(future);
        }

    }
}

```
org.apache.dubbo.config.ServiceConfigBase#export()的方法：
```java
public final void export() {
    this.export(RegisterTypeEnum.AUTO_REGISTER);
}
public void export(RegisterTypeEnum registerType) {
    if (!this.exported) {
        if (this.getScopeModel().isLifeCycleManagedExternally()) {
            this.getScopeModel().getDeployer().prepare();
        } else {
            this.getScopeModel().getDeployer().start();
        }

        synchronized(this) {
            if (!this.exported) {
                if (!this.isRefreshed()) {
                    this.refresh();
                }

                if (this.shouldExport()) {
                    this.init();
                    if (this.shouldDelay()) {
                        this.doDelayExport();
                    } else if (Integer.valueOf(-1).equals(this.getDelay()) && Boolean.parseBoolean(ConfigurationUtils.getProperty(this.getScopeModel(), "dubbo.application.manual-register", "false"))) {
                        this.doExport(RegisterTypeEnum.MANUAL_REGISTER);
                    } else {
                        this.doExport(registerType);
                    }
                }

            }
        }
    }
}

```
