---
icon: file-lines
title: OpenFeign
author: Ms.Zyh
date: 2025-04-08
category:
  - SpringCloud
tag:
  - 常用
  - SpringCloud
sticky: false
star: false
---


Feigen由 Netflix 开发并开源，最初作为 Netflix OSS 的一部分，用于简化 HTTP API 的客户端调用，Netflix Feign 已停止维护，最终版本为 9.x。OpenFeigen由Spring Cloud 团队基于 Feign 开发的增强版，整合到 Spring Cloud 生态中。

### 一，Spring Cloud整合openFeign
#### 第一步：添加依赖
```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-openfeign</artifactId>
</dependency>
<properties>   
    <spring-cloud.version>2021.0.7</spring-cloud.version>  
</properties>
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>${spring-cloud.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

```
#### 第二步：启用Feign客户端
在Spring Boot应用的主类上添加@EnableFeignClients注解，以启用Feign客户端功能
```java
@SpringBootApplication
@EnableFeignClients
public class SpringCloudApplication {
    public static void main(String[] args) {
        SpringApplication.run(SpringCloudApplication.class, args);
    }
}
```
#### 第三步：定义接口
规范的使用方式，在项目中再创建一个module -> Generators -> Maven Archetype:
| 配置|  说明|  值|
| :- | :- |:- |
|name|模块名称|api|
|JDK|JDK版本|1.8|
|Archetype| 快捷框架 |org.apache.maven.archetypes:maven-archetype-quickstart|
然后在新创建api模块中定义接口：
```java
@FeignClient(name = "open-feign", url = "http://localhost:8383",path = "/openFeign")
public interface OpenFeignApi {
    @GetMapping("/interfaceOne")
    String interfaceOne();
    @GetMapping("/interfaceTwo")
    String interfaceTwo(@RequestParam("param")String param);
}
```
定义完成接口，可以打成jar包，然后上传到maven仓库。
@FeignClient注解详细介绍：
\参数\说明\
\:-\:-\
\name/value\在服务注册中心注册的名称\
\ url\于非服务发现场景，如调用外部 API\
\ path\定义接口的公共路径前缀\
\ configuration\指定自定义的配置类\
\ fallback|异常处理方法|
| fallbackFactory | 通过工厂类生成 fallback 实例|
@FeignClient的fallback是在Feign客户端中定义的，通常用于处理服务调用失败的情况，比如服务提供者宕机或者网络问题。而Sentinel的fallback是用于处理流量控制、熔断等场景下的降级策略

#### 第四步：服务的提供者
在新创建新的项目中，或则在原来的项目中创建controller、service模块，然后引入第三步定义的接口jar
```xml
<dependency>
    <groupId>top.zouyh</groupId>
    <artifactId>api</artifactId>
    <version>0.0.1-SNAPSHOT</version>
</dependency>
```
实现接口通过`@FeignClient`注解声明openFeign服务：
```java
/**
 *
 * @RequestMapping("/openFeign")的值要和OpenFeignApi接的@FeignClient的path保持一致
 */
@RestController
@RequestMapping("/openFeign")
public class OpenFeignController implements OpenFeignApi {
    /**
     * 接口OpenFeignApi的interfaceOne方法写过@GetMapping("interfaceOne")可以再写一遍，但要保证一致
     */
    @Override
    @GetMapping("/interfaceOne")
    public String interfaceOne() {
        return "interfaceOne";
    }
    /**
     * 接口OpenFeignApi的interfaceTwo方法写过@GetMapping("interfaceTwo")可以不写
     */
    @Override
    public String interfaceTwo(@RequestParam("param") String param) {
        return "interfaceTwo,param="+param;
    }
}

```
#### 第四步：服务的消费者
在新创建新的项目中，或则在原来的项目中创建controller、service模块，然后引入第三步定义的接口jar
```xml
<dependency>
    <groupId>top.zouyh</groupId>
    <artifactId>api</artifactId>
    <version>0.0.1-SNAPSHOT</version>
</dependency>
```
直接注入定义的接口：
```java
@RestController
@RequestMapping("/consumer")
public class ConsumerController {
    @Resource
    private OpenFeignApi openFeignApi;

    @RequestMapping("/consumerMethod")
    public String consumerMethod(String param) {
        return "interfaceOne:"+openFeignApi.interfaceOne() + ",interfaceTwo:"+openFeignApi.interfaceTwo(param);
    }

}
```

