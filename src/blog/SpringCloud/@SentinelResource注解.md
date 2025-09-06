---
icon: file-lines
# 标题
title: '@SentinelResource注解'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-10
# 一个页面可以有多个分类
category:
  - SpringCloud
# 一个页面可以有多个标签
tag:
  - 偏僻
  - SpringCloud
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

@RequestMapping和@SentinelResource的对比：Sentinel 默认将 @RequestMapping 的路径作为资源名，@RequestMapping只能做一些简单限流，只能Controller 方法使用；而@SentinelResource的value作为资源名@SentinelResource复杂场景Service 层或任意方法。注意如果两个@RequestMapping的路径和@SentinelResource值同时设置并且一样，在控制台添加的限流或者熔断规则会优先使用@RequestMapping的路径定义的资源，@SentinelResource注解配置会失效，所以建议使用@SentinelResource声明资源的时候尽量保证和@RequestMapping的路径不一样。

SentinelResource注解介绍：
```java
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Inherited
public @interface SentinelResource {
    String value() default "";

    EntryType entryType() default EntryType.OUT;

    int resourceType() default 0;

    String blockHandler() default "";

    Class<?>[] blockHandlerClass() default {};

    String fallback() default "";

    String defaultFallback() default "";

    Class<?>[] fallbackClass() default {};

    Class<? extends Throwable>[] exceptionsToTrace() default {Throwable.class};

    Class<? extends Throwable>[] exceptionsToIgnore() default {};
}
```
SentinelResource注解字段介绍：
| 属性 | 类型 | 说明 | 默认值 |
| :- | :- | :- | :- |
| value | String | 资源名称,唯一标识,若未指定则使用方法全名 | 无 |
| entryType | enum |  流量入口方向（IN/OUT）一般使用默认值 | EntryType.OUT |
| blockHandler | String | 限流/降级处理函数名，需与原方法同参数列表，且最后多一个 BlockException 参数 | 无 |
| blockHandlerClass | Class[] | blockHandler 函数所在的类（需为静态方法）  | 无 |
| fallback | String | 异常降级处理函数名，用于处理非 BlockException 的其他异常，参数需与原方法一致 | 无 |
| fallbackClass | Class[] | fallback 函数所在的类（需为静态方法）  | 无 |
| exceptionsToTrace | Class[] | 需要跟踪的异常类列表 | Throwable |
| exceptionsToIgnore | Class[] | 需要忽略的异常类列表 | 无 |

blockHandler：
```java
@RestController
@RequestMapping("/sentinel")
public class SentinelController {

    @SentinelResource(value = "sentinel-testBlockHandler",blockHandler = "handleBlock")
    @RequestMapping("/testBlockHandler")
    public String testBlockHandler(){
        return "testBlockHandler";
    }

    public String handleBlock(BlockException blockException){
        return "限流降级方法";
    }

}

```
blockHandlerClass和blockHandler：
```java
@RestController
@RequestMapping("/sentinel")
public class SentinelController {

    @SentinelResource(value = "sentinel-testBlockHandler",blockHandlerClass=SentinelControllerBlockHandler.class,blockHandler = "handleBlock")
    @RequestMapping("/testBlockHandler")
    public String testBlockHandler(){
        return "testBlockHandler";
    }

}
// 将降级方法单独抽出来
public class SentinelControllerBlockHandler {
    public static String handleBlock(BlockException blockException){
        return "限流降级方法";
    }
}

```

fallback：
```java
@RestController
@RequestMapping("/sentinel")
public class SentinelController {
    private static Integer index = 0;
    @SentinelResource(value = "sentinel-fallback",fallback = "fallback")
    @RequestMapping("/testFallback")
    public String testFallback(){
        index++;
        if(index % 3 == 0){
            throw new RuntimeException("一个异常");
        }
        return "testFallback";
    }
    public String fallback(Throwable throwable){
        return "异常处理方法:"+throwable.getMessage();
    }

}
```
fallbackClass和fallback：
```java
@RestController
@RequestMapping("/sentinel")
public class SentinelController {
    private static Integer index = 0;
    @SentinelResource(value = "sentinel-fallback",fallbackClass = SentinelControllerFallback.class,fallback = "fallback")
    @RequestMapping("/testFallback")
    public String testFallback(){
        index++;
        if(index % 3 == 0){
            throw new RuntimeException("一个异常");
        }
        return "testFallback";
    }

}

public class SentinelControllerFallback {
    public static String fallback(Throwable throwable){
        return "异常处理方法:"+throwable.getMessage();
    }
}
```
blockHandler和fallback：
```java
@RestController
@RequestMapping("/sentinel")
public class SentinelController {
    @SentinelResource(value = "sentinel-blockHandle-fallback"
            ,blockHandlerClass=SentinelControllerBlockHandler.class
            ,blockHandler = "handleBlock"
            ,fallbackClass = SentinelControllerFallback.class
            ,fallback = "fallback")
    @RequestMapping("/testBlockHandlerAndFallback")
    public String testBlockHandlerAndFallback(){
        int x = 10/0;
        return "testBlockHandlerAndFallback";
    }

}
```
同时设置blockHandler和fallback，发生限流才会调用fallback，不发生限流出现异常会都会调用blockHandler，伪代码：
```java
try {
    // 业务方法
} catch (BlockException blockException) {
    // handleBlock方法
    SentinelControllerBlockHandler.handleBlock(blockException);
}catch (Throwable throwable) {
    // fallback方法
    SentinelControllerFallback.fallback(throwable);
}
```

