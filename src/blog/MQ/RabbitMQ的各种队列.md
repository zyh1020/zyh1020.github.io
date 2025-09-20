---
icon: file-lines
title: RabbitMQ的各种队列
author: Ms.Zyh
date: 2023-08-26
category:
  - MQ
tag:
  - 偏僻
  - MQ
sticky: false
star: true
---

### 一，RabbitMQ的各种队列

#### 1.1 死信队列

由于特定的原因导致 queue 中的某些消息无法被消费，就变成了死信，死信队列是为了优雅的处理着这些无法被消费者正常消费的信息，消息变成死信有如下三种情况：

- 消息 TTL 过期 
- 队列达到最大长度(队列满了，无法再添加数据到 mq 中) 
- 消息被拒绝(basic.reject 或 basic.nack)并且 requeue=false.

架构图：

<img src="http://img.zouyh.top/article-img/20240917135113366.png" alt="image-20230505164250532" style="zoom: 80%;" />

创建SpringBoot项目，引入jar包：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

引入配置信息：

```yaml
spring:
  rabbitmq:
    host: 1.15.141.218
    port: 5672
    username: guest
    password: guest
    virtual-host: /
    listener:
      simple:
        acknowledge-mode: manual
```

##### 1.1.1 消息TTL过期

创建配置：

```java
@Configuration
public class DeadQueueConfig {

    // 创建死信交换机
    @Bean
    public DirectExchange deadExchange(){
        return new DirectExchange("dead-exchange");
    }
    // 创建死信队列
    @Bean
    public Queue deadQueue(){
        return new Queue("dead-queue");
    }
    // 创建死信交换机和死信队列绑定关系
    @Bean
    public Binding deadBinding(){
        return BindingBuilder.bind(deadQueue()).to(deadExchange()).with("dead-routing");
    }

    // 创建正常交换机
    @Bean
    public DirectExchange normalExchange(){
        return new DirectExchange("normal-exchange");
    }
    // 创建正常队列
    @Bean
    public Queue normalQueue(){
        Map<String, Object> args = new HashMap<>();
        args.put("x-dead-letter-exchange","dead-exchange"); // 声明当前队列绑定的死信交换机
        args.put("x-dead-letter-routing-key", "dead-routing"); // 声明死信交换机的死信路由
        args.put("x-message-ttl", 10000); // 声明当前队列的消息过期时间，单位ms
        return QueueBuilder.durable("normal-queue").withArguments(args).build();
    }
    // 创建正常交换机和正常队列绑定关系
    @Bean
    public Binding normalBinding(){
        return BindingBuilder.bind(normalQueue()).to(normalExchange()).with("normal-routing");
    }
}
```

生产者：

```java
@RestController
@RequestMapping("/producer")
public class Producer {
    @Autowired
    private RabbitTemplate rabbitTemplate;
    @GetMapping("sendMessage/{message}")
    public void sendMessage(@PathVariable String message){
        for (int i = 0; i < 10; i++) {
            rabbitTemplate.convertAndSend("normal-exchange","normal-routing",message+i);
        }
        System.out.println("生产者发出10条消息" + message);
    }
}
```

消费者：启动消费者后立刻关闭，模拟其接收不到消息。

```java
@Component
public class Consumer {
    public static final String CONFIRM_QUEUE_NAME = "normal-queue";
    @RabbitListener(queues =CONFIRM_QUEUE_NAME)
    public void receiveMsg(String msg, Message message, Channel channel){
        System.out.println("正常消费者接收到消息:"+msg);
        System.out.println("正常消费开始确认消息");
        try {
            channel.basicAck(message.getMessageProperties().getDeliveryTag(),false);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

项目启动：

![image-20230505172731908](http://img.zouyh.top/article-img/20240917135115371.png)

生产者发送了10条消息，访问：http://127.0.0.1:8002/producer/sendMessage/hello，此时正常消息队列有10条未消费信息

![image-20230505175215800](http://img.zouyh.top/article-img/20240917135113367.png)

时间过去10秒，正常队列里面的消息由于没有被消费消息进入死信队列

![image-20230505174852064](http://img.zouyh.top/article-img/20240917135115373.png)

启动死信消费者：

```java
@Component
public class DeadConsumer {
    public static final String CONFIRM_QUEUE_NAME = "dead-queue";
    @RabbitListener(queues =CONFIRM_QUEUE_NAME)
    public void receiveMsg(Message message){
        String msg=new String(message.getBody());
        System.out.println("死信消费者接收到消息:"+msg);
    }
}
```

死信消费者，消费死信队列的消息：

![image-20230505180059311](http://img.zouyh.top/article-img/20240917135116374.png)

##### 1.1.2 队列溢出

修改配置如下：删除了队列的消息过期时间配置，增加了队列长度设置

```java
@Configuration
public class DeadQueueConfig {

