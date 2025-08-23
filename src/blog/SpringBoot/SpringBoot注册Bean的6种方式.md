---
icon: document
# 标题
title: 'SpringBoot注册Bean的6种方式'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-28
# 一个页面可以有多个分类
category:
  - SpringBoot
# 一个页面可以有多个标签
tag:
  - 干货
  - SpringBoot
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一、常用注册Bean的6种方式
#### 1.1 @Component及其派生注解
实现方式:在类上添加`@Component`、`@Service`、`@Controller`、`@Repository`等注解，配合@ComponentScan扫描包路径。
```java
@Service
public class UserService {
    // 业务逻辑
}
```
适用场景：
- 常规业务组件（如Service层、Controller层等）
- 需要Spring自动扫描并管理的类

#### 1.2 @Bean
实现方式：配合`@Configuration`注解标记的配置类，通过`@Bean`标注方法，方法的返回对象入驻Spring容器。
```java
@Configuration
public class TestConfig {
    @Bean
    public User user() {
        return new User("zyh", 9527L);
    }
}
```
适用场景：
- 引入第三方库的类（如数据库连接池、工具类）.
- 需要自定义初始化逻辑的Bean.

#### 1.3 @Import
实现方式一：配合`@Configuration`注解标记的配置类，通过`@Import`的注解的属性`Class<?>[]`，指定的类入驻Spring容器。
```java
@Configuration
@Import({SecurityConfig.class,DataAccessProperties.class})
public class DataAccessConfig {
    @Resource
    private SecurityConfig securityConfig;
    @Resource
    private DataAccessProperties dataAccessProperties;
}
```
##### 1.3.1 配合ImportSelector接口
实现方式二：配合`@Configuration`注解标记的配置类，通过`@Import`的注解的属性`Class<?>[]`，指定的类实现ImportSelector接口的selectImports方法的返回值是入驻Spring容器的类。
```java
@EnableDataAccess
@Configuration
@Import({ImportSelectorFilter.class})
public class DataAccessConfig {
    @Resource
    private SecurityConfig securityConfig;
    @Resource
    private DataAccessProperties dataAccessProperties;
}
```
实现ImportSelectorFilter接口ImportSelector方法:
```java
public class ImportSelectorFilter  implements ImportSelector {
    /**
     * @param annotationMetadata 参数可获取导入类的注解、接口、父类等信息
     * @return 导入的类
     */
    @Override
    public String[] selectImports(AnnotationMetadata annotationMetadata) {
        // 判断DataAccessConfig类是否使用EnableDataAccess注解,EnableDataAccess注解这里是自定义 的注解
        boolean flag = annotationMetadata.hasAnnotation("top.zouyh.config.EnableDataAccess");
        if(flag){
            return new String[]{"top.zouyh.config.SecurityConfig", "top.zouyh.config.DataAccessProperties"};
        }else {
            return new String[]{"top.zouyh.config.DataConfig"};
        }
    }
}
```
##### 1.3.2 配合ImportBeanDefinitionRegistrar接口
实现方式三：配合`@Configuration`注解标记的配置类，通过`@Import`的注解的属性`Class<?>[]`，指定的类实现ImportBeanDefinitionRegistrar接口、重写registerBeanDefinitions方法的返回值是入驻Spring容器的类。
```java
@EnableDataAccess
@Configuration
@Import({ImportSelectorFilterBeanDefinition.class})
public class DataAccessConfig {
    @Resource
    private SecurityConfig securityConfig;
    @Resource
    private DataAccessProperties dataAccessProperties;
}
```
实现ImportSelectorFilterBeanDefinition接口，重写registerBeanDefinitions方法：
```java
public class ImportSelectorFilterBeanDefinition  implements ImportBeanDefinitionRegistrar {
    /**
     * @param annotationMetadata 参数可获取导入类的注解、接口、父类等信息
     * @param registry Spring注册器
     */
    @Override
    public void registerBeanDefinitions(AnnotationMetadata annotationMetadata, BeanDefinitionRegistry registry) {
        // 判断DataAccessConfig类是否使用EnableDataAccess注解,EnableDataAccess注解这里是自定义 的注解
        boolean flag = annotationMetadata.hasAnnotation("top.zouyh.config.EnableDataAccess");
        if(flag){
            BeanDefinition securityFilterBeanDefinition= BeanDefinitionBuilder
                    .genericBeanDefinition(SecurityFilter.class)
                    .getBeanDefinition();
            registry.registerBeanDefinition("securityFilter",securityFilterBeanDefinition);
            BeanDefinition dataAccessPropertiesBeanDefinition= BeanDefinitionBuilder
                    .genericBeanDefinition(DataAccessProperties.class)
                    .getBeanDefinition();
            registry.registerBeanDefinition("dataAccessProperties",dataAccessPropertiesBeanDefinition);
        }else {
            BeanDefinition dataConfigBeanDefinition= BeanDefinitionBuilder
                    .genericBeanDefinition(DataConfig.class)
                    .getBeanDefinition();
            registry.registerBeanDefinition("dataConfig",dataConfigBeanDefinition);
        }
    }
}

```
ImportSelector 与 ImportBeanDefinitionRegistrar‌区别:
| 对比项 |  ImportSelector | ImportBeanDefinitionRegistrar‌ |
| :- | :- | :-|
| 注册方式 | 动态返回需要导入的‌配置类全限定名 | 直接通过代码向容器‌注册Bean定义‌ |
| 执行时机 | 在配置类解析阶段执行 | 在 Bean 定义注册阶段执行 |
| 灵活性 | 通过间接导入类实现批量配置加载 | 直接操作 Bean 定义，支持更细粒度的控制（如属性注入、条件判断） |

