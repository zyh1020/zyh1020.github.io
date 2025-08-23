---
icon: document
# 标题
title: 'SSL证书安装'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-13
# 一个页面可以有多个分类
category:
  - Nginx
# 一个页面可以有多个标签
tag:
  - 必看
  - Nginx
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一、申请SSL证书
>腾讯官方免费SSL证书申请文档： https://cloud.tencent.com/document/product/400/6814

这个比较简单跟着流程走基本上没问题的，申请的时候需要注意一下字段：
- 免费证书绑定域名：tencent.com只赠送www.tencent.com，不包含ssl.tencent.com，需单独申请；如需绑定泛域名（例如 *.tencent.com）或者绑定IP，请购买付费证书。
- 域名验证方式：手动DNS验证比较简单。

### 二、安装SSL证书

> 腾讯官方文档： https://cloud.tencent.com/document/product/400/35244
 
注意：
- 我踩的坑`-v /root/nginx/ssl:/etc/nginx/ssl/`一定要挂载证书文件啊！
- 建议直接使用如下流程。
第一步：将请在 [SSL 证书控制台](https://console.cloud.tencent.com/ssl) 中选择您需要安装的证书下载后上传服务器，文件夹内容如下：
- `zouyh.top_bundle.crt` 证书文件
- `zouyh.top_bundle.pem` 证书文件
- `zouyh.top.key` 私钥文件
- `zouyh.top.csr` CSR 文件

第二步：新建/nginx/conf.d/ssl.conf配置：
```nginx
server {
     #SSL 默认访问端口号为 443
     listen 443 ssl; 
     #请填写绑定证书的域名
     server_name zouyh.top; 
     #/etc/nginx/ssl 路径是nginx内的不能变
     ssl_certificate /etc/nginx/ssl/zouyh.top_bundle.crt; 
     ssl_certificate_key  /etc/nginx/ssl/zouyh.top.key; 
     ssl_session_timeout 5m;
     #请按照以下协议配置
     ssl_protocols TLSv1.2 TLSv1.3; 
     #请按照以下套件配置，配置加密套件，写法遵循 openssl 标准。
     ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:HIGH:!aNULL:!MD5:!RC4:!DHE; 
     ssl_prefer_server_ciphers on;
	 #把https的域名请求转成http,也可以将
	 return 301 http://$host$request_uri;
 }

```
第三步：改变ngixn的启动命令：
```sh
docker run --name nginx -p 80:80 -p 443:443 \
-v /root/nginx/nginx.conf:/etc/nginx/nginx.conf \
-v /root/nginx/logs/:/var/log/nginx \
-v /root/nginx/html/:/usr/share/nginx/html \
-v /root/nginx/conf.d/:/etc/nginx/conf.d \
-v /root/nginx/ssl:/etc/nginx/ssl/ \
-e TZ=Asia/Shanghai \
--privileged=true \
-d nginx;
```

