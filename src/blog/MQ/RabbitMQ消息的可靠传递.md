---
icon: document
# 标题
title: 'RabbitMQ消息的可靠传递'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-12
# 一个页面可以有多个分类
category:
  - MQ
# 一个页面可以有多个标签
tag:
  - 推荐
  - MQ
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，消息的可靠投递

#### 1.1 消息的发布和确认 

> 消息的发布和确认目的是为了让生产者确认消息已经投递成功了。

消息的投递流程如下：

<img src="http://img.zouyh.top/article-img/20240917135111361.png" alt="image-20230428163339372" style="zoom:80%;" />



根据消息的投递流程RabbitMQ 为我们提供了两种方式用来控制消息的投递可靠性模式。

- `confirm` 确认模式：消息从 producer 到 exchange投递结果，设置ConnectionFactory的`publisher-confirm-type="true"` 开启确认模式，使用`rabbitTemplate.setConfirmCallback`设置回调函数，在方法中判断ack，如果为true，则发送成功，如果为false，则发送失败。
- `return` 退回模式：消息从 exchange 到 queue 投递结果，设置ConnectionFactory的`publisher-returns="true"` 开启退回模式,使用`rabbitTemplate.setReturnCallback`设置退回函数，如果同时设置了`rabbitTemplate.setMandatory(true)`参数，则会将消息退回给producer。

##### 1.1.2 测试项目搭建

创建SpringBoot项目，引入jar包：

```xml
<dependency>
	<groupId>org.springframework.boot</groupId>
	<artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

引入配置：

```yaml
spring:
  rabbitmq:
    host: 1.15.141.21
    port: 5672
    username: guest
    password: guest
    virtual-host: /
```

创建交换机和队列：

```java
@Configuration
public class ConfirmConfig {
    public static final String CONFIRM_EXCHANGE_NAME = "confirm.exchange";
    public static final String CONFIRM_QUEUE_NAME = "confirm.queue";
    // 创建路由 交换机
    @Bean("confirmExchange")
    public DirectExchange confirmExchange(){
        return new DirectExchange(CONFIRM_EXCHANGE_NAME);
    }
    // 创建 队列
    @Bean("confirmQueue")
    public Queue confirmQueue(){
        return QueueBuilder.durable(CONFIRM_QUEUE_NAME).build();
    }
    // 创建队列和交换机绑定关系
    @Bean
    public Binding queueBinding(@Qualifier("confirmQueue") Queue queue,
                                @Qualifier("confirmExchange") DirectExchange exchange){
        return BindingBuilder.bind(queue).to(exchange).with("key1");
    }
}
```

消息生产者：

```java
@RestController
@RequestMapping("/confirm")
public class Producer {
    public static final String CONFIRM_EXCHANGE_NAME = "confirm.exchange";
    public static final String CONFIRM_EXCHANGE_NAME_ERROR = "confirm.exchange.error";
    public static final String ROUTING_KEY = "key1";
    public static final String ROUTING_KEY_ERROR = "key_error";
    @Autowired
    private RabbitTemplate rabbitTemplate;
    @GetMapping("sendMessage/{message}")
    public void sendMessage(@PathVariable String message){
        CorrelationData correlationData1=new CorrelationData("1"); // 指定消息 id 为 1
        rabbitTemplate.convertAndSend(CONFIRM_EXCHANGE_NAME,ROUTING_KEY,message+",key:"+ROUTING_KEY+",changeName:"+CONFIRM_EXCHANGE_NAME,correlationData1);
        CorrelationData correlationData2=new CorrelationData("2");
        rabbitTemplate.convertAndSend(CONFIRM_EXCHANGE_NAME,ROUTING_KEY_ERROR,message+",key:"+ROUTING_KEY_ERROR+",changeName:"+CONFIRM_EXCHANGE_NAME,correlationData2);
        CorrelationData correlationData3=new CorrelationData("3");
        rabbitTemplate.convertAndSend(CONFIRM_EXCHANGE_NAME_ERROR,ROUTING_KEY,message+",key:"+ROUTING_KEY+",changeName:"+CONFIRM_EXCHANGE_NAME,correlationData3);
        CorrelationData correlationData4=new CorrelationData("4");
        rabbitTemplate.convertAndSend(CONFIRM_EXCHANGE_NAME_ERROR,ROUTING_KEY_ERROR,message+",key:"+ROUTING_KEY_ERROR+",changeName:"+CONFIRM_EXCHANGE_NAME_ERROR,correlationData4);
        System.out.println("发送消息完毕！");
    }
}
```

消费者：

```java
@Component
public class Consumer {
    public static final String CONFIRM_QUEUE_NAME = "confirm.queue";

