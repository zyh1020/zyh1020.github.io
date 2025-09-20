---
icon: file-lines
title: BIO，NIO和AIO模型
author: Ms.Zyh
date: 2023-12-16
category:
  - Netty
tag:
  - 基础
  - Netty
sticky: false
star: true
---



> IO模型就是说用什么样的通道进行数据的发送和接收，Java共支持3种网络编程IO模式：BIO，NIO，AIO

### 一，BIO同步阻塞IO

代码示例：

```java
public class BIO {
    public static void main(String[] args) throws IOException {
        ServerSocket serverSocket = new ServerSocket(8000);
        while (true){
            System.out.println("----->1，等待客户端连接<-------");
            Socket clientSocket  = serverSocket.accept(); // 建立连接
            System.out.println("----->2，客户端连接完成<-------");
            byte[] bytes = new byte[1024];
            System.out.println("----->3，等待客服端发送数据<-------");
            int read = clientSocket.getInputStream().read(bytes);
            System.out.println("----->4，读取客服端发送数据完成<-------");
            if(read != -1){
                System.out.println("----->5，接收到客户端的数据：" + new String(bytes, 0, read));
            }
        }
    }
}
```

#### 实验一：阻塞

第一步，启动项目，控制台输出

```
----->1，等待客户端连接<-------
```

第二步，通过cmd命令`telnet localhost 8000`建立连接，发送信息，控制台输出：

```
----->2，客户端连接完成<-------
----->3，等待客服端发送数据<-------
```

第三步，`CTRL+]`后，通过`send 666`发送消息

<img src="http://img.zouyh.top/article-img/20240917135119385.png" alt="image-20230621155834642" style="zoom: 80%;" />

控制台输出：

```
----->4，读取客服端发送数据完成<-------
----->5，接收到客户端的数据：666
----->1，等待客户端连接<-------
```

通过实验一，可以明白什么是阻塞IO了，所谓阻塞IO就是服务端发起读取数据申请时，在客服端没有发送数据之前，服务端会一直处于等待数据状态，直到客服端把数据准备好了交给服务端才结束。

#### 实验二：同步

第一步，启动项目，控制台输出

```
----->1，等待客户端连接<-------
```

第二步，通过cmd命令`telnet localhost 8000`建立连接A，控制台输出：

```
----->2，客户端连接完成<-------
----->3，等待客服端发送数据<-------
```

第三步，再次通过cmd命令`telnet localhost 8000`建立连接B，控制台无输出

第四步，在B连接中`CTRL+]`后，通过`send 777`发送消息，控制台无输出

第五步，在A连接中`CTRL+]`后，B通过`send 666`发送消息

<img src="http://img.zouyh.top/article-img/20240917135120386.png" alt="image-20230621161057541" style="zoom:80%;" />

控制输出:
```
----->4，读取客服端发送数据完成<-------
----->5，接收到客户端的数据：666
----->1，等待客户端连接<-------
----->2，客户端连接完成<-------
----->3，等待客服端发送数据<-------
----->4，读取客服端发送数据完成<-------
----->5，接收到客户端的数据：777
----->1，等待客户端连接<-------
```

通过实验二，可以明白什么是同步了，所谓阻塞同步就是服务端是单线程按先后顺序，读取数据的。

#### 实验三：异步

改造BIO的实验案例代码如下：

```java
public class BIO2 {
    public static void main(String[] args) throws IOException {
        ServerSocket serverSocket = new ServerSocket(8000);
        while (true){
            System.out.println("----->1，等待客户端连接<-------");
            Socket clientSocket  = serverSocket.accept(); // 建立连接
            System.out.println("----->2，客户端连接完成<-------");
            new Thread(new Runnable() {
                @Override
                public void run() {
                    byte[] bytes = new byte[1024];
                    System.out.println("----->3，等待客服端发送数据<-------");
                    int read = 0;
                    try {
                        read = clientSocket.getInputStream().read(bytes);
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                    System.out.println("----->4，读取客服端发送数据完成<-------");
                    if(read != -1){
                        System.out.println("----->5，接收到客户端的数据：" + new String(bytes, 0, read));
                    }
                }
            }).start();

        }
    }
}
```

第一步：启动项目，控制台输出

```
----->1，等待客户端连接<-------
```

第二步，通过cmd命令`telnet localhost 8000`建立连接A，控制台输出：

```
----->2，客户端连接完成<-------
----->1，等待客户端连接<-------
----->3，等待客服端发送数据<-------
```

第三步，再次通过cmd命令`telnet localhost 8000`建立连接B，控制台输出：

