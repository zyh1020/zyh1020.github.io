---
icon: document
# 标题
title: 'Mybatis动态数据源'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-25
# 一个页面可以有多个分类
category:
  - Mybatis
# 一个页面可以有多个标签
tag:
  - 必看
  - Mybatis
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---


导入的jar包
```xml
<!-- 阿里巴巴数据库链接池-->
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>druid</artifactId>
    <version>1.2.23</version>
</dependency>
<!-- 整合mybatis -->
<dependency>
    <groupId>org.mybatis.spring.boot</groupId>
    <artifactId>mybatis-spring-boot-starter</artifactId>
</dependency>
<!-- 整合jdbcTemplate -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jdbc</artifactId>
</dependency>

```
#### 1.1动态添加数据源
通常添加数据源的方式：
```java
@Configuration
public class DataSourceConfig {
    @Bean("dataSourceOne")
    @ConfigurationProperties(prefix = "spring.datasource.one")
    public DataSource dataSourceOne(){
        return new DruidDataSource();
    }
    @Bean("dataSourceTwo")
    @ConfigurationProperties(prefix = "spring.datasource.two")
    public DataSource dataSourceTwo(){
        return new DruidDataSource();
    }

}

```
通过BeanDefinition方式添加数据源：
场景一：通过监听spring启动完成事事件，自动加载数据源
```java
@Component
public class DataSourceConfig implements ApplicationListener<ApplicationStartedEvent> {
    @Override
    public void onApplicationEvent(ApplicationStartedEvent event) {
        RootBeanDefinition rootBeanDefinition = new RootBeanDefinition(DruidDataSource.class);
        rootBeanDefinition.getPropertyValues().add("username","");
        rootBeanDefinition.getPropertyValues().add("password","");
        rootBeanDefinition.getPropertyValues().add("jdbcUrl","");
        rootBeanDefinition.getPropertyValues().add("driverClass","");
        BeanDefinitionRegistry registry = (BeanDefinitionRegistry) event.getApplicationContext();
        registry.registerBeanDefinition("dataSourceThree",rootBeanDefinition);
    }
}

```
场景二： 可以提供一个Controller，通过主动调用的添加数据源
```java
@Component
public class DataSourceConfig implements ApplicationContextAware {
    private ApplicationContext applicationContext;
    @Override
    public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
        this.applicationContext = applicationContext;
    }
    private void addDataSource(){
        RootBeanDefinition rootBeanDefinition = new RootBeanDefinition(DruidDataSource.class);
        rootBeanDefinition.getPropertyValues().add("username","");
        rootBeanDefinition.getPropertyValues().add("password","");
        rootBeanDefinition.getPropertyValues().add("jdbcUrl","");
        rootBeanDefinition.getPropertyValues().add("driverClass","");
        BeanDefinitionRegistry registry = (BeanDefinitionRegistry) applicationContext;
        registry.registerBeanDefinition("dataSourceFour",rootBeanDefinition);
    }
}

```
#### 1.2动态切换数据源
##### 1.2.1 基础使用方式
 整合mybatis:
```java
/**
 * @Author zyh
 */
@Configuration
public class SqlSessionFactoryConfig {
    @Bean("sqlSessionFactoryOne")
    public SqlSessionFactory sqlSessionFactoryOne(@Qualifier("dataSourceOne") DataSource dataSource)throws Exception{
        SqlSessionFactoryBean bean = new SqlSessionFactoryBean();
        bean.setDataSource(dataSource);
        bean.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath:mapper/one/*.xml"));
        bean.setTypeAliasesPackage("top.zouyh.domain");
        return bean.getObject();
    }
    @Bean("sqlSessionFactoryTwo")
    public SqlSessionFactory sqlSessionFactoryTwo(@Qualifier("dataSourceTwo") DataSource dataSource)throws Exception{
        SqlSessionFactoryBean bean = new SqlSessionFactoryBean();
        bean.setDataSource(dataSource);
        bean.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath:mapper/two/*.xml"));
        bean.setTypeAliasesPackage("top.zouyh.domain");
        return bean.getObject();
    }
}

```
整合jdbcTemplate:
```java
/**
 * @Author zyh
 */
@Configuration
public class JdbcTemplateConfig {
    @Bean("jdbcTemplateOne")
    public JdbcTemplate jdbcTemplateOne(@Qualifier("dataSourceOne") DataSource dataSource)throws Exception{
        return new JdbcTemplate();
    }
    @Bean("jdbcTemplateTwo")
    public JdbcTemplate jdbcTemplateTwo(@Qualifier("dataSourceTwo") DataSource dataSource)throws Exception{
        return new JdbcTemplate();
    }
}

```
##### 1.2.2 动态切换方式
> 动态切换数据源本质用的Map<String,DataSource>和本地线程栈

