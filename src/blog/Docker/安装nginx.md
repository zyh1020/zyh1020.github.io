---
icon: file-lines
# 标题
title: '安装nginx'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-28
# 一个页面可以有多个分类
category:
  - Docker
# 一个页面可以有多个标签
tag:
  - 推荐
  - Docker
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，安装
1，官网搜索：https://hub.docker.com/search/?q=&type=image或者`docker search 关键字`搜索
2，拉取镜像:
```sh
docker pull nginx
```
3，创建临时容器，方便拷贝配置文件：
```sh
docker run --name nginx-temp -p 80:80 -d nginx 
```
将创建临时容器的配置文件拷贝出来：
```sh
mkdir -p /root/nginx
docker cp nginx-temp:/etc/nginx/nginx.conf /root/nginx 
docker cp nginx-temp:/etc/nginx/conf.d /root/nginx 
docker cp nginx-temp:/usr/share/nginx/html /root/nginx 
docker cp nginx-temp:/var/log/nginx /root/nginx/logs 
```


然后删除容器：
```sh
docker stop nginx-temp 
docker rm nginx-temp
```
4，创建正式的nginx容器：
```sh
docker run --name nginx -p 80:80 \
-v /root/nginx/nginx.conf:/etc/nginx/nginx.conf \
-v /root/nginx/logs/:/var/log/nginx \
-v /root/nginx/html/:/usr/share/nginx/html \
-v /root/nginx/conf.d/:/etc/nginx/conf.d \
-e TZ=Asia/Shanghai \
--privileged=true \
-d nginx;
```
注意：前一个80是容器端口不可以改，后一个80宿主机的端口可以改，前一个80是容器端口要改先改配置文件。
5，创建好容器后这里解释一下nginx文件夹中的文件作用：
```
- ngxin
	- cond.d
		- default.conf : nginx配置文件
	- html : html或js静态文件
	- logs : 日志文件夹
	- nginx.conf :  nginx配置文件

```
### 二，nginx配置
nginx.conf 文件内容：
```
user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log notice;
pid        /var/run/nginx.pid;


events {
    worker_connections  1024;
}


http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;
    client_max_body_size 100M;
    sendfile        on;
    #tcp_nopush     on;

    keepalive_timeout  65;

    #gzip  on;

    include /etc/nginx/conf.d/*.conf;
}
```
default.conf 文件内容：
``` 
upstream blog-servers {
        server 43.142.100.77:8081 weight=1;
}
server {
    listen       80;
    server_name  localhost;

    #access_log  /var/log/nginx/host.access.log  main;

    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
                try_files $uri $uri/ /index.html;
    }
	location /api {
	   proxy_pass http://blog-servers;
	   rewrite "^/api/(.*)$" /$1 break;
	}
    error_page   500 502 503 504  /50x.html;
	location = /50x.html {
			root   html;
	}
	gzip on;
	gzip_min_length 2k;
	gzip_buffers 4 16k;
	gzip_http_version 1.0;
	gzip_comp_level 2;
	gzip_types text/plain application/javascript text/css application/xml;
	gzip_vary on;
}
```
