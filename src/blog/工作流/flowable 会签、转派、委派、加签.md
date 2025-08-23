---
icon: document
# 标题
title: 'flowable 会签、转派、委派、加签'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-29
# 一个页面可以有多个分类
category:
  - 工作流
# 一个页面可以有多个标签
tag:
  - 进阶
  - 工作流
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一、 会签
> 会签的意思是，在流程任务管理中，任务通常是由一个人或者多个人同时去处理的，这种任务叫做会签任务
#### 1.1 会签类型
- 按数量通过：达到一定数量的处理后，会签通过
- 按比例通过：达到一定比例的处理后，会签通过
- 一票否决：只有一个人不同意时，会签通过
- 一票通过：只有一个同意时，会签通过
Flowable实现会签是基于多实例任务的，将任务节点设置成多实例，流程执行到该任务节点会为会签人员的集合都生成一条代办任务。
#### 1.2 会签方式
- 并行会签（parallel）：流程执行到该任务节点，会在同一时间为会签集合中人员都生成一条代办任务。
- 顺序会签(sequential)：流程执行到该任务节点，会按照会签集合的顺序生成，先为生成一条代办任务，这条任务完成后，接着继续按照会签集合的顺序，再生成一条代办任务。
Flowable配置方式如下图：
![image.png](http://img.zouyh.top/article-img/20250327151426976.png)
- 多实例类型：parallel并行会签，sequential顺序会签。
- 集合（多实例）：会签人员的集合变量，可以随意命名，通过设置流程变量的方式传递。
- 基数（多实例）：直接流程执行到该任务节点，生成多少条代办任务。若与集合（多实例）配置项同时配置，集合（多实例）配置项优先级高于基数（多实例）
- 元素变量（多实例）：循环集合多实例集合的变量名，可以随意命名，`for (String assignee : userList) {}`，注意没有使用`${}`。
- 分配用户：分配用户的变量名称和元素变量的名称需要保持一致。
- 完成条件（多实例）：flowable默认流程变量：nrOfInstances（会签中总共的实例数量）、nrOfCompletedInstances（已经完成的实例数量）、nrOfActiviteInstances（当前活动的实例数量，即还未完成的实例数量），所以该项可设置，例如：`${nrOfInstances == nrOfCompletedInstances}`表示所有人都需要完成任务会签才结束、`${nrOfCompletedInstances == 1}`表示一个人完成任务，会签结束，其它条件可以以此类推实现。
案例的总结：
	⁃	任务未结束的时候，代办任务保存在act_ru_task表中，任务结束的时候，保存在act_hi_actinst表中。
	⁃	流程未结束的时候，流程变量保存在act_ru_variable表中，流程结束的时候，流程变量保存在act_hi_varinst表中。
	⁃	关于流程变量的存储，流程中使用到的变量比如案例中的studentId、teacherId、deanId、day、agree变量必须传递存储在工作流中的同时建议业务方自己也存储，流程中未使用的变量比如案例中的memo建议业务方自己存储。

### 二、转派
> 转派：假设代办任务在人员A这里，A觉得这个代办任务，人员C处理更合适，于是A将代办任务转派给了C全权负责，代办任务就和A没关系了。
#### 2.1 发起转派
我们在测试转派能力之前，可以先在act_ru_task表中查看代办任务：
如图
同时我们也可以在act_hi_actinst表中查询已完成的任务：
如图
```java
@RestController
@RequestMapping("/flowable")
public class FlowableController {
    @Resource
    private ProcessEngine processEngine;

    @PostMapping("/forwardApproval")
    public String forwardApproval(@RequestParam("taskId") String taskId,@RequestParam("assigneeId") String assigneeId) {
        TaskService taskService = processEngine.getTaskService();
        taskService.setAssignee(taskId,assigneeId);
        return "success";
    }
}
```
测试访问`/flowable/forwardApproval`，完成转派操作，如图：
可以先在act_ru_task表中查看代办任务：
如图
同时我们也可以在act_hi_actinst表中查询已完成的任务：
如图
#### 2.2 完成转派
我们在测试转派能力之前，可以先在act_ru_task表中查看代办任务：
如图
同时我们也可以在act_hi_actinst表中查询已完成的任务：
如图
```java
@RestController
@RequestMapping("/flowable")
public class FlowableController {
    @Resource
    private ProcessEngine processEngine;

    @PostMapping("/forwardApproval")
    public String forwardApproval(@RequestParam("taskId") String taskId,@RequestParam("assigneeId") String assigneeId) {
        TaskService taskService = processEngine.getTaskService();
        taskService.setAssignee(taskId,assigneeId);
        return "success";
    }
}
```
测试访问`/flowable/forwardApproval`，完成转派操作，如图：
可以先在act_ru_task表中查看代办任务：
如图
同时我们也可以在act_hi_actinst表中查询已完成的任务：
如图

### 三、委派
> 委派：假设代办任务在人员A这里，A觉得这个代办任务，需要人员C配合处理或者人员C先处理，于是A将代办任务委派给了C，C处理完后代办任务会继续回到人员A这里。
#### 3.1 发起委派
我们在测试发起转派能力之前，可以先在act_ru_task表中查看代办任务：
如图
同时我们也可以在act_hi_actinst表中查询已完成的任务：
如图
```java
@RestController
@RequestMapping("/flowable")
public class FlowableController {
    @Resource
    private ProcessEngine processEngine;

    @PostMapping("/delegateApproval")
    public String delegateApproval(@RequestParam("taskId") String taskId,@RequestParam("delegateId") String delegateId) {
        TaskService taskService = processEngine.getTaskService();
        // 实现委派
        taskService.delegateTask(taskId,delegateId);
        return "success";
    }
}
```
测试访问`/flowable/delegateApproval`，完成转派操作，如图：
可以先在act_ru_task表中查看代办任务：
如图
同时我们也可以在act_hi_actinst表中查询已完成的任务：
如图
#### 3.2 完成委派
我们在测试完成委派能力之前，可以先在act_ru_task表中查看代办任务：
如图
同时我们也可以在act_hi_actinst表中查询已完成的任务：
```java
@RestController
@RequestMapping("/flowable")
public class FlowableController {
    @Resource
    private ProcessEngine processEngine;

    @PostMapping("/completeDelegateApproval")
    public String completeDelegateApproval(@RequestParam("taskId") String taskId) {
        TaskService taskService = processEngine.getTaskService();
        // 实现委派
        taskService.resolveTask(taskId);
        return "success";
    }
}
```
测试访问`/flowable/completeDelegateApproval`，完成委派，如图：
可以先在act_ru_task表中查看代办任务：
如图
同时我们也可以在act_hi_actinst表中查询已完成的任务：
如图

### 四、加签（不推荐）
> 加签是一种动态调整审批流程的功能，允许在流程运行中，根据实际情况临时增加新的审批人。加签通常用于处理流程中未预见的特殊情况，比如某个节点需要额外审批或增加领导确认。
```java
@RestController
@RequestMapping("/flowable")
public class FlowableController {
    @Resource
    private ProcessEngine processEngine;
    @PostMapping("/addSign")
    public String addSign(@RequestParam("taskId") String taskId,@RequestParam("assigneeId") String assigneeId) {
        TaskService taskService = processEngine.getTaskService();
        // 动态创建新任务（模拟加签）
        Task newTask = taskService.createTaskBuilder()
                .name("任务名称")
                .assignee(assigneeId)
                .parentTaskId(taskId)
                .create();
        taskService.saveTask(newTask);
        return "success";
    }

```
不推荐加签操作，现实的场景中使用的也非常少，因为它相当于动态的修改了流程，这是非常大的操作。

### 五、总结
| 操作类型 | 实现方式                                     |
| :--- | :--------------------------------------- |
| 会签   | 配置多实例任务                                  |
| 转派   | 修改任务Assignee                             |
| 委派   | 通过delegateTask实现发起委派、通过resolveTask实现完成委派 |
| 加签   | 通过创建新的定时任务实现                             |

### 六、资源
approval.bpmn20.xml文件
```xml
```
部署流程：
```java
@RestController
@RequestMapping("/flowable")
public class FlowableController {
    @Resource
    private ProcessEngine processEngine;

    @PostMapping("/deployProcess")
    public String deployProcess() {
        RepositoryService repositoryService = processEngine.getRepositoryService();
        //1,创建部署对象
        Deployment deployment = repositoryService.createDeployment()
                //2.添加流程定义文件
                .addClasspathResource("process/approval.bpmn20.xml")
                //3.设置流程名称
                .name("审批流程")
                //4.部署
                .deploy();
        //5.返回部署的流程id
        return deployment.getId();
    }
}
```
启动流程：
```java
@PostMapping("/startProcessById")
public String startProcessById(@RequestParam("studentId") String studentId,@RequestParam("deploymentId") String deploymentId) {
    RuntimeService runtimeService = processEngine.getRuntimeService();
    Map<String,Object> variable = new HashMap<>();
    variable.put("startApprovalUserId","A");
    variable.put("endApprovalUserId","C");
    ProcessInstance processInstance = runtimeService.startProcessInstanceById(deploymentId,variable);
    return processInstance.getId();
}
```
查询代办任务：
```java
@RestController
@RequestMapping("/flowable")
public class FlowableController {
    @Resource
    private ProcessEngine processEngine;
 
    @PostMapping("/findTask")
    public List<Task> findTask(@RequestParam("assigneeId") String assigneeId) {
        TaskService taskService = processEngine.getTaskService();
        return taskService.createTaskQuery()
                .taskAssignee(assigneeId)
                .list();
    }
}
```
