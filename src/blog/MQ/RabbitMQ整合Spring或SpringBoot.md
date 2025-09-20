---
icon: file-lines
title: RabbitMQ整合Spring或SpringBoot
author: Ms.Zyh
date: 2023-09-14
category:
  - MQ
tag:
  - 推荐
  - MQ
sticky: false
star: false
---

### 一，RabbitMQ整合Spring

#### 1.1 引入基础配置

第一步：引入Spring整合RabbitMQ的jar包：

```xml
<dependency>
	<groupId>org.springframework.amqp</groupId>
	<artifactId>spring-rabbit</artifactId>
	<version>2.1.8.RELEASE</version>
</dependency>
```

第二步：引入RabbitMQ的机器信息，在resources文件夹下创建rabbitmq.properties文件，并添加如下信息：

```properties
rabbitmq.host=1.15.141.21
rabbitmq.port=5672
rabbitmq.username=guest
rabbitmq.password=guest
rabbitmq.virtual-host=/
```

第三步：在resources文件夹下创建spring-rabbitmq.xml文件，并添加如下信息：

```xml
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:rabbit="http://www.springframework.org/schema/rabbit"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
       http://www.springframework.org/schema/beans/spring-beans.xsd
       http://www.springframework.org/schema/context
       https://www.springframework.org/schema/context/spring-context.xsd
       http://www.springframework.org/schema/rabbit
       http://www.springframework.org/schema/rabbit/spring-rabbit.xsd">
    <!-- 加载上一步配置文件-->
    <context:property-placeholder location="classpath:rabbitmq.properties"/>
     <!-- 定义rabbitTemplate对象操作可以在代码中方便发送消息-->
    <rabbit:template id="rabbitTemplate" connection-factory="connectionFactory"/>
    
</beans>
```

#### 1.2 队列

spring-rabbitmq.xml文件中添加如下内容

```xml
<!--
	id：bean的名称
	name：queue的名称
	exclusive：是否私有化，false(默认)所有消费者都可以访问，true第一拥有她的消费者可以一直访问
	auto-declare:自动创建
	auto-delete:自动删除，最后一个消费者和该队列断开连接后，自动删除队列，false(默认)
	durable：是否持久化，false(默认)
-->
 <rabbit:queue id="spring_queue" name="spring_queue" exclusive="false" auto-delete="false" durable="false" auto-declare="true"/>

<!--
	如果还想配置其它参数可以通过如下方式，一般上面的方式就可以了，下面的方式一般设置死信息队列交换机等信息会使用
-->
<rabbit:queue name="spring_queue_other_params" id="spring_queue_other_params">
	<rabbit:queue-arguments>
		<entry key="k1" value="value1" />
		<entry key="k2" value="value2" />
	</rabbit:queue-arguments>
</rabbit:queue>
```

#### 1.3 交换机

在resources文件夹下创建spring-rabbitmq.xml文件，并添加如下信息：

```xml
<!-- fanout类型交换机器 -->
<rabbit:fanout-exchange id="spring_fanout_exchange" name="spring_fanout_exchange"  auto-declare="true">
	<rabbit:bindings>
		<rabbit:binding queue="spring_fanout_queue_1"  />
		<rabbit:binding queue="spring_fanout_queue_2"/>
	</rabbit:bindings>
</rabbit:fanout-exchange>

<!-- direct类型交换机器 -->
<rabbit:direct-exchange name="spring_direct_exchange" >
	<rabbit:bindings>
		<rabbit:binding queue="spring_direct_queue_1" key="info"/>
        <rabbit:binding queue="spring_direct_queue_2" key="error"/>
	</rabbit:bindings>
</rabbit:direct-exchange>

<!-- topic类型交换机器 -->
<rabbit:topic-exchange name="spring_topic_exchange">
	<rabbit:bindings>
		<rabbit:binding queue="spring_topic_queue_1" pattern="info.#"/>
        <rabbit:binding queue="spring_topic_queue_1" pattern="error.#"/>
	</rabbit:bindings>
</rabbit:topic-exchange>
```

#### 1.4 生产者发送消息

```java
@RunWith(SpringJUnit4ClassRunner.class)
@ContextConfiguration(locations = "classpath:spring-rabbitmq.xml")
public class ProducerTest {
    //1.注入 RabbitTemplate
    @Autowired
    private RabbitTemplate rabbitTemplate;
	@Test
    public void testSend(){
        //2.发送消息
        // 简单模式和工作模式
        rabbitTemplate.convertAndSend("spring_queue","hello world spring....");
        // fanout类型交换机器
        rabbitTemplate.convertAndSend("spring_fanout_exchange","","spring fanout....");
        // direct类型交换机器
        rabbitTemplate.convertAndSend("spring_direct_exchange","info","spring Direct....");
        // topic类型交换机器
        rabbitTemplate.convertAndSend("spring_topic_exchange","info.sql","spring topic....");
    }
}
```

#### 1.5 消费者消费消息

实现MessageListener接口

