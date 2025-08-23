---
icon: document
# 标题
title: 'RabbitMQ六种工作模式'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-17
# 一个页面可以有多个分类
category:
  - MQ
# 一个页面可以有多个标签
tag:
  - 干货
  - MQ
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，RabbitMQ六种工作模式

​	RabbitMQ 是一个消息中间件：它接受并转发消息。你可以把它当做一个快递站点，当你要发送一个包裹时，你把你的包裹放到快递站，快递员最终会把你的快递送到收件人那里，按照这种逻辑 RabbitMQ 是一个快递站，一个快递员帮你传递快件。RabbitMQ 与快递站的主要区别在于，它不处理快件而是接收，存储和转发消息数据。

核心概念：

- `Broker`：接收和分发消息的应用，RabbitMQ Server 就是 Message Broker 
- `Virtual host`：出于多租户和安全因素设计的，把 AMQP 的基本组件划分到一个虚拟的分组中，类似 于网络中的 namespace 概念。当多个不同的用户使用同一个RabbitMQ server提供的服务时可以划分出多个vhost，每个用户在自己的vhost创建 exchange／queue等 
- `Connection`：publisher／consumer 和 broker 之间的 TCP 连接
- `Channel`：如果每一次访问 RabbitMQ 都建立一个 Connection，在消息量大的时候建立 TCP Connection 的开销将是巨大的，效率也较低。Channel 是在 connection 内部建立的逻辑连接，如果应用程 序支持多线程，通常每个 thread 创建单独的 channel 进行通讯，AMQP method 包含了 channel id 帮助客 户端和 message broker 识别 channel，所以 channel 之间是完全隔离的。Channel 作为轻量级的 Connection 极大减少了操作系统建立 TCP connection 的开销
- `Exchange`：message 到达 broker 的第一站，根据分发规则，匹配查询表中的 routing key，分发消息到 queue 中去。常用的类型有：direct (point-to-point), topic (publish-subscribe) and fanout (multicast)
- `Queue`：消息最终被送到这里等待 consumer 取走 
- `Binding`：exchange 和 queue 之间的虚拟连接，binding 中可以包含 routing key，Binding 信息被保 存到 exchange 中的查询表中，用于 message 的分发依据.

