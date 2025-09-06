---
icon: file-lines
# 标题
title: 'ssh服务登录linux'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-28
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


### 一、创建密钥

我的电脑是windows，可以查看`\Users\用户名\.ssh`文件是否有`id_rsa`和`id_rsa.pub`两个文件，分别为私钥和公钥，如果没有可以通过git的命令创建：
```sh
ssh-keygen -t rsa -C "youmail@gmail.com"
```
### 二、配置密钥
```sh
# 公钥上传服务
echo "*.pub公钥文件内容" >> ~/.ssh/authorized_keys
# 确认公钥权限
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# 确认/etc/ssh/sshd_config文件中
# ssh服务的连接端口
Port 22
# 是否限制root用户登录
PermitRootLogin no
# 是否允许账号密码登录
PasswordAuthentication yes

# 重启服务
sudo systemctl restart sshd
```


创建githubApi的部署token
 `Settings  ->  Developer settings  -> Presonal access tokens -> tokens (classic)`：
  ![2025-08-30 13 58 05.png](http://img.zouyh.top/article-img/202508301417107.png)
  然后点击右上方的 `Generate new token`，接着输入 token 的名字，这个名字可以随意，不过还是推荐根据它的用途来命名。然后选 Expiration，也就是这个 Token 的有效期，如果我们要长期用，建议选为 No expiration，意思就是无期限。最后就是选权限，一般来讲这里选 repo 就够了，但是如果你不确定，那就全都选上也行。然后点击 Generate Token.
  
`进入仓库->setting -> Secrets and variables  -> Actions`:
![2025-08-30 13 46 44.png](http://img.zouyh.top/article-img/202508301348535.png)
