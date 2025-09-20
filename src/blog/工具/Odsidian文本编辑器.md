---
icon: file-lines
title: Odsidian文本编辑器
author: Ms.Zyh
date: 2022-07-20
category:
  - 工具
tag:
  - 偏僻
  - 工具
sticky: false
star: false
---

说一下为什么选择Obsidian作为我的markdown文本编辑，原来我是使用的typora的，这个typora使用起来是非常舒服的，但是它有一个很大的缺点就是多端同步，没有办法将文件保存在远程，所以我就百度了一下，发现了Odsidian这编辑器。
### 一，Obsidian
#### 1，下载安装
下载：前往Obsidia`https://obsidian.md`官网，点击"Get Obsidian for Windows"按钮或则点击Download都可以进入下载页面，然后点击Download for Windows下载安装包。
![image.png](http://img.zouyh.top/article-img/20240917135149407.png)

安装：找到下载的安装包双击运行：
![image.png](http://img.zouyh.top/article-img/20240917135148403.png)
自定义安装目录：
![](http://img.zouyh.top/article-img/20240917135151408.png)

#### 2，远程同步
注意事项/写在前面：
- 插件搜索需要科学上网，如果你的网路实在不行的话，可以采用离线安装的方式，这个需要你自行百度了呦。
- 远程同步是使用Remotely Save插件 + 七牛云 实现的，如果和你的使用对象存储平台的不一致，可以百度其它方式呦。
##### 2.1 安装插件
路径：Obsidian->设置->第三方插件->社区插件市场-> 点击浏览->搜索`Remotely Save`
![image.png](http://img.zouyh.top/article-img/20240917135154416.png)
安装完成后点击启用。
##### 2.2 创建七牛云存储空间
访问七牛云`https://portal.qiniu.com/`,左侧边栏选择对象存储kodo->左侧侧边栏选择空间管理->页面点击新建存储空间：
![image.png](http://img.zouyh.top/article-img/20240917135152411.png)

创建完成后会在该页面看到创建的存储空间
![image.png](http://img.zouyh.top/article-img/20240917135148404.png)

点击后进入到文件管理，左侧选择空间概览：
![image.png](http://img.zouyh.top/article-img/20240917135154415.png)
密钥信息：点击右上角头像->选择密钥管理
![image.png](http://img.zouyh.top/article-img/20240917135149406.png)
##### 2.3 配置插件
设置-> 第三方插件->选中Remotely Save->配置信息如下图：
![2024-07-20 16 47 18.png](http://img.zouyh.top/article-img/20240917135151409.png)
其他的配置基本上不用改变。验证一下，点击右侧的刷新按钮，即可完成同步任务：
![image.png](http://img.zouyh.top/article-img/20240917135148402.png)

七牛云的中效果：
![image.png](http://img.zouyh.top/article-img/20240917135152410.png)

#### 3，图片上传
注意事项/写在前面：
- 插件搜索需要科学上网，如果你的网路实在不行的话，可以采用离线安装的方式，这个需要你自行百度了呦 
- 图片上传是使用Image auto upload + picGo 实现的，Image auto upload插件实现图片上传，本质上还是通过picGo实现的，所以在使用Image auto upload插件的时候一定要保证你的picGo已经安装配置好了，如果不知道怎么安装配置picGo，可以先去我的博客网站中扒一下，我是有写过的picGo+七牛云实现自己的图床的。
##### 3.1 安装插件
路径：Obsidian->设置->第三方插件->社区插件市场-> 点击浏览->搜索`Image auto upload`
![插件搜索.png](http://img.zouyh.top/article-img/20240917135153412.png)
安装完成后点击启用。
##### 3.2 配置插件
设置-> 第三方插件->选中Image auto upload Plugin->配置信息如下图：

![image.png](http://img.zouyh.top/article-img/20240917135148405.png)
配置完成后验证一下，使用微信截图后-> 粘贴到文章中 -> 等待图片上传-> 上传完成后，选中上传的图片，可以看到图片链接如图：
![image.png](http://img.zouyh.top/article-img/20240917135154414.png)

在七牛云中找一下：
![image.png](http://img.zouyh.top/article-img/20240917135153413.png)

