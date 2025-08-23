---
icon: document
# 标题
title: 'spring整合mybatis源码解析'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-24
# 一个页面可以有多个分类
category:
  - Mybatis
# 一个页面可以有多个标签
tag:
  - 基础
  - Mybatis
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，spring整合mybatis源码解析

mybatis单独使用的简单例子：

```java
public class App {
	public static void main(String[] args) {
		String resource = "mybatis‐config.xml";
		Reader reader;
		try {
			//将XML配置文件构建为Configuration配置类
			reader = Resources.getResourceAsReader(resource);
			// 通过加载配置文件流构建一个SqlSessionFactory DefaultSqlSessionFactory
			SqlSessionFactory sqlSessionFactory = new SqlSessionFactoryBuilder().build(reader);
			// 数据源 执行器 DefaultSqlSession
			SqlSession session = sqlSessionFactory.openSession();
			try {
				// 执行查询 底层执行jdbc
				//User user = (User)session.selectOne("com.tuling.mapper.selectById", 1);
				UserMapper mapper = session.getMapper(UserMapper.class);
				System.out.println(mapper.getClass());
				User user = mapper.selectById(1L);
				System.out.println(user.getUserName());
			} catch (Exception e) {
 				e.printStackTrace();
 			}finally {
 				session.close();
			}
		} catch (IOException e) {
			e.printStackTrace();
		}
	}
}
```

spring整合mybatis配置例子：

```java
@Configuration
@MapperScan(basePackages = "com.asiainfo.kf.mapper.two",sqlSessionFactoryRef = "twoSqlSessionFactory")
public class TwoDataSourceConfig {
    @Bean("twoDateSource")
    @ConfigurationProperties(prefix = "spring.datasource.two")
    public DataSource oneDateSource(){
        return new DruidDataSource();
    }
    @Bean("twoSqlSessionFactory")
    public SqlSessionFactory twoSqlSessionFactory(@Qualifier("twoDateSource") DataSource dataSource) throws Exception {
        SqlSessionFactoryBean bean = new SqlSessionFactoryBean();
        bean.setDataSource(dataSource);
        bean.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath:mapper/two/**/*.xml"));
        return bean.getObject();
    }
}
```



#### 1.1sqlSession的创建

对比这两个简单配置mybatis单独使用是通过`SqlSessionFactoryBuilder`的`build()`方法创建SqlSessionFactory 的：

```java
SqlSessionFactory sqlMapper = new SqlSessionFactoryBuilder().build(reader);
```

spring整合mybatis是通过`SqlSessionFactoryBean`的`getObject()`方法创建SqlSessionFactory 的:

```java
@Bean("twoSqlSessionFactory")
    public SqlSessionFactory twoSqlSessionFactory(@Qualifier("twoDateSource") DataSource dataSource) throws Exception {
        SqlSessionFactoryBean bean = new SqlSessionFactoryBean();
        bean.setDataSource(dataSource);
        bean.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath:mapper/two/**/*.xml"));
        return bean.getObject();
}
```

所以spring整合mybatis关键就在于SqlSessionFactoryBean，SqlSessionFactoryBean的部分源码和实现的接口：

