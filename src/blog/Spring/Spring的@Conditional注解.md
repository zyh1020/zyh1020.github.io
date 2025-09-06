---
icon: file-lines
# 标题
title: 'Spring的@Conditional注解'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-29
# 一个页面可以有多个分类
category:
  - Spring
# 一个页面可以有多个标签
tag:
  - 偏僻
  - Spring
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一、@Conditional
`@Conditional`来源于spring-context包下的一个注解。Conditional中文是条件的意思，`@Conditional`注解它的作用是按照一定的条件进行判断，满足条件给容器注册bean:
```java
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Conditional {
    Class<? extends Condition>[] value();
}

```
`@Conditional`只有一个参数，参数是个数组，并且参数要求是继承与Condition类。Condition类是一个函数式接口。matches方法就是比较方法，如果`@Conditional`注解参数所有的Condition类的matches方法都是true则注入，如果有1个false则不注入：
```java
@FunctionalInterface
public interface Condition {
    boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata);
}
```
### 二、自定义Condition实现类
实现Condition接口的matches方法：
```java
public class MyCondition implements Condition {
    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        Environment environment = context.getEnvironment();
        String property = environment.getProperty("spring.profiles.active");
        if ("dev".equals(property)) {
            return true;
        }
        return false;
    }
}
```
使用自定义Condition实现类：
```java
@Configuration
@Conditional({MyCondition.class})
public class MyConfig {
}
```
测试：
```java
@SpringBootTest
public class TestApplication {
    @Resource
    private MyConfig myConfig;
    @Test
    public void test(){
        System.out.println("myConfig:"+myConfig);
    }
}
```
输出结果：
```
myConfig:null
```
在``配置文件新增`spring.profiles.active=dev`配置，输出结果
```
myConfig:top.zouyh.test.MyConfig$$EnhancerBySpringCGLIB$$258147ee@3c52978d
```
### 三、常见的扩展注解
#### 3.1 @ConditionalOnClass
```java
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Conditional({OnClassCondition.class})
public @interface ConditionalOnClass {
    // 类
    Class<?>[] value() default {};
    // 全限类名
    String[] name() default {};
}
```
判断条件是否存在这个类文件,如果有这个文件就相当于满足条件,当然并不是说容器里面是否有这个类哈,不要理解错了,这是也是自定义start的核心实现。
#### 3.2 @ConditionalOnClass
```java
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Conditional({OnClassCondition.class})
public @interface ConditionalOnMissingClass {
    String[] value() default {};
}

```
判断条件: 和`@ConditionalOnClass`功能相反.
#### 3.3 @ConditionalOnBean
```java
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Conditional({OnBeanCondition.class})
public @interface ConditionalOnBean {

	// 指定bean的类类型。当所有指定类的bean都包含在容器中时，条件匹配。
    Class<?>[] value() default {};
	// 指定bean的全类名。当指定的所有类的bean都包含在容器中时，条件匹配。
    String[] type() default {};
	// bean所声明的注解,当ApplicationContext中存在声明该注解的bean时返回true
    Class<? extends Annotation>[] annotation() default {};
	// bean的id,当ApplicationContext中存在给定id的bean时返回true,这个id指的就是容器当中对象的id
    String[] name() default {};
	// 搜索容器层级,默认是所有上下文搜索
    SearchStrategy search() default SearchStrategy.ALL;
	// 可能在其泛型参数中包含指定bean类型的其他类
    Class<?>[] parameterizedContainer() default {};
}
```
判断条件:spring ioc容器中存在bean的时候注入，不存在的时候不注入
#### 3.4 @ConditionalOnMissingBean
```java
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Conditional({OnBeanCondition.class})
public @interface ConditionalOnMissingBean {
    Class<?>[] value() default {};
    String[] type() default {};
    // 识别匹配 bean 时，可以被忽略的 bean 的 class 类型
    Class<?>[] ignored() default {};
    //识别匹配 bean 时，可以被忽略的 bean 的 class 类型名称
    String[] ignoredType() default {};
    Class<? extends Annotation>[] annotation() default {};
    String[] name() default {};
    SearchStrategy search() default SearchStrategy.ALL;
    Class<?>[] parameterizedContainer() default {};
}
```
判断条件: 和`@ConditionalOnBean`功能相反.
#### 3.5 @ConditionalOnProperty
```java
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
@Documented
@Conditional({OnPropertyCondition.class})
public @interface ConditionalOnProperty {
    // 指定的属性完整名称，不能和name同时使用。
    String[] value() default {};
    //配置文件中属性的前缀
    String prefix() default "";
    //指定的属性名称
    String[] name() default {};
    // 指定的属性的属性值要等于该指定值，当value或name为一个时使用
    String havingValue() default "";
    // 当不匹配时是否允许加载，当为true时就算不匹配也不影响bean的注入或配置类的生效。
    boolean matchIfMissing() default false;
}
```
用于通过和springboot当中application配置文件配合使用如：
```java
@Configuration
@ConditionalOnProperty(
        prefix = "spring.profiles",
        name = {"active"}
        havingValue = "dev",
        matchIfMissing =""
)
public class MyConfig {
    
}
```
#### 3.6 其它注解
|注解|作用|
|:-|:-|
|@ConditionalOnJava|	只有运行指定版本的 Java 才会加载 Bean|
|@ConditionalOnWebApplication/@ConditionalOnNotWebApplication|只有运行在/不在web 应用里才会加载这个 bean|
|@ConditionalOnCloudPlatform|只有运行在指定的云平台上才加载指定的 bean|
|@ConditionalOnJndi|只有指定的资源通过 JNDI 加载后才加载 bean|
|@ConditionalOnExpression(“${test.express}==true”) | 可通过spring提供的spEL表达式灵活配置，当表达式为true的时候，才会实例化一个Bean|
|@ConditionalOnSingleCandidate(UserService.class) |表示ioc容器中只有一个UserService类型的Bean，才生效|
|@ConditionalOnResource|指定的静态资源⽂件存在 才加载|
