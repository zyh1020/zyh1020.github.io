---
icon: file-lines
# 标题
title: 'RocketMQ核心操作'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-21
# 一个页面可以有多个分类
category:
  - MQ
# 一个页面可以有多个标签
tag:
  - 必看
  - MQ
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，基础API操作

新建mavn项目导入jar包：

```xml
<dependency>
	<groupId>org.apache.rocketmq</groupId>
	<artifactId>rocketmq-client</artifactId>
	<version>4.7.1</version>
</dependency>
```

#### 1.1 消息的发送

##### 1.1.1 单向发送消息

```java
public class Producer {
    public static void main(String[] args) throws MQClientException, InterruptedException {
        DefaultMQProducer producer = new DefaultMQProducer("ProducerGroupName");
        producer.setNamesrvAddr("1.15.141.218:9876");
        producer.start();
        for (int i = 0; i < 20; i++)
            try {
                {
                    Message msg = new Message("TopicTest",
                        "TagA",
                        "OrderID188",
                        "Hello world".getBytes(RemotingHelper.DEFAULT_CHARSET));
                    producer.sendOneway(msg); // 通过sendOneway方法发送消息，没有返回值
                }

            } catch (Exception e) {
                e.printStackTrace();
            }

        producer.shutdown();
    }
}
```

在可视化界面可以看到：