```java
public class SqlSessionFactoryBean implements FactoryBean<SqlSessionFactory>, InitializingBean, ApplicationListener<ApplicationEvent> {
    private static final Logger LOGGER = LoggerFactory.getLogger(SqlSessionFactoryBean.class);
    private static final ResourcePatternResolver RESOURCE_PATTERN_RESOLVER = new PathMatchingResourcePatternResolver();
    private static final MetadataReaderFactory METADATA_READER_FACTORY = new CachingMetadataReaderFactory();
    private Resource configLocation; // mybatis的核心配置文件
    private Configuration configuration; // 配置类
    private Resource[] mapperLocations; // mapper配置文件所在位置
    private DataSource dataSource; // 数据源
    private TransactionFactory transactionFactory; 
    private Properties configurationProperties; // 类比于mybatis核心配置文件的Properties
    // 创建SqlSessionFactory的
    private SqlSessionFactoryBuilder sqlSessionFactoryBuilder = new SqlSessionFactoryBuilder();
    // SqlSessionFactory
    private SqlSessionFactory sqlSessionFactory;
    // 类比于mybatis核心配置文件的environment
    private String environment = SqlSessionFactoryBean.class.getSimpleName();
    private boolean failFast;
    private Interceptor[] plugins; // 类比于mybatis核心配置文件的plugins
    private TypeHandler<?>[] typeHandlers; // 类比于mybatis核心配置文件的typeHandlers
    private String typeHandlersPackage;
    private Class<? extends TypeHandler> defaultEnumTypeHandler;
    private Class<?>[] typeAliases;  // 类比于mybatis核心配置文件的typeAliases
    private String typeAliasesPackage;
    private Class<?> typeAliasesSuperType;
    private LanguageDriver[] scriptingLanguageDrivers;
    private Class<? extends LanguageDriver> defaultScriptingLanguageDriver;
    private DatabaseIdProvider databaseIdProvider;
    private Class<? extends VFS> vfs;
    private Cache cache; // 类比于mybatis核心配置文件的cache
    private ObjectFactory objectFactory;
    private ObjectWrapperFactory objectWrapperFactory;
}
```

①，由上源码可以看出SqlSessionFactoryBean实现了FactoryBean接口，查看SqlSessionFactoryBean的getObject()方法：

```java
public SqlSessionFactory getObject() throws Exception {
        if (this.sqlSessionFactory == null) {
            this.afterPropertiesSet();
        }

        return this.sqlSessionFactory; // 最终返回的是sqlSessionFactory
    }
```

​	FactoryBean接口的作用是在创建Bean的是通过`getObject()`方法返回的Bean，这也是为什么我写的spring整合mybatis的配置中通过SqlSessionFactoryBean的`getObject()`方法返回SqlSessionFactory，而有时候我们会看到配置的没有调用`getObject()`方法直接返回SqlSessionFactoryBean，就是因为SqlSessionFactoryBean实现了FactoryBean接口，就算我们不手动`getObject()`方法，Spring也会自动调用`getObject()`方法创建SqlSessionFactory的。

②，由上源码可知SqlSessionFactoryBean还实现了InitializingBean接口，在spring中实现InitializingBean接口的会在初始化的时候调用`afterPropertiesSet()`方法，跟进SqlSessionFactoryBean的`afterPropertiesSet()`方法：

```java
public void afterPropertiesSet() throws Exception {
    	// this.dataSource和this.sqlSessionFactoryBuilder属性不能null
        Assert.notNull(this.dataSource, "Property 'dataSource' is required");
        Assert.notNull(this.sqlSessionFactoryBuilder, "Property 'sqlSessionFactoryBuilder' is required");
    	// configuration和configLocation属性不能同时设置
        Assert.state(this.configuration == null && this.configLocation == null || this.configuration == null || this.configLocation == null, "Property 'configuration' and 'configLocation' can not specified with together");
    	// 通过buildSqlSessionFactory方法创建SqlSessionFactory，赋值给成员变量this.sqlSessionFactory
    	// SqlSessionFactoryBean实现了FactoryBean接口，FactoryBean接口的作用是在创建Bean的是通过getObject()方法返回，getObject()方法返的就是this.sqlSessionFactory成员变量
        this.sqlSessionFactory = this.buildSqlSessionFactory();
    }
```

继续跟进` this.buildSqlSessionFactory();`方法：

