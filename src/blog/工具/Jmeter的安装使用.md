---
icon: file-lines
title: Jmeter的安装使用
author: Ms.Zyh
date: 2022-07-05
category:
  - 工具
tag:
  - 基础
  - 工具
sticky: false
star: false
---

### 一，安装
方式一：官网下载，官网地址：http://jmeter.apache.org/download_jmeter.cgi
方式二：天翼网盘下载，下载链接：https://cloud.189.cn/web/share?code=Vj63em2aIruu（访问码：6vdi）
我在官网下载的是JMeter 5.6.3版本的zip文件，下载完成后直接解压，然后进入到`apache-jmeter-5.6.3\bin`文件夹内，双击`jmeter.bat`文件启动jmeter：
![image.png](http://img.zouyh.top/article-img/202501261614708.png)
启动之后会有两个窗口，一个cmd窗口，一个JMeter的 GUI窗口，cmd窗口的主要是提示我们，不要使用GUI窗口运行压力测试，GUI仅用于压力测试的创建和调试；执行压力测试请不要使用GUI窗口。使用下面的命令来执行测试：
```sh
jmeter -n -t [jmx file] -l [results file] -e -o [Path to web report folder]
```
并且修改JMeter批处理文件的环境变量：`HEAP="-Xms1g -Xmx1g -XX:MaxMetaspaceSize=256m"`，我不是专业测试我一般使用GUI窗口就足够我日常需求了，所以这里就不多说了，下面进行简单的设置修改，官方默认为我们提供了简体中文，通过 【Options】->【Choose Language】 ->【Chinese (Simplified)】变更为简体中文。

### 二，使用
#### 2.1 线程组
在 Test plan 上右键 【添加】-->【线程(用户)】-->【线程组】：
![image.png](http://img.zouyh.top/article-img/202501261627610.png)

- 线程数：指的就是我们要模拟的虚拟用户数
- ramp-up时间：准备时长 启动虚拟用户所需要的时间
- 循环次数：虚拟用户要执行脚本次数，如果选择永远，则脚本会一直运行
- 调度器：选择调度器后可以指定脚本的运行时长，但是要配合循环次数永远一块使用
- 持续时间：脚本要运行的时长
- 启动延迟：点击开始后，推迟多少秒开始执行脚本
#### 2.2 HTTP请求
在 刚创建的线程组 上右键 【添加】-->【取样器】-->【HTTP请求】：
![image.png](http://img.zouyh.top/article-img/202501261644040.png)
- 协议：一般是http或https
- 服务器名称或ip：请求的域名或者ip地址
- 端口号：服务的端口
- HTTP请求：请求的方式Get、Post、Put等
- HTTP请求路径：请求路径
- HTTP请求参数：可以在底部的添加或删除按钮添加或者删除请求参数。
#### 2.3 查看结果树
-  在 刚创建的HTTP请求 上右键 【添加】-->【监听器】-->【查看结果树】：
- 在 刚创建的线程组 右键启动，点击刚创建结果树，即可看到执行结果