    @RabbitListener(queues =CONFIRM_QUEUE_NAME)
    public void receiveMsg(Message message){
        String msg=new String(message.getBody());
        System.out.println("接受到队列 confirm.queue 消息:"+msg);
    }
}
```

启动项目访问：http://127.0.0.1:8002/confirm/sendMessage/hello，控制台输出如下：

```sh
发送消息完毕！
接受到队列 confirm.queue 消息:hello-key:key1-changeName:confirm.exchange
2023-05-04 16:44:56.761 ERROR 24884 --- [15.141.218:5672] o.s.a.r.c.CachingConnectionFactory       : Channel shutdown: channel error; protocol method: #method<channel.close>(reply-code=404, reply-text=NOT_FOUND - no exchange 'confirm.exchange.error' in vhost '/', class-id=60, method-id=40)
```

##### 1.1.3 确认模式

第一步：在配置文件当中新增：`publisher-confirm-type: CORRELATED `配置

```yaml
spring:
  rabbitmq:
    host: 1.15.141.21
    port: 5672
    username: guest
    password: guest
    virtual-host: /
    publisher-confirm-type: CORRELATED 
```

有三种模式：

- `NONE` 禁用发布确认模式，是默认值.
- `CORRELATED` 发布消息成功到交换器后会触发回调方法.
- `SIMPLE` 经测试有两种效果，其一效果和 CORRELATED 值一样会触发回调方法， 其二在发布消息成功后使用 rabbitTemplate 调用 waitForConfirms 或 waitForConfirmsOrDie 方法等待broker节点返回发送结果，根据返回结果来判定下一步的逻辑，要注意的点是 waitForConfirmsOrDie 方法如果返回 false 则会关闭 channel，则接下来无法发送消息到 broker.

第二步：创建回调接口

```java
@Component
public class MyConfirmCallback implements RabbitTemplate.ConfirmCallback {
    @Autowired
    private RabbitTemplate rabbitTemplate;
    @PostConstruct
    public void init(){
        rabbitTemplate.setConfirmCallback(this);
    }
    /**
     * 交换机不管是否收到消息的一个回调方法
     * CorrelationData 消息相关数据
     * ack 交换机是否收到消息 true / false
     * cause 交换机没有接收到消息，失败的原因
     */
    @Override
    public void confirm(CorrelationData correlationData, boolean ack, String cause) {
        String id = correlationData != null ? correlationData.getId():"";
        if(ack){
            System.out.println("交换机已经收到id为:"+id+"的消息");
        }else{
            System.out.println("交换机还未收到id为:"+id+"消息,由于原因:"+cause);
        }
    }
}

```

重新启动项目访问：http://127.0.0.1:8002/confirm/sendMessage/hello，控制台输出如下：

```sh
接受到队列 confirm.queue 消息:hello,key:key1,changeName:confirm.exchange
交换机已经收到id为:1的消息
交换机已经收到id为:2的消息
2023-05-04 16:48:28.179 ERROR 20108 --- [15.141.218:5672] o.s.a.r.c.CachingConnectionFactory       : Channel shutdown: channel error; protocol method: #method<channel.close>(reply-code=404, reply-text=NOT_FOUND - no exchange 'confirm.exchange.error' in vhost '/', class-id=60, method-id=40)
交换机还未收到id为:3消息,由于原因:channel error; protocol method: #method<channel.close>(reply-code=404, reply-text=NOT_FOUND - no exchange 'confirm.exchange.error' in vhost '/', class-id=60, method-id=40)
发送消息完毕！
交换机还未收到id为:4消息,由于原因:channel error; protocol method: #method<channel.close>(reply-code=404, reply-text=NOT_FOUND - no exchange 'confirm.exchange.error' in vhost '/', class-id=60, method-id=40)
2023-05-04 16:48:28.244 ERROR 20108 --- [15.141.218:5672] o.s.a.r.c.CachingConnectionFactory       : Channel shutdown: channel error; protocol method: #method<channel.close>(reply-code=404, reply-text=NOT_FOUND - no exchange 'confirm.exchange.error' in vhost '/', class-id=60, method-id=40)

