---
icon: file-lines
# 标题
title: '一篇搞定nignx'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-14
# 一个页面可以有多个分类
category:
  - Nginx
# 一个页面可以有多个标签
tag:
  - 进阶
  - Nginx
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，nginx的配置文件

<img src="http://img.zouyh.top/article-img/20240917135104336.png" alt="image-20230328151550458" style="zoom:80%;" />

- work_processes：是 Nginx 服务器并发处理服务的关键配置，worker_processes 值越大，可以支持的并发处理量也越多，但是 会受到硬件、软件等设备的制约。
- events：主要影响Nginx 服务器与用户的网络连接，常用的设置包括是否开启对多 work process 下的网络连接进行序列化，是否允许同时接收多个网络连接，选取哪种事件驱动模型来处理连接请求，每个 word process 可以同时支持的最大连接数等。
- http ：是 Nginx 服务器配置中最频繁的部分，代理、缓存和日志定义等绝大多数功能和第三方模块的配置都在这里。
- server ： 每个 http 块可以包括多个 server 块，而每个 server 块就相当于一个虚拟主机。 最常见的配置是本虚拟机主机的监听配置和本虚拟主机的名称或IP配置
- location 块：  一个 server 块可以配置多个 location 块， 这块的主要作用是基于 Nginx  服务器接收到的请求字符串。

### 二，反向代理

#### 2.1 概念

正向代理: Nginx 不仅可以做反向代理，实现负载均衡，还能用作正向代理来进行上网等功能。 如果你想直接访问Google服务器，是不可能的，我们通常是通过代理服务器实现的，如下图：

<img src="http://img.zouyh.top/article-img/20240917135105339.png" alt="image-20230327180502490" style="zoom:80%;" />

反向代理：其实客户端对代理是无感知的，因为客户端不需要任何配置就可以访问，我们只需要将请求发送到反向代理服务器，由反向代理服务器去选择目标服务器获取数据后，在返回给客户端，此时反向代理服务器和目标服务器对外就是一个服务器，暴露的是代理服务器 地址，隐藏了真实服务器 IP 地址。

<img src="http://img.zouyh.top/article-img/20240917135104338.png" alt="image-20230327181052945" style="zoom:80%;" />

正向代理和反向代理对比：

- 正向代理，是访问目标服务器ip，需要在客服端上配置代理服务器；
- 反向代理，访问的是代理服务器ip，客户端对代理是无感知的，因为客户端不需要任何配置

#### 2.2 实现配置

**实验效果**：使用 nginx 反向代理，根据访问的路径跳转到不同端口的服务中

访问 `http://127.0.0.1:80/edu/` 直接跳转到 `127.0.0.1:8081 `

访问 `http://127.0.0.1:80/vod/ `直接跳转到 `127.0.0.1:8082 `

**实验步骤**

第一步，准备两个 tomcat，一个 8081 端口，一个 8082端口，并准备好测试的页面 .

第二步，修改 nginx 的配置文件 在 http 块中添加 server{} 

```nginx
server {
    listen	80;
    server_name  127.0.0.1;
    location ~ /edu/ {
    	proxy_pass  http://127.0.0.1:8081
    }

    location ~ /vod/ {
   	 	proxy_pass  http://127.0.0.1:8082 
    }
}    
```

- `listen	80`：监听端口80 即当访问服务器的端口是80时，进入这个server块处理
-  `server_name`：当配置了listen时不起作用   
- `location`：后面是访问路径当是/ 请求代理到tomcat的地址
- `proxy_pass`：使用代理的固定写法，后面跟要代理服务器地址            

第三步，刷新配置并启动。

**补充**：location 指令用于匹配 URL，  语法如下： 

```
location [ = | ~ | ~* | ^~] uri {
}
```

- `= `：用于不含正则表达式的 uri 前，要求请求字符串与 uri 严格匹配，如果匹配成功，就停止继续向下搜索并立即处理该请求
- `~`：用于表示 uri 包含正则表达式，并且区分大小写
- `~*`：用于表示 uri 包含正则表达式，并且不区分大小写
- `^~`：用于不含正则表达式的 uri 前，要求 Nginx 服务器找到标识 uri 和请求。字符串匹配度最高的 location 后，立即使用此 location 处理请求，而不再使用 location块中的正则 uri 和请求字符串做匹配

### 三，负载均衡

#### 3.1 概念

​	访问量和并发量特别大的时候，单个服务器解决不了，我们增加服务器的数量，然后将请求分发到各个服务器上，将原先请求集中到单个服务器上的情况改为将请求分发到多个服务器上，将负载分发到不同的服务器，也就是我们所说的负载均衡。

<img src="http://img.zouyh.top/article-img/20240917135105340.png" alt="image-20230328104403279" style="zoom: 80%;" />

