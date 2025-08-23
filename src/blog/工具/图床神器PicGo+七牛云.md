---
icon: document
# 标题
title: '图床神器PicGo+七牛云'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-22
# 一个页面可以有多个分类
category:
  - 工具
# 一个页面可以有多个标签
tag:
  - 常用
  - 工具
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，PicGo安装
github下载地址：https://github.com/Molunerfinn/PicGo/releases
天翼网盘安装地址：https://cloud.189.cn/web/share?code=QjeQnqymQVra（访问码：g3ze）
git的下载方式：
![0.png](http://img.zouyh.top/article-img/20240917135204444.png)
双击运行安装包：
![1.png](http://img.zouyh.top/article-img/20240917135201436.png)
自定义安装的目录，直接下一步：
![2.png](http://img.zouyh.top/article-img/20240917135203443.png)
点击安装即可完成安装PicGo：
![3.png](http://img.zouyh.top/article-img/20240917135203441.png)

### 二，七牛云平台

#### 2.1 创建存储空间
登录七牛云官网：https://www.qiniu.com/
左侧空间管理->新建空间
![2024-08-17 16 10 17.png|500](http://img.zouyh.top/article-img/20240917135202438.png)
注意访问控制是公开，公开的比较方便博客下载和展示。
#### 2.2 为存储空间绑定域名
空间管理-> 刚创建的存储空间(zouyh-img)->域名管理：
![2024-08-17 16 18 00.png](http://img.zouyh.top/article-img/20240917135201437.png)

刚创建的存储空间，七牛云平台一般会给一个测试域名，这个域名30天后会过期，所以需要我们绑定自己的域名。
![2024-08-17 16 24 18.png|525](http://img.zouyh.top/article-img/20240917135204445.png)

点击域名管理界面，查看刚创建的img.zouyh.top
![2024-08-17 16 38 44.png|700](http://img.zouyh.top/article-img/20240917135202439.png)
我的域名是在注册管理腾讯平台的，域名注册-我的域名-解析
![2024-08-17 16 30 24.png](http://img.zouyh.top/article-img/20240917135204446.png)
添加域名解析：
![2024-08-17 16 35 08.png](http://img.zouyh.top/article-img/20240917135203442.png)
到此为止域名绑定就做完了。
### 三，PicGo的七牛云配置
PicGo的七牛云配置：
![2024-08-17 16 52 28.png|475](http://img.zouyh.top/article-img/20240917135202440.png)
上图编号1的获取方式：七牛云的个人中心的密钥管理
![2024-08-17 16 45 22.png](http://img.zouyh.top/article-img/20240917135205447.png)
上图编号2的获取方式：https://developer.qiniu.com/kodo/4088/s3-access-domainname?utm_source=ld246.com

| 存储区域Region | 存储区域Region ID |
| ---------- | ------------- |
| 华东         | z0            |
| 华北         | z1            |
| 华南         | z2            |