```
----->2，客户端连接完成<-------
----->1，等待客户端连接<-------
----->3，等待客服端发送数据<-------
```

第四步，在B连接中`CTRL+]`后，通过`send 777`发送消息，控制台输出

```
----->4，读取客服端发送数据完成<-------
----->5，接收到客户端的数据：777
```

第五步，在A连接中`CTRL+]`后，B通过`send 666`发送消息

```
----->4，读取客服端发送数据完成<-------
----->5，接收到客户端的数据：666
```

通过实验三，将read阻塞操作交给新的线程去处理，可以实现异步处理，在处理在A连接的请求之前，先处理B连接的请求，但是这种方式是不合适的，因为如果客户端连接一直不发送请求，服务端的读操作会一直阻塞，导致线程一直阻塞，浪费资源。其次客户端连接很多，那就需要很多线程去处理，会导致服务器线程太多，压力太大，产生C10K问题。

### 二，NIO同步非阻塞IO

同步非阻塞，服务器实现模式为一个线程可以处理多个请求(连接)，客户端发送的连接请求都会注册到**多路复用**器selector上，多路复用器轮询到连接有IO请求就进行处理，JDK1.4开始引入。

#### 实验一：非阻塞

```java
public class NIO {
    // 保存客户端连接
    static List<SocketChannel> channelList = new ArrayList<>();

    public static void main(String[] args) throws IOException {
        // 创建NIO ServerSocketChannel,与BIO的serverSocket类似
        ServerSocketChannel serverSocket = ServerSocketChannel.open();
        serverSocket.socket().bind(new InetSocketAddress(8000));
        serverSocket.configureBlocking(false);// 设置ServerSocketChannel为非阻塞
        while (true) {
            // 非阻塞模式accept方法不会阻塞，否则会阻塞
            // NIO的非阻塞是由操作系统内部实现的，底层调用了linux内核的accept函数
            SocketChannel socketChannel = serverSocket.accept();
            if (socketChannel != null) {
                System.out.println("----->客户端连接成功<-------");
                socketChannel.configureBlocking(false);// 设置SocketChannel为非阻塞
                channelList.add(socketChannel);// 保存客户端连接在List中
            }
            // 遍历连接进行数据读取
            Iterator<SocketChannel> iterator = channelList.iterator();
            while (iterator.hasNext()) {
                SocketChannel sc = iterator.next();// 非阻塞模式read方法不会阻塞，否则会阻塞
                ByteBuffer byteBuffer = ByteBuffer.allocate(128);
                int len = sc.read(byteBuffer);// 如果有数据，把数据打印出来
                if (len > 0) {
                    System.out.println("----->接收到消息：" + new String(byteBuffer.array()));
                } else if (len == -1) {
                    iterator.remove();// 如果客户端断开，把socket从集合中去掉
                    System.out.println("----->客户端断开连接<-------");
                }
            }
        }
    }
}

```

第一步：启动项目，控制台无输出

第二步，通过cmd命令`telnet localhost 8000`建立连接A，控制台输出：

```
----->客户端连接成功<-------
```

第三步，通过cmd命令`telnet localhost 8000`建立连接B，控制台输出：

```
----->客户端连接成功<-------
```

第四步，在B连接中`CTRL+]`后，通过`send 777`发送消息，控制台输出

```
 ----->接收到消息：777                                                                                        
```

第五步，在A连接中`CTRL+]`后，B通过`send 666`发送消息

```
 ----->接收到消息：666                                                                                        
```

实验一可以看出服务端是非阻塞的，但是也是有缺点的，如果连接数太多的话，会有大量的无效遍历，假如有10000个连接，其中只有1000个连接有写数据，但是由于其他9000个连接并没有断开，我们还是要每次轮询遍历一万次，其中有十分之九的遍历都是无效的，这显然不是一个让人很满意的状态。

#### 实验二：多路复用

