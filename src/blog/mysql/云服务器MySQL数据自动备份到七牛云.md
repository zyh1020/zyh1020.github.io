---
icon: document
# 标题
title: '云服务器MySQL数据自动备份到七牛云'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-28
# 一个页面可以有多个分类
category:
  - mysql
# 一个页面可以有多个标签
tag:
  - 常用
  - mysql
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---


对于我这种小网站，虽然没几个人访问，但是我担心呀！我害怕呀！hhhh，所以为了我这个小破站能够正常的运行下去，我决定备份一下数据。
> 目标：将mysql数据定时备份到七牛云
￼

### 一，下载安装qshell工具
qshell 是基于七牛 API 服务的命令行工具，介绍和下载网址：https://developer.qiniu.com/kodo/1302/qshell
```sh
# 下载文件
wget  https://github.com/qiniu/qshell/releases/download/v2.12.0/qshell-v2.12.0-linux-386.tar.gz
# 解压
tar -xvf qshell-v2.12.0-linux-386.tar.gz
# 配置环境变量
mv qshell /usr/bin/
# 赋执行的权限
chmod +x /usr/bin/qshell
# 执行qshell，输出帮助信息，表示安装成功
```
### 二，编写脚本
```sh
#!/bin/bash


# 定义备份的参数 将以下参数修改为你的
BACKUP_DIR=/root/mysqlBack/sql
MYSQL_CONTAINER_NAME=mysql
MYSQL_USER=root
MYSQL_PASSWORD=blog123456
DATABASE_NAME=blog
DATE=$(date +"%Y%m%d%H%M%S")
LOG_FILE=/root/mysqlBack/backup.log
QSHELL_DIR=/usr/bin
BUCKET_NAME= 
ACCESS_KEY= 
SECRET_KEY=

# 备份MySQL数据库 输出日志
BACK_FILE =  $DATABASE_NAME-$DATE.sql
echo “====开始备份====“ >> "$LOG_FILE"
docker exec $MYSQL_CONTAINER_NAME /usr/bin/mysqldump -u $MYSQL_USER --password=$MYSQL_PASSWORD $DATABASE_NAME > $BACKUP_DIR/$BACK_FILE 2>> $LOG_FILE
echo “====备份完成====“ >> "$LOG_FILE"

echo “====开始上传====“ >> "$LOG_FILE"
$QSHELL_DIR/qshell account $ACCESS_KEY $SECRET_KEY  > /dev/null
$QSHELL_DIR/qshell rput $BUCKET_NAME  $BACKUP_DIR/$BACK_FILE mysql/$BACK_FILE true >> $LOG_FILE 2>&1
echo “====上传完成====“ >> $LOG_FILE

# 删除超过7天的备份文件
find $BACKUP_DIR -type f -mtime +7 -name "*.sql" -exec rm {} \; >> $LOG_FILE 2>&1
```

### 三，设置定时任务

使用cron job来每天自动运行这个脚本：`crontab -e`，进入编译器，i，插入：
```sh
0 3 * * * /root/sh/backup_mysql.sh
```
每天3点执行脚本/root/sh/backup_mysql.sh,查看定时任务：`crontab -l`