![image-20230427114939656](http://img.zouyh.top/article-img/20240917135107348.png)

六种类模式：

| **模式**     | **交换机** | **队列个数** | **交换机和队列的bingings关系routingkey** |
| ------------ | ---------- | ------------ | ---------------------------------------- |
| 简单模式     | 默认交换机 | 1            | 队列名                                   |
| 工作模式     | 默认交换机 | N            | 队列名                                   |
| 发布订阅模式 | fanout     | N            | Routingkey相同，默认使用""               |
| 路由模式     | direct     | N            | Routingkey不相同                         |
| 主题模式     | topic      | N            | Routingkey通过#，*匹配规则               |
| RPC模式      | headers    | 基本不使用   |                                          |

创建一个简单的maven项目引入jar包：

```xml
<!-- 连接驱动 -->
<dependency>
	<groupId>com.rabbitmq</groupId>
	<artifactId>amqp-client</artifactId>
	<version>5.8.0</version>
</dependency>
<!-- json解析工具 -->
<dependency>
	<groupId>com.alibaba.fastjson2</groupId>
	<artifactId>fastjson2</artifactId>
	<version>2.0.26</version>
</dependency>
```

创建连接工具类：

```java
public class MqClientUtils {
    private static ConnectionFactory connectionFactory;
    static {
        connectionFactory = new ConnectionFactory();
        connectionFactory.setHost("1.15.141.218");
        connectionFactory.setUsername("guest");
        connectionFactory.setPassword("guest");

    }
    public static Connection newConnection(){
        try {
            return connectionFactory.newConnection();
        } catch (IOException e) {
            e.printStackTrace();
        } catch (TimeoutException e) {
            e.printStackTrace();
        }

        return null;
    }

}
```

#### 1.1 简单模式

<img src="http://img.zouyh.top/article-img/20240917135106345.png" alt="image-20230427101405210" style="zoom:80%;" />



生产者`ProducerMq`：

```java
public class ProducerMq {
    private static final String QUEUE_NAME = "SIMPLE_QUEUE";
    public static void main(String[] args) throws IOException, TimeoutException {
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
        channel.queueDeclare(QUEUE_NAME,false,false,false,null);
        String message = "simple message";
        /*
         * 参数1：发送到那个交换机
         * 参数2：路由的key是哪个
         * 参数3：其他的参数信息
         * 参数4：发送消息的消息体
         * */
        channel.basicPublish("",QUEUE_NAME,null, message.getBytes());
        channel.close();
        connection.close();
        System.out.println ( "消息发送完毕");
    }

}
```

消费者`ConsumerMq`：

```java
public class ConsumerMq {
    private static final String QUEUE_NAME = "SIMPLE_QUEUE";
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
        channel.queueDeclare(QUEUE_NAME,false,false,false,null);
        System.out.println("等待接收消息....");
        // 推送的消息如何进行消费的接口回调
        DeliverCallback deliverCallback=(consumerTag, delivery)->{
            String message= new String(delivery.getBody());
            System.out.println("接收消息:"+message);
        };
        // 取消消费的一个回调接口 如在消费的时候队列被删除掉了
        CancelCallback cancelCallback=(consumerTag)->{
            System.out.println("消息消费被中断");
        };
        /*
         * 参数1：消费哪个队列
         * 参数2：消费成功之后是否要自动应答 true代表自动应答 false手动应答
         * 参数3：消费者成功消费的回调
         * 参数4：消费者未成功消费的回调
         * */
        channel.basicConsume(QUEUE_NAME,true,deliverCallback,cancelCallback);
    }
}
```

先启动生产者控制台输出：

```
消息发送完毕
```

可视化界面可以看到：

![image-20230427113818343](http://img.zouyh.top/article-img/20240917135109356.png)

在启动消费者控制台输出：

```
等待接收消息....
接收消息:simple message
```

![image-20230427113947799](http://img.zouyh.top/article-img/20240917135107350.png)



#### 1.2 工作模式

<img src="http://img.zouyh.top/article-img/20240917135107347.png" alt="image-20230427112146455" style="zoom:80%;" />

生产者`ProducerMq`：

```java
public class ProducerMq {
    private static final String QUEUE_NAME = "WORK_QUEUE";
    public static void main(String[] args) throws IOException, TimeoutException {
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
        channel.queueDeclare(QUEUE_NAME,false,false,false,null);
        for (int i = 0; i < 100; i++) {
            String message = JSON.toJSONString(new Message(i, "内容" + i));
            channel.basicPublish("",QUEUE_NAME,null, message.getBytes());
        }
        /*
         * 参数1：发送到那个交换机
         * 参数2：路由的key是哪个
         * 参数3：其他的参数信息
         * 参数4：发送消息的消息体
         * */
        channel.close();
        connection.close();
        System.out.println ( "消息发送完毕");
    }

}
```

和简单工作模式相比较，就是更改了队列的名称和发送的内容，发送的内容是通过fastjson2的json字符串。

消费者`ConsumerMq01`，`ConsumerMq02`，`ConsumerMq03`:

```java
public class ConsumerMq01 {
    private static final String QUEUE_NAME = "WORK_QUEUE";
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
        channel.queueDeclare(QUEUE_NAME,false,false,false,null);
        System.out.println("等待接收消息....");
        // 推送的消息如何进行消费的接口回调
        DeliverCallback deliverCallback=(consumerTag, delivery)->{
            String message= new String(delivery.getBody());
            System.out.println("接收消息:"+message);
        };
        // 取消消费的一个回调接口 如在消费的时候队列被删除掉了
        CancelCallback cancelCallback=(consumerTag)->{
            System.out.println("消息消费被中断");
        };
        /*
         * 参数1：消费哪个队列
         * 参数2：消费成功之后是否要自动应答 true代表自动应答 false手动应答
         * 参数3：消费者成功消费的回调
         * 参数4：消费者未成功消费的回调
         * */
        channel.basicConsume(QUEUE_NAME,true,deliverCallback,cancelCallback);
    }
}
```

`ConsumerMq01`，`ConsumerMq02`，`ConsumerMq03`和简单工作模式相比较是内容是一模一样的。

测试：

先启动费者`ConsumerMq01`，`ConsumerMq02`，`ConsumerMq03`在启动生产者`ProducerMq`，`ProducerMq`控制台输出：

```
消息发送完毕
```

`ConsumerMq01`控制台输出：

```
等待接收消息....
接收消息:{"content":"内容0","id":0}
接收消息:{"content":"内容3","id":3}
接收消息:{"content":"内容6","id":6}
接收消息:{"content":"内容9","id":9}
接收消息:{"content":"内容12","id":12}
接收消息:{"content":"内容15","id":15}
接收消息:{"content":"内容18","id":18}
接收消息:{"content":"内容21","id":21}
接收消息:{"content":"内容24","id":24}
，，，，
```

`ConsumerMq02`控制台输出：

```
等待接收消息....
接收消息:{"content":"内容1","id":1}
接收消息:{"content":"内容4","id":4}
接收消息:{"content":"内容7","id":7}
接收消息:{"content":"内容10","id":10}
接收消息:{"content":"内容13","id":13}
接收消息:{"content":"内容16","id":16}
接收消息:{"content":"内容19","id":19}
接收消息:{"content":"内容22","id":22}
，，，，
```

`ConsumerMq03`控制台输出：

```
等待接收消息....
接收消息:{"content":"内容2","id":2}
接收消息:{"content":"内容5","id":5}
接收消息:{"content":"内容8","id":8}
接收消息:{"content":"内容11","id":11}
接收消息:{"content":"内容14","id":14}
接收消息:{"content":"内容17","id":17}
接收消息:{"content":"内容20","id":20}
接收消息:{"content":"内容23","id":23}
，，，，
```

通过消费者`ConsumerMq01`，`ConsumerMq02`，`ConsumerMq03`输出可以看出，默认采用的是轮询公平的分发方式。但是在某种场景下这种策略并不是很好，假如有两个消费者在处理任务，其中有个消费者 1 处理任务的速度非常快，而另外一个消费者 2 处理速度却很慢，这个时候我们还是采用轮训分发的化就会到这处理速度快的这个消费者很大一部分时间 处于空闲状态，而处理慢的那个消费者一直在干活，这种分配方式在这种情况下其实就不太好。为了避免这种情况，我们可以设置参数 ：

```
channel.basicQos(1);
```

> 注意：要在手动应答的方式下使用，上面的参数。

修改`ConsumerMq01`，`ConsumerMq02`，`ConsumerMq03`，再测试，修改后的内容如下：

```java
public class ConsumerMq01 {
    private static final String QUEUE_NAME = "WORK_QUEUE";
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
        channel.queueDeclare(QUEUE_NAME,false,false,false,null);
        channel.basicQos(1);
        System.out.println("等待接收消息....");
        // 推送的消息如何进行消费的接口回调
        DeliverCallback deliverCallback=(consumerTag, delivery)->{
            String message= new String(delivery.getBody());
            try {
                Thread.sleep(10);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            System.out.println("接收消息:"+message);
            channel.basicAck(delivery.getEnvelope().getDeliveryTag(),false);
        };
        // 取消消费的一个回调接口 如在消费的时候队列被删除掉了
        CancelCallback cancelCallback=(consumerTag)->{
            System.out.println("消息消费被中断");
        };
        /*
         * 参数1：消费哪个队列
         * 参数2：消费成功之后是否要自动应答 true代表自动应答 false手动应答
         * 参数3：消费者成功消费的回调
         * 参数4：消费者未成功消费的回调
         * */
        channel.basicConsume(QUEUE_NAME,false,deliverCallback,cancelCallback);
    }
}
```

`ConsumerMq01`，`ConsumerMq02`，`ConsumerMq03`的内容基本一样，就是线程休眠时间分别是` Thread.sleep(10);`，` Thread.sleep(100);`，` Thread.sleep(500);`，这样来模拟不通机器的的效率，更能看出效果。

`ConsumerMq01`控制台输出：

```
等待接收消息....
接收消息:{"content":"内容0","id":0}
接收消息:{"content":"内容3","id":3}
接收消息:{"content":"内容4","id":4}
接收消息:{"content":"内容5","id":5}
接收消息:{"content":"内容6","id":6}
接收消息:{"content":"内容7","id":7}
接收消息:{"content":"内容9","id":9}
接收消息:{"content":"内容10","id":10}
接收消息:{"content":"内容11","id":11}
接收消息:{"content":"内容12","id":12}
接收消息:{"content":"内容13","id":13}
接收消息:{"content":"内容15","id":15}
接收消息:{"content":"内容16","id":16}
接收消息:{"content":"内容17","id":17}
,,,,
```

`ConsumerMq02`控制台输出：

```
等待接收消息....
接收消息:{"content":"内容1","id":1}
接收消息:{"content":"内容8","id":8}
接收消息:{"content":"内容14","id":14}
接收消息:{"content":"内容20","id":20}
接收消息:{"content":"内容26","id":26}
接收消息:{"content":"内容34","id":34}
接收消息:{"content":"内容40","id":40}
接收消息:{"content":"内容45","id":45}
接收消息:{"content":"内容52","id":52}
,,,
```

`ConsumerMq03`控制台输出：

```
等待接收消息....
接收消息:{"content":"内容2","id":2}
接收消息:{"content":"内容31","id":31}
接收消息:{"content":"内容60","id":60}
接收消息:{"content":"内容89","id":89}
,,,
```

可以看出实现了，能者多劳的模式。

#### 1.3 发布订阅模式

<img src="http://img.zouyh.top/article-img/20240917135108351.png" alt="image-20230427101804017" style="zoom:80%;" />

发布者：

```java
public class Publish {
    private static final String EXCHANGE_NAME = "PUB_SUB_EXCHANGE";
    public static void main(String[] args) throws IOException {
        Connection connection = MqClientUtils.newConnection();
        Channel channel = connection.createChannel();
        /*
        * 创建交换机
        * 参数1：交换机名字
        * 参数2：交换机类型
        * */
        channel.exchangeDeclare(EXCHANGE_NAME,"fanout");
        Scanner sc = new Scanner(System.in);
        System.out.println("请输入信息");
        while (sc.hasNext()) {
            String message = sc.nextLine();
            channel.basicPublish(EXCHANGE_NAME, "", null, message.getBytes("UTF-8"));
            System.out.println("生产者发出消息：" + message);
        }
    }
}
```

订阅者01：

```java
public class Subscription01 {
    private static final String QUEUE_NAME = "PUB_SUB_QUEUE_01"; // 队列名称
    private static final String EXCHANGE_NAME = "PUB_SUB_EXCHANGE"; // 交换机名称
    public static void main(String[] args) throws IOException {
        Connection connection = MqClientUtils.newConnection();
        Channel channel = connection.createChannel();
        /*
         * 创建交换机
         * 参数1：交换机名字
         * 参数2：交换机类型
         * */
        channel.exchangeDeclare(EXCHANGE_NAME,"fanout");
        /*
         * 参数1：队列名称，存在就不用创建，不存在会自动创建
         * 参数2：队列里面的消息是否持久化，默认消息存储在内存中
         * 参数3：是否私有化，false所有消费者都可以访问，true第一拥有她的消费者可以一直访问
         * 参数4：是否自动删除最后一个消费者端开连接以后该队列是否自动删除 true自动删除
         * 参数5：其他参数
         * */
        channel.queueDeclare(QUEUE_NAME,false,false,false,null);
        // 将队列和交换机绑定，绑定的关系routingkey = ""
        channel.queueBind(QUEUE_NAME, EXCHANGE_NAME, "");
        DeliverCallback deliverCallback = (consumerTag, delivery) -> {
           String message= new String(delivery.getBody());
            System.out.println("订阅者1:"+message);
        };
        channel.basicConsume(QUEUE_NAME, false, deliverCallback, consumerTag -> { });
    }
}

```

订阅者02：与订阅者01相比就是队列名称不同

```java
public class Subscription02 {
    private static final String QUEUE_NAME = "PUB_SUB_QUEUE_02";// 队列名称
    private static final String EXCHANGE_NAME = "PUB_SUB_EXCHANGE";// 交换机名称
    public static void main(String[] args) throws IOException {
        Connection connection = MqClientUtils.newConnection();
        Channel channel = connection.createChannel();
        /*
         * 创建交换机，不存在就创建，存在不创建直接使用
         * 参数1：交换机名字
         * 参数2：交换机类型
         * */
        channel.exchangeDeclare(EXCHANGE_NAME,"fanout");
        /*
         * 参数1：队列名称，存在就不用创建，不存在会自动创建
         * 参数2：队列里面的消息是否持久化，默认消息存储在内存中
         * 参数3：是否私有化，false所有消费者都可以访问，true第一拥有她的消费者可以一直访问
         * 参数4：是否自动删除最后一个消费者端开连接以后该队列是否自动删除 true自动删除
         * 参数5：其他参数
         * */
        channel.queueDeclare(QUEUE_NAME,false,false,false,null);
        // 将队列和交换机绑定，绑定的关系routingkey = ""
        channel.queueBind(QUEUE_NAME, EXCHANGE_NAME, "");
        DeliverCallback deliverCallback = (consumerTag, delivery) -> {
           String message= new String(delivery.getBody());
            System.out.println("订阅者2:"+message);
        };
        channel.basicConsume(QUEUE_NAME, false, deliverCallback, consumerTag -> { });
    }
}
```

发布者控制台输入和输出：

```
请输入信息
11
生产者发出消息：11
22
生产者发出消息：22
```

订阅者1控制台输出：

```
订阅者1:11
订阅者1:22
```

订阅者2控制台输出：

```
订阅者2:11
订阅者2:22
```

RabbitMQ可视化ui界面可以看到：

![image-20230427100555012](http://img.zouyh.top/article-img/20240917135108352.png)

点击交换机名称可以查看到，交换机绑定的队列，如下图：

![image-20230427100440393](http://img.zouyh.top/article-img/20240917135110357.png)



总结：在发布订阅模式下，生产者(发布者)发布消息时，将消息发布到交换机，消费者(订阅者)将自己对应队列与交换机绑定。从而实现一条消息可以被交换机发送至不同队列中，实现每个消费者能收到该消息。

#### 1.4 路由模式

<img src="http://img.zouyh.top/article-img/20240917135109354.png" alt="image-20230427112011907" style="zoom:80%;" />

发布者：

```java
public class Publish {
    private static final String EXCHANGE_NAME = "ROUTING_EXCHANGE";
    public static void main(String[] args) throws IOException {
        Connection connection = MqClientUtils.newConnection();
        Channel channel = connection.createChannel();
        /*
        * 创建交换机
        * 参数1：交换机名字
        * 参数2：交换机类型
        * */
        channel.exchangeDeclare(EXCHANGE_NAME, BuiltinExchangeType.DIRECT);
        Map<String,String> bindingKeyMap = new HashMap<>();
        bindingKeyMap.put("info","普通 info 信息");
        bindingKeyMap.put("warning","警告 warning 信息");
        bindingKeyMap.put("error","错误 error 信息");
        //debug 没有消费这接收这个消息 所有就丢失了
        bindingKeyMap.put("debug","调试 debug 信息");
        for(String bindingKey : bindingKeyMap.keySet()) {
            String message = bindingKeyMap.get(bindingKey);
            channel.basicPublish(EXCHANGE_NAME,bindingKey, null, message.getBytes("UTF-8"));
            System.out.println("生产者发出消息:" + message);
        }
    }
}
```

订阅者1：

```java
public class Subscription01 {
    private static final String QUEUE_NAME = "ROUTING_QUEUE_01";// 队列名称
    private static final String EXCHANGE_NAME = "ROUTING_EXCHANGE";
    public static void main(String[] args) throws IOException {
        Connection connection = MqClientUtils.newConnection();
        Channel channel = connection.createChannel();
        /*
         * 创建交换机
         * 参数1：交换机名字
         * 参数2：交换机类型
         * */
        channel.exchangeDeclare(EXCHANGE_NAME, BuiltinExchangeType.DIRECT);
        /*
         * 参数1：队列名称，存在就不用创建，不存在会自动创建
         * 参数2：队列里面的消息是否持久化，默认消息存储在内存中
         * 参数3：是否私有化，false所有消费者都可以访问，true第一拥有她的消费者可以一直访问
         * 参数4：是否自动删除最后一个消费者端开连接以后该队列是否自动删除 true自动删除
         * 参数5：其他参数
         * */
        channel.queueDeclare(QUEUE_NAME,false,false,false,null);
        // 将队列和交换机绑定，绑定的关系routingkey = ""
        channel.queueBind(QUEUE_NAME, EXCHANGE_NAME, "info");
        DeliverCallback deliverCallback = (consumerTag, delivery) -> {
           String message= new String(delivery.getBody());
            System.out.println("订阅者1:"+message);
        };
        channel.basicConsume(QUEUE_NAME, false, deliverCallback, consumerTag -> { });
    }
}
```

订阅者2：与订阅者01相比队列名称不同，绑定的routingKey不同

```java
public class Subscription02 {
    private static final String QUEUE_NAME = "ROUTING_QUEUE_02";// 队列名称
    private static final String EXCHANGE_NAME = "ROUTING_EXCHANGE";
    public static void main(String[] args) throws IOException {
        Connection connection = MqClientUtils.newConnection();
        Channel channel = connection.createChannel();
        /*
         * 创建交换机
         * 参数1：交换机名字
         * 参数2：交换机类型
         * */
        channel.exchangeDeclare(EXCHANGE_NAME, BuiltinExchangeType.DIRECT);
        /*
         * 参数1：队列名称，存在就不用创建，不存在会自动创建
         * 参数2：队列里面的消息是否持久化，默认消息存储在内存中
         * 参数3：是否私有化，false所有消费者都可以访问，true第一拥有她的消费者可以一直访问
         * 参数4：是否自动删除最后一个消费者端开连接以后该队列是否自动删除 true自动删除
         * 参数5：其他参数
         * */
        channel.queueDeclare(QUEUE_NAME,false,false,false,null);
        // 将队列和交换机绑定，绑定的关系routingkey = ""
        channel.queueBind(QUEUE_NAME, EXCHANGE_NAME, "warning");
        channel.queueBind(QUEUE_NAME, EXCHANGE_NAME, "error");
        DeliverCallback deliverCallback = (consumerTag, delivery) -> {
           String message= new String(delivery.getBody());
            System.out.println("订阅者2:"+message);
        };
        channel.basicConsume(QUEUE_NAME, false, deliverCallback, consumerTag -> { });
    }
}
```

发布者控制台输出：

```
生产者发出消息:调试 debug 信息
生产者发出消息:警告 warning 信息
生产者发出消息:错误 error 信息
生产者发出消息:普通 info 信息
```

订阅者1控制台输出：

```
订阅者1:普通 info 信息
```

订阅者2控制台输出：

```
订阅者2:警告 warning 信息
订阅者2:错误 error 信息
```

RabbitMQ可视化ui界面可以看到：

![image-20230427104357213](http://img.zouyh.top/article-img/20240917135108353.png)

点击交换机名称可以查看到，交换机绑定的队列，如下图：

![image-20230427104436108](http://img.zouyh.top/article-img/20240917135109355.png)

和发布订阅模式区别：多重绑定，交换机和队列的绑定关系routingKey可以是多个的，发布订阅模式routingKey都是”“。

和发布订阅模式相似：exchange 的绑定类型是 direct，但是它绑定的多个队列的routingKey如果都相同，在这种情况下虽然绑定类型是 direct 但是它表现的就和 fanout 有点类似了，就跟广播差不多。

#### 1.5 主题模式

交换机类型Topic 的要求 :

​	发送到类型是 topic 交换机的消息的 routing_key 不能随意写，必须满足一定的要求，它必须是一个单词列表**，**以点号分隔开。这些单词可以是任意字母的组合，比如说：`stock.usd.nyse`,`nyse.vmw`, `quick.orange.rabbit`这种类型的。当然这个单词列表最多不能超过 255 个字节。 在这个规则列表中，其中有两个替换符是大家需要注意的

-  `*`可以代替一个单词 
- ` #`可以替代零个或多个单词

下图是一个队列绑定关系图，我们来看看他们之间数据接收情况是怎么样的

<img src="http://img.zouyh.top/article-img/20240917135106346.png" alt="image-20230427110619682" style="zoom:80%;" />

- `quick.orange.rabbit `：被队列 Q1Q2 接收到 
- `lazy.orange.elephant` ：被队列 Q1Q2 接收到
- `quick.orange.fox `：被队列 Q1 接收到
- ` lazy.brown.fox`: 被队列 Q2 接收到 
- `lazy.pink.rabbit`： 虽然满足两个绑定但只被队列 Q2 接收一次 
- `quick.brown.fox` ：不匹配任何绑定不会被任何队列接收到会被丢弃 
- `quick.orange.male.rabbit`： 是四个单词不匹配任何绑定会被丢弃 
- `lazy.orange.male.rabbit` ：是四个单词但匹配 Q2 

发布者：

```java
public class Publish {
    private static final String EXCHANGE_NAME = "TOPIC_EXCHANGE";
    public static void main(String[] args) throws IOException {
        Connection connection = MqClientUtils.newConnection();
        Channel channel = connection.createChannel();
        /*
        * 创建交换机
        * 参数1：交换机名字
        * 参数2：交换机类型
        * */
        channel.exchangeDeclare(EXCHANGE_NAME, BuiltinExchangeType.TOPIC);
        Map<String,String> bindingKeyMap = new HashMap<>();
        bindingKeyMap.put("quick.orange.rabbit","被队列 Q1Q2 接收到");
        bindingKeyMap.put("lazy.orange.elephant","被队列 Q1Q2 接收到");
        bindingKeyMap.put("quick.orange.fox","被队列 Q1 接收到");
        bindingKeyMap.put("lazy.brown.fox","被队列 Q2 接收到");
        bindingKeyMap.put("lazy.pink.rabbit","虽然满足两个绑定但只被队列 Q2 接收一次");
        bindingKeyMap.put("quick.brown.fox","不匹配任何绑定不会被任何队列接收到会被丢弃");
        bindingKeyMap.put("quick.orange.male.rabbit","是四个单词不匹配任何绑定会被丢弃");
        bindingKeyMap.put("lazy.orange.male.rabbit","是四个单词但匹配 Q2");
        for(String bindingKey : bindingKeyMap.keySet()) {
            String message = bindingKeyMap.get(bindingKey);
            channel.basicPublish(EXCHANGE_NAME,bindingKey, null, message.getBytes("UTF-8"));
            System.out.println("生产者发出消息:" + message);
        }
    }
}
```

订阅者1：

```java
public class Subscription01 {
    private static final String QUEUE_NAME = "TOPIC_QUEUE_01";
    private static final String EXCHANGE_NAME = "TOPIC_EXCHANGE";
    public static void main(String[] args) throws IOException {
        Connection connection = MqClientUtils.newConnection();
        Channel channel = connection.createChannel();
        /*
         * 创建交换机
         * 参数1：交换机名字
         * 参数2：交换机类型
         * */
        channel.exchangeDeclare(EXCHANGE_NAME, BuiltinExchangeType.TOPIC);
        /*
         * 参数1：队列名称，存在就不用创建，不存在会自动创建
         * 参数2：队列里面的消息是否持久化，默认消息存储在内存中
         * 参数3：是否私有化，false所有消费者都可以访问，true第一拥有她的消费者可以一直访问
         * 参数4：是否自动删除最后一个消费者端开连接以后该队列是否自动删除 true自动删除
         * 参数5：其他参数
         * */
        channel.queueDeclare(QUEUE_NAME,false,false,false,null);
        // 将队列和交换机绑定，绑定的关系routingkey = ""
        channel.queueBind(QUEUE_NAME, EXCHANGE_NAME, "*.orange.*");
        DeliverCallback deliverCallback = (consumerTag, delivery) -> {
           String message= new String(delivery.getBody());
            System.out.println("订阅者1:"+message);
        };
        channel.basicConsume(QUEUE_NAME, false, deliverCallback, consumerTag -> { });
    }
}
```

订阅者2：与订阅者01相比队列名称不同，绑定的routingKey不同

```java
public class Subscription02 {
    private static final String QUEUE_NAME = "TOPIC_QUEUE_02";
    private static final String EXCHANGE_NAME = "TOPIC_EXCHANGE";
    public static void main(String[] args) throws IOException {
        Connection connection = MqClientUtils.newConnection();
        Channel channel = connection.createChannel();
        /*
         * 创建交换机
         * 参数1：交换机名字
         * 参数2：交换机类型
         * */
        channel.exchangeDeclare(EXCHANGE_NAME, BuiltinExchangeType.TOPIC);
        /*
         * 参数1：队列名称，存在就不用创建，不存在会自动创建
         * 参数2：队列里面的消息是否持久化，默认消息存储在内存中
         * 参数3：是否私有化，false所有消费者都可以访问，true第一拥有她的消费者可以一直访问
         * 参数4：是否自动删除最后一个消费者端开连接以后该队列是否自动删除 true自动删除
         * 参数5：其他参数
         * */
        channel.queueDeclare(QUEUE_NAME,false,false,false,null);
        // 将队列和交换机绑定，绑定的关系routingkey = ""
        channel.queueBind(QUEUE_NAME, EXCHANGE_NAME, "*.*.rabbit");
        channel.queueBind(QUEUE_NAME, EXCHANGE_NAME, "lazy.#");
        DeliverCallback deliverCallback = (consumerTag, delivery) -> {
           String message= new String(delivery.getBody());
            System.out.println("订阅者1:"+message);
        };
        channel.basicConsume(QUEUE_NAME, false, deliverCallback, consumerTag -> { });
    }
}
```

发布者控制台输出：

```
生产者发出消息:是四个单词不匹配任何绑定会被丢弃
生产者发出消息:不匹配任何绑定不会被任何队列接收到会被丢弃
生产者发出消息:被队列 Q1Q2 接收到
生产者发出消息:被队列 Q2 接收到
生产者发出消息:被队列 Q1Q2 接收到
生产者发出消息:被队列 Q1 接收到
生产者发出消息:虽然满足两个绑定但只被队列 Q2 接收一次
生产者发出消息:是四个单词但匹配 Q2
```

订阅者1控制台输出：

```
订阅者1:被队列 Q1Q2 接收到
订阅者1:被队列 Q1Q2 接收到
订阅者1:被队列 Q1 接收到
```

订阅者2控制台输出：

```
订阅者1:被队列 Q1Q2 接收到
订阅者1:被队列 Q2 接收到
订阅者1:被队列 Q1Q2 接收到
订阅者1:虽然满足两个绑定但只被队列 Q2 接收一次
订阅者1:是四个单词但匹配 Q2
```

RabbitMQ可视化ui界面可以看到：

![image-20230427111519231](http://img.zouyh.top/article-img/20240917135106344.png)

点击交换机名称可以查看到，交换机绑定的队列，如下图：

![image-20230427111555444](http://img.zouyh.top/article-img/20240917135107349.png)