```

由控制台输出可以验证，发布消息成功到交换器后会触发回调方法。

##### 1.1.4 回退模式

​	在仅开启了生产者确认机制的情况下，交换机接收到消息后，会直接给消息生产者发送确认消息，但是如果发现该消息不可路由，那么消息会被直接丢弃，此时生产者是不知道消息被丢弃这个事件的。那么如何 让无法被路由的消息帮我想办法处理一下？

第一步：在配置文件当中新增：`publisher-returns: true `配置

```yaml
spring:
  rabbitmq:
    host: 1.15.141.218
    port: 5672
    username: guest
    password: guest
    virtual-host: /
    publisher-confirm-type: CORRELATED
    publisher-returns: true
```

第二步：修改回调接口，新增如下内容：

```java
@Component
public class MyConfirmCallback implements RabbitTemplate.ConfirmCallback, RabbitTemplate.ReturnCallback {
    @Autowired
    private RabbitTemplate rabbitTemplate;
    @PostConstruct
    public void init(){
        rabbitTemplate.setConfirmCallback(this);
        // true: 交换机无法将消息进行路由时，会将该消息返回给生产者
        // false：如果发现消息无法进行路由，则直接丢弃
        rabbitTemplate.setMandatory(true);
        //设置回退消息交给谁处理
        rabbitTemplate.setReturnCallback(this);
    }
    @Override
    public void confirm(CorrelationData correlationData, boolean ack, String cause) {
        String id = correlationData != null ? correlationData.getId():"";
        if(ack){
            System.out.println("交换机已经收到id为:"+id+"的消息");
        }else{
            System.out.println("交换机还未收到id为:"+id+"消息,由于原因:"+cause);
        }
    }

   
    @Override
    public void returnedMessage(Message message, int replyCode, String replyText, String exchange, String routingKey) {
        System.out.println("消息id:"+message.getMessageProperties().getHeaders().get("spring_returned_message_correlation")+"，消息内容:"+new String(message.getBody())+", 被交换机"+exchange+"退回，退回原因 :"+replyText+", 路由key:"+routingKey);
    }
}
```

重新启动项目访问：http://127.0.0.1:8002/confirm/sendMessage/hello，控制台输出如下：

```sh
交换机已经收到id为:1的消息
接受到队列 confirm.queue 消息:hello,key:key1,changeName:confirm.exchange
消息id:2，消息内容:hello,key:key_error,changeName:confirm.exchange, 被交换机confirm.exchange退回，退回原因 :NO_ROUTE, 路由key:key_error
交换机已经收到id为:2的消息
2023-05-04 17:13:28.121 ERROR 22720 --- [15.141.218:5672] o.s.a.r.c.CachingConnectionFactory       : Channel shutdown: channel error; protocol method: #method<channel.close>(reply-code=404, reply-text=NOT_FOUND - no exchange 'confirm.exchange.error' in vhost '/', class-id=60, method-id=40)
交换机还未收到id为:3消息,由于原因:channel error; protocol method: #method<channel.close>(reply-code=404, reply-text=NOT_FOUND - no exchange 'confirm.exchange.error' in vhost '/', class-id=60, method-id=40)
发送消息完毕！
交换机还未收到id为:4消息,由于原因:channel error; protocol method: #method<channel.close>(reply-code=404, reply-text=NOT_FOUND - no exchange 'confirm.exchange.error' in vhost '/', class-id=60, method-id=40)
2023-05-04 17:13:28.139 ERROR 22720 --- [15.141.218:5672] o.s.a.r.c.CachingConnectionFactory       : Channel shutdown: channel error; protocol method: #method<channel.close>(reply-code=404, reply-text=NOT_FOUND - no exchange 'confirm.exchange.error' in vhost '/', class-id=60, method-id=40)

