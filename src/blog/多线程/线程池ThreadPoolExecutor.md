---
icon: document
# 标题
title: '线程池ThreadPoolExecutor'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-22
# 一个页面可以有多个分类
category:
  - 多线程
# 一个页面可以有多个标签
tag:
  - 基础
  - 多线程
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，ThreadPoolExecutor

全参构造函数参数介绍，在Java中创建线程池常用的类是`ThreadPoolExecutor`，该类的全参构造函数如下：

```java
public ThreadPoolExecutor(int corePoolSize,
                          int maximumPoolSize,
                          long keepAliveTime,
                          TimeUnit unit,
                          BlockingQueue<Runnable> workQueue,
                          ThreadFactory threadFactory,
                          RejectedExecutionHandler handler) {
}
```

参数介绍：

`corePoolSize`：线程池中核心线程数的最大值

`maximumPoolSize`：线程池中能拥有最多线程数

`threadFactory`：指定创建线程的工厂，调用ThreadFactory的唯一方法newThread()创建新线程时，可以更改所创建的新线程的名称、线程组、优先级、守护进程状态等

`workQueue`：用于缓存任务的阻塞队列，对于不同的应用场景我们可能会采取不同的排队策略，这就需要不同类型的阻塞队列。

`handler`：表示当workQueue已满，且池中的线程数达到maximumPoolSize时，线程池拒绝添加新任务时采取的策略。

`keepAliveTime`：表示空闲线程的存活时间。

`unit`：表示keepAliveTime的单位。

#### 1.1 workQueue阻塞队列

BlockingQueue的实现类如下：