### 二，openFeign切换OkHttp客户端
OkHttp内置了连接池，可以复用连接，减少握手时间，提升性能。另外，OkHttp支持GZIP压缩，可以自动压缩请求体，减少传输数据的大小，节省带宽。还有，OkHttp有更好的错误处理机制，比如自动重试。
导入相关jar：
```xml
<dependency>
    <groupId>io.github.openfeign</groupId>
    <artifactId>feign-okhttp</artifactId>
</dependency>
```
配置OkHttp：
```java
@Configuration
public class OkHttpConfig {
    @Bean
    public OkHttpClient okHttpClient(){
        return new OkHttpClient.Builder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(5,TimeUnit.SECONDS)
                .writeTimeout(10,TimeUnit.SECONDS)
                .connectionPool(new ConnectionPool(50,5,TimeUnit.MINUTES))
                .addInterceptor(new OkHttpInterceptor())
                .build();
    }

    /**
     * 这个一定要执行否者okHttpClient无法生效，原因是OkHttpFeignConfiguration在spring容器中有OkHttpClient的时候OkHttpFeignConfiguration就不会加载了
     * @param client
     * @return
     */
    @Bean
    public Client feignClient(okhttp3.OkHttpClient client) {
        return new feign.okhttp.OkHttpClient(client);
    }
}
```
添加OkHttpInterceptor拦截器打印日志：
```java
@Slf4j
public class OkHttpInterceptor implements Interceptor {
    @Override
    public Response intercept(Chain chain) throws IOException {
        Request request = chain.request();
        RequestBody requestBody = request.body();

        //copy一份出来，避免把流被消耗完
        Buffer buffer = new Buffer();
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        if (requestBody != null) {
            requestBody.writeTo(buffer);
            buffer.copyTo(outputStream);
            // 重新生成新的request
            RequestBody copiedRequestBody = RequestBody.create(requestBody.contentType(), outputStream.toByteArray());
            request = request
                    .newBuilder()
                    .headers(request.headers())
                    .method(request.method(), copiedRequestBody)
                    .build();
        }

        // 打印请求信息
        traceRequest(request, outputStream.toByteArray());

        // 获得响应信息并打印 返回一个新的Response
        return traceResponseReturnNewResponse(chain.proceed(request));
    }

    private Response copyResponse(Response response, String bodyString) {
        if (response.body() != null) {
            return response.newBuilder()
                    .body(ResponseBody.create(response.body().contentType(), bodyString))
                    .build();
        }
        return response;
    }

    private void traceRequest(Request request, byte[] bytes) {
        log.info("===========================request begin================================================");
        log.info("URI : {}", request.url());
        log.info("Method : {}", request.method());
        log.info("Headers : {}", request.headers());
        log.info("Request body: {}", new String(bytes));
        log.info("==========================request end================================================");
    }

    private Response traceResponseReturnNewResponse(Response response) throws IOException {
        ResponseBody body = response.body();
        // 只能读取一次
        String bodyString = body.string();

        log.info("============================response begin==========================================");
        log.info("Status code : {}", response.code());
        log.info("Status text : {}", response.message());
        log.info("Headers : {}", response.headers());
        log.info("Response body: {}", bodyString);
        log.info("=======================response end=================================================");

        // 需要构建一个新的返回
        return copyResponse(response, bodyString);
    }
}
```