```java
protected SqlSessionFactory buildSqlSessionFactory() throws Exception {
    	// XMLConfigBuilder这个类用于解析mybatis核心配置文件
        XMLConfigBuilder xmlConfigBuilder = null;
        Configuration targetConfiguration;
        if (this.configuration != null) { // spring整合mybatis的配置时传入了configuration
            targetConfiguration = this.configuration;
            if (targetConfiguration.getVariables() == null) {
                targetConfiguration.setVariables(this.configurationProperties);
            } else if (this.configurationProperties != null) {
                targetConfiguration.getVariables().putAll(this.configurationProperties);
            }
        } else if (this.configLocation != null) { // spring整合mybatis的配置时传入了 mybatis核心配置文件
            xmlConfigBuilder = new XMLConfigBuilder(this.configLocation.getInputStream(), (String)null, this.configurationProperties); // 解析mybatis核心配置文件
            targetConfiguration = xmlConfigBuilder.getConfiguration(); 
        } else { // spring整合mybatis的配置时configuration和configLocation属性都没设置
            LOGGER.debug(() -> {
                return "Property 'configuration' or 'configLocation' not specified, using default MyBatis Configuration";
            });
            targetConfiguration = new Configuration(); // 自己创建配置类
            Optional.ofNullable(this.configurationProperties).ifPresent(targetConfiguration::setVariables);
        }

        Optional.ofNullable(this.objectFactory).ifPresent(targetConfiguration::setObjectFactory);
        Optional.ofNullable(this.objectWrapperFactory).ifPresent(targetConfiguration::setObjectWrapperFactory);
        Optional.ofNullable(this.vfs).ifPresent(targetConfiguration::setVfsImpl);
        Stream var10000;
    	// 整合typeAliasesPackage配置
        if (StringUtils.hasLength(this.typeAliasesPackage)) {
            var10000 = this.scanClasses(this.typeAliasesPackage, this.typeAliasesSuperType).stream().filter((clazz) -> {
                return !clazz.isAnonymousClass();
            }).filter((clazz) -> {
                return !clazz.isInterface();
            }).filter((clazz) -> {
                return !clazz.isMemberClass();
            });
            TypeAliasRegistry var10001 = targetConfiguration.getTypeAliasRegistry();
            var10000.forEach(var10001::registerAlias);
        }

        if (!ObjectUtils.isEmpty(this.typeAliases)) {
            Stream.of(this.typeAliases).forEach((typeAlias) -> {
                targetConfiguration.getTypeAliasRegistry().registerAlias(typeAlias);
                LOGGER.debug(() -> {
                    return "Registered type alias: '" + typeAlias + "'";
                });
            });
        }
		// 整合plugins配置
        if (!ObjectUtils.isEmpty(this.plugins)) {
            Stream.of(this.plugins).forEach((plugin) -> {
                targetConfiguration.addInterceptor(plugin);
                LOGGER.debug(() -> {
                    return "Registered plugin: '" + plugin + "'";
                });
            });
        }
		// 整合typeHandlersPackage配置
        if (StringUtils.hasLength(this.typeHandlersPackage)) {
            var10000 = this.scanClasses(this.typeHandlersPackage, TypeHandler.class).stream().filter((clazz) -> {
                return !clazz.isAnonymousClass();
            }).filter((clazz) -> {
                return !clazz.isInterface();
            }).filter((clazz) -> {
                return !Modifier.isAbstract(clazz.getModifiers());
            });
            TypeHandlerRegistry var24 = targetConfiguration.getTypeHandlerRegistry();
            var10000.forEach(var24::register);
        }

        if (!ObjectUtils.isEmpty(this.typeHandlers)) {
            Stream.of(this.typeHandlers).forEach((typeHandler) -> {
                targetConfiguration.getTypeHandlerRegistry().register(typeHandler);
                LOGGER.debug(() -> {
                    return "Registered type handler: '" + typeHandler + "'";
                });
            });
        }

        targetConfiguration.setDefaultEnumTypeHandler(this.defaultEnumTypeHandler);
        if (!ObjectUtils.isEmpty(this.scriptingLanguageDrivers)) {
            Stream.of(this.scriptingLanguageDrivers).forEach((languageDriver) -> {
                targetConfiguration.getLanguageRegistry().register(languageDriver);
                LOGGER.debug(() -> {
                    return "Registered scripting language driver: '" + languageDriver + "'";
                });
            });
        }

        Optional.ofNullable(this.defaultScriptingLanguageDriver).ifPresent(targetConfiguration::setDefaultScriptingLanguage);
        if (this.databaseIdProvider != null) {
            try {
                targetConfiguration.setDatabaseId(this.databaseIdProvider.getDatabaseId(this.dataSource));
            } catch (SQLException var23) {
                throw new NestedIOException("Failed getting a databaseId", var23);
            }
        }

        Optional.ofNullable(this.cache).ifPresent(targetConfiguration::addCache);
        if (xmlConfigBuilder != null) {
            try {
                xmlConfigBuilder.parse();
                LOGGER.debug(() -> {
                    return "Parsed configuration file: '" + this.configLocation + "'";
                });
            } catch (Exception var21) {
                throw new NestedIOException("Failed to parse config resource: " + this.configLocation, var21);
            } finally {
                ErrorContext.instance().reset();
            }
        }
		// 整合环境配置
        targetConfiguration.setEnvironment(new Environment(this.environment, (TransactionFactory)(this.transactionFactory == null ? new SpringManagedTransactionFactory() : this.transactionFactory), this.dataSource));
    	// 解析Mapper.xml
        if (this.mapperLocations != null) {
            if (this.mapperLocations.length == 0) {
                LOGGER.warn(() -> {
                    return "Property 'mapperLocations' was specified but matching resources are not found.";
                });
            } else {
                Resource[] var3 = this.mapperLocations;
                int var4 = var3.length;

                for(int var5 = 0; var5 < var4; ++var5) {
                    Resource mapperLocation = var3[var5];
                    if (mapperLocation != null) {
                        try {
                            XMLMapperBuilder xmlMapperBuilder = new XMLMapperBuilder(mapperLocation.getInputStream(), targetConfiguration, mapperLocation.toString(), targetConfiguration.getSqlFragments());
                            xmlMapperBuilder.parse();
                        } catch (Exception var19) {
                            throw new NestedIOException("Failed to parse mapping resource: '" + mapperLocation + "'", var19);
                        } finally {
                            ErrorContext.instance().reset();
                        }

                        LOGGER.debug(() -> {
                            return "Parsed mapper file: '" + mapperLocation + "'";
                        });
                    }
                }
            }
        } else {
            LOGGER.debug(() -> {
                return "Property 'mapperLocations' was not specified.";
            });
        }
		// 创建sqlSessionFactory
        return this.sqlSessionFactoryBuilder.build(targetConfiguration);
    }
```