```java
public class NIO2 {
    public static void main(String[] args) throws IOException {
        // 创建NIO ServerSocketChannel
        ServerSocketChannel serverSocket = ServerSocketChannel.open();
        serverSocket.socket().bind(new InetSocketAddress(8000));
        serverSocket.configureBlocking(false); // 设置ServerSocketChannel为非阻塞
        Selector selector = Selector.open();// 打开Selector处理Channel，即创建epoll
        // 把ServerSocketChannel注册到selector上，并且selector对客户端accept连接操作感兴趣
        serverSocket.register(selector, SelectionKey.OP_ACCEPT);
        while (true) {
            selector.select(); // 阻塞等待需要处理的事件发生
            // 获取selector中注册的全部事件的 SelectionKey 实例
            Set<SelectionKey> selectionKeys = selector.selectedKeys();
            Iterator<SelectionKey> iterator = selectionKeys.iterator();
            // 遍历SelectionKey对事件进行处理
            while (iterator.hasNext()) {
                SelectionKey key = iterator.next();
                // 如果是OP_ACCEPT事件，则进行连接获取和事件注册
                if (key.isAcceptable()) {
                    ServerSocketChannel server = (ServerSocketChannel) key.channel();
                    SocketChannel socketChannel = server.accept();
                    socketChannel.configureBlocking(false);
                    // 这里只注册了读事件，如果需要给客户端发送数据可以注册写事件
                    socketChannel.register(selector, SelectionKey.OP_READ);
                    System.out.println("----->客户端连接成功<-------");
                } else if (key.isReadable()) {  // 如果是OP_READ事件，则进行读取和打印
                    SocketChannel socketChannel = (SocketChannel) key.channel();
                    ByteBuffer byteBuffer = ByteBuffer.allocate(128);
                    int len = socketChannel.read(byteBuffer);
                    // 如果有数据，把数据打印出来
                    if (len > 0) {
                        System.out.println("----->接收到消息：" + new String(byteBuffer.array()));
                    } else if (len == -1) { // 如果客户端断开连接，关闭Socket
                        System.out.println("----->客户端断开连接<-------");
                        socketChannel.close();
                    }
                }
                //从事件集合里删除本次处理的key，防止下次select重复处理
                iterator.remove();
            }
        }
    }
}
```

第一步：启动项目，控制台无输出

第二步，通过cmd命令`telnet localhost 8000`建立连接A，控制台输出：

```
----->客户端连接成功<-------
```

第三步，通过cmd命令`telnet localhost 8000`建立连接B，控制台输出：

```
----->客户端连接成功<-------
```

第四步，在B连接中`CTRL+]`后，通过`send 777`发送消息，控制台输出

```
 ----->接收到消息：777                                                                                        
```

第五步，在A连接中`CTRL+]`后，B通过`send 666`发送消息

```
 ----->接收到消息：666                                                                                        
```

虽然实验二和实验一，产生的效果一样，但是实验二处理更像是那个学生背完书后主动找老师背书，实验一跟像是老师一个个问学生背完书了吗。

​	I/O多路复用底层主要用的Linux 内核·函数（select，poll，epoll）来实现，windows不支持epoll实现，windows底层是基于winsock2的select函数实现的(不开源)，NIO底层在JDK1.4版本是用linux的内核函数select()或poll()来实现，跟上面的实验一代码类似，selector每次都会轮询所有的sockchannel看下哪个channel有读写事件，有的话就处理，没有就继续遍历，JDK1.5开始引入了epoll基于事件响应机制来优化NIO。

|              | **select**                               | **poll**                                 | **epoll(jdk 1.5及以上)**                                     |
| ------------ | ---------------------------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| **操作方式** | 遍历                                     | 遍历                                     | 回调                                                         |
| **底层实现** | 数组                                     | 链表                                     | 哈希表                                                       |
| **IO效率**   | 每次调用都进行线性遍历，时间复杂度为O(n) | 每次调用都进行线性遍历，时间复杂度为O(n) | 事件通知方式，每当有IO事件就绪，系统注册的回调函数就会被调用，时间复杂度O(1) |
| **最大连接** | 有上限                                   | 无上限                                   | 无上限                                                       |

接下来下面主要深入研究一下实验二，DK1.4版本是用linux的内核函数select()或poll()来实现和实验一类似就不多说了，主要研究JDK1.5开始引入了epoll基于事件响应机制来优化NIO。在实验二代码里如下几个方法非常重要，我们从Hotspot与Linux内核函数级别来理解下:    

