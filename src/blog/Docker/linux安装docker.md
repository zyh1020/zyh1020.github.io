---
icon: file-lines
# 标题
title: 'linux安装docker'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-12
# 一个页面可以有多个分类
category:
  - Docker
# 一个页面可以有多个标签
tag:
  - 进阶
  - Docker
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，安装
第一步：检查内核版本，必须是3.10及以上
```sh
[root@VM-4-7-centos ~]# uname -r
3.10.0-1160.99.1.el7.x86_64
```
第二步：清理卸载
```sh
yum remove docker \
docker-client \ 
docker-client-latest \ 
docker-common \ 
docker-latest \ 
docker-latest-logrotate \ 
docker-logrotate \ 
docker-selinux \ 
docker-engine-selinux \ 
docker-engine \ 
docker-ce 
rm -rf /etc/systemd/system/docker.service.d 
rm -rf /var/lib/docker 
rm -rf /var/run/docker
```
第三步：安装依赖包
```sh
sudo yum install -y yum-utils device-mapper-persistent-data lvm2 --skip-broken
```
第四步：设置yum的数据源阿里云镜像源，这是要添加的 YUM 仓库的 URL。在这个例子中，它指向阿里云的 Docker CE（Community Edition）的 CentOS 版本仓库：
```sh
yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
```
第五步：安装 Docker-CE，Docker17代以后，Docker可分为i两种版本：Docker EE企业版和Docker CE社区版
```sh
sudo yum install docker-ce
```
第六步：验证安装是否成功(有client和service两部分表示docker安装启动都成功了
```
docker version
```
![image.png](http://img.zouyh.top/article-img/202505242118221.png)
这个图表示，安装成功了但是没有启动docker，启动docker
```sh
 sudo systemctl start docker
```
一般启动后将服务设为开机自启
``` sh
sudo systemctl enable docker
``` 
### 二、解决docker拉取镜像速度慢的问题

我用腾讯云服务器使用执行如下命令：
```sh
sudo mkdir -p /etc/docker 
sudo tee /etc/docker/daemon.json <<-'EOF'
{
	"registry-mirrors" : ["http://hub-mirror.c.163.com"]
} 
EOF 
```
然后重启：
```sh
sudo systemctl daemon-reload 
sudo systemctl restart docker
```