跟进`this.sqlSessionFactoryBuilder.build(targetConfiguration);`方法：

```java
public SqlSessionFactory build(Configuration config) {
        return new DefaultSqlSessionFactory(config); // 最终创建的DefaultSqlSessionFactory
    }
```



#### 1.2mapper代理的创建

 	继续对比最开始的mybatis单独使用的简单例子和spring整合mybatis配置例子，spring整合mybatis想要创建代理对象，在1.1章节中已经创建好了`SqlSessionFactory`，我们只需要通过`SqlSession session = sqlSessionFactory.openSession();`获取SqlSession，然后通过SqlSession的getMapper方法就能创建代理对象。

spring整合mybatis想要创建代理对象是通过`@MapperScan`注解实现的，查看`@MapperScan`注解源码：

```java
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE})
@Documented
@Import({MapperScannerRegistrar.class})
@Repeatable(MapperScans.class)
public @interface MapperScan {
String[] value() default {};
    String[] basePackages() default {};
    Class<?>[] basePackageClasses() default {};
    Class<? extends BeanNameGenerator> nameGenerator() default BeanNameGenerator.class;
    Class<? extends Annotation> annotationClass() default Annotation.class;
    Class<?> markerInterface() default Class.class;
    String sqlSessionTemplateRef() default "";
    String sqlSessionFactoryRef() default "";
    Class<? extends MapperFactoryBean> factoryBean() default MapperFactoryBean.class;
    String lazyInitialization() default "";
}
```

MapperScan注解上通过`@Import({MapperScannerRegistrar.class})`导入了MapperScannerRegistrar类：

```java
public class MapperScannerRegistrar implements ImportBeanDefinitionRegistrar, ResourceLoaderAware {
 }
```

MapperScannerRegistrar实现了ImportBeanDefinitionRegistrar接口，ImportBeanDefinitionRegistrar的`registerBeanDefinitions`方法会为IOC容器中注入Bean，查看MapperScannerRegistrard的`registerBeanDefinitions`方法：

```java
void registerBeanDefinitions(AnnotationMetadata annoMeta, AnnotationAttributes annoAttrs, BeanDefinitionRegistry registry, String beanName) {
    	// 重点注册了一个MapperScannerConfigurer类
        BeanDefinitionBuilder builder = BeanDefinitionBuilder.genericBeanDefinition(MapperScannerConfigurer.class); 
		// ，，，，省略部分代码
       registry.registerBeanDefinition(beanName, builder.getBeanDefinition());
    }
```

