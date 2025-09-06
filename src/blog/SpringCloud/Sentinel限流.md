---
icon: file-lines
# 标题
title: 'Sentinel限流'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-14
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


### 一，流控限流

| 配置项                   | 说明                                                                   |
| :-------------------- | :------------------------------------------------------------------- |
| 资源名:resource          | 限流规则的作用对象,最常用的资源是我们代码中的 Java 方法,一段代码，或者一个接口                          |
| 针对来源: limitApp        | 流控针对的调用来源，填写微服务名，default代表不区分调用来源                                    |
| 阀值类型: grade           | - QPS:每秒请求数，当前调用该api的QPS到达阈值的时候进行限流 - 线程数: 当调用该api的并发线程数到达阈值的时候，进行限流 |
| 单机/均摊/总体阀值:count      | 阀值类型是QPS表示每秒的请求数；阀值类型是线程数表示并发线程数                                     |
| 流控模式:strategy         | 直接; 关联; 链路                                                           |
| 流控效果: controlBehavior | 直接拒绝; 排队等待; 慢启动模式                                                    |
注意：同一个资源可以设置多个流控规则，我们可以通过代码定义流量控制规则也可以通过在sentinel控制台进行配置，一般我们都是使用控制台进行配置，下面是一个代码配置的方式：
``` java
@RestController
@RequestMapping("/sentinel")
public class SentinelController {
    @PostConstruct
    public void init(){
        initFlowRule();
    }

    private void initFlowRule(){
        //流控规则集合
        List<FlowRule> rules = new ArrayList<>();
        // 创建规则
        FlowRule rule = new FlowRule();
        // 设置受保护的资源
        rule.setResource("/sentinel/sayHello");
        // 设置流控规则 QPS 限流阈值类型：QPS、并发线程数
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        // 设置受保护的资源的阈值
        rule.setCount(2);
        // 设置流控模式：直接
        rule.setStrategy(RuleConstant.STRATEGY_DIRECT);
        // 设置流控效果：快速失败
        rule.setControlBehavior(RuleConstant.CONTROL_BEHAVIOR_DEFAULT);
        // 加载配置好的规则
        rules.add(rule);
        FlowRuleManager.loadRules(rules);
    }

    @RequestMapping(value = "/sayHello")
    public String sayHello() {
        return "Hello, Sentinel ";
    }
}
```
测试：浏览器访问`/sentinel/sayHello`
结果：
- 正常点击，每秒点击不超过2次，浏览器显示Hello, Sentinel 
- 快速点击，每秒点击超过2次，浏览器显示Blocked by Sentinel (flow limiting）

#### 1.1流控模式
##### 1.1.1直接
> 直接：统计当前资源的请求，触发阈值时对当前资源直接限流

资源：
```java
@RestController
@RequestMapping("/sentinel")
public class SentinelController {
    @RequestMapping("/flowControl")
    public String flowControl(){
        return "success";
    }
}
```
添加限流规则：
![image.png](http://img.zouyh.top/article-img/202501261551364.png)
含义： `/sentinel/flowControl`这个资源每秒只允许2次请求，如果超出阀值，再次访问`/sentinel/flowControl`请求会被拦截并报错
测试方式一：
浏览器访问：`/sentinel/flowControl`
结果：
- 正常点击，每秒点击不超过2次，浏览器显示sucees
- 快速点击，每秒点击超过2次，浏览器显示Blocked by Sentinel (flow limiting)
![2025-01-27 11 48 57.png](http://img.zouyh.top/article-img/202501271150939.png)
测试方式二：
jmeter配置：
![image.png](http://img.zouyh.top/article-img/202501271521443.png)
配置含义是30个用户，10秒内发送请求，平均每秒的QPS = 30 /10 = 3 > 2阀值。
访问`/sentinel/flowControl`结果：
![image.png](http://img.zouyh.top/article-img/202501271524932.png)
平均每秒有3个请求，2个通过，1个限流

##### 1.1.2关联
> 关联：统计与当前资源相关的另一个资源，触发阈值时，对当前资源限流 

资源：
```java
@RestController
@RequestMapping("/sentinel")
public class SentinelController {

    @RequestMapping("/flowControl")
    public String flowControl(){
        return "success";
    }

    @RequestMapping("/association")
    public String association(){
        return "success";
    }
}
```
添加限流规则：
![image.png](http://img.zouyh.top/article-img/202501261552986.png)
含义：`/sentinel/association`这个资源每秒只允许2次请求，如果超出阀值，再次访问`/sentinel/flowControl`请求会被拦截并报错
测试：浏览器访问`/sentinel/flowControl`，使用Jmeter或PostMain访问`/sentinel/association`
结果：
- Jmeter模拟访问`/sentinel/association`不超出阀值，浏览器访问`/sentinel/flowControl`显示sucees
- Jmeter模拟访问`/sentinel/association`超出阀值，浏览器访问`/sentinel/flowControl`显示Blocked by Sentinel (flow limiting)

![image.png](http://img.zouyh.top/article-img/202501271145233.png)
不停的访问`/sentinel/association`超出阀值，`/sentinel/association`不会限流。
![image.png](http://img.zouyh.top/article-img/202501271148375.png)
但是不停的访问`/sentinel/association`超出阀值时，浏览器显示访问`/sentinel/flowControl`：
![2025-01-27 11 48 57.png](http://img.zouyh.top/article-img/202501271150939.png)

##### 1.1.3 链路
> 链路：统计从指定链路访问到本资源的请求，触发阈值时，对指定链路限流

前言：链路模式中，是对不同来源的两个链路做监控，但是 sentinel 默认会给进入 SpringMVC 的所有请求设置同一个 root 资源，会导致链路模式失效。
我们需要关闭这种对 SpringMVC 的资源聚合，修改服务的 application.yml 文件：
```yml
spring:
  cloud:
    sentinel:
      web-context-unify: false 
```
资源：
```java
@RestController
@RequestMapping("/sentinel")
public class SentinelController {

    @Resource
    private  SentinelService sentinelService;

    @RequestMapping("/linkOne")
    public String linkOne(){
        return "success," + sentinelService.linkResource("linkOne");
    }

    @RequestMapping("/linkTwo")
    public String linkTwo(){
       return "success," + sentinelService.linkResource("linkTwo");
    }

}

@Service
public class SentinelService {
  /**
   * 默认情况下Service中的方法是不被Sentinel监控的，需要我们自己通过注解来标记要监控的方法。
   * 给linkResource方法添加@SentinelResource注解
   */
   @SentinelResource("link")
    public String linkResource(String link){
        return link;
    }
}
```
重启服务，回到sentinel控制台可以看到：
![image.png](http://img.zouyh.top/article-img/202501271152833.png)
添加限流规则：
![image.png](http://img.zouyh.top/article-img/202501271153354.png)
含义：只统计`/sentinel/linkTwo`请求进入link资源，如果超出阀值再次访问`/sentinel/linkOne`或`/sentinel/linkTwo`请求会被拦截并报错
结果：
配置线程组：
![image.png](http://img.zouyh.top/article-img/202501271456537.png)
配置含义是30个用户，10秒内发送请求，平均每秒的QPS = 30 /10 = 3 > 2阀值。
资源`/sentinel/linkOne`的结果：
![image.png](http://img.zouyh.top/article-img/202501271459816.png)
资源`/sentinel/linkTwo`的结果：
![image.png](http://img.zouyh.top/article-img/202501271500301.png)
对`/sentinel/linkTwo`限流了，每秒有3个请求，2个通过，1个限流。
#### 1.2 流控效果
##### 1.2.1 快速失败
>  当请求超过阈值后，新的请求会被立即拒绝并抛出 BlockException 异常，快速失败是默认的处理方式。
资源：
```java
@RestController
@RequestMapping("/sentinel")
public class SentinelController {
    @RequestMapping("/quickFail")
    public String quickFail(){
        return "success";
    }
}
```
添加限流规则：
![image.png](http://img.zouyh.top/article-img/202501271511229.png)
jmeter配置：
![image.png](http://img.zouyh.top/article-img/202501271515178.png)
配置含义是30个用户，10秒内发送请求，平均每秒的QPS = 30 /10 = 3 > 2阀值。
![image.png](http://img.zouyh.top/article-img/202501271514005.png)
对`/sentinel/linkTwo`限流了，每秒有3个请求，2个通过，1个限流，限流效果直接失败，响应Blocked by Sentinel (flow limiting)
##### 1.2.2 warm up预热模式
>  当请求超过阈值后，新的请求会被立即拒绝并抛出异常，但这种模式阈值会动态变化，从一个阈值/3（冷加载因子）逐渐增加到阈值。
资源：
```java
@RestController
@RequestMapping("/sentinel")
public class SentinelController {
    @RequestMapping("/warmUp")
    public String warmUp(){
    	return "success";
   }
}
```
添加限流规则：
![image.png](http://img.zouyh.top/article-img/202501271529505.png)

例如：`/sentinel/warmUp` 接口当瞬时大流量进来，为系统留出缓冲时间，预防突发性系统崩溃，预热3秒后，慢慢将阈值升至10，阈值在预热的3秒内是动态增加的，刚开始阈值只有10/3，慢慢将阈值升至10。
jmeter配置:s
![image.png](http://img.zouyh.top/article-img/202501271532721.png)
配置含义是300个用户，20秒内发送请求，平均每秒的QPS = 300 /20 = 15 > 10阀值。
资源`/sentinel/warmUp` 刚开始阈值只有10/3：
![image.png](http://img.zouyh.top/article-img/202501271535294.png)
随着时间的增加，成功的请求也在增加：
![image.png](http://img.zouyh.top/article-img/202501271535195.png)
最终稳定15个请求，10个通过，5个限流。
![image.png](http://img.zouyh.top/article-img/202501271537342.png)

##### 1.2.3 排队等待
>  当请求超过QPS阈值时，快速失败和warm up 会拒绝新的请求并抛出异常，而排队等待则是让所有请求进入一个队列中，然后按照阈值允许的时间间隔依次执行，后来的请求必须等待前面执行完成，如果请求预期的等待时间超出最大时长，则会被拒绝。
资源：
```java
@RestController  
@RequestMapping("/sentinel")  
public class SentinelController {  
    @RequestMapping("/queueUp")  
    public String queueUp() throws Exception {  
        // 假设处理时间200毫秒  
        Thread.sleep(200);  
        return "success";  
    }  
}
```
添加限流规则：
![image.png](http://img.zouyh.top/article-img/202501271550281.png)

例如：假设每200ms处理一个队列中的请求；QPS = 5，timeout = 2000ms，意味着预期等待时长超过2000ms的请求会被拒绝并抛出异常。那什么叫做预期等待时长呢？比如现在一下子来了12 个请求，因为每200ms执行一个请求，那么：
- 第6个请求的预期等待时长 = 200 * （6 - 1） = 1000ms
- 第11个请求的预期等待时长 = 200 * （11-1） = 2000ms
也就是第11个请求后的请求会被拒绝，前11个请求会进入等待队列
jmeter配置：
![image.png](http://img.zouyh.top/article-img/202501271559902.png)
配置含义是100个用户，10秒内发送请求，平均每秒的QPS = 100 /10 = 10 > 5阀值。
资源`/sentinel/queueUp`访问效果：
![image.png](http://img.zouyh.top/article-img/202501271600700.png)
最初平均10秒内发送请求，而我们设置的阀值是5，按理来说最初成功应该是5，但是当我们流控效果采用排队等待时，等待timeout = 2000ms，处理一个请求大概200ms，最多处理10个请求，上图显示处理9个而不是10个也可以理解，`Thread.sleep(200);`整个请求的处理时间稍稍 > 200ms也是可以理解的。后面来的请求基本超出了等待timeout = 2000ms，只能处理1个接收1个的效果。最终当处理没有请求来的时候11个请求时最大的处理能力，第11个请求的预期等待时长 = 200 * （11-1） = 2000ms。
![image.png](http://img.zouyh.top/article-img/202501271608780.png)
### 二，热点限流
资源：
```java
@RestController  
@RequestMapping("/sentinel")  
public class SentinelController {  
    @RequestMapping("/queryStudentInfo/{studentId}/{studentName}")  
    public String queryStudentInfo(@PathVariable(value = "studentId",required = false) String studentId  
            , @PathVariable(value = "studentName",required = false)String studentName){  
        return "success,studentId="+studentId+",studentName"+studentName;  
    }  
}
```
演示一：配置热点参数：
![image.png](http://img.zouyh.top/article-img/202501271622443.png)
配置说明：访问`/sentinel/queryStudentInfo`资源，在统计时长1秒内，如果请求参数0索引参数不为null，并且QPS大于5，进行限流操作

演示二：请求接口未传递指定的限流Key时，是不会触发限流的

演示三：参数例外项的使用，假设我们有一个查询接口，通过学号查询的QPS支持1000，通过姓名查询的QPS支持100，但是有位学生的名参数例外项表示


