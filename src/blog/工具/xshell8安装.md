---
icon: file-lines
# 标题
title: 'xshell8安装'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-08
# 一个页面可以有多个分类
category:
  - 工具
# 一个页面可以有多个标签
tag:
  - 偏僻
  - 工具
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一、下载安装
- 下载：
	- 官方下载地址：https://www.xshell.com/zh/free-for-home-school/
	- 天翼云盘：https://cloud.189.cn/t/3yMvUnbAjyUf（访问码：gv75）
- 安装：比较简单，一直下一步，中间也就修改一下安装位置，这里就不放截图了。
- 注册：注册也比较简单填一下用户名和邮箱就好了。
### 二、连接
安装完成后，通过如下方式创建连接：
![2025-06-07 12 58 04.png](http://img.zouyh.top/article-img/202506071259229.png)
填写连接信息
![2025-06-07 13 00 37.png](http://img.zouyh.top/article-img/202506071305031.png)
点击连接后，进入如下界面：
![2025-06-07 13 06 56.png](http://img.zouyh.top/article-img/202506071313061.png)
点击确认后，进入如下界面：
![2025-06-07 13 07 29.png](http://img.zouyh.top/article-img/202506071314126.png)
到此，也就完成连接。
### 三、上传文件
> 注意上传是单个文件，不是文件夹。
- 验证：输入`rz --version`或`rpm -qa | grep lrzsz`检查是否安装成功。
```
[root@VM-4-7-centos ~]# rz --version
rz (lrzsz) 0.12.20
```
- 安装： Ubuntu/Debian 使用`sudo apt-get install lrzsz`安装， CentOS/RedHat使用`yum install -y lrzsz`安装。
- 上传：拖拽上传，直接拖拽本地文件至Xshell会话窗口，文件将自动传输到服务器的当前目录。rz命令上传，在Xshell会话中输入`rz`命令，弹出本地文件选择窗口，选中文件即可上传。