```
Selector.open()  // 创建多路复用器 
socketChannel.register(selector, SelectionKey.OP_READ)  // 将channel注册到多路复用器上 
selector.select()  // 阻塞等待需要处理的事件发生         
```

   ![NIO底层Epoll实现源码剖析 (2)](http://qiniu.zouyh.top//wordpress/NIO%E5%BA%95%E5%B1%82Epoll%E5%AE%9E%E7%8E%B0%E6%BA%90%E7%A0%81%E5%89%96%E6%9E%90%20(2).jpg)

总结：NIO整个调用流程就是Java调用了操作系统的内核函数来创建Socket，获取到Socket的文件描述符，再创建一个Selector对象，对应操作系统的Epoll描述符，将获取到的Socket连接的文件描述符的事件绑定到Selector对应的Epoll文件描述符上，进行事件的异步通知，这样就实现了使用一条线程，并且不需要太多的无效的遍历，将事件处理交给了操作系统内核(操作系统中断程序实现)，大大提高了效率。

**Epoll函数详解**

```
 int epoll_create(int size);       
```

创建一个epoll实例，并返回一个非负数作为文件描述符，用于对epoll接口的所有后续调用。参数size代表可能会容纳size个描述符，但size不是一个最大值，只是提示操作系统它的数量级，现在这个参数基本上已经弃用了             

```
int epoll_ctl(int epfd, int op, int fd, struct epoll_event *event);     
```

 使用文件描述符epfd引用的epoll实例，对目标文件描述符fd执行op操作。

参数epfd表示epoll对应的文件描述符，参数fd表示socket对应的文件描述符。

参数op有以下几个值：

- EPOLL_CTL_ADD：注册新的fd到epfd中，并关联事件event；
- EPOLL_CTL_MOD：修改已经注册的fd的监听事件；
- EPOLL_CTL_DEL：从epfd中移除fd，并且忽略掉绑定的event，这时event可以为null；

参数event是一个结构体                 

```
struct epoll_event {
    __uint32_t   events;      /* Epoll events */
    epoll_data_t data;        /* User data variable */
};
	
typedef union epoll_data {
    void        *ptr;
    int          fd;
    __uint32_t   u32;
    __uint64_t   u64;
} epoll_data_t;           
```

events有很多可选值，这里只举例最常见的几个：

EPOLLIN ：表示对应的文件描述符是可读的；

EPOLLOUT：表示对应的文件描述符是可写的；

EPOLLERR：表示对应的文件描述符发生了错误；

成功则返回0，失败返回-1              

```
int epoll_wait(int epfd, struct epoll_event *events, int maxevents, int timeout);      
```

等待文件描述符epfd上的事件。epfd是Epoll对应的文件描述符，events表示调用者所有可用事件的集合，maxevents表示最多等到多少个事件就返回，timeout是超时时间。

### 三，AIO异步非阻塞IO

> AIO是NIO的进阶版，适用于连接数目多且连接比较长(重操作)的架构，从JDK7 开始支持

```java
public class AIO {
    public static void main(String[] args) throws IOException, InterruptedException {
        final AsynchronousServerSocketChannel serverChannel =
                AsynchronousServerSocketChannel.open().bind(new InetSocketAddress(8000));
        serverChannel.accept(null, new CompletionHandler<AsynchronousSocketChannel, Object>() {
            @Override
            public void completed(AsynchronousSocketChannel socketChannel, Object attachment) {
                try {
                    System.out.println("2--"+Thread.currentThread().getName());
                    // 再此接收客户端连接，如果不写这行代码后面的客户端连接连不上服务端
                    serverChannel.accept(attachment, this);
                    System.out.println(socketChannel.getRemoteAddress());
                    ByteBuffer buffer = ByteBuffer.allocate(1024);
                    socketChannel.read(buffer, buffer, new CompletionHandler<Integer, ByteBuffer>() {
                        @Override
                        public void completed(Integer result, ByteBuffer buffer) {
                            System.out.println("3--"+Thread.currentThread().getName());
                            buffer.flip();
                            System.out.println(new String(buffer.array(), 0, result));
                        }

                        @Override
                        public void failed(Throwable exc, ByteBuffer buffer) {
                            exc.printStackTrace();
                        }
                    });
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }

            @Override
            public void failed(Throwable exc, Object attachment) {
                exc.printStackTrace();
            }
        });

        System.out.println("1--"+Thread.currentThread().getName());
        Thread.sleep(Integer.MAX_VALUE);
    }
}
```

第一步：启动项目，输出如下：

```
1--main
```

第二步：通过cmd命令`telnet localhost 8000`建立连接A，控制台输出：

```
2--Thread-9
/0:0:0:0:0:0:0:1:11021
```

第三步，通过cmd命令`telnet localhost 8000`建立连接B，控制台输出：

```
2--Thread-9
/0:0:0:0:0:0:0:1:1445
```

第四步，在B连接中`CTRL+]`后，通过`send 777`发送消息，控制台输出：

```
3--Thread-8
777
```

第四步，在B连接中`CTRL+]`后，通过`send 666`发送消息，控制台输出：

```
3--Thread-8
666
```

可以看出，服务端响应客户端请求即不阻塞，也是异步的。在Linux系统上，AIO的底层实现仍使用Epoll。