![image-20230512112720862](http://img.zouyh.top/article-img/20240917135119382.png)

<img src="http://img.zouyh.top/article-img/20240917135119384.png" alt="image-20230512112747666" style="zoom: 67%;" />

有20条待消费的消息。

##### 1.1.2 同步发送消息

```java
public class Producer {
    public static void main(String[] args) throws MQClientException{
        DefaultMQProducer producer = new DefaultMQProducer("ProducerGroupName");
        producer.setNamesrvAddr("1.15.141.218:9876");
        producer.start();
        for (int i = 0; i < 20; i++)
            try {
                Message msg = new Message("Topic02",
                    "Tag02",
                    "keys02",
                    "Hello world".getBytes(RemotingHelper.DEFAULT_CHARSET));
                SendResult sendResult = producer.send(msg);// 同步传递消息，消息会发给集群中的一个Broker节点。
                System.out.println("返回结果:"+sendResult);
            } catch (Exception e) {
                e.printStackTrace();
            }

        producer.shutdown();
    }
}
```

在可视化界面可以看到：

<img src="http://img.zouyh.top/article-img/20240917135119383.png" alt="image-20230512112257524" style="zoom: 67%;" />

有20条待消费的消息。

##### 1.1.3 异步发送消息

```java
public class AsyncProducer {
    public static void main(
        String[] args) throws MQClientException, InterruptedException{
        DefaultMQProducer producer = new DefaultMQProducer("ProducerGroupName");
        producer.setNamesrvAddr("1.15.141.218:9876");
        producer.start();
        producer.setRetryTimesWhenSendAsyncFailed(0);
        int messageCount = 20;
        final CountDownLatch countDownLatch = new CountDownLatch(messageCount);
        for (int i = 0; i < messageCount; i++) {
            try {
                final int index = i;
                Message msg = new Message("Topic03",
                    "Tag03",
                    "keys03",
                    "Hello world".getBytes(RemotingHelper.DEFAULT_CHARSET));
                producer.send(msg, new SendCallback() {
                    @Override
                    public void onSuccess(SendResult sendResult) {
                        countDownLatch.countDown();
                        System.out.println("index:"+index+",msgId:"+sendResult.getMsgId());
                    }
                    @Override
                    public void onException(Throwable e) {
                        countDownLatch.countDown();
                        System.out.println("index:"+index+",e:"+e);
                        e.printStackTrace();
                    }
                });
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
         // 由于是异步发送，这里引入一个countDownLatch，保证所有Producer发送消息的回调方法都执行完了再停止Producer服务。
        countDownLatch.await(5, TimeUnit.SECONDS);
        producer.shutdown(); 
    }
}
```

控制台输出：

```
index:6,msgId:A9FE7F77465C18B4AAC23B1F316C0003
index:4,msgId:A9FE7F77465C18B4AAC23B1F316C0001
index:7,msgId:A9FE7F77465C18B4AAC23B1F316C0002
index:1,msgId:A9FE7F77465C18B4AAC23B1F316C0007
index:2,msgId:A9FE7F77465C18B4AAC23B1F316C0005
index:5,msgId:A9FE7F77465C18B4AAC23B1F316C0004
index:3,msgId:A9FE7F77465C18B4AAC23B1F316C0006
index:0,msgId:A9FE7F77465C18B4AAC23B1F316C0000
index:8,msgId:A9FE7F77465C18B4AAC23B1F31800008
index:10,msgId:A9FE7F77465C18B4AAC23B1F31800009
index:9,msgId:A9FE7F77465C18B4AAC23B1F3180000A
index:11,msgId:A9FE7F77465C18B4AAC23B1F3180000B
index:12,msgId:A9FE7F77465C18B4AAC23B1F3180000C
index:13,msgId:A9FE7F77465C18B4AAC23B1F3180000D
index:14,msgId:A9FE7F77465C18B4AAC23B1F3180000E
index:15,msgId:A9FE7F77465C18B4AAC23B1F3180000F
index:17,msgId:A9FE7F77465C18B4AAC23B1F31800011
index:19,msgId:A9FE7F77465C18B4AAC23B1F31800013
index:18,msgId:A9FE7F77465C18B4AAC23B1F31800012
index:16,msgId:A9FE7F77465C18B4AAC23B1F31800010
```

可以看出消息是否发送成功的响应是异步的。

在可视化界面可以看到：

<img src="http://img.zouyh.top/article-img/20240917135118380.png" alt="image-20230512113312705" style="zoom:67%;" />

#### 1.2 消息的接收

消费者消费消息有两种模式，一种是消费者主动去Broker上拉取消息的拉模式，另一种是消费者等待 Broker把消息推送过来的推模式。

##### 1.2.1 推送模式

```java
public class PushConsumer {
    public static void main(String[] args) throws MQClientException {
        DefaultMQPushConsumer consumer = new DefaultMQPushConsumer("ConsumerGroupName");
        consumer.setNamesrvAddr("1.15.141.218:9876");
        consumer.subscribe("Topic01", "*");
        consumer.setConsumeFromWhere(ConsumeFromWhere.CONSUME_FROM_FIRST_OFFSET);
        consumer.setConsumeTimestamp("202209221800");
        consumer.registerMessageListener(new MessageListenerConcurrently() {
            @Override
            public ConsumeConcurrentlyStatus consumeMessage(List<MessageExt> msgs, ConsumeConcurrentlyContext context) {
                System.out.println("线程name:"+Thread.currentThread().getName()+",msgs:"+msgs);
                return ConsumeConcurrentlyStatus.CONSUME_SUCCESS;
            }
        });
        consumer.start();
    }
}
```

控制台输出：

```
线程name:ConsumeMessageThread_7,msgs:[MessageExt [brokerName=broker-a, queueId=0, storeSize=184, queueOffset=1, sysFlag=0, bornTimestamp=1683861863459, bornHost=/113.215.165.119:2399, storeTimestamp=1683861863731, storeHost=/1.15.141.218:10911, msgId=010F8DDA00002A9F0000000000002F1C, commitLogOffset=12060, bodyCRC=198614610, reconsumeTimes=0, preparedTransactionOffset=0, toString()=Message{topic='Topic01', flag=0, properties={MIN_OFFSET=0, MAX_OFFSET=5, KEYS=keys01, CONSUME_START_TIME=1683871881033, UNIQ_KEY=A9FE7F7752D418B4AAC23B1888230005, WAIT=true, TAGS=Tag01}, body=[72, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100], transactionId='null'}]]
线程name:ConsumeMessageThread_4,msgs:[MessageExt [brokerName=broker-a, queueId=3, storeSize=184, queueOffset=0, sysFlag=0, bornTimestamp=1683861863439, bornHost=/113.215.165.119:2399, storeTimestamp=1683861863726, storeHost=/1.15.141.218:10911, msgId=010F8DDA00002A9F0000000000002B84, commitLogOffset=11140, bodyCRC=198614610, reconsumeTimes=0, preparedTransactionOffset=0, toString()=Message{topic='Topic01', flag=0, properties={MIN_OFFSET=0, MAX_OFFSET=5, KEYS=keys01, CONSUME_START_TIME=1683871881033, UNIQ_KEY=A9FE7F7752D418B4AAC23B18880E0000, WAIT=true, TAGS=Tag01}, body=[72, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100], transactionId='null'}]]
,,,,,,,,,,,,,,,
```

##### 1.2.2 拉取模式

```java
public class PullConsumer {
    private static final Map<MessageQueue, Long> OFFSE_TABLE = new HashMap<MessageQueue, Long>();
    public static void main(String[] args) throws MQClientException {
        DefaultMQPullConsumer consumer = new DefaultMQPullConsumer("ConsumerGroupName");
        consumer.setNamesrvAddr("1.15.141.218:9876");
        consumer.start();
        Set<MessageQueue> mqs = consumer.fetchSubscribeMessageQueues("Topic02");
        for (MessageQueue mq : mqs) {
            System.out.println("mq:"+mq);
            SINGLE_MQ:
            while (true) {
                try {
                    PullResult pullResult =
                        consumer.pullBlockIfNotFound(mq, null, getMessageQueueOffset(mq), 32);
                    System.out.println("结果："+pullResult);
                    putMessageQueueOffset(mq, pullResult.getNextBeginOffset());
                    switch (pullResult.getPullStatus()) {
                        case FOUND:
                            break;
                        case NO_MATCHED_MSG:
                            break;
                        case NO_NEW_MSG:
                            break SINGLE_MQ;
                        case OFFSET_ILLEGAL:
                            break;
                        default:
                            break;
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
        consumer.shutdown();
    }

    private static long getMessageQueueOffset(MessageQueue mq) {
        Long offset = OFFSE_TABLE.get(mq);
        if (offset != null)
            return offset;

        return 0;
    }

    private static void putMessageQueueOffset(MessageQueue mq, long offset) {
        OFFSE_TABLE.put(mq, offset);
    }

}
```

控制台输出：

```
mq:MessageQueue [topic=Topic02, brokerName=broker-a, queueId=2]
结果：PullResult [pullStatus=FOUND, nextBeginOffset=5, minOffset=0, maxOffset=5, msgFoundList=5]
结果：PullResult [pullStatus=NO_NEW_MSG, nextBeginOffset=5, minOffset=0, maxOffset=5, msgFoundList=0]
mq:MessageQueue [topic=Topic02, brokerName=broker-a, queueId=3]
结果：PullResult [pullStatus=FOUND, nextBeginOffset=5, minOffset=0, maxOffset=5, msgFoundList=5]
结果：PullResult [pullStatus=NO_NEW_MSG, nextBeginOffset=5, minOffset=0, maxOffset=5, msgFoundList=0]
mq:MessageQueue [topic=Topic02, brokerName=broker-a, queueId=0]
结果：PullResult [pullStatus=FOUND, nextBeginOffset=5, minOffset=0, maxOffset=5, msgFoundList=5]
结果：PullResult [pullStatus=NO_NEW_MSG, nextBeginOffset=5, minOffset=0, maxOffset=5, msgFoundList=0]
mq:MessageQueue [topic=Topic02, brokerName=broker-a, queueId=1]
结果：PullResult [pullStatus=FOUND, nextBeginOffset=5, minOffset=0, maxOffset=5, msgFoundList=5]
结果：PullResult [pullStatus=NO_NEW_MSG, nextBeginOffset=5, minOffset=0, maxOffset=5, msgFoundList=0]
```

通常情况下，用推模式比较简单。 实际上RocketMQ的推模式也是由拉模式封装出来的。 4.7.1版本中`DefaultMQPullConsumerImpl`这个消费者类已标记为过期，但是还是可以使用的。 替换的类是`DefaultLitePullConsumerImpl`

```java
public class LitePullConsumerSubscribe {
    public static volatile boolean running = true;
    public static void main(String[] args) throws Exception {
        DefaultLitePullConsumer litePullConsumer = new DefaultLitePullConsumer("ConsumerGroupName");
        litePullConsumer.setNamesrvAddr("1.15.141.218:9876");
        litePullConsumer.setConsumeFromWhere(ConsumeFromWhere.CONSUME_FROM_FIRST_OFFSET);
        litePullConsumer.subscribe("Topic03", "*");
        litePullConsumer.start();
        try {
            while (running) {
                List<MessageExt> messageExts = litePullConsumer.poll();
                System.out.println("MessageExt:"+messageExts);
            }
        } finally {
            litePullConsumer.shutdown();
        }
    }
}
```

或者这样可以控制偏移量的方式访问：

```java
public class LitePullConsumerAssign {
    public static volatile boolean running = true;
    public static void main(String[] args) throws Exception {
        DefaultLitePullConsumer litePullConsumer = new DefaultLitePullConsumer("ProducerGroupName");
        litePullConsumer.setNamesrvAddr("1.15.141.218:9876");
        litePullConsumer.setAutoCommit(false);
        litePullConsumer.start();
        Collection<MessageQueue> mqSet = litePullConsumer.fetchMessageQueues("Topic01");
        List<MessageQueue> list = new ArrayList<>(mqSet);
        List<MessageQueue> assignList = new ArrayList<>();
        for (int i = 0; i < list.size() / 2; i++) {
            assignList.add(list.get(i));
        }
        litePullConsumer.assign(assignList);
        litePullConsumer.seek(assignList.get(0), 5); // 取出第1的MessageQueue
        try {
            while (running) {
                List<MessageExt> messageExts = litePullConsumer.poll();
                System.out.println("MessageExt:"+messageExts);
                litePullConsumer.commitSync();
            }
        } finally {
            litePullConsumer.shutdown();
        }

    }
}
```

控制台输出：

```
MessageExt:[MessageExt [brokerName=broker-a, queueId=3, storeSize=184, queueOffset=0, sysFlag=0, bornTimestamp=1683862300012, bornHost=/113.215.165.119:2770, storeTimestamp=1683862300295, storeHost=/1.15.141.218:10911, msgId=010F8DDA00002A9F0000000000003C0C, commitLogOffset=15372, bodyCRC=198614610, reconsumeTimes=0, preparedTransactionOffset=0, toString()=Message{topic='Topic03', flag=0, properties={MIN_OFFSET=0, MAX_OFFSET=5, KEYS=keys03, UNIQ_KEY=A9FE7F77465C18B4AAC23B1F316C0003, WAIT=true, TAGS=Tag03}, body=[72, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100], transactionId='null'}], MessageExt [brokerName=broker-a, queueId=3, storeSize=184, queueOffset=1, sysFlag=0, bornTimestamp=1683862300032, bornHost=/113.215.165.119:2770, storeTimestamp=1683862300296, storeHost=/1.15.141.218:10911, msgId=010F8DDA00002A9F0000000000003FA4, commitLogOffset=16292, bodyCRC=198614610, reconsumeTimes=0, preparedTransactionOffset=0, toString()=Message{topic='Topic03', flag=0, properties={MIN_OFFSET=0, MAX_OFFSET=5, KEYS=keys03, UNIQ_KEY=A9FE7F77465C18B4AAC23B1F31800008, WAIT=true, TAGS=Tag03}, body=[72, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100], transactionId='null'}], MessageExt [brokerName=broker-a, queueId=3, storeSize=184, queueOffset=2, sysFlag=0, bornTimestamp=1683862300032, bornHost=/113.215.165.119:2770, storeTimestamp=1683862300296, storeHost=/1.15.141.218:10911, msgId=010F8DDA00002A9F00000000000041CC, commitLogOffset=16844, bodyCRC=198614610, reconsumeTimes=0, preparedTransactionOffset=0, toString()=Message{topic='Topic03', flag=0, properties={MIN_OFFSET=0, MAX_OFFSET=5, KEYS=keys03, UNIQ_KEY=A9FE7F77465C18B4AAC23B1F3180000B, WAIT=true, TAGS=Tag03}, body=[72, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100], transactionId='null'}], MessageExt [brokerName=broker-a, queueId=3, storeSize=184, queueOffset=3, sysFlag=0, bornTimestamp=1683862300032, bornHost=/113.215.165.119:2770, storeTimestamp=1683862300296, storeHost=/1.15.141.218:10911, msgId=010F8DDA00002A9F0000000000004284, commitLogOffset=17028, bodyCRC=198614610, reconsumeTimes=0, preparedTransactionOffset=0, toString()=Message{topic='Topic03', flag=0, properties={MIN_OFFSET=0, MAX_OFFSET=5, KEYS=keys03, UNIQ_KEY=A9FE7F77465C18B4AAC23B1F3180000C, WAIT=true, TAGS=Tag03}, body=[72, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100], transactionId='null'}], MessageExt [brokerName=broker-a, queueId=3, storeSize=184, queueOffset=4, sysFlag=0, bornTimestamp=1683862300032, bornHost=/113.215.165.119:2770, storeTimestamp=1683862300297, storeHost=/1.15.141.218:10911, msgId=010F8DDA00002A9F00000000000044AC, commitLogOffset=17580, bodyCRC=198614610, reconsumeTimes=0, preparedTransactionOffset=0, toString()=Message{topic='Topic03', flag=0, properties={MIN_OFFSET=0, MAX_OFFSET=5, KEYS=keys03, UNIQ_KEY=A9FE7F77465C18B4AAC23B1F3180000F, WAIT=true, TAGS=Tag03}, body=[72, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100], transactionId='null'}]]
，，，，，，，，，，
```

#### 1.3 顺序消息

消息的生产者：

```java
public class Producer {
    public static void main(String[] args) throws UnsupportedEncodingException {
        try {
            DefaultMQProducer producer = new DefaultMQProducer("please_rename_unique_group_name");
            producer.setNamesrvAddr("1.15.141.218:9876");
            producer.start();
            for (int i = 0; i < 10; i++) {
                int orderId = i;
                for(int j = 0 ; j <= 5 ; j ++){
                    Message msg =
                            new Message("OrderTopicTest", "order_"+orderId, "KEY" + orderId,
                                    ("order_"+orderId+" step " + j).getBytes(RemotingHelper.DEFAULT_CHARSET));
                    SendResult sendResult = producer.send(msg, new MessageQueueSelector() {
                        @Override
                        public MessageQueue select(List<MessageQueue> mqs, Message msg, Object arg) {
                            Integer id = (Integer) arg; // arg是send发送消息的参数，这里arg=orderId
                            int index = id % mqs.size(); // 这里是为了保证orderId相同的发送到同一个MessageQueue
                            return mqs.get(index);
                        }
                    }, orderId);
                    System.out.println("发送结果："+sendResult);
                }
            }
            producer.shutdown();
        } catch (MQClientException | RemotingException | MQBrokerException | InterruptedException e) {
            e.printStackTrace();
        }
    }
}
```

消息的消费者：

```java
public class Consumer {
    public static void main(String[] args) throws MQClientException {
        DefaultMQPushConsumer consumer = new DefaultMQPushConsumer("orderConsumer");
        producer.setNamesrvAddr("1.15.141.218:9876");
        consumer.setConsumeFromWhere(ConsumeFromWhere.CONSUME_FROM_LAST_OFFSET);
        consumer.subscribe("OrderTopicTest", "*");
        // 这里使用的是MessageListenerOrderly
        consumer.registerMessageListener(new MessageListenerOrderly() {
            @Override
            public ConsumeOrderlyStatus consumeMessage(List<MessageExt> msgs, ConsumeOrderlyContext context) {
                context.setAutoCommit(true);
                for(MessageExt msg:msgs){
                    System.out.println("收到消息内容 "+new String(msg.getBody()));
                }
                return ConsumeOrderlyStatus.SUCCESS;
            }
        });
        consumer.start();
    }

}
```

-控制台输出：

```
收到消息内容 order_2 step 0
收到消息内容 order_1 step 0
收到消息内容 order_3 step 0
收到消息内容 order_0 step 0
收到消息内容 order_1 step 1
收到消息内容 order_3 step 1
收到消息内容 order_1 step 2
收到消息内容 order_2 step 1
收到消息内容 order_1 step 3
收到消息内容 order_0 step 1
收到消息内容 order_1 step 4
收到消息内容 order_2 step 2
收到消息内容 order_3 step 2
收到消息内容 order_1 step 5
，，，，
```

从控制台输出可以看出，RocketMQ保证的是消息的局部有序，而不是全局有序。

​	消费者会从多个消息队列上去拿消息。这时虽然每个消息队列上的消息是有序的，但是多个队列之间的消息仍然是乱序的。消费者端要保证消息有序，就需要按队列一个一个来取消息，即取完一个队列的消息后，再去取下一个队列的消息。而给consumer注入的 `MessageListenerOrderly`对象，在RocketMQ内部就会通过锁队列的方式保证消息是一个一个队列来取的。`MessageListenerConcurrently`这个消息监听器则不会锁队列，每次都是从多个 Message中取一批数据（默认不超过32条）。因此也无法保证消息有序，所以一定要使用`MessageListenerOrderly`对象来取消息。

#### 1.4 广播消息

在集群状态 `MessageModel.CLUSTERING`下，每一条消息只会被同一个消费者组中的一个实例消费到，这跟 kafka和rabbitMQ的集群模式是一样的，而广播模式`MessageModel.BROADCASTING`则是把消息发给了所有订阅了对应主题的消费者，而不管消费者是不是同一个消费者组。

消息的生产者和普通的没什么区别，消息的消费者如下：

```java
public class PushConsumer {
    public static void main(String[] args) throws InterruptedException, MQClientException {
        DefaultMQPushConsumer consumer = new DefaultMQPushConsumer("BroadcastConsumer");
        consumer.setNamesrvAddr("1.15.141.218:9876");
        consumer.setConsumeFromWhere(ConsumeFromWhere.CONSUME_FROM_LAST_OFFSET);
        consumer.setMessageModel(MessageModel.BROADCASTING); // 设置广播模式
        consumer.subscribe("BroadcastTopicTest", "*");
        consumer.registerMessageListener(new MessageListenerConcurrently() {
            @Override
            public ConsumeConcurrentlyStatus consumeMessage(List<MessageExt> msgs,
                ConsumeConcurrentlyContext context) {
                System.out.println("线程name:"+Thread.currentThread().getName()+",msgs:"+msgs);
                return ConsumeConcurrentlyStatus.CONSUME_SUCCESS;
            }
        });
        consumer.start();
    }
}
```

#### 1.5 批量消息

批量发送消息能显著提高传递消息的性能。限制是这些批量消息应该有相同的topic，而且不能是延时消息。此外，这一批消息的总大小不应超过4MB，如果超过可以有2种处理方案：

- 将消息进行切割成多个小于4M的内容进行发送
- 修改4M的限制改成更大，可以设置Producer的maxMessageSize属性，修改配置文件中的maxMessageSize属性。

简单的批量发送案例：

```java
public class SimpleBatchProducer {

    public static void main(String[] args) throws Exception {
        DefaultMQProducer producer = new DefaultMQProducer("BatchProducerGroupName");
        producer.setNamesrvAddr("1.15.141.218:9876");
        producer.start();

        String topic = "BatchTest";
        List<Message> messages = new ArrayList<>();
        messages.add(new Message(topic, "Tag", "OrderID001", "Hello world 0".getBytes()));
        messages.add(new Message(topic, "Tag", "OrderID002", "Hello world 1".getBytes()));
        messages.add(new Message(topic, "Tag", "OrderID003", "Hello world 2".getBytes()));
        producer.send(messages);
        
        producer.shutdown();
    }
}
```

如果一批数据大于4M，可以通过如下方式发送

```java
public class SplitBatchProducer {
    public static void main(String[] args) throws Exception {
        DefaultMQProducer producer = new DefaultMQProducer("BatchProducerGroupName");
        producer.setNamesrvAddr("1.15.141.218:9876");
        producer.start();
        String topic = "BatchTest";
        List<Message> messages = new ArrayList<>(100 * 1000);
        for (int i = 0; i < 100 * 1000; i++) {
            messages.add(new Message(topic, "Tag", "OrderID" + i, ("Hello world " + i).getBytes()));
        }
        ListSplitter splitter = new ListSplitter(messages);
        while (splitter.hasNext()) {
            List<Message> listItem = splitter.next();
            producer.send(listItem);
        }
        producer.shutdown();
    }

}
```

将消息进行切割成多个小于4M的内容

```java
class ListSplitter implements Iterator<List<Message>> {
    private int sizeLimit = 1000 * 1000;
    private final List<Message> messages;
    private int currIndex;

    public ListSplitter(List<Message> messages) {
        this.messages = messages;
    }

    @Override
    public boolean hasNext() {
        return currIndex < messages.size();
    }

    @Override
    public List<Message> next() {
        int nextIndex = currIndex;
        int totalSize = 0;
        for (; nextIndex < messages.size(); nextIndex++) {
            Message message = messages.get(nextIndex);
            int tmpSize = message.getTopic().length() + message.getBody().length;
            Map<String, String> properties = message.getProperties();
            for (Map.Entry<String, String> entry : properties.entrySet()) {
                tmpSize += entry.getKey().length() + entry.getValue().length();
            }
            tmpSize = tmpSize + 20; 
            if (tmpSize > sizeLimit) {
                if (nextIndex - currIndex == 0) {
                    nextIndex++;
                }
                break;
            }
            if (tmpSize + totalSize > sizeLimit) {
                break;
            } else {
                totalSize += tmpSize;
            }

        }
        List<Message> subList = messages.subList(currIndex, nextIndex);
        currIndex = nextIndex;
        return subList;
    }

    @Override
    public void remove() {
        throw new UnsupportedOperationException("Not allowed to remove");
    }
}
```

#### 1.6 过滤消息

##### 1.6.1 TagFilter

消息的生产者：

```java
public class TagFilterProducer {
    public static void main(String[] args) throws Exception {
        DefaultMQProducer producer = new DefaultMQProducer("TagFilterProducer");
        producer.setNamesrvAddr("1.15.141.218:9876");
        producer.start();
        String[] tags = new String[] {"TagA", "TagB", "TagC"};
        for (int i = 0; i < 15; i++) {
            String tag = tags[i % tags.length];
            Message msg = new Message("TagFilterTest",
                tag,
               (tag+"-Hello world").getBytes(RemotingHelper.DEFAULT_CHARSET));
            SendResult sendResult = producer.send(msg);
            System.out.println("发送结果："+sendResult);
        }
        producer.shutdown();
    }
}

```

消息的消费者：

```java
public class TagFilterConsumer {
    public static void main(String[] args) throws InterruptedException, MQClientException, IOException {
        DefaultMQPushConsumer consumer = new DefaultMQPushConsumer("TagFilterConsumer");
        consumer.setNamesrvAddr("1.15.141.218:9876");
        consumer.subscribe("TagFilterTest", "TagA || TagC");
        consumer.registerMessageListener(new MessageListenerConcurrently() {
            @Override
            public ConsumeConcurrentlyStatus consumeMessage(List<MessageExt> msgs,
                ConsumeConcurrentlyContext context) {
                for (MessageExt msg : msgs) {
                    System.out.println("收到消息内容 "+new String(msg.getBody()));
                }
                return ConsumeConcurrentlyStatus.CONSUME_SUCCESS;
            }
        });
        consumer.start();

    }
}
```

控制台输出：

```
收到消息内容 TagA-Hello world
收到消息内容 TagC-Hello world
收到消息内容 TagC-Hello world
收到消息内容 TagC-Hello world
收到消息内容 TagA-Hello world
收到消息内容 TagC-Hello world
收到消息内容 TagA-Hello world
收到消息内容 TagA-Hello world
收到消息内容 TagC-Hello world
收到消息内容 TagA-Hello world
```

可以看出输出收到的消息是TagA和TagC，TagB是没有接收到的。

##### 1.6.2 SqlFilter

消息的生产者：

```java
public class SqlFilterProducer {
    public static void main(String[] args) throws Exception {
        DefaultMQProducer producer = new DefaultMQProducer("SqlFilterProducer");
        producer.setNamesrvAddr("1.15.141.218:9876");
        producer.start();
        String[] tags = new String[] {"TagA", "TagB", "TagC"};
        for (int i = 0; i < 15; i++) {
            String tag = tags[i % tags.length];
            Message msg = new Message("SqlFilterTest",
                    tag,
                (tag+" - Hello RocketMQ - " + i).getBytes(RemotingHelper.DEFAULT_CHARSET)
            );
            msg.putUserProperty("otherProperty", String.valueOf(i));
            SendResult sendResult = producer.send(msg);
            System.out.println("发送结果："+sendResult);
        }
        producer.shutdown();
    }
}

```

消息的消费者：

```java
public class SqlFilterConsumer {
    public static void main(String[] args) throws Exception {
        DefaultMQPushConsumer consumer = new DefaultMQPushConsumer("SqlFilterConsumer");
        consumer.setNamesrvAddr("1.15.141.218:9876");
        consumer.subscribe("SqlFilterTest",
            MessageSelector.bySql("(TAGS is not null and TAGS in ('TagA', 'TagB'))" +
                "and (otherProperty is not null and otherProperty between 0 and 3)"));
        consumer.registerMessageListener(new MessageListenerConcurrently() {
            @Override
            public ConsumeConcurrentlyStatus consumeMessage(List<MessageExt> msgs,
                ConsumeConcurrentlyContext context) {
                for (MessageExt msg : msgs) {
                    System.out.println("收到消息内容 "+new String(msg.getBody()));
                }
                return ConsumeConcurrentlyStatus.CONSUME_SUCCESS;
            }
        });
        consumer.start();
    }
}
```

控制台输出：

```
收到消息内容 TagB - Hello RocketMQ - 1
收到消息内容 TagA - Hello RocketMQ - 3
收到消息内容 TagA - Hello RocketMQ - 0
```

如果消费者启动出现如下错误：

```sh
Exception in thread "main" org.apache.rocketmq.client.exception.MQClientException: CODE: 1  DESC: The broker does not support consumer to filter message by SQL92
For more information, please visit the url, http://rocketmq.apache.org/docs/faq/
	at org.apache.rocketmq.client.impl.MQClientAPIImpl.checkClientInBroker(MQClientAPIImpl.java:2240)
```

解决方式：在`conf/broker.conf`中添加配置

```
enablePropertyFilter=true
```

#### 1.7 延迟消息

延迟消息实现的效果就是在调用producer.send方法后，消息并不会立即发送出去，而是会等一 段时间再发送出去。这是RocketMQ特有的一个功能。 那会延迟多久呢？延迟时间的设置就是在Message消息对象上设置一个延迟级别` message.setDelayTimeLevel(3);`开源版本的RocketMQ中，对延迟消息并不支持任意时间的延迟设定(商业版本中支持)，而是只支 持18个固定的延迟级别，1到18分别对应`1s 5s 10s 30s 1m 2m 3m 4m 5m 6m 7m 8m 9m 10m 20m 30m 1h 2h`。

```
public class ScheduledMessageProducer {
    public static void main(String[] args) throws Exception {
        DefaultMQProducer producer = new DefaultMQProducer("ScheduledProducerGroup");
        producer.setNamesrvAddr("");
        producer.start();
        for (int i = 0; i < 100; i++) {
            Message msg = new Message("ScheduledTopic",("Hello"+i).getBytes());
            msg.setDelayTimeLevel(3); // 设置延迟级别
            producer.send(msg);
        }
        producer.shutdown();
    }
}
```



#### 1.8 事务消息

事务消息主要和消息的生产者有关：

```java
public class TransactionProducer {
    public static void main(String[] args) throws MQClientException, InterruptedException {
        TransactionListener transactionListener = new TransactionListenerImpl();
        TransactionMQProducer producer = new TransactionMQProducer("TransactionProducer");
        producer.setNamesrvAddr("1.15.141.218:9876");
        ExecutorService executorService = new ThreadPoolExecutor(2, 5, 100, TimeUnit.SECONDS, new ArrayBlockingQueue<Runnable>(2000), new ThreadFactory() {
            @Override
            public Thread newThread(Runnable r) {
                Thread thread = new Thread(r);
                thread.setName("client-transaction-msg-check-thread");
                return thread;
            }
        });
        producer.setExecutorService(executorService);
        producer.setTransactionListener(transactionListener);
        producer.start();
        String[] tags = new String[] {"TagA", "TagB", "TagC", "TagD", "TagE"};
        for (int i = 0; i < 10; i++) {
            try {
               String tag =  tags[i % tags.length];
                Message msg =
                    new Message("TransactionTopicTest",tag , "KEY" + i,
                        (tag + " Hello RocketMQ " + i).getBytes(RemotingHelper.DEFAULT_CHARSET));
                SendResult sendResult = producer.sendMessageInTransaction(msg, null);
                System.out.println("----->sendResult:"+sendResult);
                Thread.sleep(10);
            } catch (MQClientException | UnsupportedEncodingException e) {
                e.printStackTrace();
            }
        }
        for (int i = 0; i < 100000; i++) { // 防止生产者结束，导致监听不到
            Thread.sleep(1000);
        }
        producer.shutdown();
    }
}
```

事务消息的关键是在TransactionMQProducer中指定了一个TransactionListener事务监听器：

```java
public class TransactionListenerImpl implements TransactionListener {

    // 在提交完事务消息后执行。
    @Override
    public LocalTransactionState executeLocalTransaction(Message msg, Object arg) {
        String tags = msg.getTags();
        if(StringUtils.contains(tags,"TagA")){
            return LocalTransactionState.COMMIT_MESSAGE; // 返回COMMIT_MESSAGE状态的消息会立即被消费者消费到
        }else if(StringUtils.contains(tags,"TagB")){
            return LocalTransactionState.ROLLBACK_MESSAGE; // 返回ROLLBACK_MESSAGE状态的消息会被丢弃。
        }else{
            return LocalTransactionState.UNKNOW; // 返回UNKNOWN状态的消息会由Broker过一段时间再来回查事务的状态。
        }
    }

    // 在对UNKNOWN状态的消息进行状态回查时执行。返回的结果是一样的。
    @Override
    public LocalTransactionState checkLocalTransaction(MessageExt msg) {
        String tags = msg.getTags();
        if(StringUtils.contains(tags,"TagC")){
            return LocalTransactionState.COMMIT_MESSAGE; // 返回COMMIT_MESSAGE状态的消息会立即被消费者消费到
        }else if(StringUtils.contains(tags,"TagD")){
            return LocalTransactionState.ROLLBACK_MESSAGE; // 返回ROLLBACK_MESSAGE状态的消息会被丢弃。
        }else{
            return LocalTransactionState.UNKNOW; // 返回UNKNOWN状态的消息会由Broker过一段时间再来回查事务的状态。
        }
    }
}
```

消息的消费者：

```java
public class Consumer {
    public static void main(String[] args) throws MQClientException {
        DefaultMQPushConsumer consumer = new DefaultMQPushConsumer("TransactionConsumer");
        consumer.setNamesrvAddr("1.15.141.218:9876");
        consumer.setConsumeFromWhere(ConsumeFromWhere.CONSUME_FROM_LAST_OFFSET);
        consumer.subscribe("TransactionTopicTest", "*");
        consumer.registerMessageListener(new MessageListenerOrderly() {
            @Override
            public ConsumeOrderlyStatus consumeMessage(List<MessageExt> msgs, ConsumeOrderlyContext context) {
                context.setAutoCommit(true);
                for(MessageExt msg:msgs){
                    System.out.println("收到消息内容 "+new String(msg.getBody()));
                }
                return ConsumeOrderlyStatus.SUCCESS;
            }
        });
        consumer.start();
    }

}
```

控制台输出：

```
收到消息内容 TagA Hello RocketMQ 0
收到消息内容 TagA Hello RocketMQ 5
收到消息内容 TagC Hello RocketMQ 2
收到消息内容 TagC Hello RocketMQ 7
```

会先输出TagA的内容，过一会再出输出TagC的内容，符合预期场景。

![image-20230515104503530](http://img.zouyh.top/article-img/20240917135118381.png)

事务消息机制的关键是在发送消息时，会将消息转为一个half半消息，并存入RocketMQ内部的一个 RMQ_SYS_TRANS_HALF_TOPIC 这个Topic，这样对消费者是不可见的。再经过一系列事务检查通过后，再将消息转存到目标Topic，这样对消费者就可见了。

### 二，整合SpringBoot

创建SpringBoot项目，引入jar包

```xml
<dependency>
	<groupId>org.apache.rocketmq</groupId>
	<artifactId>rocketmq-spring-boot-starter</artifactId>
	<version>2.1.1</version>
</dependency>
```

引入配置信息：

```properties
# NameServer地址
rocketmq.name-server = 1.15.141.218:9876
# 默认的消息生产者组
rocketmq.producer.group = springBootGroup
```

#### 2.1 消息的发送

##### 2.1.1 单向发送消息

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class SpringRocketTest {
    @Resource
    private RocketMQTemplate rocketMQTemplate;
	@Test
    public void sendMessageTest(){
        // 单项发送消息
        rocketMQTemplate.sendOneWay("springBootTopic","Hello, World!");
        
    }
}
```

##### 2.1.2 同步发送消息

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class SpringRocketTest {
    @Resource
    private RocketMQTemplate rocketMQTemplate;
	@Test
    public void sendMessageTest(){
        // 同步发送消息
        SendResult sendResult = rocketMQTemplate.syncSend(springTopic, "Hello, World!");
    }
}
```

##### 2.1.3 异步发送消息

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class SpringRocketTest {
    @Resource
    private RocketMQTemplate rocketMQTemplate;
	@Test
    public void sendMessageTest(){
         rocketMQTemplate.asyncSend("springBootTopic", "Hello, World!", new SendCallback() {
            @Override
            public void onSuccess(SendResult sendResult) {
                System.out.println("发送成功！");
            }

            @Override
            public void onException(Throwable throwable) {
                System.out.println("发送失败！");
            }
        });
    }
}
```

##### 2.1.4 sendAndReceive方法

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class SpringRocketTest {
    @Resource
    private RocketMQTemplate rocketMQTemplate;
	@Test
    public void sendMessageTest(){
         // 同步发送消息并且返回一个String类型的结果。
        String replyString = rocketMQTemplate.sendAndReceive("springBootTopic", "request string", String.class);
     
        
        // 同步发送消息并且返回一个Byte数组类型的结果。
        byte[] replyBytes = rocketMQTemplate.sendAndReceive("springBootTopic", MessageBuilder.withPayload("request byte[]").build(), byte[].class, 3000);
       
         // 同步发送一个带hash参数的请求(排序消息)，并返回一个User类型的结果
        User requestUser = new User().setUserAge((byte) 9).setUserName("requestUserName");
        User replyUser = rocketMQTemplate.sendAndReceive("springBootTopic", requestUser, User.class, "order-id");
    
        // 同步发送一个带延迟级别的消息(延迟消息)，并返回一个泛型结果
        ProductWithPayload<String> replyGenericObject = rocketMQTemplate.sendAndReceive("springBootTopic", "request generic",
                new TypeReference<ProductWithPayload<String>>() {
                }.getType(), 30000, 2);
        
        // 异步发送消息，返回String类型结果。
        rocketMQTemplate.sendAndReceive("springBootTopic", "request string", new RocketMQLocalRequestCallback<String>() {
            @Override public void onSuccess(String message) {
                System.out.printf("send %s and receive %s %n", "request string", message);
            }

            @Override public void onException(Throwable e) {
                e.printStackTrace();
            }
        });
        // 异步发送消息，并返回一个User类型的结果。
        rocketMQTemplate.sendAndReceive("springBootTopic", new User().setUserAge((byte) 9).setUserName("requestUserName"), new RocketMQLocalRequestCallback<User>() {
            @Override public void onSuccess(User message) {
               
            }
            @Override public void onException(Throwable e) {
                e.printStackTrace();
            }
        }, 5000);
    }
}
```





#### 2.2 消息的接收

```java
@Component
@RocketMQMessageListener(consumerGroup = "springBootConsumerGroup", topic = "springBootTopic",consumeMode= ConsumeMode.CONCURRENTLY,messageModel = MessageModel.BROADCASTING)
// consumerGroup: 消费者组；
// topic：订阅的主题；consumeMode：
// ConsumeMode(同时模式),ORDERLY(顺序模式)
// messageModel：CLUSTERING(集群模式模式),BROADCASTING(广播模式)
public class SpringConsumer implements RocketMQListener<String> {
    @Override
    public void onMessage(String message) {
        System.out.println("Received message : "+ message);
    }
}
```

#### 2.3 顺序消息

消息的生产者：

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class SpringRocketTest {
    @Resource
    private RocketMQTemplate rocketMQTemplate;
	@Test
    public void sendMessageTest(){
        // 参数一：topic   如果想添加tag,可以使用"topic:tag"的写法
        // 参数二：消息内容
        // 参数三：hashKey 用来计算决定消息发送到哪个消息队列
        
        // 单向
        rocketMQTemplate.sendOneWayOrderly("springBootTopic","Hello, World!","hashKey"); 
        // 同步
        SendResult sendResult = rocketMQTemplate.syncSendOrderly("springBootTopic", "Hello, World!","hashKey"); 
        // 异步
        rocketMQTemplate.asyncSendOrderly("springBootTopic", "Hello, World!", "hashKey", new SendCallback() {
            @Override
            public void onSuccess(SendResult sendResult) {
                System.out.println("发送成功！");
            }

            @Override
            public void onException(Throwable throwable) {
                System.out.println("发送失败！");
            }
        });
    }
}
```

消息的消费者：`consumeMode= ConsumeMode.ORDERLY`

```java
@Component
@RocketMQMessageListener(consumerGroup = "springBootConsumerGroup", topic = "springBootTopic",consumeMode= ConsumeMode.ORDERLY) 
// consumeMode：ConsumeMode(同时模式),ORDERLY(顺序模式)
public class SpringConsumer implements RocketMQListener<String> {
    @Override
    public void onMessage(String message) {
        System.out.println("Received message : "+ message);
    }
}
```

#### 2.4 广播消息

在集群状态 `MessageModel.CLUSTERING`下，每一条消息只会被同一个消费者组中的一个实例消费到，这跟 kafka和rabbitMQ的集群模式是一样的，而广播模式`MessageModel.BROADCASTING`则是把消息发给了所有订阅了对应主题的消费者，而不管消费者是不是同一个消费者组。

消息的生产者和普通的没什么区别，消息的消费者如下：

```java
@Component
@RocketMQMessageListener(consumerGroup = "springBootConsumerGroup", topic = "springBootTopic",consumeMode= ConsumeMode.CONCURRENTLY,messageModel = MessageModel.BROADCASTING)
// messageModel：CLUSTERING(集群模式模式),BROADCASTING(广播模式)
public class SpringConsumer implements RocketMQListener<String> {
    @Override
    public void onMessage(String message) {
        System.out.println("Received message : "+ message);
    }
}
```

#### 2.5 批量消息

批量发送消息能显著提高传递消息的性能。限制是这些批量消息应该有相同的topic，而且不能是延时消息。此外，这一批消息的总大小不应超过4MB，如果超过可以有2种处理方案：

- 将消息进行切割成多个小于4M的内容进行发送

- 修改4M的限制改成更大，可以设置Producer的maxMessageSize属性，修改配置文件中的maxMessageSize属性。

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class SpringRocketTest {
    @Resource
    private RocketMQTemplate rocketMQTemplate;
	@Test
    public void sendMessageTest(){
        sList<Message<String>> messageList = new ArrayList<>();
        for(int i=0;i<10;i++){
            messageList.add(MessageBuilder.withPayload("批量消息"+(i+1)).build());
        }
        //参数一：topic 如果想添加tag,可以使用"topic:tag"的写法
        //参数二：消息内容
        SendResult sendResult = rocketMQTemplate.syncSend("springBootTopic",messageList);
        System.out.println(sendResult);
    }
}
```

如果发送的消息大于4M：

```java
class ListSplitter implements Iterator<List<Message>> {
    private int sizeLimit = 1000 * 1000;
    private final List<Message> messages;
    private int currIndex;

    public ListSplitter(List<Message> messages) {
        this.messages = messages;
    }

    @Override
    public boolean hasNext() {
        return currIndex < messages.size();
    }

    @Override
    public List<Message> next() {
        int nextIndex = currIndex;
        int totalSize = 0;
        for (; nextIndex < messages.size(); nextIndex++) {
            Message message = messages.get(nextIndex);
            int tmpSize = message.getTopic().length() + message.getBody().length;
            Map<String, String> properties = message.getProperties();
            for (Map.Entry<String, String> entry : properties.entrySet()) {
                tmpSize += entry.getKey().length() + entry.getValue().length();
            }
            tmpSize = tmpSize + 20; 
            if (tmpSize > sizeLimit) {
                if (nextIndex - currIndex == 0) {
                    nextIndex++;
                }
                break;
            }
            if (tmpSize + totalSize > sizeLimit) {
                break;
            } else {
                totalSize += tmpSize;
            }

        }
        List<Message> subList = messages.subList(currIndex, nextIndex);
        currIndex = nextIndex;
        return subList;
    }

    @Override
    public void remove() {
        throw new UnsupportedOperationException("Not allowed to remove");
    }
}
```



```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class SpringRocketTest {
    @Resource
    private RocketMQTemplate rocketMQTemplate;
	@Test
    public void sendMessageTest(){
       List<Message> messageList = new ArrayList<>();
        for(int i=0;i<1000;i++){
            byte[] bytes = (("批量消息"+i).getBytes(CharsetUtil.UTF_8));
            messageList.add(new Message("message-topic-batch","tag"+i,bytes));
        }
        // 切割消息,把大的消息分裂传给你若干个小的消息
        ListSplitter splitter = new ListSplitter(messageList);
        while(splitter.hasNext()){
            List<Message> listItem = splitter.next();
            // 发送消息
            //参数一：topic 如果想添加tag,可以使用"topic:tag"的写法
            //参数二：消息内容
            SendResult sendResult = rocketMQTemplate.syncSend("springBootTopic",messageList,6000);
            System.out.println(sendResult);
        }
    }
}
```

#### 2.6 过滤消息

##### 2.6.1 TagFilter

消息的生产者：

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class SpringRocketTest {
    @Resource
    private RocketMQTemplate rocketMQTemplate;
	@Test
    public void sendMessageTest(){
       String[] tags = new String[] {"TagA", "TagB", "TagC"};
        for (int i = 0; i < 15; i++) {
            String tag = tags[i % tags.length];
            rocketMQTemplate.syncSend("TagFilterTopic:"+tag,tag+"-Hello world");
        }
    }
}
```

消息的消费者：

```java
@Component
@RocketMQMessageListener(consumerGroup = "TagFilterConsumerGroup", topic = "TagFilterTopic"
        ,consumeMode= ConsumeMode.CONCURRENTLY
        ,messageModel = MessageModel.CLUSTERING
        ,selectorExpression = "TagA || TagC"
        ,selectorType = SelectorType.TAG
)
// selectorExpression: tag表达式；selectorType：表达式类型TAG和SQL92
public class SpringConsumer implements RocketMQListener<String> {
    @Override
    public void onMessage(String message) {
        System.out.println("收到消息内容 "+ message);
    }
}
```

控制台输出：

```
收到消息内容 TagA-Hello world
收到消息内容 TagC-Hello world
收到消息内容 TagC-Hello world
收到消息内容 TagC-Hello world
收到消息内容 TagA-Hello world
收到消息内容 TagC-Hello world
收到消息内容 TagA-Hello world
收到消息内容 TagA-Hello world
收到消息内容 TagC-Hello world
收到消息内容 TagA-Hello world
```

可以看出输出收到的消息是TagA和TagC，TagB是没有接收到的。

##### 2.6.2 SqlFilter

消息的生产者：

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class SpringRocketTest {
    @Resource
    private RocketMQTemplate rocketMQTemplate;
	@Test
    public void sendMessageTest(){
        String[] tags = new String[] {"TagA", "TagB", "TagC"};
        for (int i = 0; i < 15; i++) {
            String tag = tags[i % tags.length];
            Map<String,Object> headers = new HashMap<>();//设置消息的属性（header）信息
            headers.put("otherProperty", String.valueOf(i));
            rocketMQTemplate.convertAndSend("SqlFilterTopic:"+tag,tag+" - Hello RocketMQ - " + i,headers);
        }
    }
}
```

消息的消费者：

```java
@Component
@RocketMQMessageListener(consumerGroup = "SqlFilterConsumerGroup", topic = "SqlFilterTopic"
        ,consumeMode= ConsumeMode.CONCURRENTLY
        ,messageModel = MessageModel.BROADCASTING
        ,selectorExpression = "(TAGS is not null and TAGS in ('TagA', 'TagB'))" +
        "and (otherProperty is not null and otherProperty between 0 and 3)"
        ,selectorType = SelectorType.SQL92
)
// selectorExpression: tag表达式；selectorType：表达式类型TAG和SQL92
public class SpringConsumer implements RocketMQListener<String> {
    @Override
    public void onMessage(String message) {
        System.out.println("收到消息内容 "+ message);
    }
}
```

控制台输出：

```
收到消息内容 TagB - Hello RocketMQ - 1
收到消息内容 TagA - Hello RocketMQ - 3
收到消息内容 TagA - Hello RocketMQ - 0
```

#### 2.7 延迟消息

延迟消息实现的效果就是在调用producer.send方法后，消息并不会立即发送出去，而是会等一 段时间再发送出去。这是RocketMQ特有的一个功能。 那会延迟多久呢？延迟时间的设置就是在Message消息对象上设置一个延迟级别` message.setDelayTimeLevel(3);`开源版本的RocketMQ中，对延迟消息并不支持任意时间的延迟设定(商业版本中支持)，而是只支 持18个固定的延迟级别，1到18分别对应`1s 5s 10s 30s 1m 2m 3m 4m 5m 6m 7m 8m 9m 10m 20m 30m 1h 2h`。

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class SpringRocketTest {
    @Resource
    private RocketMQTemplate rocketMQTemplate;
	@Test
    public void sendMessageTest(){
      for (int i = 0; i < 100; i++) {
            // 参数一：topi，参数二：消息，参数三：超时时间，参数四：延迟级别
            rocketMQTemplate.syncSend("ScheduledTopic",MessageBuilder.withPayload("Hello"+i).build(),2000,3);
        }
    }
}
```

#### 2.8 事务消息

事务消息主要和消息的生产者有关：

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class SpringRocketTest {
    @Resource
    private RocketMQTemplate rocketMQTemplate;
	@Test
    public void sendMessageTest(){
        String[] tags = new String[] {"TagA", "TagB", "TagC", "TagD", "TagE"};
        for (int i = 0; i < 10; i++) {
            String tag =  tags[i % tags.length];
            rocketMQTemplate.sendMessageInTransaction("TransactionTopic:"+tag,MessageBuilder.withPayload(tag + " Hello RocketMQ " + i).build(),null);
        }
    }
}
```

TransactionListener事务监听器：

```java
@RocketMQTransactionListener
public class TransactionMsgListener implements RocketMQLocalTransactionListener {
    @Override
    public RocketMQLocalTransactionState executeLocalTransaction(Message message, Object o) {
        String tag = (String) message.getHeaders().get("rocketmq_TAGS");
        if(StringUtils.contains(tag,"TagA")){
            return RocketMQLocalTransactionState.COMMIT; // 返回COMMIT状态的消息会立即被消费者消费到
        }else if(StringUtils.contains(tag,"TagB")){
            return RocketMQLocalTransactionState.ROLLBACK; // 返回ROLLBACK状态的消息会被丢弃。
        }else{
            return RocketMQLocalTransactionState.UNKNOWN; // 返回UNKNOWN状态的消息会由Broker过一段时间再来回查事务的状态。
        }
    }

    @Override
    public RocketMQLocalTransactionState checkLocalTransaction(Message message) {
        String tag = (String) message.getHeaders().get("rocketmq_TAGS");
        if(StringUtils.contains(tag,"TagC")){
            return RocketMQLocalTransactionState.COMMIT; // 返回COMMIT状态的消息会立即被消费者消费到
        }else if(StringUtils.contains(tag,"TagD")){
            return RocketMQLocalTransactionState.ROLLBACK; // 返回ROLLBACK状态的消息会被丢弃。
        }else{
            return RocketMQLocalTransactionState.UNKNOWN; // 返回UNKNOWN状态的消息会由Broker过一段时间再来回查事务的状态。
        }
    }
}
```

消息的消费者：

```java
@Component
@RocketMQMessageListener(consumerGroup = "TransactionConsumerGroup", topic = "TransactionTopic",consumeMode= ConsumeMode.CONCURRENTLY,messageModel = MessageModel.BROADCASTING)
public class SpringConsumer implements RocketMQListener<String> {
    @Override
    public void onMessage(String message) {
        System.out.println("收到消息内容 "+ message);
    }
}
```

控制台输出：

```
收到消息内容 TagA Hello RocketMQ 0
收到消息内容 TagA Hello RocketMQ 5
收到消息内容 TagC Hello RocketMQ 2
收到消息内容 TagC Hello RocketMQ 7
```

会先输出TagA的内容，过一会再出输出TagC的内容，符合预期场景。