```

重点对比消息1和消息2，可以看出ReturnCallback接口，在路由key不正确时会回调。

#### 1.2 消息的应答

通过设置：`spring.rabbitmq.listener.simple.acknowledge-mode=manual`参数开启手动应答

- none不应答  
- auto自动应答 
- manual手动应答

##### 1.2.1 自动应答（不建议使用）

​	消息发送后立即被认为已经传送成功，这种模式需要在高吞吐量和数据传输安全性方面做权衡,因为这种模式如果消息在接收到之前，消费者那边出现连接或者 channel 关闭，那么消息就丢失了,当然另一方面这种模式消费者那边可以传递过载的消息，没有对传递的消息数量进行限制， 当然这样有可能使得消费者这边由于接收太多还来不及处理的消息，导致这些消息的积压，最终使得内存耗尽，最终这些消费者线程被操作系统杀死，所以这种模式仅适用在消费者可以高效并 以某种速率能够处理这些消息的情况下使用。

##### 1.2.2 手动应答（建议使用）

手动消息应答的方法：

- `channel.basicAck(long tag ,boolean var2)` ：用于肯定确认，RabbitMQ 已知道该消息并且成功的处理消息，可以将其丢弃了。
- `channel.basicNack(long tag,boolean var2, boolean  var3)`：用于否定确认。
- `channel.basicReject(long tag ,boolean var2)`：用于否定确认与 Channel.basicNack ()相比少一个Multiple参数不处理该消息了直接拒绝，可以将其丢弃了。

参数解释：

- tag：表示消息的id，
- var2：
  - true 代表批量应答 channel 上未应答的消息。比如说 channel 上有传送 tag 的消息 5,6,7,8 当前 tag 是 8 那么此时 5-8 的这些还未应答的消息都会被确认收到消息应答 。
  - false 同上面相比只会应答 tag=8 的消息 5,6,7 这三个消息依然不会被确认收到消息应答。

- var3：false表示消息直接丢弃，true表示消息会从新入队

##### 1.2.3 手动应答效果演示

创建SpringBoot项目，引入jar包：

```xml
<dependency>
	<groupId>org.springframework.boot</groupId>
	<artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

引入配置：

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

编写配置：

```java
@Configuration
public class AckConfig {
    private static final String ACK_QUEUE_NAME="ack_queue";
    @Bean
    public Queue ackQueue(){
        return new Queue(ACK_QUEUE_NAME);
    }
}
```

生产者：

```java
public class ProducerMq {
    private static final String ACK_QUEUE_NAME="ack_queue";
    public static void main(String[] args) throws IOException {
        Connection connection = MqClientUtils.newConnection();
        // 获取创建通信
        Channel channel = connection.createChannel();
        /*
         * 参数1：队列名称，存在就不用创建，不存在会自动创建
         * 参数2：队列里面的消息是否持久化，默认消息存储在内存中
         * 参数3：是否私有化，false所有消费者都可以访问，true第一拥有她的消费者可以一直访问
         * 参数4：是否自动删除最后一个消费者端开连接以后该队列是否自动删除 true自动删除
         * 参数5：其他参数
         * */
        channel.queueDeclare(ACK_QUEUE_NAME,false,false,false,null);
        Scanner sc = new Scanner(System.in);
        System.out.println("请输入信息");
        while (sc.hasNext()) {
            String message = sc.nextLine();
            channel.basicPublish("", ACK_QUEUE_NAME, null, message.getBytes("UTF-8"));
            System.out.println("生产者发出消息" + message);
        }
    }
}
```

消费者1：单独的springBoot项目，引入的jar和yaml配置一样，不需要再创建队列了

