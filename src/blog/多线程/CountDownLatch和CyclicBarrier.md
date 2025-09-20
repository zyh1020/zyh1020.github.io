---
icon: file-lines
title: CountDownLatch和CyclicBarrier
author: Ms.Zyh
date: 2022-06-07
category:
  - 多线程
tag:
  - 干货
  - 多线程
sticky: false
star: true
---



### 一，CountDownLatch 

​	作用：CountDownLatch类能够使一个线程等待其他线程完成各自的工作后再执行。

​	使用场景：Zookeeper分布式锁，Jmeter模拟高并发等。

​	工作原理：CountDownLatch是通过一个计数器来实现的，计数器的初始值为线程的数量。每当一个线程完成了自己的任务后，通过调用``countDown();`方法使计数器的值就会减1，当计数器值到达0时，它表示所有的线程已经完成了任务，然后在闭锁上等待的线程就可以恢复执行任务。

```java
public class CountDownLatchTest {
	private static CountDownLatch countDownLatsh = new CountDownLatch(5);
    private static class Player implements Runnable{
        private Integer index;
        public Player(Integer index){
            this.index = index;
        }
        @Override
        public void run() {
            System.out.println("玩家"+index+"准备完成");
            countDownLatsh.countDown();
        }
    }
    public static void main(String[] args) throws InterruptedException {
        for(int i = 0; i < 5; i++){
            new Thread(new Player(i)).start();
        }
        countDownLatsh.await();
        System.out.println("玩家准备完毕，开始游戏");
    }
}

```

输出结果：

```cmd
玩家1准备完成
玩家0准备完成
玩家3准备完成
玩家2准备完成
玩家4准备完成
玩家准备完毕，开始游戏
```



### 二，CyclicBarrier

​	栅栏屏障，让一组线程到达一个屏障（也可以叫同步点）时被阻塞，直到最后一个线程到达屏障时，屏障才会开门，所有被屏障拦截的线程才会继续运行。

​	CyclicBarrier默认的构造方法是`CyclicBarrier(int parties)`，其参数表示屏障拦截的线程数量，每个线程调用`await`方法告CyclicBarrier我已经到达了屏障，然后当前线程被阻塞。

```java

public class CyclicBarrierTest {
    private static CyclicBarrier cyclicBarrier = new CyclicBarrier(5);
    private static class Player implements Runnable{
        private Integer index;
        public Player(Integer index){
            this.index = index;
        }

        @Override
        public void run() {
            System.out.println("玩家"+index+"准备完成");
            try {
                cyclicBarrier.await();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
    public static void main(String[] args) throws Exception {
        for(int i = 0; i < 4; i++){
            new Thread(new Player(i)).start();
        }
        cyclicBarrier.await();
        System.out.println("玩家准备完毕，开始游戏");
    }
}

```

输出结果：

```cmd
玩家0准备完成
玩家1准备完成
玩家2准备完成
玩家3准备完成
玩家准备完毕，开始游戏
```



**CountDownLatch 和 CyclicBarrier的区别**

- 从使用上可以发现二者侧重点不同，在CountDownLatch使用时其实是存在主线程和子线程的概念，子线程在准备好主线程需要的资源后，主线程结束等待，继续剩下的工作；而在CyclicBarrier使用中，并不存在主和次的说法，更像是一组线程在互相等待后，然后在同一时间，继续后面的操作，可以类比于现实中跑步比赛的场景，一组运动员在各自准备好起跑动作后，由裁判员发令后，统一起跑
- 等待超时CountDownLatch会直接返回，继续后续工作，CyclicBarrier首先会抛TimeoutException，同时如果CyclicBarrier要等的线程数大于1，其他线程不会按设定的等待时间等待，而是抛出BrokenBarrierException后直接返回，所以使用CyclicBarrier要注意异常处理的逻辑。
- 使用细节差异如下表：

| CountDownLatch                                      | CyclicBarrier                                                |
| --------------------------------------------------- | ------------------------------------------------------------ |
| 减计数方式                                          | 加计数方式                                                   |
| 计数为0时释放所有线程                               | 计数达到指定值时释放所有等待线程                             |
| 计数为0时，无法重置                                 | 计数达到指定值时，计数值置为0重新开始                        |
| 调用countDown()方法计数减1，调用await()方法阻塞线程 | 调用await()方法计数加1，当计数值不等于构造方法指定值时，阻塞线程 |
| 不可重复利用                                        | 可重复利用                                                   |

- 最后要提的是CountDownLatch 和 CyclicBarrier虽然基本都是在多线程中使用，但是同一个线程多次调用countDown()和await()其实也会使计数改变。
