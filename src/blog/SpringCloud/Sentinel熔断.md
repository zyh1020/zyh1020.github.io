---
icon: file-lines
title: Sentinel熔断
author: Ms.Zyh
date: 2025-07-25
category:
  - SpringCloud
tag:
  - 偏僻
  - SpringCloud
sticky: false
star: false
---

熔断和限流的对比：
- 设计目标：熔断的核心是快速失败，防止故障扩散；限流的核心是控制流量速率，防止系统因突发流量过载。
- 触发方式：熔断是异常比例，异常数；限流是请求速率，并发量
- 恢复方式：熔断是半开状态主动探测；限流是时间窗口重置后自动恢复
### 一，慢调用
```java
@RestController
@RequestMapping("/sentinel")
public class SentinelController {
    private Integer index = 0;
    private Integer abnormal = 2;
    @RequestMapping("/slowCount")
    public String slowCount() throws InterruptedException {
        index++;
        // 访问abnormal次出现1次异常
        if(index % abnormal == 0){
            Thread.sleep(600);
        }
        return "slowCount";
    }
}

```

配置：在统计时长中，发起请求数大于等于最小请求数，且出现的慢调用请求数（不包括异常数）达到比例阈值 * 发起请求数时，会进行熔断，熔断时间=熔断时长。

### 二，异常比例
```java
@RestController
@RequestMapping("/sentinel")
public class SentinelController {
    private Integer index = 0;
    private Integer abnormal = 2;
    @RequestMapping("/abnormalRatio")
    public String abnormalRatio(){
        index++;
        // 访问abnormal次出现1次异常
        if(index % abnormal == 0){
            int x = 10/0;
        }
        return "abnormalRatio";
    }
}
```
配置：在统计时长中，发起请求数大于等于最小请求数，且出现的异常数达到比例阈值 * 发起请求数时，会进行熔断，熔断时间=熔断时长。

### 三，异常数
资源：
```java
@RestController
@RequestMapping("/sentinel")
public class SentinelController {
    private Integer index = 0;
    private Integer abnormal = 2;
    @RequestMapping("/abnormalCount")
    public String abnormalCount(){
        index++;
        // 访问abnormal次出现1次异常
        if(index % abnormal == 0){
            int x = 10/0;
        }
        return "abnormalCount";
    }
}
配置：

配置含义：在统计时长中，发起请求数大于等于最小请求数，且出现的异常数达到异常数，会进行熔断，熔断时间=熔断时长。
