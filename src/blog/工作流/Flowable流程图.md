---
icon: document
# 标题
title: 'Flowable流程图'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-08
# 一个页面可以有多个分类
category:
  - 工作流
# 一个页面可以有多个标签
tag:
  - 干货
  - 工作流
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，认识工作流
#### 1.1 认识BPM与BPMN
- BPM：BPM是Business Process Management的缩写，中文含义业务流程管理，旨在通过分析、设计、执行、监控和优化业务流程，这一流程也被称之为Business Process Modeling业务流程建模。说白了BPM就是一种管理方法，或者说是一种思想，主要是用来管理业务流程。
- BPMN：BPM下就有很多种建模语言，BPMN（Business Process Modeling Notation）就是其中的一种建模语言。在2004年5月由BPMI Notation Working Group对外发布，这就是BPMN 1.0 规范。后来BPMI并入到OMG组织，并在2011年推出BPMN2.0标准，对BPMN进行了重新定义 (Business Process Model and Notation)，这就是我们常说的BPMN2.0。
总的来说，BPM是一种思想，而BPMN是实现这种思想的行业规范。

#### 1.2 工作流引擎的发展
BPMN流程建模工具用于生产流程定义XML或JSON文件，工作流引擎则是用来部署流程定义XML或JSON文件，创建这些流程定义的流程实例，查询运行中或历史的流程实例与相关数据等，常见的工作流引擎jBPM 、Activiti、Flowable、Camunda等。
![image.png](http://img.zouyh.top/article-img/20250324163542569.png)
- jBPM架构较老旧且社区文档较少，所以不推荐。
- Activiti 社区分裂导致版本混乱（Activiti 5/6/7）且功能迭代缓慢也不推荐。
- Flowable轻量级、生态好、适合中小型企业。
- Camunda高性能与高可用性、 专业监控工具、适合大型企业高并发场景。

### 二，流程设计
对工作流引擎有了一定的认识后，我们就需要开始工作流里最重要的一个环节，那就是设计流程或者说画流程图。有了流程图，我们才能使用工作流引擎jBPM 、Activiti、Flowable、Camunda来加载部署流程、创建流程实例等操作。
#### 2.1 BPMN.js自定义
当 FlowableUI 无法满足复杂的流程业务需求时，这个时候就可以基于bpmn.js来自定义流程设计器。官网地址：https://bpmn.io/
BPMN.js 是一个基于浏览器的 BPMN 图表渲染和编辑工具，它的底层实现融合了现代 Web 技术与模块化设计思想，为开发者提供了高度可定制和扩展的解决方案,这个学习成本较高，感兴趣的同学可以参考中文学习文档：https://github.com/LinDaiDai/bpmn-chinese-document
#### 2.2 第三方的设计器
自己从0到1做当然是个很耗费心力的事情，所以直接用别人开源的设计器当然也是不错的选择，如果自己有定制化需求，那从1到10去改也相对容易了，比如：https://gitee.com/MiyueSC/bpmn-process-designer
#### 2.3 FlowableUI
官方出品，与 Flowable 后台引擎逻辑对接非常好，元素及属性也是最全的，如果只是使用创建流程定义XML或JSON文件，
下载的地址：https://github.com/flowable/flowable-engine/releases 找到flowable-6.8.0.zip下载，然后在flowable-6.8.0/war包中找到flowable-ui.war，然后通过`java -jar flowable-ui.war`命令启动应，应用启动成功后，访问http://localhost:8080/flowable-ui/idm/#/login，管理员账号admin、密码test