#### 3.2 实现配置

**实验效果**：使用 nginx 负载均衡，根据相同路径轮询跳转到不同端口的同一个服务中

访问 `http://127.0.0.1:80/ `直接跳转到 `127.0.0.1:8081`或`127.0.0.1:8082`

**实验步骤：**

第一步，准备两个 tomcat服务，一个 8081 端口，一个 8082端口，并准备好测试的页面 .

第二步，修改 nginx 的配置文件 在 http 块中添加 server{} 

```nginx
upstream tomcats {
    server 127.0.0.1:8081;
    server 127.0.0.1:8082;
}
server {
        listen	80;
        server_name	127.0.0.1;
        location / {
    		proxy_pass http://tomcats;
		}
}
```

第三步，刷新配置并启动。

**补充：**和反向代理的配置相比，代理的地址改变了，变成了upstream对应的值。

#### 3.3 负载策略

##### 3.3.1 轮询

 		轮询：默认使用的是轮询策略，每个请求按时间顺序逐一分配到不同的后端服务器，如果后端服务器 down掉，能自动剔，轮询策略其实是一个特殊的加权策略，不同的是，服务器组中的各个服务器的权重都是1。

```nginx
upstream server的名字{
    server 真实项目的ip+端口号;
    server 真实项目的ip+端口号;
    server 真实项目的ip+端口号;
}
```

##### 3.3.2 加权

weight代表权重默认为 1,权重越高被分配的客户端请求越多。

```nginx
upstream server的名字{
    server 真实项目的ip+端口号 weight = 5;
    server 真实项目的ip+端口号 weight = 3;
    server 真实项目的ip+端口号 weight = 10;
}
```

##### 3.3.3 least_conn

最少连接，把请求转发给连接数最少的服务器。

```nginx
upstream server的名字{
    server 真实项目的ip+端口号;
    server 真实项目的ip+端口号;
    server 真实项目的ip+端口号;
    least_conn;
}
```

##### 3.3.4 ip_hash 

ip_hash :每个请求按访问 ip 的 hash 结果分配，这样每个访客会固定访问一个后端服务器，这个可以解决session共享问题。

```nginx
upstream server的名字{
    ip_hash;
    server 真实项目的ip+端口号;
    server 真实项目的ip+端口号;
    server 真实项目的ip+端口号;
}
```

##### 3.3.5 url_hash 

url_hash 和 ip_hash 类似，不同的是，客户端ip可能变，但客户端发送的请求URL不同功能模块虽说不同，但同一个功能点的URL是固定不变的

```nginx
upstream server的名字{
    hash $request_uri;
    server 真实项目的ip+端口号;
    server 真实项目的ip+端口号;
    server 真实项目的ip+端口号;hash $request_uri;
}
```

##### 3.3.6 fair

fair（第三方）：按后端服务器的响应时间来分配请求，响应时间短的优先分配

```nginx
upstream server的名字{
    server 真实项目的ip+端口号;
    server 真实项目的ip+端口号;
    server 真实项目的ip+端口号;
    fair;
}
```

注： 该策略，在nginx的默认模块中是不支持的，需要下载 nginx-upstream-fair 模块

### 四 ，动静分离

#### 4.1 概念

为了加快网站的解析速度，可以把动态页面和静态页面由不同的服务器来解析，加快解析速 度。降低原来单个服务器的压力。

<img src="http://img.zouyh.top/article-img/20240917135104337.png" alt="image-20230328112408571" style="zoom:80%;" />

Nginx 动静分离简单来说就是把动态跟静态请求分开，不能理解成只是单纯的把动态页面和静态页面物理分离。严格意义上说应该是动态请求跟静态请求分开，可以理解成使用 Nginx 处理静态页面，Tomcat 处理动态页面。动静分离从目标实现角度来讲大致分为两种， 

- 一种是纯粹把静态文件独立成单独的域名，放在独立的服务器上，也是目前主流推崇的方案。
- 另外一种方法就是动态跟静态文件混合在一起发布，通过 nginx 来分开。

#### 4.2 实现配置

第一步：在nginx根目录“/”下创建一个data文件夹，在data文件夹下创建两个文件夹，一个名为request，另一个名为static；在request文件夹中放置一个静态的html，在static文件夹中放置一个图片。

第二步，修改 nginx 的配置文件，在http的server的块中添加location块

```nginx
location /request {    
  root /data/;
  index index.html index.htm;
} 
location /static {    
  root /data/;
  autoindex on;
}    
```

`index` 访问`http://ip:port/`地址后面如果不添加任何内容，则默认依次访问index.html或index.htm。

` autoindex on`  作用是访问问价夹时可以以列表的方式展示文件

