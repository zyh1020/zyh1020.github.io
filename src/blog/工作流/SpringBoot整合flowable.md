---
icon: file-lines
# 标题
title: 'SpringBoot整合flowable'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-01
# 一个页面可以有多个分类
category:
  - 工作流
# 一个页面可以有多个标签
tag:
  - 必看
  - 工作流
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---


### 一，flowable相关配置
第一步：导入对应的jar：
```xml
<dependency>
    <groupId>org.flowable</groupId>
    <artifactId>flowable-spring-boot-starter</artifactId>
    <version>6.7.2</version>
</dependency>
```
springboot2.x版本对应flowable6.x，springboot3.x版本对应flowable7.x.
除了以上依赖，还需要导入数据库依赖，如果数据库依赖有就不用了:
```xml
<!-- mysql链接驱动 -->  
<dependency>  
    <groupId>mysql</groupId>  
    <artifactId>mysql-connector-java</artifactId>  
    <scope>runtime</scope>  
</dependency>  
<!-- 数据库连接池 -->  
<dependency>  
    <groupId>com.alibaba</groupId>  
    <artifactId>druid</artifactId>  
    <version>1.2.8</version>  
</dependency>  
<!-- mybatis整合springBoot-->  
<dependency>  
    <groupId>org.mybatis.spring.boot</groupId>  
    <artifactId>mybatis-spring-boot-starter</artifactId>  
    <version>2.1.3</version>  
</dependency>
```

第二步：application.yml文件中新增flowable配置：
```yml
flowable:
  async-executor-activate: true #关闭定时任务JOB
  #  将databaseSchemaUpdate设置为true。当Flowable发现库与数据库表结构不一致时，会自动将数据库表结构升级至新版本。前提是数据库中只能有flowable-learn架构，架构中不能有表。
  database-schema-update: true
logging:
  level:
    org:
      flowable: debug
```
因为flowable需要数据库来存储数据，所以还需要导入数据库的相关配置。
```yaml
spring:
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://127.0.0.1:3306/flowable?serverTimezone=GMT%2B8
    username: root
    password: 123456
```
验证是否整合成功，可以查看数据库表创建情况：
![](http://img.zouyh.top/article-img/202503301428824.png)
### 二，flowable相关表
项目启动成功后，可以在数据库中看到79张表,为了更好地理解 Flowable 的实现原理和细节，有必要先理清楚相关表结构及其作用，接下来，我来帮各位读者梳理一下生成的这79张表。第一次学习的同学可能乍一看这79张表会感到头疼，光是理清楚每张表和字段的作用就要花很长时间，其实有些表我们从来都不会用到，比如引擎自带的用户相关的表，在我们实际业务中，有我们自己的用户组关系和字段，所以在下面的表格中也不做罗列。
Flowable的所有数据库表都以ACT_开头，具体如下：
- ACT_RE：'RE’表示repository（存储）。这个前缀的表包含了流程定义和流程静态资源：图片，规则等等。
- ACT_RU：'RU’表示runtime。这些运行时的表，包含流程实例，任务，变量，异步任务等运行中的数据。Flowable只在流程实例执行过程中保存这些数据，在流程结束时就会删除这些记录。这样运行时表可以一直很小速度很快。
- ACT_HI：'HI’表示history。这些表包含历史数据，比如历史流程实例，变量，任务等。
- ACT_ID：'ID’表示identity (组织机构)。这些表包含标识的信息，如用户，用户组等。
- ACT_GE：'GE’表示general。存储Flowable在各种不同场景下需要的通用数据。

最后提示：在实际业务中，建议将工作流单独部署一个服务和数据库，通过对外提供接口的方式调用服务，不然和业务耦合在一个服务中，多出那么79张表不利于问题排查和维护。

| 表                   | 说明                                                         |
| :------------------ | :--------------------------------------------------------- |
| ACT_RE_DEPLOYMENT   | 存储流程部署记录，每次服务重启会部署一次，这里会新增一条记录                             |
| ACT_RE_MODEL        | 存储模型信息，创建模型时，额外定义的一些模型相关信息，存在这张表，默认不保存                     |
| ACT_RE_PROCDEF      | 存储已部署的流程定义，记录流程的变更，流程每变更一次存一条记录，version_字段加1               |
| ACT_RU_EVENT_SUBSCR | 存储运行时事件，当流程定义使用事件（信号/消息/启动/中间/边界）时，引擎将对该表的引用存储在该表中         |
| ACT_RU_EXECUTION    | 存储运行时流程执行实例和指向流程实例当前状态的指针                                  |
| ACT_RU_IDENTITYLINK | 存储运行时用户关系信息，即任务节点与参与者的相关信息                                 |
| ACT_RU_JOB          | 存储运行时作业                                                    |
| ACT_RU_TASK         | 存储运行时任务                                                    |
| ACT_RU_VARIABLE     | 存储运行时变量，是与实例相关的变量                                          |
| ACT_HI_ACTINST      | 存储历史的活动信息，记录流程流转过的所有节点                                     |
| ACT_HI_ATTACHMENT   | 存储历史的流程的附件表                                                |
| ACT_HI_COMMENT      | 存储历史的流程说明性信息                                               |
| ACT_HI_DETAIL       | 存储历史的流程运行的细节信息，比如流程中产生的变量详细，包括控制流程流转的变量，业务表单中填写的流程需要用到的变量等 |
| ACT_HI_ENTITYLINK   | 存储历史参与的人员                                                  |
| ACT_HI_IDENTITYLINK | 存储任务参与者数据，主要存储历史节点参与者的信息，可能是 Group 也可能是 User               |
| ACT_HI_PROCINST     | 存储历史的流程实例，保存每一个历史流程，创建时就生成，一条流程实例对应一个记录                    |
| ACT_HI_TASKINST     | 存储历史的任务实例，记录每一个历史节点，一个 Task 对应一个记录                         |
| ACT_HI_TSK_LOG      | 存储历史的任务操作日志，每一次执行可能会带上数据，存在这里                              |
| ACT_HI_VARINST      | 存储历史的流程运行中的变量信息                                            |