查看MapperScannerConfigurer类：

```java
public class MapperScannerConfigurer implements BeanDefinitionRegistryPostProcessor, InitializingBean, ApplicationContextAware, BeanNameAware {
  
```

发现MapperScannerConfigurer类实现了BeanDefinitionRegistryPostProcessor接口，BeanDefinitionRegistryPostProcessor接口继承了BeanFactoryPostProcessor接口，BeanFactoryPostProcessor是Spring重要的扩展点之一，springIOC的加载流程中，会调用BeanFactoryPostProcessor接口postProcessBeanDefinitionRegistry方法：

```java
public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) {
        if (this.processPropertyPlaceHolders) {
            this.processPropertyPlaceHolders();
        }
		// 创建ClassPathMapperScanner
        ClassPathMapperScanner scanner = new ClassPathMapperScanner(registry);
        scanner.setAddToConfig(this.addToConfig);
        scanner.setAnnotationClass(this.annotationClass);
        scanner.setMarkerInterface(this.markerInterface);
        scanner.setSqlSessionFactory(this.sqlSessionFactory);
        scanner.setSqlSessionTemplate(this.sqlSessionTemplate);
        scanner.setSqlSessionFactoryBeanName(this.sqlSessionFactoryBeanName);
        scanner.setSqlSessionTemplateBeanName(this.sqlSessionTemplateBeanName);
        scanner.setResourceLoader(this.applicationContext);
        scanner.setBeanNameGenerator(this.nameGenerator);
        scanner.setMapperFactoryBeanClass(this.mapperFactoryBeanClass);
        if (StringUtils.hasText(this.lazyInitialization)) {
            scanner.setLazyInitialization(Boolean.valueOf(this.lazyInitialization));
        }

        scanner.registerFilters();
    	// 调用scan方法
        scanner.scan(StringUtils.tokenizeToStringArray(this.basePackage, ",; \t\n"));
    }
```

跟进`scanner.scan(StringUtils.tokenizeToStringArray(this.basePackage, ",; \t\n"));`方法：

```java
public int scan(String... basePackages) {
        int beanCountAtScanStart = this.registry.getBeanDefinitionCount();
        this.doScan(basePackages); // 继续
        if (this.includeAnnotationConfig) {
            AnnotationConfigUtils.registerAnnotationConfigProcessors(this.registry);
        }

        return this.registry.getBeanDefinitionCount() - beanCountAtScanStart;
    }
```

继续跟进`this.doScan(basePackages);`方法：

```java
public Set<BeanDefinitionHolder> doScan(String... basePackages) {
    	// 调用父类ClassPathBeanDefinitionScanner的doScan方法
        Set<BeanDefinitionHolder> beanDefinitions = super.doScan(basePackages);
        if (beanDefinitions.isEmpty()) {
            LOGGER.warn(() -> {
                return "No MyBatis mapper was found in '" + Arrays.toString(basePackages) + "' package. Please check your configuration.";
            });
        } else {
            this.processBeanDefinitions(beanDefinitions);
        }

        return beanDefinitions;
    }
```

ClassPathBeanDefinitionScanner的doScan方法：

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

根据包名找到符合条件的BeanDefinition集合，跟进`Set<BeanDefinition> candidates = this.findCandidateComponents(basePackage);`方法：