```java
public class SpringQueueListener implements MessageListener {
    @Override
    public void onMessage(Message message) {
        //打印消息
        System.out.println(new String(message.getBody()));
    }
}
```

spring-rabbitmq.xml配置文件，添加如下内容：

```java
<!-- 将上面实现MessageListener接口的监听交给spring -->
<bean id="springQueueListener" class="com.baiqi.rabbitmq.listener.SpringQueueListener"/>
<!-- 注册监听器，并表明监听的是那个队列 -->
<rabbit:listener-container connection-factory="connectionFactory" auto-declare="true">
   <rabbit:listener ref="springQueueListener" queue-names="spring_queue"/>
</rabbit:listener-container>
```

带有交换机的写法也是一样的，只是监听的队列不一样。

### 二，RabbitMQ整合SpringBoot

#### 2.1 引入基础配置

第一步：引入SpringBoot整合RabbitMQ的jar包：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

第二步：引入RabbitMQ的机器信息，在resources文件夹下的application.properties文件中添加如下信息：

```properties
spring.rabbitmq.host=1.15.141.21
spring.rabbitmq.port=5672
spring.rabbitmq.username=guest
spring.rabbitmq.password=guest
spring.rabbitmq.addresses=1.15.141.21
spring.rabbitmq.virtual-host=/
```

由于SpringBoot自动装配的特性，当我们完成jar的导入和信息的填写，SpringBoot就会为我们自动装配RabbitMQ。

#### 2.2 队列

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

#### 2.3 交换机

fanout类型交换机器:

```java
@Configuration
public class FanoutConfig {
	//声明队列
	@Bean
	public Queue fanoutQ1() {
		return new Queue("springboot_fanout_queue_1");
	}
	@Bean
	public Queue fanoutQ2() {
		return new Queue("springboot_fanout_queue_2");
	}

	//声明exchange
	@Bean
	public FanoutExchange setFanoutExchange() {
		return new FanoutExchange("springboot_fanout_exchange");
	}

	//声明Binding,exchange与queue的绑定关系
	@Bean
	public Binding bindQ1() {
		return BindingBuilder.bind(fanoutQ1()).to(setFanoutExchange());
	}
	@Bean
	public Binding bindQ2() {
		return BindingBuilder.bind(fanoutQ2()).to(setFanoutExchange());
	}

}
```

direct类型交换机器：

```java
@Configuration
public class DirectConfig {
	//声明队列
	@Bean
	public Queue directQ1() {
		return new Queue("springboot_direct_queue_1");
	}
	@Bean
	public Queue directQ2() {
		return new Queue("springboot_direct_queue_2");
	}
	//声明exchange
	@Bean
	public DirectExchange setDirectExchange() {
		return new DirectExchange("springboot_direct_exchange");
	}
	//声明binding，需要声明一个routingKey
	@Bean
	public Binding bindDirectBind1() {
		return BindingBuilder.bind(directQ1()).to(setDirectExchange()).with("china.changsha");
	}
	@Bean
	public Binding bindDirectBind2() {
			return BindingBuilder.bind(directQ2()).to(setDirectExchange()).with("china.beijing");
	}

}
```

topic类型交换机器：

```java
@Configuration
public class TopicConfig {
	//声明队列
	@Bean
	public Queue topicQ1() {
		return new Queue("springboot_topic_queue_1");
	}
	@Bean
	public Queue topicQ2() {
		return new Queue("springboot_topic_queue_2");
	}
	//声明exchange
	@Bean
	public TopicExchange setTopicExchange() {
		return new TopicExchange("springboot_topic_exchange");
	}

	//声明binding，需要声明一个roytingKey
	@Bean
	public Binding bindTopicHebei1() {
		return BindingBuilder.bind(topicQ1()).to(setTopicExchange()).with("changsha.*");
	}
	@Bean
	public Binding bindTopicHebei2() {
		return BindingBuilder.bind(topicQ2()).to(setTopicExchange()).with("#.beijing");
	}

}
```

#### 2.4 生产者发送消息

```java
@SpringBootTest
class KfApplicationTests {
	//1.注入 RabbitTemplate
    @Autowired
    private RabbitTemplate rabbitTemplate;
	@Test
    public void testSend(){
        //2.发送消息
        // 简单模式和工作模式
        rabbitTemplate.convertAndSend("springboot_queue","hello world springboot....");
        // fanout类型交换机器
        rabbitTemplate.convertAndSend("springboot_fanout_exchange","","springboot fanout....");
        // direct类型交换机器
        rabbitTemplate.convertAndSend("springboot_direct_exchange","info","springboot Direct....");
        // topic类型交换机器
        rabbitTemplate.convertAndSend("springboot_topic_exchange","info.sql","springboot topic....");
    }
}
```

#### 2.5 消费者消费消息

```java
@Component
public class SpringBootQueueListener {
	//通过@RabbitListener注解监听队列
	@RabbitListener(queues="springboot_queue")
	public void springbootQueue(String message) {
	     System.out.println(message);
	}
}
```

带有交换机的写法也是一样的，只是监听的队列不一样。