#### 1.4 实现FactoryBean接口
实现方式：实现FactoryBean接口，重写getObject()方法定义Bean实例，并通过@Component或@Bean注册接口实现类
```java
@Component
public class TestFactoryBean implements FactoryBean<DataAccessConfig> {
    @Override
    public DataAccessConfig getObject() throws Exception {
        return new DataAccessConfig();
    }

    @Override
    public Class<?> getObjectType() {
        return DataAccessConfig.class;
    }
}
```
容器中实际注册的是`getObject()`返回的对象，而非FactoryBean本身.
适用场景：
	- 复杂对象的创建
	- 代理创建对象

#### 1.5 实现BeanDefinitionRegistryPostProcessor接口
实现方式：实现BeanDefinitionRegistryPostProcessor接口，在postProcessBeanDefinitionRegistry()方法中手动注册BeanDefinition
```java
@Component
public class TestRegistrar implements BeanDefinitionRegistryPostProcessor {
    // 注册bean定义 执行
    @Override
    public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry beanDefinitionRegistry) throws BeansException {
        BeanDefinition securityFilterBeanDefinition= BeanDefinitionBuilder
                .genericBeanDefinition(DataAccessConfig.class)
                .addPropertyValue("securityConfig", "securityConfig")
                .getBeanDefinition();
        beanDefinitionRegistry.registerBeanDefinition("dataAccessConfig",securityFilterBeanDefinition);

    }
    // 加载所有Bean定义之后、Bean实例化之前 执行
    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory configurableListableBeanFactory) throws BeansException {
        // 可以修改bean定义
    }
}

```
适用场景：
- 框架开发中动态注册Bean（如Spring Boot Starter自动配置）
- 根据运行时条件（如配置文件、环境变量）‌决定是否注册Bean

#### 1.6 spi机制
实现方式：通过META-INF/spring.factories声明自动配置
```xml
# META-INF/spring.factories
org.springframework.boot.autoconfigure.EnableAutoConfiguration=top.zouyh.TestConfig
```
```java
@Configuration
public class TestConfig {
    @Bean
    public User user() {
        return new User("zyh", 9527L);
    }
}
```
适用场景：
- 开发自定义Starter
- 封装通用模块供多个项目复用

