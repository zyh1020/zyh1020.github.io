---
icon: file-lines
title: SpringBoot自动装配原理
author: Ms.Zyh
date: 2024-09-23
category:
  - SpringBoot
tag:
  - 基础
  - SpringBoot
sticky: false
star: true
---

### 一，SpringBoot自动装配原理

<img src="http://img.zouyh.top/article-img/20240917135055312.png" alt="image-20230313155332664" style="zoom: 67%;" />

```java
@SpringBootApplication
public class Springbootday01Application {
    public static void main(String[] args) {
        SpringApplication.run(Springbootday01Application.class, args);
   }
}
```

`@SpringBootApplication`作用是Spring Boot应用标注在某个类上说明这个类是SpringBoot的主配置类，SpringBoot就应该运行这个类的main方法来启动SpringBoot应用；

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@SpringBootConfiguration // 标记①
@EnableAutoConfiguration // 标记②
@ComponentScan(
    excludeFilters = {@Filter(type = FilterType.CUSTOM,classes = {TypeExcludeFilter.class}),
                      @Filter(type = FilterType.CUSTOM, classes = {AutoConfigurationExcludeFilter.class})}
)
public @interface SpringBootApplication {
```

标记①，`@SpringBootConfiguration`作用是标注在某个类上，表示这是一个Spring Boot的配置类；

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Configuration
public @interface SpringBootConfiguration {
}
```

`@Configuration`：spring的底层注解，作用是标注在某个类上，表示这是一个的配置类；配置类也是容器中的一个组件，通过`@Component`方式注入；一个配置类代表一个配置文件

标记②，`@EnableAutoConfiguration`开启自动配置，注解源码：

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@AutoConfigurationPackage // 标记③
@Import({AutoConfigurationImportSelector.class})// 标记④
public @interface EnableAutoConfiguration {
```

标记③，`@AutoConfigurationPackage`注解，作用将主配置类即`@SpringBootApplication`标注的类的所在包及下面所有子包里面的所有组件扫描到Spring容器；

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@Import({Registrar.class})
public @interface AutoConfigurationPackage {
}
```

`@Import({Registrar.class})`作用是给容器中导入Registrar类，Registrar类是AutoConfigurationPackages的静态内部类，Registrar源码：

```java
static class Registrar implements ImportBeanDefinitionRegistrar, DeterminableImports {
    Registrar() {
    }
    public void registerBeanDefinitions(AnnotationMetadata metadata, BeanDefinitionRegistry registry) {
      
        AutoConfigurationPackages.register(registry, (new AutoConfigurationPackages.PackageImport(metadata)).getPackageName());
    }
    public Set<Object> determineImports(AnnotationMetadata metadata) {
        return Collections.singleton(new AutoConfigurationPackages.PackageImport(metadata));
    }
}
```

发现`Registrar`实现了`ImportBeanDefinitionRegistrar`，会调用registerBeanDefinitions方法为容器添加Bean。上面的源码中`                new AutoConfigurationPackages.PackageImport(metadata)).getPackageName()`获取的值就是`@SpringBootApplication`注解的所在包,那metadata又是什么呢？metadata是我们的主启动类的全类名。跟进`AutoConfigurationPackages.register`方法:

```java
public static void register(BeanDefinitionRegistry registry, String... packageNames) {
    // 判断有没有注册过BEAN = AutoConfigurationPackages类
    if (registry.containsBeanDefinition(BEAN)) {
        AutoConfigurationPackages.BasePackagesBeanDefinition beanDefinition = (AutoConfigurationPackages.BasePackagesBeanDefinition)registry.getBeanDefinition(BEAN);
        beanDefinition.addBasePackages(packageNames);
    } else { // 没有注册过就扫描packageNames所在包及子包里面所有组件
        registry.registerBeanDefinition(BEAN, new AutoConfigurationPackages.BasePackagesBeanDefinition(packageNames));
    }

}
```

标记④，`@Import({AutoConfigurationImportSelector.class})`中AutoConfigurationImportSelector实现DeferredImportSelector接口，DeferredImportSelector接口是继承ImportSelector类的，但是并没有重写selectImports方法，DeferredImportSelector有两个特点：

- 继承该接口的会在所有@Configuration配置类处理完后运行。
- 如果定义了一个以上的DeferredImportSelector则使用Order接口来进行排序。这一点也是在 `this.deferredImportSelectorHandler.process();` 中进行了排序调用。

回顾一下SpringIOC加载流程验证中DeferredImportSelector的两个特点，SpringIOC加载流程验证中，会调用ConfigurationClassPostProcessor的postProcessBeanDefinitionRegistry方法，解析配置类：

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
                   // `@componentScans`、`@propertySource`、`@Bean`等注解解析完了, 包括`@Import`实现`ImportBeanDefinitionRegistrar`和`ImportSelector`接口的类解析方法
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

由SpringIOC的加载流程可以看出，DeferredImportSelector的process方法，是在`@componentScans`、`@propertySource`、`@Bean`等注解，包括`@Import`实现`ImportBeanDefinitionRegistrar`和`ImportSelector`接口的类都解析完后执行的