第一步：创建DataSourceContextHolder，用于本地线程存储
```java
public class DataSourceContextHolder {
    private static final ThreadLocal<String> CONTEXT_HOLDER = new ThreadLocal<>();

    public static void setDataSourceKey(String key) {
        CONTEXT_HOLDER.set(key);
    }

    public static String getDataSourceKey() {
        return CONTEXT_HOLDER.get();
    }

    public static void clearDataSourceKey() {
        CONTEXT_HOLDER.remove();
    }
}

```
第二步：创建 CustomRoutingDataSource继承AbstractRoutingDataSource，结构Map<String,DataSource>实现线程切换
```java
public class CustomRoutingDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
	// 获取当前线程对应的数据源
        return DataSourceContextHolder.getDataSourceKey();
    }
}
```
第三步：将CustomRoutingDataSource注入IOC容器中
```java
@Configuration
public class DataSourceConfig {
    @Bean("dataSourceOne")
    @ConfigurationProperties(prefix = "spring.datasource.one")
    public DataSource dataSourceOne(){
        return new DruidDataSource();
    }
    @Bean("dataSourceTwo")
    @ConfigurationProperties(prefix = "spring.datasource.two")
    public DataSource dataSourceTwo(){
        return new DruidDataSource();
    }
    @Bean("routingDataSource")
    public DataSource routingDataSource(@Qualifier("dataSourceOne")DataSource dataSourceOne
            ,@Qualifier("dataSourceTwo")DataSource dataSourceTwo){
        AbstractRoutingDataSource routingDataSource = new CustomRoutingDataSource();
        Map<Object, Object> targetDataSources = new HashMap<>();
        targetDataSources.put("dataSourceOne", dataSourceOne);
        targetDataSources.put("dataSourceTwo", dataSourceTwo);
        routingDataSource.setTargetDataSources(targetDataSources);
        routingDataSource.setDefaultTargetDataSource(dataSourceOne);
        return routingDataSource;
    }
}
```
第四步：使用mybatis和jdbcTemplate使用数据源：
整合mybatis:
```java
@Configuration
public class SqlSessionFactoryConfig {
    @Bean("sqlSessionFactory")
    public SqlSessionFactory sqlSessionFactory(@Qualifier("routingDataSource") DataSource dataSource)throws Exception{
        SqlSessionFactoryBean bean = new SqlSessionFactoryBean();
        bean.setDataSource(dataSource);
        bean.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath:mapper/one/*.xml"));
        bean.setTypeAliasesPackage("top.zouyh.domain");
        return bean.getObject();
    }
}
```
整合jdbcTemplate:
```java
@Configuration
public class JdbcTemplateConfig {
    @Bean("jdbcTemplate")
    public JdbcTemplate jdbcTemplate(@Qualifier("routingDataSource") DataSource dataSource)throws Exception{
        return new JdbcTemplate();
    }
}

```
第五步：测试
```
   public User getUserById(Long id) {

        // 切换到Two
        DataSourceContextHolder.setDataSourceKey("dataSourceOne");
        User user = userMapper.selectUserById(id);
        log.info("user:{}", user);

        // 切换回One
        DataSourceContextHolder.setDataSourceKey("dataSourceTwo");
        user = userMapper.selectUserById(id);
        log.info("user:{}", user);
        return user;
    }

```
##### 1.2.3 优化
在上面测试的代码中，在切换数据源每次都会执行`DataSourceContextHolder.setDataSourceKey()`的方法，我们可以使用自定义注解+SpringAop的方式进行优化：
自定义注解：
```java
@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface DataSourceAnnotation {
    String value();
}
```
SpringAop切面：
```java
@Aspect
@Component
public class DataSourceAop {
    @Around("@annotation(DataSourceAnnotation)")
    public Object clearDataSourceKey(ProceedingJoinPoint point)throws Throwable {
        MethodSignature methodSignature = (MethodSignature)point.getSignature();
        Method method = methodSignature.getMethod();
        DataSourceAnnotation annotation = method.getAnnotation(DataSourceAnnotation.class);
        DataSourceContextHolder.setDataSourceKey(annotation.value());
        try {
            return point.proceed();
        } finally {
            DataSourceContextHolder.clearDataSourceKey();
        }
    }
}
```