![image-20230227150056897](http://img.zouyh.top/article-img/20240917135053307.png)

其中常见阻塞队列: 

- ArrayBlockingQueue 由数组支持的有界队列 ,
- LinkedBlockingQueue 基于链表的无界队列，
- PriorityBlockingQueue  由优先级堆支持的无界优先级队列，
- DelayQueue由优先级堆支持的、基于时间的调度队列
- SynchronousQueue单个元素的阻塞队列

BlockingQueue 的阻塞队列提供了四种处理方法：

| 方法描述             | 抛出异常  | 返回特殊的值 | 一直阻塞 | 超时退出           |
| :------------------- | :-------- | :----------- | :------- | :----------------- |
| 插入数据             | add(e)    | offer(e)     | put(e)   | offer(e,time,unit) |
| 获取并移除队列的头   | remove()  | poll()       | take()   | poll(time,unit)    |
| 获取但不移除队列的头 | element() | peek()       |          |                    |

- 抛出异常：是指当阻塞队列满时候，再往队列里插入元素，会抛出`IllegalStateException(“Queue full”)`异常。当队列为空时，从队列里获取元素时会抛出`NoSuchElementException`异常
- 返回特殊值： 插入方法会返回是否成功，成功则返回true。移除方法，则是从队列里拿出一个元素，如果没有则返回null
- 一直阻塞： 当阻塞队列满时，如果生产者线程往队列里put元素，队列会一直阻塞生产者线程，直到拿到数据，或者响应中断退出。当队列空时，消费者线程试图从队列里take元素，队列也会阻塞消费者线程，直到队列可用。
- 超时退出：当阻塞队列满时，队列会阻塞生产者线程一段时间，如果超过一定的时间，生产者线程就会退出。

#### 1.2 拒绝策略

当workQueue已满，且池中的线程数达到maximumPoolSize时，线程池拒绝添加新任务时采取的策略。一般可以采取以下四种取值：

| 策略                                     | 效果                                           |
| ---------------------------------------- | ---------------------------------------------- |
| ThreadPoolExecutor.AbortPolicy()         | 抛出RejectedExecutionException异常             |
| ThreadPoolExecutor.CallerRunsPolicy()    | 由向线程池提交任务的线程来执行该任务           |
| ThreadPoolExecutor.DiscardOldestPolicy() | 抛弃最旧的任务（最先提交而没有得到执行的任务） |
| ThreadPoolExecutor.DiscardPolicy()       | 抛弃当前的任务                                 |

自定义拒绝策略，实现RejectedExecutionHandler接口重写rejectedExecution方法：

```java
class CustomerIgnorePolicy implements RejectedExecutionHandler{
        @Override
        public void rejectedExecution(Runnable r, ThreadPoolExecutor executor) {
            System.out.println(Thread.currentThread().getName()+"-rejected;  taskCount-"+executor.getTaskCount());
            
        }
}
```

#### 1.3 任务调度流程

![image-20230227152826215](http://img.zouyh.top/article-img/20240917135054309.png)

来新任务了：

- 情况一：当前运行的线程数少于corePoolSize，则添加新的线程执行该任务。
- 情况二：当前运行的线程数等于corePoolSize，但是阻塞队列未满，则将任务入队列，而不添加新的线程。
- 情况三：当前运行的线程数等于corePoolSize，同时阻塞队列已满，但是池中的线程数小于maximumPoolSize，则创建新的线程执行任务。
- 情况四：当前运行的线程数等于corePoolSize，同时阻塞队列已满，同时池中的线程数等于maximumPoolSize，则根据构造函数中的handler指定的策略来拒绝新的任务。

#### 1.4 execute和submit

execute方法: `void execute(Runnable command):` 
submit方法:

- `<T> Future<T> submit(Callable<T> task);`
- `<T> Future<T> submit(Runnable task, T result);`
- `Future<?> submit(Runnable task);`

​	execute和submit都可以向线程池提交任务，两种方法的区别execute()方法只能接收Runnable类型的参数，而submit()方法可以接收Callable、Runnable两种类型的参数，Callable类型的任务是可以返回执行结果的，而Runnable类型的任务不可以返回执行结果，submit()提交任务后会有返回值，而execute()没有。

源码分析execute方法:

```java
public void execute(Runnable command) {
    if (command == null)
        throw new NullPointerException();
    
	int c = ctl.get(); // clt记录着runState和workerCount
    /*
    * workerCountOf方法取出低29位的值，表示当前活动的线程数；
    * 如果当前活动线程数小于corePoolSize，则新建一个线程放入线程池中；
    * 并把任务添加到该线程中。
    */
    if (workerCountOf(c) < corePoolSize) {
        /*
        * addWorker中的第二个参数表示限制添加线程的数量是根据corePoolSize来判断还是maximumPoolSize来判断；
        * 如果为true，根据corePoolSize来判断；
        * 如果为false，则根据maximumPoolSize来判断
        */
        if (addWorker(command, true))
           return;
   		c = ctl.get(); // 如果添加失败，则重新获取ctl值
     }
    // 如果当前线程池是运行状态并且任务添加到队列成功
    if (isRunning(c) && workQueue.offer(command)) {
        
		int recheck = ctl.get(); // 重新获取ctl值
        // 再次判断线程池的运行状态，如果不是运行状态，由于之前已经把command添加到workQueue中了，
		// 这时需要移除该command
        // 执行过后通过handler使用拒绝策略对该任务进行处理，整个方法返回
        if (! isRunning(recheck) && remove(command))
            reject(command);
         /*
        * 获取线程池中的有效线程数，如果数量是0，则执行addWorker方法
        * 这里传入的参数表示：
        * 1. 第一个参数为null，表示在线程池中创建一个线程，但不去启动；
        * 2. 第二个参数为false，将线程池的有限线程数量的上限设置为maximumPoolSize，添加线程时根据maximumPoolSize来判断；
        * 如果判断workerCount大于0，则直接返回，在workQueue中新增的command会在将来的某个时刻被执行。
        */
         else if (workerCountOf(recheck) == 0)
            addWorker(null, false);
    }
    /*
    * 如果执行到这里，有两种情况：
    * 1. 线程池已经不是RUNNING状态；
    * 2. 线程池是RUNNING状态，但workerCount >= corePoolSize并且workQueue已满。
    * 这时，再次调用addWorker方法，但第二个参数传入为false，将线程池的有限线程数量的上限设置为maximumPoolSize；
    * 如果失败则拒绝该任务
    */
    else if (!addWorker(command, false))
        reject(command);
    }
}
```

这里要注意一下`addWorker(null, false);`也就是创建一个线程，但并没有传入任务，因为任务已经被添加到workQueue中了，所以worker在执行的时候，会直接从workQueue中获取任务。所以，在`workerCountOf(recheck) == 0`时执行`addWorker(null, false);`也是为了保证线程池在RUNNING状态下必须要有一个线程来执行任务.

```java
private boolean addWorker(Runnable firstTask, boolean core) {
    retry: // 标记，标记对一个循环的操作(continue和bread)处理点
    for (;;) {
        int c = ctl.get();
        int rs = runStateOf(c);// 获取运行状态
       /*
        * 这个if判断
        * 如果rs >= SHUTDOWN，则表示此时不再接收新任务；
        * 接着判断以下3个条件，只要有1个不满足，则返回false：
        * 1. rs == SHUTDOWN，这时表示关闭状态，不再接受新提交的任务，但却可以继续处理阻塞队列中已保存的任务
        * 2. firsTask为空
        * 3. 阻塞队列不为空
        * 首先考虑rs == SHUTDOWN的情况
        * 这种情况下不会接受新提交的任务，所以在firstTask不为空的时候会返回false；
        * 然后，如果firstTask为空，并且workQueue也为空，则返回false，
        * 因为队列中已经没有任务了，不需要再添加线程了
        */
        if (rs >= SHUTDOWN &&
            ! (rs == SHUTDOWN && firstTask == null && !workQueue.isEmpty())
           )
            return false;
        for (;;) {
            int wc = workerCountOf(c);// 获取线程数
            // 如果wc超过CAPACITY，也就是ctl的低29位的最大值（二进制是29个1），返回false；
            // 这里的core是addWorker方法的第二个参数，如果为true表示根据corePoolSize来比较，
            // 如果为false则根据maximumPoolSize来比较。
            if (wc >= CAPACITY || wc >= (core ? corePoolSize : maximumPoolSize))
                return false;
            if (compareAndIncrementWorkerCount(c)) // 尝试增加workerCount，如果成功，则跳出第一个for循环
                break retry;     
            c = ctl.get();// 如果增加workerCount失败，则重新获取ctl的值
            // 如果当前的运行状态不等于rs，说明状态已被改变，返回第一个for循环继续执行
            if (runStateOf(c) != rs)
                    continue retry;
            }
        }
        boolean workerStarted = false;
        boolean workerAdded = false;
        Worker w = null;
        try {
            
            w = new Worker(firstTask);// 根据firstTask来创建Worker对象
            final Thread t = w.thread;  // 每一个Worker对象都会创建一个线程
            if (t != null) {
                final ReentrantLock mainLock = this.mainLock;
                mainLock.lock();
                try {
                    int rs = runStateOf(ctl.get());
                    // rs < SHUTDOWN表示是RUNNING状态；
                    // 如果rs是RUNNING状态或者rs是SHUTDOWN状态并且firstTask为null，向线程池中添加线程。
                    // 因为在SHUTDOWN时不会在添加新的任务，但还是会执行workQueue中的任务
                    if (rs < SHUTDOWN || (rs == SHUTDOWN && firstTask == null)) {
                        if (t.isAlive()) 
                          throw new IllegalThreadStateException();
                           // workers是一个HashSet
                           workers.add(w);
                           int s = workers.size();
                           // largestPoolSize记录着线程池中出现过的最大线程数量
                           if (s > largestPoolSize)
                               largestPoolSize = s;
                           workerAdded = true;
                    }
                 } finally {
                    mainLock.unlock();
                 }
                if (workerAdded) {
                    t.start();// 启动线程
                    workerStarted = true;
                }
             }
           } finally {
              if (! workerStarted)
                    addWorkerFailed(w);
           }
    return workerStarted；
 }
```

Worker类线程池中的每一个线程被封装成一个Worker对象，ThreadPool维护的其实就是一组Worker对象，请参见JDK源码。Worker类继承了AQS，并实现了Runnable接口，注意其中的firstTask和thread属性：firstTask用它来保存传入的任务；thread是在调用构造方法时通过ThreadFactory来创建的线程，是用来处理任务的线程。在 调 用 构 造 方 法 时 ， 需 要 把 任 务 传 入 ， 这 里 通 过getThreadFactory().newThread(this);来新建一个线程，newThread方法传入的参数是this，因为Worker本身继承了Runnable接口，也就是一个线程，所以一个Worker对象在启动的时候会调用Worker类中的run方法。Worker继承了AQS，使用AQS来实现独占锁的功能。为什么不使用ReentrantLock来实现呢？可以看到tryAcquire方法，它是不允许重入的，而ReentrantLock是允许重入的：

1. lock方法一旦获取了独占锁，表示当前线程正在执行任务中；
2. 如果正在执行任务，则不应该中断线程；
3. 如果该线程现在不是独占锁的状态，也就是空闲的状态，说明它没有在处理任务，这时可以对该线程进行中断；
4. 线程池在执行shutdown方法或tryTerminate方法时会调用interruptIdleWorkers方法来中断空闲的线程，interruptIdleWorkers方法会使用tryLock方法来判断线程池中的线程是否是空闲状态；
5. 之所以设置为不可重入，是因为我们不希望任务在调用像setCorePoolSize这样的线程池控制方法时重新获取锁。如果使用ReentrantLock，它是可重入的，这样如果在任务中调用了如setCorePoolSize这类线程池控制的方法，会中断正在运行的线程。所以，Worker继承自AQS，用于判断线程是否空闲以及是否可以被中断。此外，在构造方法中执行了setState(-1);，把state变量设置为-1，为什么这么做呢？是因为AQS中默认的state是0，如果刚创建了一个Worker对象，还没有执行任务时，这时就不应该被中断，看一下tryAquire方法：

```java
 protected boolean tryAcquire(int unused) {
    //cas修改state，不可重入
    if (compareAndSetState(0, 1)) {
      setExclusiveOwnerThread(Thread.currentThread());
      return true;
    }
    return false;
 }
```

tryAcquire方法是根据state是否是0来判断的，所以，setState(-1);将state设置为-1是为了禁止在执行任务前对线程进行中断。正因为如此，在runWorker方法中会先调用Worker对象的unlock方法将state设置为0

runWorker方法在Worker类中的run方法调用了runWorker方法来执行任务，runWorker方法的代码如下：

```java
final void runWorker(Worker w) {
    Thread wt = Thread.currentThread();
    Runnable task = w.firstTask;// 获取第一个任务
    w.firstTask = null;
    w.unlock(); // 允许中断
    boolean completedAbruptly = true; // 是否因为异常退出循环
    try {
        // 如果task为空，则通过getTask来获取任务
        while (task != null || (task = getTask()) != null) {
            w.lock();
            if ((runStateAtLeast(ctl.get(), STOP) || (Thread.interrupted() && runStateAtLeast(ctl.get(),STOP))) &&!wt.isInterrupted())
                wt.interrupt();
            try {
                beforeExecute(wt, task);
                Throwable thrown = null;
                try {
                    task.run();
                } catch (RuntimeException x) {
                    thrown = x; throw x;
                } catch (Error x) {
                    thrown = x; throw x;
                } catch (Throwable x) {
                    thrown = x; throw new Error(x);
                } finally {
                    afterExecute(task, thrown);
                }
            } finally {
                task = null;
                w.completedTasks++;
                w.unlock();
            }
        }
         completedAbruptly = false; // 正常会到这句
        } finally {
            processWorkerExit(w, completedAbruptly);
        }
}
```

这里说明一下第一个if判断，目的是：如果线程池正在停止，那么要保证当前线程是中断状态；如果不是的话，则要保证当前线程不是中断状态；这里要考虑在执行该if语句期间可能也执行了shutdownNow方法，shutdownNow方法会把状态设置为STOP，回顾一下STOP状态：不能接受新任务，也不处理队列中的任务，会中断正在处理任务的线程。在线程池处于RUNNING 或 SHUTDOWN 状态时，调用 shutdownNow() 方法会使线程池进入到该状态。STOP状态要中断线程池中的所有线程，而这里使用Thread.interrupted()来判断是否中断是 为 了 确 保 在 RUNNING 或 者 SHUTDOWN 状 态 时 线 程 是 非 中 断 状 态 的 ， 因 为Thread.interrupted()方法会复位中断的状态。

总结一下runWorker方法的执行过程：

1. while循环不断地通过getTask()方法获取任务；
2. getTask()方法从阻塞队列中取任务；
3. 如果线程池正在停止，那么要保证当前线程是中断状态，否则要保证当前线程不是中断状态；
4. 调用task.run()执行任务；
5. 如果task为null则跳出循环，执行processWorkerExit()方法；
6. runWorker方法执行完毕，也代表着Worker中的run方法执行完毕，销毁线程。这里的beforeExecute方法和afterExecute方法在ThreadPoolExecutor类中是空的，留给子类来实现。completedAbruptly变量来表示在执行 任务过程中是否出现了异常，在processWorkerExit方法中会对该变量的值进行判断。

getTask方法getTask方法用来从阻塞队列中取任务，代码如下：

```java
private Runnable getTask() {
    
    boolean timedOut = false; // timeOut变量的值表示上次从阻塞队列中取任务时是否超时
    for (;;) {
        int c = ctl.get();
        int rs = runStateOf(c);
        /*
        * 如果线程池状态rs >= SHUTDOWN，也就是非RUNNING状态，再进行以下判断：
        * 1. rs >= STOP，线程池是否正在stop；
        * 2. 阻塞队列是否为空。
        * 如果以上条件满足，则将workerCount减1并返回null。
        * 因为如果当前线程池状态的值是SHUTDOWN或以上时，不允许再向阻塞队列中添加任务。
        */
        if (rs >= SHUTDOWN && (rs >= STOP || workQueue.isEmpty())) {
            decrementWorkerCount();
            return null;
        }
        int wc = workerCountOf(c);
        // Are workers subject to culling?
        // timed变量用于判断是否需要进行超时控制。
        // allowCoreThreadTimeOut默认是false，也就是核心线程不允许进行超时；
        // wc > corePoolSize，表示当前线程池中的线程数量大于核心线程数量；
        // 对于超过核心线程数量的这些线程，需要进行超时控制
        boolean timed = allowCoreThreadTimeOut || wc > corePoolSize;

        /*
        * wc > maximumPoolSize的情况是因为可能在此方法执行阶段同时执行了setMaximumPoolSize方法；
        * timed && timedOut 如果为true，表示当前操作需要进行超时控制，并且上次从阻塞队列中获取任务发生了超时
        * 接下来判断，如果有效线程数量大于1，或者阻塞队列是空的，那么尝试将workerCount减1；
        * 如果减1失败，则返回重试。
        * 如果wc == 1时，也就说明当前线程是线程池中唯一的一个线程了。
        */
        if ((wc > maximumPoolSize || (timed && timedOut)) && (wc > 1 || workQueue.isEmpty())) {
            if (compareAndDecrementWorkerCount(c))
            return null;
            continue;
        }
        try {
            /*
            * 根据timed来判断，如果为true，则通过阻塞队列的poll方法进行超时控制，如果在keepAliveTime时间内没有获取到任务，				则返回null；
            * 否则通过take方法，如果这时队列为空，则take方法会阻塞直到队列不为空。
             */
            Runnable r = timed ?
            workQueue.poll(keepAliveTime, TimeUnit.NANOSECONDS) :
            workQueue.take();
            if (r != null)
                return r;       
            timedOut = true;// 如果 r == null，说明已经超时，timedOut设置为true
        } catch (InterruptedException retry) {
             // 如果获取任务时当前线程发生了中断，则设置timedOut为false并返回循环重试
             timedOut = false;
        }
    }
}
```

这里重要的地方是第二个if判断，目的是控制线程池的有效线程数量。由上文中的分析可以知道，在执行execute方法时，如果当前线程池的线程数量超过了corePoolSize且小于maximumPoolSize，并且workQueue已满时，则可以增加工作线程，但这时如果超时没有获取到任务，也就是timedOut为true的情况，说明workQueue已经为空了，也就说明了当前线程池中不需要那么多线程来执行任务了，可以把多于corePoolSize数量的线程销毁掉，保持线程数量在corePoolSize即可。什么时候会销毁？当然是runWorker方法执行完之后，也就是Worker中的run方法执行完，由JVM自动回收。getTask方法返回null时，在runWorker方法中会跳出while循环，然后processWorkerExit方法。

processWorkerExit方法:

```java
private void processWorkerExit(Worker w, boolean completedAbruptly) {
    // 如果completedAbruptly值为true，则说明线程执行时出现了异常，需要将workerCount减1；
    // 如果线程执行时没有出现异常，说明在getTask()方法中
    // 已经对workerCount进行了减1操作，这里就不必再减了。
    if (completedAbruptly)
        decrementWorkerCount();
    final ReentrantLock mainLock = this.mainLock;
    mainLock.lock();
    try {
        //统计完成的任务数
        completedTaskCount += w.completedTasks;
        // 从workers中移除，也就表示着从线程池中移除了一个工作线程
        workers.remove(w);
    } finally {
        mainLock.unlock();
    }
   // 根据线程池状态进行判断是否结束线程池
   tryTerminate();
   int c = ctl.get();
   /*
   * 当线程池是RUNNING或SHUTDOWN状态时，如果worker是异常结束，那么会直接addWorke
   * 如果allowCoreThreadTimeOut=true，并且等待队列有任务，至少保留一个worker；
   * 如果allowCoreThreadTimeOut=false，workerCount不少于corePoolSize。
   */
   if (runStateLessThan(c, STOP)) {
       if (!completedAbruptly) {
           int min = allowCoreThreadTimeOut ? 0 : corePoolSize;
       if (min == 0 && ! workQueue.isEmpty())
           min = 1;
       if (workerCountOf(c) >= min)
           return; // replacement not needed
    }
    addWorker(null, false);
}

```

​	至此，processWorkerExit执行完之后，工作线程被销毁，以上就是整个工作线程的生命周期，从execute方法开始，Worker使用ThreadFactory创建新的工作线程，runWorker通过getTask获取任务，然后执行任务，如果getTask返回null，进入processWorkerExit方法，整个线程结束.

#### 1.5 钩子方法

三个钩子方法存在于ThreadPoolExecutor类，这3个方法都是空方法，一般会在子类中重写

- `protected void beforeExecute(Thread t, Runnable r) { }: `任务执行之前的钩子方法
- `protected void afterExecute(Runnable r, Throwable t) { }：` 任务执行之后的钩子方法
- `protected void terminated() { }：` 线程池终止时的钩子方法

```java
ExecutorService pool = new ThreadPoolExecutor(2, 4, 60,TimeUnit.SECONDS, new LinkedBlockingQueue<>(2)){
	@Override
	protected void terminated()
	{
		System.out.println("调度器已停止...");
	}
	@Override
	protected void beforeExecute(Thread t,Runnable target)
	{
		System.out.println("前钩执行...");
		super.beforeExecute(t, target);
	}
	@Override
	protected void afterExecute(Runnable target,Throwable t)
	{
		System.out.println("后钩执行...");
		super.afterExecute(target, t);
	}
};

```

#### 1.6 线程池状态

```java
private static final int RUNNING    = -1 << COUNT_BITS;
private static final int SHUTDOWN   =  0 << COUNT_BITS;
private static final int STOP       =  1 << COUNT_BITS;
private static final int TIDYING    =  2 << COUNT_BITS;
private static final int TERMINATED =  3 << COUNT_BITS;
```

<img src="http://img.zouyh.top/article-img/20240917135053308.png" alt="image-20230227155353292" style="zoom: 80%;" />

1、RUNNING

- 状态说明：线程池处在RUNNING状态时，能够接收新任务，以及对已添加的任务进行处理。
- 状态切换：线程池的初始化状态是RUNNING。换句话说，线程池被一旦被创建，就处 于RUNNING状态，并且线程池中的任务数为0

2、 SHUTDOWN

- 状态说明：线程池处在SHUTDOWN状态时，不接收新任务，但能处理已添加的任务。
-  状态切换：调用线程池的shutdown()接口时，线程池由RUNNING -> SHUTDOWN。

3、STOP

- 状态说明：线程池处在STOP状态时，不接收新任务，不处理已添加的任务，并且会中断正在处理的任务。
-  状态切换：调用线程池的shutdownNow()接口时，线程池由(RUNNING or SHUTDOWN ) -> STOP。

4、TIDYING

- 状态说明：当所有的任务已终止，ctl记录的”任务数量”为0，线程池会变为TIDYING状态。当线程池变为TIDYING状态时，会执行钩子函数terminated()。terminated()在ThreadPoolExecutor类中是空的，若用户想在线程池变为TIDYING时，进行相应的处理；可以通过重载terminated()函数来实现。
- 状态切换：当线程池在SHUTDOWN状态下，阻塞队列为空并且线程池中执行的任务也为空时，就会由 SHUTDOWN -> TIDYING。 当线程池在STOP状态下，线程池中执行的任务为空时，就会由STOP -> TIDYING。

5、 TERMINATED

- 状态说明：线程池彻底终止，就变成TERMINATED状态。
- 状态切换：线程池处在TIDYING状态时，执行完terminated()之后，就会由 TIDYING -> TERMINATED。

进入TERMINATED的条件如下： 线程池不是RUNNING状态； 线程池状态不是TIDYING状态或TERMINATED状态； 如果线程池状态是SHUTDOWN并且workerQueue为空； workerCount为0；设置TIDYING状态成功。

### 二，Executors

​	ThreadPoolExecutor构造函数的参数很多，使用起来很麻烦，为了方便的创建线程池，JavaSE中又定义了Executors类，Eexcutors类提供了四个创建线程池的方法，分别：`newCachedThreadPool`，`newFixedThreadPool`，`newSingleThreadExecutor `，`newScheduleThreadPool `.

#### 2.1 newCachedThreadPool

```java
public static ExecutorService newCachedThreadPool() {
    return new ThreadPoolExecutor(0, Integer.MAX_VALUE,
                                  60L, TimeUnit.SECONDS,
                                  new SynchronousQueue<Runnable>());
}
```

该方法创建一个可缓存线程池，如果线程池长度超过处理需要，可灵活回收空闲线程，若无可回收，则新建线程。此类型线程池特点是：

- 工作线程的创建数量几乎没有限制(其实也有限制的,数目为Interger. MAX_VALUE)
- 空闲的工作线程会自动销毁，有新任务会重新创建
- 在使用CachedThreadPool时，一定要注意控制任务的数量，否则，由于大量线程同时运行，很有会造成系统瘫痪。

#### 2.2 newFixedThreadPool

```java
public static ExecutorService newFixedThreadPool(int nThreads) {
    return new ThreadPoolExecutor(nThreads, nThreads,
                                  0L, TimeUnit.MILLISECONDS,
                                  new LinkedBlockingQueue<Runnable>());
}
```

   该方法创建一个指定工作线程数量的线程池。每当提交一个任务就创建一个工作线程，如果工作线程数量达到线程池初始的最大数，则将提交的任务存入到池队列中。

优点：具有线程池提高程序效率和节省创建线程时所耗的开销.

缺点：1，在线程池空闲时，即线程池中没有可运行任务时，它不会释放工作线程，还会占用一定的系统资源。2，阻塞队列无界，队列很大，很有可能导致JVM出现OOM（Out Of Memory）异常，即内存资源耗尽

#### 2.3 newSingleThreadExecutor

```java
public static ExecutorService newSingleThreadExecutor() {
    return new FinalizableDelegatedExecutorService
        (new ThreadPoolExecutor(1, 1,
                                0L, TimeUnit.MILLISECONDS,
                                new LinkedBlockingQueue<Runnable>()));
}
```

​	该方法创建一个单线程化的Executor，即只创建唯一的工作者线程来执行任务，它只会用唯一的工作线程来执行任务，保证所有任务按照指定顺序(FIFO, LIFO,优先级)执行。如果这个线程异常结束，会有另一个取代它，保证顺序执行。

单工作线程最大的特点是可保证顺序地执行各个任务，并且在任意给定的时间不会有多个线程是活动的，缺点是阻塞队列也是无界，队列很大，很有可能导致JVM出现OOM（Out Of Memory）异常，即内存资源耗尽

#### 2.4 newScheduleThreadPool

```java
public ScheduledThreadPoolExecutor(int corePoolSize) {
    super(corePoolSize, Integer.MAX_VALUE, 0, NANOSECONDS,
          new DelayedWorkQueue()); // 调用父类ThreadPoolExecutor的构造方法
}
```

​	该方法创建一个定长的线程池，而且支持定时（schedule方法）的以及周期性的任务执行，支持定时及周期性任务执行，主要问题在于线程数不设上限`Integer.MAX_VALUE`