 跟进`this.deferredImportSelectorHandler.process(); `方法：

```java
public void process() {
	// 获取待处理的 DeferredImportSelectorHolder
	List<DeferredImportSelectorHolder> deferredImports = this.deferredImportSelectors;
	this.deferredImportSelectors = null;
	try {
		if (deferredImports != null) {
			DeferredImportSelectorGroupingHandler handler = new DeferredImportSelectorGroupingHandler();
			// 排序
			deferredImports.sort(DEFERRED_IMPORT_COMPARATOR);
			// 根据不同的group 进行分组注册按照分组调用
			deferredImports.forEach(handler::register);
			handler.processGroupImports();
		}
	}
	finally {
		this.deferredImportSelectors = new ArrayList<>();
	}
}
```

根据不同的group 进行分组注册 ，跟进`handler::register`方法：

```java
public void register(DeferredImportSelectorHolder deferredImport) {
	// 获取当前 DeferredImportSelector的Group
	Class<? extends Group> group = deferredImport.getImportSelector().getImportGroup();
	DeferredImportSelectorGrouping grouping = this.groupings.computeIfAbsent(
			(group != null ? group : deferredImport),
			key -> new DeferredImportSelectorGrouping(createGroup(group)));
	// 将当前 DeferredImportSelector 添加到同一分组中的
	grouping.add(deferredImport);
	// 保存需要处理的配置类
	this.configurationClasses.put(deferredImport.getConfigurationClass().getMetadata(),
			deferredImport.getConfigurationClass());
}

```

跟进` deferredImport.getImportSelector().getImportGroup();`方法获取当前 DeferredImportSelector的Group

```java
public Iterable<Group.Entry> getImports() {
	for (DeferredImportSelectorHolder deferredImport : this.deferredImports) {
		// 调用 DeferredImportSelector.Group#process
		this.group.process(deferredImport.getConfigurationClass().getMetadata(),
				deferredImport.getImportSelector());
	}
	// 调用 DeferredImportSelector.Group#selectImports
	return this.group.selectImports();
}
```

综上可以看到 DeferredImportSelector 的处理过程并非是直接调用ImportSelector#selectImports方法。而是调用 `DeferredImportSelector.Group#process` 和 `Group#selectImports`方法来完成引入功能，且方法调用是在`@componentScans`、`@propertySource`、`@Bean`等注解，包括`@Import`实现`ImportBeanDefinitionRegistrar`和`ImportSelector`接口的类都解析完后执行的。

回到SpringBoot自动装配，AutoConfigurationImportSelector的内部类AutoConfigurationGroup实现了Group接口，内部类AutoConfigurationGroup的process方法如下：

```java
public void process(AnnotationMetadata annotationMetadata, DeferredImportSelector deferredImportSelector) {
            Assert.state(deferredImportSelector instanceof AutoConfigurationImportSelector, () -> {
                return String.format("Only %s implementations are supported, got %s", AutoConfigurationImportSelector.class.getSimpleName(), deferredImportSelector.getClass().getName());
            });
    		// 获取自动装配类
            AutoConfigurationImportSelector.AutoConfigurationEntry autoConfigurationEntry = ((AutoConfigurationImportSelector)deferredImportSelector).getAutoConfigurationEntry(annotationMetadata);
    
    		// 存放在了this.autoConfigurationEntries集合中
            this.autoConfigurationEntries.add(autoConfigurationEntry);
            Iterator var4 = autoConfigurationEntry.getConfigurations().iterator();
            while(var4.hasNext()) {
                String importClassName = (String)var4.next();
                this.entries.putIfAbsent(importClassName, annotationMetadata);
            }

        }
```

内部类AutoConfigurationGroup的selectImports方法如下：

```java
@Override
public Iterable<Entry> selectImports() {
	if (this.autoConfigurationEntries.isEmpty()) {
		return Collections.emptyList();
	}
	// 对 process方法读取到的存放在了this.autoConfigurationEntries集合中的自动装配类，进行排除过滤
    //  AutoConfigurationEntry::getExclusions方法是获取
	Set<String> allExclusions = this.autoConfigurationEntries.stream()
.map(AutoConfigurationEntry::getExclusions).flatMap(Collection::stream).collect(Collectors.toSet());
	// 获取所有经过自动化配置过滤器的配置类AutoConfigurationEntry::getConfigurations方法获取 META-INF/spring.factories的中的 org.springframework.boot.autoconfigure.AutoConfigurationImportFilter
	Set<String> processedConfigurations = this.autoConfigurationEntries.stream()
			.map().flatMap(Collection::stream)
			.collect(Collectors.toCollection(LinkedHashSet::new));
	// 排除过滤后配置类中需要排除的类
	processedConfigurations.removeAll(allExclusions);
	return sortAutoConfigurations(processedConfigurations, getAutoConfigurationMetadata()).stream()
			.map((importClassName) -> new Entry(this.entries.get(importClassName), importClassName))
			.collect(Collectors.toList());
}

```

回到AutoConfigurationGroup的process方法跟进，获取自动装配类的方法`((AutoConfigurationImportSelector)deferredImportSelector).getAutoConfigurationEntry(annotationMetadata);`方法：

```java
 protected AutoConfigurationImportSelector.AutoConfigurationEntry getAutoConfigurationEntry(AnnotationMetadata annotationMetadata) {
        if (!this.isEnabled(annotationMetadata)) {// 判断有没有启动自动装配
            return EMPTY_ENTRY;
        } else {
            AnnotationAttributes attributes = this.getAttributes(annotationMetadata);
            // 获取自动装配类
            List<String> configurations = this.getCandidateConfigurations(annotationMetadata, attributes);
            // 去重
            configurations = this.removeDuplicates(configurations);
            // 根据EnableAutoConfiguration注解中属性，获取不需要自动装配的类名单
            Set<String> exclusions = this.getExclusions(annotationMetadata, attributes);
            this.checkExcludedClasses(configurations, exclusions);
            // 排除
            configurations.removeAll(exclusions);
            // 根据pom依赖中添加的starte过滤出有效的配置类
            configurations = this.getConfigurationClassFilter().filter(configurations);
            this.fireAutoConfigurationImportEvents(configurations, exclusions);
            return new AutoConfigurationImportSelector.AutoConfigurationEntry(configurations, exclusions);
        }
    }

```

获取自动装配类，跟进`this.getCandidateConfigurations(annotationMetadata, attributes)`方法：

```java
 protected List<String> getCandidateConfigurations(AnnotationMetadata metadata, AnnotationAttributes attributes) {
        // this.getSpringFactoriesLoaderFactoryClass()方法获取的是EnableAutoConfiguration.class这个值是确定META-INF/spring.factories的中的那个键的
     	// this.getBeanClassLoader()方法获取的当前AutoConfigurationImportSelector的类加载器，这个值是确定那个META-INF/spring.factories的
        List<String> configurations = SpringFactoriesLoader.loadFactoryNames(this.getSpringFactoriesLoaderFactoryClass(), this.getBeanClassLoader());
        Assert.notEmpty(configurations, "No auto configuration classes found in META-INF/spring.factories. If you are using a custom packaging, make sure that file is correct.");
        return configurations;
    }
```

继续跟进`SpringFactoriesLoader.loadFactoryNames(this.getSpringFactoriesLoaderFactoryClass(), this.getBeanClassLoader());`方法：

```java
public static List<String> loadFactoryNames(Class<?> factoryType, @Nullable ClassLoader classLoader) {
    ClassLoader classLoaderToUse = classLoader;
    if (classLoader == null) {
        classLoaderToUse = SpringFactoriesLoader.class.getClassLoader();
    }
	// factoryType是EnableAutoConfiguration.class所以factoryTypeName是org.springframework.boot.autoconfigure.EnableAutoConfiguration
    String factoryTypeName = factoryType.getName(); 
    // loadSpringFactories方法获取当前AutoConfigurationImportSelector的类加载器资源目录下的META-INF/spring.factories文件内容
    // 然后通过getOrDefault筛选出rg.springframework.boot.autoconfigure.EnableAutoConfiguration的值
    return (List)loadSpringFactories(classLoaderToUse).getOrDefault(factoryTypeName, Collections.emptyList());
}
```

继续跟进`loadSpringFactories`方法：加载器资源目录下的META-INF/spring.factories文件内容

```java
 private static Map<String, List<String>> loadSpringFactories(ClassLoader classLoader) {
        Map<String, List<String>> result = (Map)cache.get(classLoader);
        if (result != null) {
            return result;
        } else {
            HashMap result = new HashMap();

            try {
                // 获取会去所有的jar包和类路径下找/META-INF/spring.factories文件获得候选的自动配置类
 				Enumeration urls = classLoader.getResources("META-INF/spring.factories");
                while(urls.hasMoreElements()) {
                    URL url = (URL)urls.nextElement();
                    UrlResource resource = new UrlResource(url);
                    Properties properties = PropertiesLoaderUtils.loadProperties(resource);
                    Iterator var6 = properties.entrySet().iterator();

                    while(var6.hasNext()) {
                        Entry<?, ?> entry = (Entry)var6.next();
                        String factoryTypeName = ((String)entry.getKey()).trim();
                        String[] factoryImplementationNames = StringUtils.commaDelimitedListToStringArray((String)entry.getValue());
                        String[] var10 = factoryImplementationNames;
                        int var11 = factoryImplementationNames.length;

                        for(int var12 = 0; var12 < var11; ++var12) {
                            String factoryImplementationName = var10[var12];
                            ((List)result.computeIfAbsent(factoryTypeName, (key) -> {
                                return new ArrayList();
                            })).add(factoryImplementationName.trim());
                        }
                    }
                }

                result.replaceAll((factoryType, implementations) -> {
                    return (List)implementations.stream().distinct().collect(Collectors.collectingAndThen(Collectors.toList(), Collections::unmodifiableList));
                });
                cache.put(classLoader, result);
                return result;
            } catch (IOException var14) {
                throw new IllegalArgumentException("Unable to load factories from location [META-INF/spring.factories]", var14);
            }
        }
    }
```

任何一个springboot应用，都会引入`spring-boot-autoconfigure`，而spring.factories文件就在该包下面`META-INF/spring.factories`文件内容如下：

```properties
# Auto Configure
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
org.springframework.boot.autoconfigure.admin.SpringApplicationAdminJmxAutoConfiguration,\
org.springframework.boot.autoconfigure.aop.AopAutoConfiguration,\
org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration,\
org.springframework.boot.autoconfigure.batch.BatchAutoConfiguration,\
org.springframework.boot.autoconfigure.cache.CacheAutoConfiguration,\
org.springframework.boot.autoconfigure.cassandra.CassandraAutoConfiguration,
// 太多了省略一下
# Auto Configuration Import Filters
org.springframework.boot.autoconfigure.AutoConfigurationImportFilter=\
org.springframework.boot.autoconfigure.condition.OnBeanCondition,\
org.springframework.boot.autoconfigure.condition.OnClassCondition,\
org.springframework.boot.autoconfigure.condition.OnWebApplicationCondition

```

以`HttpEncodingAutoConfiguration`（Http编码自动配置）为例解释自动配置原理

```java
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ServerProperties.class)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnClass(CharacterEncodingFilter.class)
@ConditionalOnProperty(prefix = "server.servlet.encoding", value = "enabled", matchIfMissing = true)
public class HttpEncodingAutoConfiguration {
   private final Encoding properties;
   public HttpEncodingAutoConfiguration(ServerProperties properties) {
      this.properties = properties.getServlet().getEncoding();
   }

   @Bean
   @ConditionalOnMissingBean
   public CharacterEncodingFilter characterEncodingFilter() {
      CharacterEncodingFilter filter = new OrderedCharacterEncodingFilter();
      filter.setEncoding(this.properties.getCharset().name());
      filter.setForceRequestEncoding(this.properties.shouldForce(Encoding.Type.REQUEST));
      filter.setForceResponseEncoding(this.properties.shouldForce(Encoding.Type.RESPONSE));
      return filter;
   }
```

`@xxxConditional`根据当前不同的条件判断，必须是@Conditional指定的条件成立，才给容器中添加组件，配置配里面的所有内容才生效；

| 扩展注解作用                    | 判断是否满足当前指定条件                         |
| ------------------------------- | ------------------------------------------------ |
| @ConditionalOnJava              | 系统的java版本是否符合要求                       |
| @ConditionalOnBean              | 容器中存在指定Bean；                             |
| @ConditionalOnMissingBean       | 容器中不存在指定Bean；                           |
| @ConditionalOnExpression        | 满足SpEL表达式指定                               |
| @ConditionalOnClass             | 系统中有指定的类                                 |
| @ConditionalOnMissingClass      | 系统中没有指定的类                               |
| @ConditionalOnSingleCandidate   | 容器中只有一个指定的Bean，或者这个Bean是首选Bean |
| @ConditionalOnProperty          | 系统中指定的属性是否有指定的值                   |
| @ConditionalOnResource          | 类路径下是否存在指定资源文件                     |
| @ConditionalOnWebApplication    | 当前是web环境                                    |
| @ConditionalOnNotWebApplication | 当前不是web环境                                  |
| @ConditionalOnJndi              | JNDI存在指定项                                   |