```java
@Component
public class ConsumerMq01 {
    public static final String CONFIRM_QUEUE_NAME = "ack_queue";

    @RabbitListener(queues =CONFIRM_QUEUE_NAME)
    public void receiveMsg(String msg, Message message, Channel channel){
        System.out.println("消费1接收消息:"+msg);
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println("消费1开始确认消息");
        try {
            channel.basicAck(message.getMessageProperties().getDeliveryTag(),false);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

消费者2：单独的springBoot项目，引入的jar和yaml配置一样，不需要再创建队列了

```java
@Component
public class ConsumerMq01 {
    public static final String CONFIRM_QUEUE_NAME = "ack_queue";

    @RabbitListener(queues =CONFIRM_QUEUE_NAME)
    public void receiveMsg(String msg, Message message, Channel channel){
        System.out.println("消费2接收消息:"+msg);
        try {
            Thread.sleep(50000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println("消费2开始确认消息");
        try {
            channel.basicAck(message.getMessageProperties().getDeliveryTag(),false);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
```

生产者访问http://127.0.0.1:8001/ack/sendMessage/aa和http://127.0.0.1:8001/ack/sendMessage/bb后控制台输出

```
生产者发出消息aa
生产者发出消息bb
```

消费者1输出：

```
消费1接收消息:aa
消费1开始确认消息
```

消费者2：

```
消费2接收消息:bb
```

在消费者2输出开始确认消息之前，停止消费者2的springBoot项目，回到消费者1的控制台，等一会可以看到消费者1重新收到了消息bb

```
消费1接收消息:aa
消费1开始确认消息
消费1接收消息:bb
消费1开始确认消息
```

生产者正常情况下消息发送方发送两个消息 aa和 bb分别被消费者1和消费者2接收到消息并进行处理，但是由于消费者2处理时间较长，在还未处理完，也就是说消费者2还没有执行 ack 代码的时候，消费者2被停掉了， 此时会看到消息bb被消费者1重新接收到了，说明消息 bb被重新入队，然后分配给能处理消息的 消费者1 处理了.

消费者2被停掉了后，可以看到ack_queue队列中有一条待应答记录：![image-20230426163255986](http://img.zouyh.top/article-img/20240917135110358.png)

总结：消息自动重新入队，如果消费者由于某些原因失去连接(其通道已关闭，连接已关闭或 TCP 连接丢失)，导致消息未发送 ACK 确认，RabbitMQ 将了解到消息未完全处理，并将对其重新排队。如果此时其它消费者也可以处理，它将很快将其重新分发给另一个消费者。这样即使某个消费者偶尔死亡，也可以确保不会丢失任何消息。

#### 1.3 消息的持久化

##### 1.3.1 队列实现持久化 

之前我们创建的队列都是非持久化的，rabbitmq 如果重启该队列就会被删除掉，如果要队列实现持久化需要在声明队列的时候把 durable 参数设置为持久化：

原生API的方式创建队列：

```java
/*
* 参数1：队列名称，存在就不用创建，不存在会自动创建
* 参数2：队列是否持久化，默认消息存储在内存中
* 参数3：是否私有化，false所有消费者都可以访问，true第一拥有她的消费者可以一直访问
* 参数4：是否自动删除最后一个消费者端开连接以后该队列是否自动删除 true自动删除
* 参数5：其他参数
* */
channel.queueDeclare(QUEUE_NAME,true,false,false,null);
```

> 但是需要注意的就是之前声明的队列不是持久化的，需要把原先队列先删除，或者重新创建一个持久化的队列，不然就会出现错误。

springboot的方式创建队列：

```java
@Configuration
public class RabbitMQConfig {
    //声明队列
    @Bean
    public Queue springboot_queue() {
        return new Queue("springboot_queue");
    }

}

```

队列的构造方法如下：

```java
public Queue(String name) {
	this(name, true, false, false);
}

public Queue(String name, boolean durable) {
	this(name, durable, false, false, (Map)null);
}

public Queue(String name, boolean durable, boolean exclusive, boolean autoDelete) {
	this(name, durable, exclusive, autoDelete, (Map)null);
}

public Queue(String name, boolean durable, boolean exclusive, boolean autoDelete, Map<String, Object> arguments) {
	Assert.notNull(name, "'name' cannot be null");
	this.name = name;
	this.actualName = StringUtils.hasText(name) ? name : Base64UrlNamingStrategy.DEFAULT.generateName() + "_awaiting_declaration";
	this.durable = durable;
	this.exclusive = exclusive;
	this.autoDelete = autoDelete;
	this.arguments = (Map)(arguments != null ? arguments : new HashMap());
}
```

- `name`：队列名称
- `durable`：是否持久化
- `exclusive`：是否私有化，false所有消费者都可以访问，true第一拥有她的消费者可以一直访问
- `autoDelete`： 是否自动删除，最后一个消费者和该队列断开连接后，自动删除队列
- `arguments`：其它参数配置

以下为控制台中持久化队列的 UI 显示区:

![image-20230426164123881](http://img.zouyh.top/article-img/20240917135111359.png)

这个时候即使重启 rabbitmq 队列也依然存在。

##### 1.3.2 交换机的持久化

在申明exchange的时候有个参数：durable，当该参数为true，则对该exchange做持久化，重启rabbitmq服务器，该exchange不会消失。durable的默认值为true。

```java
// ***代表Direct，Fanout，Topic
public ***Exchange(String name) {
	super(name);
}

public***Exchange(String name, boolean durable, boolean autoDelete) {
	super(name, durable, autoDelete);
}

public ***Exchange(String name, boolean durable, boolean autoDelete, Map<String, Object> arguments) {
	super(name, durable, autoDelete, arguments);
}

```

以下为控制台中持久化队列的 UI 显示区:

<img src="http://img.zouyh.top/article-img/20240917135111360.png" alt="image-20230505153810055" style="zoom: 67%;" />

##### 1.3.3 消息实现持久化

要想让消息实现持久化，需要生产者再发送在消息时添加`MessageProperties.PERSISTENT_TEXT_PLAIN `这个参数信息:

```java
/*
 * 参数1：发送到那个交换机
 * 参数2：路由的key是哪个
 * 参数3：其他的参数信息
 * 参数4：发送消息的消息体
 * */
channel.basicPublish("",QUEUE_NAME, MessageProperties.PERSISTENT_TEXT_PLAIN, message.getBytes());
```

将消息标记为持久化并不能完全保证不会丢失消息。尽管它告诉 RabbitMQ 将消息保存到磁盘，但 这里依然存在当消息刚准备存储在磁盘的时候但是还没有存储完，消息还在缓存的一个间隔点。此时并没 有真正写入磁盘。持久性保证并不强，但是对于我们的简单任务队列而言，这已经绰绰有余了。

> spring中默认的message就是持久化
>

RabbitTemplate类下的convertAndSend方法发送消息：

```java
@Override
public void convertAndSend(String exchange, String routingKey, final Object object) throws AmqpException {
	convertAndSend(exchange, routingKey, object, (CorrelationData) null);
}
```

然后调用了该类下的重载方法convertAndSend：

```java
@Override
public void convertAndSend(String exchange, String routingKey, final Object object,
		@Nullable CorrelationData correlationData) throws AmqpException {
	send(exchange, routingKey, convertMessageIfNecessary(object), correlationData);
}

```

继续跟进`convertMessageIfNecessary(object)`方法：

```java
protected Message convertMessageIfNecessary(final Object object) {
	if (object instanceof Message) { // 判断object是不是Message类型的，如果是直接返回
		return (Message) object;
	}
    // 如果不是会默认传入一个MessageProperties属性，并将object转换为Message类型的对象
	return getRequiredMessageConverter().toMessage(object, new MessageProperties());
}
```

在MessageProperties中，有个deliveryMode属性，该属性默认值为：MessageDeliveryMode.PERSISTENT（持久化的）

```java
public MessageProperties() {
	this.deliveryMode = DEFAULT_DELIVERY_MODE;
	this.priority = DEFAULT_PRIORITY;
}
static {
	DEFAULT_DELIVERY_MODE = MessageDeliveryMode.PERSISTENT; // 持久化的
	DEFAULT_PRIORITY = 0;
}
```

这也进一步说明了，如果你传入的object不是Message类型，会默认并将object转换为Message类型的对象，并设置消息是持久化的。

消息转换完成后，回到send方法`send(exchange, routingKey, convertMessageIfNecessary(object), correlationData);`:

```java
@Override
public void send(final String exchange, final String routingKey,
		final Message message, @Nullable final CorrelationData correlationData)
		throws AmqpException {
	execute(channel -> {
		doSend(channel, exchange, routingKey, message,
				(RabbitTemplate.this.returnCallback != null
						|| (correlationData != null && StringUtils.hasText(correlationData.getId())))
						&& RabbitTemplate.this.mandatoryExpression.getValue(
								RabbitTemplate.this.evaluationContext, message, Boolean.class),
				correlationData);
		return null;
	}, obtainTargetConnectionFactory(this.sendConnectionFactorySelectorExpression, message));
}
```

继续跟进`doSend`方法：

```java
public void doSend(Channel channel, String exchangeArg, String routingKeyArg, Message message, // NOSONAR complexity
		boolean mandatory, @Nullable CorrelationData correlationData)
				throws Exception { // NOSONAR TODO: change to IOException in 2.2.

	String exch = exchangeArg;
	String rKey = routingKeyArg;
	if (exch == null) {
		exch = this.exchange;
	}
	if (rKey == null) {
		rKey = this.routingKey;
	}
	if (logger.isDebugEnabled()) {
		logger.debug("Publishing message " + message
				+ "on exchange [" + exch + "], routingKey = [" + rKey + "]");
	}

	Message messageToUse = message;
	MessageProperties messageProperties = messageToUse.getMessageProperties();
	if (mandatory) {
		messageProperties.getHeaders().put(PublisherCallbackChannel.RETURN_LISTENER_CORRELATION_KEY, this.uuid);
	}
	if (this.beforePublishPostProcessors != null) {
		for (MessagePostProcessor processor : this.beforePublishPostProcessors) {
			messageToUse = processor.postProcessMessage(messageToUse, correlationData);
		}
	}
	setupConfirm(channel, messageToUse, correlationData);
	if (this.userIdExpression != null && messageProperties.getUserId() == null) {
		String userId = this.userIdExpression.getValue(this.evaluationContext, messageToUse, String.class);
		if (userId != null) {
			messageProperties.setUserId(userId);
		}
	}
	sendToRabbit(channel, exch, rKey, mandatory, messageToUse); // 发送消息
	// Check if commit needed
	if (isChannelLocallyTransacted(channel)) {
		// Transacted channel created by this template -> commit.
		RabbitUtils.commitIfNecessary(channel);
	}
}
```

继续跟进`sendToRabbit(channel, exch, rKey, mandatory, messageToUse);`方法：

```java
protected void sendToRabbit(Channel channel, String exchange, String routingKey, boolean mandatory,
		Message message) throws IOException {
	BasicProperties convertedMessageProperties = this.messagePropertiesConverter
			.fromMessageProperties(message.getMessageProperties(), this.encoding);
	channel.basicPublish(exchange, routingKey, mandatory, convertedMessageProperties, message.getBody());
}
```

在该方法中我们终于看到了发送消息到rabbitmq的操作，该方法将MessageProperties对象转换成了BasicProperties。至此我们终于了解了，springBoot中如何实现messge的持久化。默认的message就是持久化的。

如果你非要更改消息为非持久化的，可以参考下面的代码：

```java
MessageProperties messageProperties = new MessageProperties();
messageProperties.setDeliveryMode(MessageDeliveryMode.NON_PERSISTENT); // 设置非持久化
Message msg = new Message("hello".getBytes(),messageProperties);
rabbitTemplate.convertAndSend(CONFIRM_EXCHANGE_NAME,ROUTING_KEY,msg);
```