```java
public Set<BeanDefinition> findCandidateComponents(String basePackage) {
        LinkedHashSet candidates = new LinkedHashSet();
        try {
            String packageSearchPath = "classpath*:" + this.resolveBasePackage(basePackage) + '/' + this.resourcePattern;
            //包下class对象都会解析成对应的resource对象文件对象
            Resource[] resources = this.resourcePatternResolver.getResources(packageSearchPath);
            boolean traceEnabled = this.logger.isTraceEnabled();
            boolean debugEnabled = this.logger.isDebugEnabled();
            Resource[] var7 = resources;
            int var8 = resources.length;
             //遍历所有文件对象数组
            for(int var9 = 0; var9 < var8; ++var9) {
                Resource resource = var7[var9];
                if (traceEnabled) {
                    this.logger.trace("Scanning " + resource);
                }

                if (resource.isReadable()) {
                    try {
                    //利用ASM技术把文件对象解析成元数据信息
                        MetadataReader metadataReader = this.metadataReaderFactory.getMetadataReader(resource);
                        //解析是否包含Component注解，以及剔除excludeFilters配置的，includeFilters匹配则成功（new AnnotationTypeFilter(Component.class)），匹配通过继续筛选是否有Condition条件
                        if (this.isCandidateComponent(metadataReader)) {
                            ScannedGenericBeanDefinition sbd = new ScannedGenericBeanDefinition(metadataReader);
                            sbd.setResource(resource);
                            sbd.setSource(resource);
                            //判断当前对象是否符合
                            if (this.isCandidateComponent((AnnotatedBeanDefinition)sbd)) {
                                if (debugEnabled) {
                                    this.logger.debug("Identified candidate component class: " + resource);
                                }
                            //满足以上条件才能成为候选beanDefinition即真正的beandefinition
                                candidates.add(sbd);
                            } else if (debugEnabled) {
                                this.logger.debug("Ignored because not a concrete top-level class: " + resource);
                            }
                        } else if (traceEnabled) {
                            this.logger.trace("Ignored because not matching any filter: " + resource);
                        }
                    } catch (Throwable var13) {
                        throw new BeanDefinitionStoreException("Failed to read candidate component class: " + resource, var13);
                    }
                } else if (traceEnabled) {
                    this.logger.trace("Ignored because not readable: " + resource);
                }
            }

            return candidates;
        } catch (IOException var14) {
            throw new BeanDefinitionStoreException("I/O failure during classpath scanning", var14);
        }
    }

```