    // 创建死信交换机
    @Bean
    public DirectExchange deadExchange(){
        return new DirectExchange("dead-exchange");
    }
    // 创建死信队列
    @Bean
    public Queue deadQueue(){
        return new Queue("dead-queue");
    }
    // 创建死信交换机和死信队列绑定关系
    @Bean
    public Binding deadBinding(){
        return BindingBuilder.bind(deadQueue()).to(deadExchange()).with("dead-routing");
    }

    // 创建正常交换机
    @Bean
    public DirectExchange normalExchange(){
        return new DirectExchange("normal-exchange");
    }
    // 创建正常队列
    @Bean
    public Queue normalQueue(){
        Map<String, Object> args = new HashMap<>();
        args.put("x-dead-letter-exchange","dead-exchange"); // 声明当前队列绑定的死信交换机
        args.put("x-dead-letter-routing-key", "dead-routing"); // 声明死信交换机的死信路由
        args.put("x-max-length", 6); // 设置队列的长度
        return QueueBuilder.durable("normal-queue").withArguments(args).build();
    }
    // 创建正常交换机和正常队列绑定关系
    @Bean
    public Binding normalBinding(){
        return BindingBuilder.bind(normalQueue()).to(normalExchange()).with("normal-routing");
    }
}
```

> 注意：如果使用同名称队列，先删除原来的队列，或者使用不同名称队列

生产者：

```java
@RestController
@RequestMapping("/producer")
public class Producer {
    @Autowired
    private RabbitTemplate rabbitTemplate;
    @GetMapping("sendMessage/{message}")
    public void sendMessage(@PathVariable String message){
        for (int i = 0; i < 10; i++) {
            rabbitTemplate.convertAndSend("normal-exchange","normal-routing",message+i);
        }
        System.out.println("生产者发出10条消息" + message);
    }
}
```

消费者：启动消费者后立刻关闭，模拟其接收不到消息

```java
@Component
public class Consumer {
    public static final String CONFIRM_QUEUE_NAME = "normal-queue";
    @RabbitListener(queues =CONFIRM_QUEUE_NAME)
    public void receiveMsg(String msg, Message message, Channel channel){
        System.out.println("正常消费者接收到消息:"+msg);
        try {
            channel.basicAck(message.getMessageProperties().getDeliveryTag(),false);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

项目启动：

![image-20230506100514563](http://img.zouyh.top/article-img/20240917135112362.png)

生产者发送了10条消息，访问：http://127.0.0.1:8002/producer/sendMessage/hello，此时正常消息队列有6条未消费信息，死信队列中有4条死信。

![image-20230506100058231](http://img.zouyh.top/article-img/20240917135114368.png)

启动死信消费者：

```java
@Component
public class DeadConsumer {
    public static final String CONFIRM_QUEUE_NAME = "dead-queue";
    @RabbitListener(queues =CONFIRM_QUEUE_NAME)
    public void receiveMsg(Message message){
        String msg=new String(message.getBody());
        System.out.println("死信消费者接收到消息:"+msg);
    }
}
```

死信消费者，消费死信队列的消息：

![image-20230506101025643](http://img.zouyh.top/article-img/20240917135114369.png)

##### 1.1.3 消息被拒

修改配置如下：删除了队列的消息过期时间配置，删除队列长度设置

```java
@Configuration
public class DeadQueueConfig {

    // 创建死信交换机
    @Bean
    public DirectExchange deadExchange(){
        return new DirectExchange("dead-exchange");
    }
    // 创建死信队列
    @Bean
    public Queue deadQueue(){
        return new Queue("dead-queue");
    }
    // 创建死信交换机和死信队列绑定关系
    @Bean
    public Binding deadBinding(){
        return BindingBuilder.bind(deadQueue()).to(deadExchange()).with("dead-routing");
    }

    // 创建正常交换机
    @Bean
    public DirectExchange normalExchange(){
        return new DirectExchange("normal-exchange");
    }
    // 创建正常队列
    @Bean
    public Queue normalQueue(){
        Map<String, Object> args = new HashMap<>();
        args.put("x-dead-letter-exchange","dead-exchange"); // 声明当前队列绑定的死信交换机
        args.put("x-dead-letter-routing-key", "dead-routing"); // 声明死信交换机的死信路由
        return QueueBuilder.durable("normal-queue").withArguments(args).build();
    }
    // 创建正常交换机和正常队列绑定关系
    @Bean
    public Binding normalBinding(){
        return BindingBuilder.bind(normalQueue()).to(normalExchange()).with("normal-routing");
    }
}
```

> 注意：如果使用同名称队列，先删除原来的队列，或者使用不同名称队列

生产者：

```java
@RestController
@RequestMapping("/producer")
public class Producer {
    @Autowired
    private RabbitTemplate rabbitTemplate;
    @GetMapping("sendMessage/{message}")
    public void sendMessage(@PathVariable String message){
        for (int i = 0; i < 10; i++) {
            rabbitTemplate.convertAndSend("normal-exchange","normal-routing",message+i);
        }
        System.out.println("生产者发出10条消息" + message);
    }
}
```

消费者：启动消费者后不用关闭

```java
@Component
public class Consumer {
    public static final String CONFIRM_QUEUE_NAME = "normal-queue";
    @RabbitListener(queues =CONFIRM_QUEUE_NAME)
    public void receiveMsg(String msg, Message message, Channel channel){
        System.out.println("正常消费者接收到消息:"+msg);
        try {
            if(msg != null && msg.contains("6")){ // 不签收
                channel.basicReject(message.getMessageProperties().getDeliveryTag(),false);
            }else{ // 签收
                channel.basicAck(message.getMessageProperties().getDeliveryTag(),false);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

项目启动：

![image-20230506102122511](http://img.zouyh.top/article-img/20240917135113365.png)

生产者发送了10条消息，访问：http://127.0.0.1:8002/producer/sendMessage/hello，此时正常消息队列有0条未消费信息，本来是有9条信息，但是消费者没有关闭，所以这9条消息被消费了，死信队列中有1条死信。

消费者控制台输出：

```
正常消费者接收到消息,签收:hello0
正常消费者接收到消息,签收:hello1
正常消费者接收到消息,签收:hello2
正常消费者接收到消息,签收:hello3
正常消费者接收到消息,签收:hello4
正常消费者接收到消息,签收:hello5
正常消费者接收到消息,不签收:hello6
正常消费者接收到消息,签收:hello7
正常消费者接收到消息,签收:hello8
正常消费者接收到消息,签收:hello9
```

![image-20230506102653892](http://img.zouyh.top/article-img/20240917135117378.png)

启动死信消费者：

```java
@Component
public class DeadConsumer {
    public static final String CONFIRM_QUEUE_NAME = "dead-queue";
    @RabbitListener(queues =CONFIRM_QUEUE_NAME)
    public void receiveMsg(Message message){
        String msg=new String(message.getBody());
        System.out.println("死信消费者接收到消息:"+msg);
    }
}
```

死信消费者，消费死信队列的消息：

![image-20230506102805700](http://img.zouyh.top/article-img/20240917135112363.png)

#### 1.2 延时队列

##### 1.2.1 基于死信

​	TTL 是什么呢？TTL 是 RabbitMQ 中一个消息或者队列的属性，表明一条消息或者该队列中的所有消息的最大存活时间，单位是毫秒。如果一条消息设置了 TTL 属性或者进入了设置 TTL 属性的队列，那么这条消息如果在TTL设置的时间内没有被消费，则会成为"死信"，如果同时配置了队列的 TTL 和消息的TTL，那么较小的那个值将会被使用。

①，队列设置 TTL，在创建队列的时候设置队列的`x-message-ttl`属性

```java
@Bean
public Queue normalQueue(){
	Map<String, Object> args = new HashMap<>();
	args.put("x-dead-letter-exchange","dead-exchange"); // 声明当前队列绑定的死信交换机
	args.put("x-dead-letter-routing-key", "dead-routing"); // 声明死信交换机的死信路由
	args.put("x-message-ttl", 10000); // 声明当前队列的消息过期时间，单位ms
	return QueueBuilder.durable("normal-queue").withArguments(args).build();
}
```

  ②，消息设置 TTL，针对每条消息设置 TTL

```java
public void sendMessage(){
	String exchangeName = "交换机";
	String routingKey = "路由";
	String msg = "消息";
	String ttlTime = "3000"; // 消息的过期时间，如果不设置 TTL，表示消息永远不会过期，如果将TTL设置为0，则表示除非此时可以 直接投递该消息到消费者，否则该消息将会被丢弃
	rabbitTemplate.convertAndSend(exchangeName,routingKey,msg,correlation->{
		correlation.getMessageProperties().setExpiration(ttlTime);
		return correlation;
	});
}
```

- 队列设置TTL 属性，那么一旦消息过期，就会被队列丢弃，如果配置了死信队列被丢到死信队列中。
- 消息设置TTL 属性，消息过期，也不一定会被马上丢弃，因为消息是否过期是在即将投递到消费者之前判定的，如果当前队列有严重的消息积压情况，则已过期的消息也许还能存活较长时间。

前一小节我们介绍了死信队列，就存在延时队列现象，我们可以更改架构图如下，故意不消费正常队列中信息，等它过期后，丢到死信队列，让死信队列的消费者消费处理。等待过期的时间就是延时的时间：

<img src="http://img.zouyh.top/article-img/20240917135116375.png" alt="image-20230506112500800" style="zoom:80%;" />

基于死信的演延时队列，消息变成死信可以通过设置队列TTL 属性或者设置消息TTL 属性，前面的死信队列已经介绍过了队列设置TTL 属性，下面我就着重介绍消息设置TTL 属性。

创建SpringBoot项目，引入jar包：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

引入配置信息：

```yaml
spring:
  rabbitmq:
    host: 1.15.141.218
    port: 5672
    username: guest
    password: guest
    virtual-host: /
    listener:
      simple:
        acknowledge-mode: manual
```

创建配置：

```java
@Configuration
public class DeadQueueConfig {
    // 创建死信交换机
    @Bean
    public DirectExchange deadExchange(){
        return new DirectExchange("dead-exchange");
    }
    // 创建死信队列
    @Bean
    public Queue deadQueue(){
        return new Queue("dead-queue");
    }
    // 创建死信交换机和死信队列绑定关系
    @Bean
    public Binding deadBinding(){
        return BindingBuilder.bind(deadQueue()).to(deadExchange()).with("dead-routing");
    }

    // 创建正常交换机
    @Bean
    public DirectExchange normalExchange(){
        return new DirectExchange("normal-exchange");
    }
    // 创建正常队列
    @Bean
    public Queue normalQueue(){
        Map<String, Object> args = new HashMap<>();
        args.put("x-dead-letter-exchange","dead-exchange"); // 声明当前队列绑定的死信交换机
        args.put("x-dead-letter-routing-key", "dead-routing"); // 声明死信交换机的死信路由
        return QueueBuilder.durable("normal-queue").withArguments(args).build();
    }
    // 创建正常交换机和正常队列绑定关系
    @Bean
    public Binding normalBinding(){
        return BindingBuilder.bind(normalQueue()).to(normalExchange()).with("normal-routing");
    }
}
```

生产者：

```java
@RestController
@RequestMapping("/producer")
public class Producer {
    @Autowired
    private RabbitTemplate rabbitTemplate;
    @GetMapping("sendMessage/{message}")
    public void sendMessage(@PathVariable String message){
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd hh:mm:ss");
        String exchangeName = "normal-exchange";
        String routingKey = "normal-routing";
        String ttlTime01 = "30000";
        rabbitTemplate.convertAndSend(exchangeName,routingKey,message+ttlTime01,correlation->{
            correlation.getMessageProperties().setExpiration(ttlTime01);
            return correlation;
        });
        System.out.println("生产者发出消息:"+message+ttlTime01+",时间："+dateFormat.format(new Date()));
        String ttlTime02 = "10000";
        rabbitTemplate.convertAndSend(exchangeName,routingKey,message+ttlTime02,correlation->{
            correlation.getMessageProperties().setExpiration(ttlTime02);
            return correlation;
        });
        System.out.println("生产者发出消息:"+message+ttlTime02+",时间："+dateFormat.format(new Date()));
    }
}
```

消费者不存在，因为我们需要故意不消费正常队列中信息，等它过期后，丢到死信队列，让死信队列的消费者消费处理。

死信消费者：

```java
@Component
public class DeadConsumer {
    public static final String CONFIRM_QUEUE_NAME = "dead-queue";
    @RabbitListener(queues =CONFIRM_QUEUE_NAME)
    public void receiveMsg(String msg, Message message, Channel channel){
        System.out.println("死信消费者接收到消息:"+msg+",时间："+new SimpleDateFormat("yyyy-MM-dd hh:mm:ss").format(new Date()));
        try {
            channel.basicAck(message.getMessageProperties().getDeliveryTag(),false);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

启动生产者和消费者，生产者发送消息访问：http://127.0.0.1:8002/producer/sendMessage/hello

生产者控制台输出：

```
生产者发出消息:hello30000,时间：2023-05-06 11:42:11
生产者发出消息:hello10000,时间：2023-05-06 11:42:11
```

死信消费者控制台输出：

```
死信消费者接收到消息:hello30000,时间：2023-05-06 11:42:41
死信消费者接收到消息:hello10000,时间：2023-05-06 11:42:41
```

​	由生产者和死信消费者控制台的输出，可以看出第一条消息在 30S 后变成了死信消息，然后被死信消费者消费掉，第二条消息本意上我们是希望10s后后变成了死信消息，然后被消费者消费掉，但是第二条消息在也是在30S 之后被死信消费者消费掉。原因是因为RabbitMQ 只会检查第一个消息是否过期，如果过期则丢到死信队列， 如果第一个消息的延时时长很长，而第二个消息的延时时长很短，第二个消息并不会优先得到执行。 

##### 1.2.2 基于插件

​	如果不能实现在消息粒度上的 TTL，并使其在设置的 TTL 时间 及时死亡，就无法设计成一个通用的延时队列。那如何解决呢，接下来我们就去解决该问题。

安装延时队列插件：https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases

下载 rabbitmq_delayed_message_exchange 插件，然后解压放置到 RabbitMQ 的插件目录`/plugins`

如果采用docker安装的，需要将宿主机文件拷贝到容器中的插件目录：

```sh
# docker cp 宿主机中文件路径 容器名:容器中文件路径  
docker cp /root/rabbitmq_delayed_message_exchange-3.10.2.ez rabbitmq:/plugins
# 进入容器
docker exec -it rabbitmq /bin/bash
# 移动到plugins目录下
cd plugins
# 查看是否上传成功
ls
```

执行下面命令让该插件生效

```sh
rabbitmq-plugins enable rabbitmq_delayed_message_exchange
```

<img src="http://img.zouyh.top/article-img/20240917135114370.png" alt="image-20230506151739037" style="zoom:80%;" />



创建交换机的type新增`x-delayed-message `选项：

<img src="http://img.zouyh.top/article-img/20240917135116376.png" alt="image-20230506151754706" style="zoom:80%;" />

创建SpringBoot项目，引入jar包：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

引入配置信息：

```yaml
spring:
  rabbitmq:
    host: 1.15.141.218
    port: 5672
    username: guest
    password: guest
    virtual-host: /
    listener:
      simple:
        acknowledge-mode: manual
```

创建配置：

```java
@Configuration
public class DeadQueueConfig {
    @Bean
    public Queue delayedQueue() {
        return new Queue("dead-queue");
    }
    //自定义交换机 我们在这里定义的是一个延迟交换机
    @Bean
    public CustomExchange delayedExchange() {
        Map args = new HashMap<>();
        args.put("x-delayed-type", "direct");//自定义交换机的类型
        return new CustomExchange("delayed-exchange", "x-delayed-message", true, false, args);
    }
    @Bean
    public Binding bindingDelayedQueue() {
        return BindingBuilder.bind(delayedQueue()).to(delayedExchange()).with("delayed-routingkey").noargs();
    }
}
```

生产者：

```java
@RestController
@RequestMapping("/producer")
public class Producer {
    @Autowired
    private RabbitTemplate rabbitTemplate;
    @GetMapping("sendMessage/{message}")
    public void sendMessage(@PathVariable String message){
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd hh:mm:ss");
        String exchangeName = "delayed-exchange";
        String routingKey = "delayed-routingkey";
        String ttlTime01 = "30000";
        rabbitTemplate.convertAndSend(exchangeName,routingKey,message+ttlTime01,correlation->{
            correlation.getMessageProperties().setDelay(ttlTime01);// 设置过期时间
            return correlation;
        });
        System.out.println("生产者发出消息:"+message+ttlTime01+",时间："+dateFormat.format(new Date()));
        String ttlTime02 = "10000";
        rabbitTemplate.convertAndSend(exchangeName,routingKey,message+ttlTime02,correlation->{
            correlation.getMessageProperties().setDelay(ttlTime02); // 设置过期时间
            return correlation;
        });
        System.out.println("生产者发出消息:"+message+ttlTime02+",时间："+dateFormat.format(new Date()));
    }
}
```

死信消费者：

```java
@Component
public class DeadConsumer {
    public static final String CONFIRM_QUEUE_NAME = "dead-queue";
    @RabbitListener(queues =CONFIRM_QUEUE_NAME)
    public void receiveMsg(String msg, Message message, Channel channel){
        System.out.println("死信消费者接收到消息:"+msg+",时间："+new SimpleDateFormat("yyyy-MM-dd hh:mm:ss").format(new Date()));
        try {
            channel.basicAck(message.getMessageProperties().getDeliveryTag(),false);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

启动生产者和消费者，生产者发送消息访问：http://127.0.0.1:8002/producer/sendMessage/hello

生产者控制台输出：

```
生产者发出消息:hello30000,时间：2023-05-06 12:50:20
生产者发出消息:hello10000,时间：2023-05-06 12:50:20
```

死信消费者控制台输出：

```
死信消费者接收到消息:hello10000,时间：2023-05-06 12:50:30
死信消费者接收到消息:hello30000,时间：2023-05-06 12:50:50
```

第二个消息被先消费掉了，符合预期。

总结：

- 通过给队列设置TTL过期时间，消息过期，就会被队列立刻丢弃，如果配置了死信队列被丢到死信队列中，这种方式的最大缺点就是在于一开始就定下了所有消息的过期时间，都是给队列设置的TTL过期时间，如果过期时间不一样就需要创建不同的死信队列。
- 通过给消息设置TTL过期时间，也不一定会被马上丢弃，因为消息是否过期是在即将投递到消费者之前判定的，如果当前队列有严重的消息积压情况，则已过期的消息也许还能存活较长时间，所以要使用基于插件延时队列。
- 如果消息的过期时间单一，建议采用给队列设置TTL过期时间；如果消息的过期时间多样，建议采用给消息设置TTL过期时间并结合插件的方式使用。

#### 1.3 优先队列

> 对于积压的消息（启动消费者一定要在生产者生产消息之后启动），选择优先级最大的进行消费。

创建SpringBoot项目，引入jar包：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

引入配置信息：

```yaml
spring:
  rabbitmq:
    host: 1.15.141.218
    port: 5672
    username: guest
    password: guest
    virtual-host: /
    listener:
      simple:
        acknowledge-mode: manual
```

创建配置：

```java
@Configuration
public class DeadQueueConfig {
    // 创建正常队列
    @Bean
    public Queue priorityQueue(){
        Map<String, Object> args = new HashMap<>();
        args.put("x-max-priority", 10); // 声明当前队列绑定的死信交换机
        return QueueBuilder.durable("priority-queue").withArguments(args).build();
    }
    // 创建优先级交换机
    @Bean
    public DirectExchange priorityExchange(){
        return new DirectExchange("priority-exchange");
    }

    // 创建正常交换机和正常队列绑定关系
    @Bean
    public Binding priorityBinding(){
        return BindingBuilder.bind(priorityQueue()).to(priorityExchange()).with("priority-routing");
    }

}
```

生产者：

```java
@RestController
@RequestMapping("/producer")
public class Producer {
    @Autowired
    private RabbitTemplate rabbitTemplate;
    @GetMapping("sendMessage/{message}")
    public void sendMessage(@PathVariable String message){
        String exchangeName = "priority-exchange";
        String routingKey = "priority-routing";
        rabbitTemplate.convertAndSend(exchangeName,routingKey,message+1,correlation->{
            correlation.getMessageProperties().setPriority(1); // 设置优先级
            return correlation;
        });

        rabbitTemplate.convertAndSend(exchangeName,routingKey,message+5,correlation->{
            correlation.getMessageProperties().setPriority(5);// 设置优先级
            return correlation;
        });
        System.out.println("生产者发出消息完毕！");
    }
}
```

项目启动：

![image-20230506155413296](http://img.zouyh.top/article-img/20240917135117377.png)

生产者生产消息，访问：http://127.0.0.1:8002/producer/sendMessage/hello

![image-20230506155726629](http://img.zouyh.top/article-img/20240917135115372.png)

消费者：注意启动消费者一定要在生产者生产消息之后启动，如果消费者一直启动生产者刚生产消息好消息，就被消费者消费了，根本就没有比较优先级的时间。

```java
@Component
public class Consumer {
    public static final String CONFIRM_QUEUE_NAME = "priority-queue";
    @RabbitListener(queues =CONFIRM_QUEUE_NAME)
    public void receiveMsg(String msg, Message message, Channel channel){
        System.out.println("正常消费者接收到消息:"+msg);
        try {
            channel.basicAck(message.getMessageProperties().getDeliveryTag(),false);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

消费者启动后控制台输出：

```
正常消费者接收到消息:hello5
正常消费者接收到消息:hello1
```

可以看出hello5虽然是第二条消息，但是优先级大先被消费了。

![image-20230506155927162](http://img.zouyh.top/article-img/20240917135112364.png)

#### 1.4 惰性队列

​	RabbitMQ 从 3.6.0 版本开始引入了惰性队列的概念。惰性队列会尽可能的将消息存入磁盘中，而在消费者消费到相应的消息时才会被加载到内存中，它的一个重要的设计目标是能够支持更长的队列，即支持更多的消息存储。当消费者由于各种各样的原因(比如消费者下线、宕机亦或者是由于维护而关闭等)而致 使长时间内不能消费消息造成堆积时，惰性队列就很有必要了。 默认情况下，当生产者将消息发送到 RabbitMQ 的时候，队列中的消息会尽可能的存储在内存之中， 这样可以更加快速的将消息发送给消费者。即使是持久化的消息，在被写入磁盘的同时也会在内存中驻留一份备份。当 RabbitMQ 需要释放内存的时候，会将内存中的消息换页至磁盘中，这个操作会耗费较长的时间，也会阻塞队列的操作，进而无法接收新的消息。虽然 RabbitMQ 的开发者们一直在升级相关的算法， 但是效果始终不太理想，尤其是在消息量特别大的时候。

队列具备两种模式：default 和 lazy,默认的为 default 模式，在队列声明的时候可以通过`x-queue-mode`参数来设置队列的模式:

```java
// 创建队列
@Bean
public Queue normalQueue(){
	Map<String, Object> args = new HashMap<>();
	args.put("x-queue-mode", "lazy");
	return QueueBuilder.durable("lazy-queue").withArguments(args).build();
}
```

内存开销对比: 在发送 1 百万条消息，每条消息大概占 1KB 的情况下，普通队列占用内存是 1.2GB，而惰性队列仅仅占用 1.5MB