 我们怎么知道哪些自动配置类生效；我们可以通过设置配置文件appliaction.properties 中：启用 `debug=true`属性；来让控制台打印自动配置报告，这样我们就可以很方便的知道哪些自动配置类生效；

下面我么就以`HttpEncodingAutoConfiguration`使用到的的注解为例说明自动配置原理；

- `@Configuration`：表示这是一个配置类，以前编写的配置文件一样，也可以给容器中添加组件。
- `@ConditionalOnWebApplication`： 判断当前应用是否是web应用，如果是，当前配置类生效。
- `@ConditionalOnClass`：判断当前项目有没有这个类`CharacterEncodingFilter`；SpringMVC中进行乱码解决的过滤器。
- `@ConditionalOnProperty`：判断配置文件中是否存在某个配置 `spring.http.encoding.enabled`；如果不存在，判断也是成立的即使我们配置文件中不配置`pring.http.encoding.enabled=true`，也是默认是true的。

- `@EnableConfigurationProperties({ServerProperties.class})`：将配置文件中对应的值和 ServerProperties绑定起来；并把 ServerProperties加入到 IOC 容器中。并注册`ConfigurationPropertiesBindingPostProcessor`用于将`@ConfigurationProperties`的类和配置进行绑定

ServerProperties类的源码：

```java
@ConfigurationProperties( prefix = "server",ignoreUnknownFields = true)
public class ServerProperties {
    private Integer port; // 端口
    private InetAddress address;
    @NestedConfigurationProperty
    private final ErrorProperties error = new ErrorProperties();
    private ServerProperties.ForwardHeadersStrategy forwardHeadersStrategy;
    private String serverHeader;
    private DataSize maxHttpHeaderSize = DataSize.ofKilobytes(8L);
    private Shutdown shutdown;
    @NestedConfigurationProperty
    private Ssl ssl;
    @NestedConfigurationProperty
    private final Compression compression;
    @NestedConfigurationProperty
    private final Http2 http2;
    private final ServerProperties.Servlet servlet;
    private final ServerProperties.Tomcat tomcat;
    private final ServerProperties.Jetty jetty;
    private final ServerProperties.Netty netty;
    private final ServerProperties.Undertow undertow;
    // 省略.....
```

ServerProperties通过 `@ConfigurationProperties`注解将配置文件与自身属性绑定，而`@EnableConfigurationProperties`主要是把以绑定值JavaBean加入到spring容器中。到这里，小伙伴们应该明白，我们在application.properties 声明`server.port`是通过`@ConfigurationProperties`注解，绑定到对应的XxxxProperties配置实体类上，然后再通过`@EnableConfigurationProperties`注解导入到Spring容器中。