![image-20230110180129486](http://img.zouyh.top/article-img/20240917134959150.png)

跟进ClassPathMapperScanner的isCandidateComponent方法：判断的必须是接口并且顶级的

```java
protected boolean isCandidateComponent(AnnotatedBeanDefinition beanDefinition) {
        return beanDefinition.getMetadata().isInterface() && beanDefinition.getMetadata().isIndependent();
    }
```

如果跟进的是ClassPathScanningCandidateComponentProvider的isCandidateComponent方法：判断当前对象不能是接口

```java
 protected boolean isCandidateComponent(AnnotatedBeanDefinition beanDefinition) {
        AnnotationMetadata metadata = beanDefinition.getMetadata();
        return metadata.isIndependent() && (metadata.isConcrete() || metadata.isAbstract() && metadata.hasAnnotatedMethods(Lookup.class.getName()));
    }
```

​	spring整合mybatis通过ClassPathMapperScanner重写isCandidateComponent方法，避开了Spring不能注册接口成为Bean定义的规则。

回到ClassPathMapperScannerd的doScan方法，看看扫描后为BeanDefinitio又做了什么？

```java
public Set<BeanDefinitionHolder> doScan(String... basePackages) {
    	// 调用父类ClassPathBeanDefinitionScanner的doScan方法
        Set<BeanDefinitionHolder> beanDefinitions = super.doScan(basePackages);
        if (beanDefinitions.isEmpty()) {
            LOGGER.warn(() -> {
                return "No MyBatis mapper was found in '" + Arrays.toString(basePackages) + "' package. Please check your configuration.";
            });
        } else {
            this.processBeanDefinitions(beanDefinitions);
        }
}
```

跟进` this.processBeanDefinitions(beanDefinitions);`方法：

```java
 private void processBeanDefinitions(Set<BeanDefinitionHolder> beanDefinitions) {
        GenericBeanDefinition definition;
     	// 循环
        for(Iterator var3 = beanDefinitions.iterator(); var3.hasNext(); definition.setLazyInit(this.lazyInitialization)) {
            BeanDefinitionHolder holder = (BeanDefinitionHolder)var3.next();
            definition = (GenericBeanDefinition)holder.getBeanDefinition();
            String beanClassName = definition.getBeanClassName();
            LOGGER.debug(() -> {
                return "Creating MapperFactoryBean with name '" + holder.getBeanName() + "' and '" + beanClassName + "' mapperInterface";
            });
            // 
            definition.getConstructorArgumentValues().addGenericArgumentValue(beanClassName);
            // 偷天换日
            definition.setBeanClass(this.mapperFactoryBeanClass);
            definition.getPropertyValues().add("addToConfig", this.addToConfig);
            boolean explicitFactoryUsed = false;
            if (StringUtils.hasText(this.sqlSessionFactoryBeanName)) {
                definition.getPropertyValues().add("sqlSessionFactory", new RuntimeBeanReference(this.sqlSessionFactoryBeanName));
                explicitFactoryUsed = true;
            } else if (this.sqlSessionFactory != null) {
                definition.getPropertyValues().add("sqlSessionFactory", this.sqlSessionFactory);
                explicitFactoryUsed = true;
            }

            if (StringUtils.hasText(this.sqlSessionTemplateBeanName)) {
                if (explicitFactoryUsed) {
                    LOGGER.warn(() -> {
                        return "Cannot use both: sqlSessionTemplate and sqlSessionFactory together. sqlSessionFactory is ignored.";
                    });
                }

                definition.getPropertyValues().add("sqlSessionTemplate", new RuntimeBeanReference(this.sqlSessionTemplateBeanName));
                explicitFactoryUsed = true;
            } else if (this.sqlSessionTemplate != null) {
                if (explicitFactoryUsed) {
                    LOGGER.warn(() -> {
                        return "Cannot use both: sqlSessionTemplate and sqlSessionFactory together. sqlSessionFactory is ignored.";
                    });
                }

                definition.getPropertyValues().add("sqlSessionTemplate", this.sqlSessionTemplate);
                explicitFactoryUsed = true;
            }

            if (!explicitFactoryUsed) {
                LOGGER.debug(() -> {
                    return "Enabling autowire by type for MapperFactoryBean with name '" + holder.getBeanName() + "'.";
                });
                definition.setAutowireMode(2);
            }
        }

    }
```

​	偷天换日的关键在于通过`definition.setBeanClass(this.mapperFactoryBeanClass);`修改bean的定义方式，将原来的接口类改为了实现FactoryBean接口的类，FactoryBean接口的作用是在创建Bean的是通过`getObject()`方法返回的Bean，在getObject()中调用SqlSession的getMapper方法巧妙的实现了通过mybatis创建代理。

```java
public class MapperFactoryBean<T> extends SqlSessionDaoSupport implements FactoryBean<T> {
}

```

MapperFactoryBean的getObject()方法：

```java
 public T getObject() throws Exception {
        // 调用getSqlSession的getMapper方法创建代理对象
        return this.getSqlSession().getMapper(this.mapperInterface); 
    }
```

跟进`this.getSqlSession().getMapper(this.mapperInterface); `方法：

```java
public <T> T getMapper(Class<T> type) {
        return this.configuration.getMapper(type, this);
    }
```

```java
public <T> T getMapper(Class<T> type, SqlSession sqlSession) {
        return this.mapperRegistry.getMapper(type, sqlSession);
    }
```

```java
public <T> T getMapper(Class<T> type, SqlSession sqlSession) {
        MapperProxyFactory<T> mapperProxyFactory = (MapperProxyFactory)this.knownMappers.get(type);
        if (mapperProxyFactory == null) {
            throw new BindingException("Type " + type + " is not known to the MapperRegistry.");
        } else {
            try {
                return mapperProxyFactory.newInstance(sqlSession);
            } catch (Exception var5) {
                throw new BindingException("Error getting mapper instance. Cause: " + var5, var5);
            }
        }
    }
```

```java
public T newInstance(SqlSession sqlSession) {
        MapperProxy<T> mapperProxy = new MapperProxy(sqlSession, this.mapperInterface, this.methodCache);
        return this.newInstance(mapperProxy);
}
```

```java
protected T newInstance(MapperProxy<T> mapperProxy) {
        return Proxy.newProxyInstance(this.mapperInterface.getClassLoader(), new Class[]{this.mapperInterface}, mapperProxy); // 通过反射的方式创建代理对象。
    }
```

