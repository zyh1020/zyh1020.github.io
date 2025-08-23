---
icon: document
# 标题
title: 'zookeeper实现分布式锁'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-11
# 一个页面可以有多个分类
category:
  - zookeeper
# 一个页面可以有多个标签
tag:
  - 常用
  - zookeeper
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，zookeeper实现分布式锁

引入jar：

```xml
<dependency>
	<groupId>org.apache.zookeeper</groupId>
	<artifactId>zookeeper</artifactId>
	<version>3.5.7</version>
</dependency>
```

添加配置：

```java
@Component
public class ZookeeperConfig {
    private ZooKeeper zooKeeper;
    @PostConstruct
    public void init(){
        CountDownLatch countDownLatch = new CountDownLatch(1);
        try {
            zooKeeper = new ZooKeeper("1.15.141.218:2181", 30000, new Watcher() {
                @Override
                public void process(WatchedEvent event) {
                    if(Event.KeeperState.SyncConnected.equals(event.getState())
                            && Event.EventType.None.equals(event.getType())){
                        System.out.println("......连接成功.......");
                        countDownLatch.countDown();
                    }else if(Event.KeeperState.Closed.equals(event.getState())){
                        System.out.println("......连接关闭.......");
                    }

                }
            });
            countDownLatch.await();
        } catch (IOException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    @PreDestroy
    public void destroy(){
        if(zooKeeper != null){
            try {
                zooKeeper.close();
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }
    public ZooKeeper getZooKeeper(){
        return zooKeeper;
    }
}

```

#### 1.1 互斥非公平锁

```java
public class ZkLock  implements Lock {
    private String lockName;
    private static final String ROOT_LOCK_PATH = "/zklock"; // 默认给个基础路径
    private ZooKeeper zooKeeper;

    public ZkLock(String lockName, ZooKeeper zooKeeper) {
        this.lockName = lockName;
        this.zooKeeper = zooKeeper;
        try {
            if(zooKeeper.exists(ROOT_LOCK_PATH, false) == null){
                zooKeeper.create(ROOT_LOCK_PATH,null, ZooDefs.Ids.OPEN_ACL_UNSAFE, CreateMode.PERSISTENT);
            }
        } catch (KeeperException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    @Override
    public void lock() {
        tryLock();
    }

    @Override
    public void lockInterruptibly() throws InterruptedException {

    }

    @Override
    public boolean tryLock() {
        try {
            // 获取锁
            zooKeeper.create(this.ROOT_LOCK_PATH+"/"+this.lockName,null,ZooDefs.Ids.OPEN_ACL_UNSAFE, CreateMode.EPHEMERAL);
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            // 监听重试
            try {
                CountDownLatch countDownLatch = new CountDownLatch(1);
                if(zooKeeper.exists(this.ROOT_LOCK_PATH+"/"+this.lockName, new Watcher() {
                    @Override
                    public void process(WatchedEvent watchedEvent) {
                        countDownLatch.countDown();
                    }
                }) == null){
                }
                countDownLatch.await();
                tryLock();
                return true;
            } catch (Exception e1) {
                e1.printStackTrace();
                return false;
            }

        }
    }

    @Override
    public boolean tryLock(long time, TimeUnit unit) throws InterruptedException {
        return false;
    }

    @Override
    public void unlock() {
        try {
            zooKeeper.delete(this.ROOT_LOCK_PATH+this.lockName,-1);
        } catch (InterruptedException e) {
            e.printStackTrace();
        } catch (KeeperException e) {
            e.printStackTrace();
        }
    }

    @Override
    public Condition newCondition() {
        return null;
    }
}
```

使用：

```java
public void test(){
	ZkLock zkLock = new ZkLock( "/lock",zookeeperConfig.getZooKeeper());
	try {
		zkLock.lock();
	} catch (Exception e) {
		e.printStackTrace();
	}finally {
		zkLock.unlock(); // 解锁
	}
}
```

如上实现方式在并发问题比较严重的情况下，性能会下降的比较厉害，主要原因是，所有的连接都在对同一个节点进行监听，当服务器检测到删除事件时，要通知所有的连接，所有的连接同时收到事件，再次并发竞争，这就是惊群效应。这种加锁方式是非公平的。

想要避免惊群效应带来的性能损耗，可以使用阻塞公平锁的机制对其优化，提高响应性能

#### 1.2 阻塞公平锁

```java
public class ZkFairLock implements Lock {
    private String lockName;
    private ZooKeeper zooKeeper;
    private static final String ROOT_LOCK_PATH = "/zklock"; // 默认给个基础路径

    private String currentNodePath; // 记录临时序号节点值

    public ZkFairLock(String lockName, ZooKeeper zooKeeper) {
        this.lockName = lockName;
        this.zooKeeper = zooKeeper;
        try {
            if(zooKeeper.exists(ROOT_LOCK_PATH, false) == null){
                zooKeeper.create(ROOT_LOCK_PATH,null, ZooDefs.Ids.OPEN_ACL_UNSAFE, CreateMode.PERSISTENT);
            }
        } catch (KeeperException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    @Override
    public void lock() {
        tryLock();
    }

    @Override
    public void lockInterruptibly() throws InterruptedException {

    }

    @Override
    public boolean tryLock() {
        try {
            // 获取锁
            currentNodePath = zooKeeper.create(this.ROOT_LOCK_PATH + "/" + this.lockName+"-", null, ZooDefs.Ids.OPEN_ACL_UNSAFE, CreateMode.EPHEMERAL_SEQUENTIAL);
            List<String> childrens = zooKeeper.getChildren(this.ROOT_LOCK_PATH, false); // 获取所有的子节点
            childrens.stream().filter(node -> StringUtils.startsWith(node,this.lockName+"-")).collect(Collectors.toList());// 过滤一下
            Collections.sort(childrens); // 排序
            int index = Collections.binarySearch(childrens, StringUtils.substringAfter(currentNodePath,"/")); // 获取当前节点的下表
            if(index < 1){
                return true;
            }else {
                String preNode = childrens.get(index - 1); // 前一个节点
                if(preNode != null){
                    CountDownLatch countDownLatch = new CountDownLatch(1);
                    if(zooKeeper.exists(preNode, new Watcher() {
                        @Override
                        public void process(WatchedEvent watchedEvent) {
                            countDownLatch.countDown();
                        }
                    }) == null){
                    }
                    countDownLatch.await();// 阻塞等待前一个节点删除
                }
                return true;
            }

        } catch (Exception e) {
            e.printStackTrace();
            // 监听重试
            return false;
        }
    }

    @Override
    public boolean tryLock(long time, TimeUnit unit) throws InterruptedException {
        return false;
    }

    @Override
    public void unlock() {
        try {
            zooKeeper.delete(this.ROOT_LOCK_PATH+"/"+this.currentNodePath,-1);
        } catch (InterruptedException e) {
            e.printStackTrace();
        } catch (KeeperException e) {
            e.printStackTrace();
        }
    }

    @Override
    public Condition newCondition() {
        return null;
    }
}
```

使用：

```java
public void test(){
	ZkFairLock zkFairLock = new ZkFairLock( "/lock",zookeeperConfig.getZooKeeper());
	try {
		zkFairLock.lock();
	} catch (Exception e) {
		e.printStackTrace();
	}finally {
		zkFairLock.unlock(); // 解锁
	}
}
```

#### 1.3 curator

为了更好的实现Java操作ZooKeeper服务器, 后来出现了非常强大的Curator框架, 目前是Apache的顶级项目。里面提供了更多丰富的操作, 例如Session超时重连、主从选举、分布式计数器、分布式锁等等适用于各种复杂的ZooKeeper场景的API封装

##### 1.3.1 加锁

引入jar：

```xml
<dependency>
	<groupId>org.apache.zookeeper</groupId>
	<artifactId>zookeeper</artifactId>
	<version>3.5.7</version>
</dependency>
<dependency>
	<groupId>org.apache.curator</groupId>
	<artifactId>curator-recipes</artifactId>
	<version>4.3.0</version>
	<exclusions>
		<exclusion>
			<groupId>org.apache.zookeeper</groupId>
			<artifactId>zookeeper</artifactId>
		</exclusion>
	</exclusions>
</dependency>
```

添加配置：

```java
@Configuration
public class CuratorConfig {
    @Bean
    public CuratorFramework curatorFramework(){
        // 第一步：创建链接
        CuratorFramework  curatorFramework = CuratorFrameworkFactory.builder()
                .connectString("1.15.141.218:2181")
                .connectionTimeoutMs(200000)
                .retryPolicy(new ExponentialBackoffRetry(10000, 3))
                .sessionTimeoutMs(200000)
                .build(); //
        curatorFramework.start();//启动zookeeper客户端curator
        return curatorFramework;
    }
}
```

加锁测试：

```java
public void tryMutexLock(){
        InterProcessMutex lock = new InterProcessMutex(curatorFramework, "/lock");
        try {
            lock.acquire(); // 加锁

        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            try {
                lock.release(); // 解锁
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
```

加锁原理，跟进`lock.acquire()`方法：

```java
public void acquire() throws Exception {
	if (!this.internalLock(-1L, (TimeUnit)null)) { // 默认设置时间
		throw new IOException("Lost connection while trying to acquire lock: " + this.basePath);
	}
}
```

继续跟进`this.internalLock(-1L, (TimeUnit)null)`方法：

```java
private boolean internalLock(long time, TimeUnit unit) throws Exception {
	Thread currentThread = Thread.currentThread(); // 获取当前线程
    // this.threadData是InterProcessMutex的成员变量ConcurrentMap<Thread, InterProcessMutex.LockData> threadData
    // LockData 是InterProcessMutex内部类，有三个成员变量owningThread对应线程，lockPath锁路径，lockCount锁重入次数
	InterProcessMutex.LockData lockData = (InterProcessMutex.LockData)this.threadData.get(currentThread);
	if (lockData != null) { // 如果获取到表示，owningThread对应线程的lockPath锁路径已经加锁了
		lockData.lockCount.incrementAndGet(); // 重入次数+1
		return true;
	} else {
        // this.internals是 LockInternals对象，是在InterProcessMutex构造方法赋值的
		String lockPath = this.internals.attemptLock(time, unit, this.getLockNodeBytes()); // 加锁的核心代码
		if (lockPath != null) { // != null 加锁成功
            // 创建LockData对象
			InterProcessMutex.LockData newLockData = new InterProcessMutex.LockData(currentThread, lockPath);
             // this.threadData是InterProcessMutex的成员变量ConcurrentMap<Thread, InterProcessMutex.LockData>
			this.threadData.put(currentThread, newLockData);
			return true; // 返回加锁成功
		} else {
			return false; // 返回加锁失败
		}
	}
}
```

加锁的核心，LockInternals对象的attemptLock方法：

```java
String attemptLock(long time, TimeUnit unit, byte[] lockNodeBytes) throws Exception {
	long startMillis = System.currentTimeMillis();
	Long millisToWait = unit != null ? unit.toMillis(time) : null;
	byte[] localLockNodeBytes = this.revocable.get() != null ? new byte[0] : lockNodeBytes;
	int retryCount = 0;
	String ourPath = null;
	boolean hasTheLock = false; // 设置是否获取到锁标记，默认false
	boolean isDone = false; // 设置跳出while标记，默认false

	while(!isDone) {
		isDone = true; // 跳出while标记，置为true
		try {
            // 标记①，createsTheLock方法是创建临时序号节点，this.driver是LockInternalsDriver对象
			ourPath = this.driver.createsTheLock(this.client, this.path, localLockNodeBytes);
            // 标记②，internalLockLoop判断临时序号节点ourPath是否是最小的序号节点
			hasTheLock = this.internalLockLoop(startMillis, millisToWait, ourPath);
		} catch (NoNodeException var14) {
			if (!this.client.getZookeeperClient().getRetryPolicy().allowRetry(retryCount++, System.currentTimeMillis() - startMillis, RetryLoop.getDefaultRetrySleeper())) {
				throw var14;
			}

			isDone = false;
		}
	}

	return hasTheLock ? ourPath : null;
}
```

标记①，createsTheLock方法是创建临时序号节点，跟进LockInternalsDriver对象的createsTheLock方法：

```java
public String createsTheLock(CuratorFramework client, String path, byte[] lockNodeBytes) throws Exception {
	String ourPath;
	if (lockNodeBytes != null) { // 没有数据的创建
        // 创建的是临时节点CreateMode.EPHEMERAL_SEQUENTIAL，但是path是什么
		ourPath = (String)((ACLBackgroundPathAndBytesable)client.create().creatingParentContainersIfNeeded().withProtection().withMode(CreateMode.EPHEMERAL_SEQUENTIAL)).forPath(path, lockNodeBytes); 
	} else { // 有数据的的创建 
		ourPath = (String)((ACLBackgroundPathAndBytesable)client.create().creatingParentContainersIfNeeded().withProtection().withMode(CreateMode.EPHEMERAL_SEQUENTIAL)).forPath(path);
	}

	return ourPath;
}
```

`creatingParentContainersIfNeeded()`返回的是`ProtectACLCreateModeStatPathAndBytesable<String>`对象，这对象的withProtection()方法如下：

```java
public ACLCreateModeBackgroundPathAndBytesable<String> withProtection() {
	return CreateBuilderImpl.this.withProtection();
}
```

继续跟进`CreateBuilderImpl.this.withProtection();`方法：

```java
public ACLCreateModeStatBackgroundPathAndBytesable<String> withProtection() {
	this.protectedMode.setProtectedMode();
	return this.asACLCreateModeStatBackgroundPathAndBytesable();
}
```

继续跟进`this.protectedMode.setProtectedMode();`方法：

```java
void setProtectedMode() {
	this.doProtected = true; // 为this.protectedMode的doProtected属性赋值true
	this.resetProtectedId(); // 生成一个uuid
}

void resetProtectedId() {
	this.protectedId = UUID.randomUUID().toString();
}
```

现在我们知道了creatingParentContainersIfNeeded().withProtection()方法，为this.protectedMode的doProtected属性赋值true，

为this.protectedMode的protectedId属性赋值一个uuid，传入的参数path = `我们创建InterProcessMutex对象传入的路径+ "/lock-"`，接下来继续看看forPath方法，forPath方法需要一个参数path，所以再看看forPath方法之前我们先找一下，参数path是什么？path是传入的参数，继续往前追述，找到`this.path`是LockInternals的对象的成员变量，LockInternals的对象的创建是在InterProcessMutex的构造方法创建的，所以我们看InterProcessMutex的构造方法：

```java
public InterProcessMutex(CuratorFramework client, String path) {
	this(client, path, new StandardLockInternalsDriver());
}
public InterProcessMutex(CuratorFramework client, String path, LockInternalsDriver driver) {
	this(client, path, "lock-", 1, driver);
}
InterProcessMutex(CuratorFramework client, String path, String lockName, int maxLeases, LockInternalsDriver driver) {
	this.threadData = Maps.newConcurrentMap(); // 创建了存储重入信息的map
	this.basePath = PathUtils.validatePath(path); // 校验我们传入的path是否正确
    // 注意：lockName = "lock-" maxLeases = 1
	this.internals = new LockInternals(client, driver, path, lockName, maxLeases); 
}
```

继续跟进，创建的LockInternals对象构造方法，我们的目的就是LockInternals的成员变量的path是什么别忘了：

```java
LockInternals(CuratorFramework client, LockInternalsDriver driver, String path, String lockName, int maxLeases) {
	this.driver = driver;
	this.lockName = lockName; // lockName = lock-
	this.maxLeases = maxLeases; // maxLeases = 1
	this.client = client.newWatcherRemoveCuratorFramework();
	this.basePath = PathUtils.validatePath(path); // 又一次校验我们传入的path是否正确
	this.path = ZKPaths.makePath(path, lockName); // 找到了为LockInternals的成员变量的path赋值
}

```

跟进`ZKPaths.makePath(path, lockName);`方法：

```java
public static String makePath(String parent, String child) { // parent = path ，child = lockName = lock-
	int maxPathLength = nullableStringLength(parent) + nullableStringLength(child) + 2;
	StringBuilder path = new StringBuilder(maxPathLength);
	joinPath(path, parent, child); // 拼接字符
	return path.toString();
}
```

结论最后拼接的格式为：`我们创建InterProcessMutex对象传入的路径+ "/lock-"`；

好的，我们知道了forPath方法参数path的值， 跟进forPath方法：

```java
public String forPath(String path) throws Exception {
  return this.forPath(path, this.client.getDefaultData()); // 继续跟进
}
public String forPath(String givenPath, byte[] data) throws Exception {
	if (this.compress) {
		data = this.client.getCompressionProvider().compress(givenPath, data);
	}

	String adjustedPath = this.adjustPath(this.client.fixForNamespace(givenPath, this.createMode.isSequential())); // 核心
	List<ACL> aclList = this.acling.getAclList(adjustedPath);
	this.client.getSchemaSet().getSchema(givenPath).validateCreate(this.createMode, givenPath, data, aclList);
	String returnPath = null;
	if (this.backgrounding.inBackground()) {
		this.pathInBackground(adjustedPath, data, givenPath);
	} else {
		String path = this.protectedPathInForeground(adjustedPath, data, aclList);
		returnPath = this.client.unfixForNamespace(path);
	}

	return returnPath;
}
```

跟进`this.adjustPath(this.client.fixForNamespace(givenPath, this.createMode.isSequential()))`方法

```java
String adjustPath(String path) throws Exception { // path = 我们创建InterProcessMutex对象传入的路径+ "/lock-"`
	if (this.protectedMode.doProtected()) { // this.protectedMode的doProtected属性true，上面提到过
        // PathAndNode有path和node两个属性，ZKPaths.getPathAndNode方法将path，拆分成：
        // pathAndNode的属性path = 我们创建InterProcessMutex对象传入的路径 + "/"
        // pathAndNode的属性node =  "lock-"
		PathAndNode pathAndNode = ZKPaths.getPathAndNode(path);
        // getProtectedPrefix方法的作用是拼接字符串："_c_" + (this.protectedMode.protectedId() = uuid) + "-";
        // 所以：name = "_c_" + (this.protectedMode.protectedId() = uuid) + "-" + "/lock-"
		String name = getProtectedPrefix(this.protectedMode.protectedId()) + pathAndNode.getNode();
        // path = 我们创建InterProcessMutex对象传入的路径 + "/" + "_c_" + (this.protectedMode.protectedId() = uuid) + "-" + "lock-"
		path = ZKPaths.makePath(pathAndNode.getPath(), name);
	}

	return path;
}
```

所以，最终创建临时带序号的节点格式= `我们创建InterProcessMutex对象传入的路径 + "/" + "_c_" + (this.protectedMode.protectedId() = uuid) + "-" + "lock-"`;

标记②，internalLockLoop判断临时序号节点ourPath是否是最小的序号节点，跟进`hasTheLock = this.internalLockLoop(startMillis, millisToWait, ourPath);`方法：

```java
private boolean internalLockLoop(long startMillis, Long millisToWait, String ourPath) throws Exception {
	boolean haveTheLock = false; // 设置一个加锁是否成功标志
	boolean doDelete = false;  // 设置是否删除节点标志

	try {
		if (this.revocable.get() != null) {
			((BackgroundPathable)this.client.getData().usingWatcher(this.revocableWatcher)).forPath(ourPath);
		}

        // 加锁失败一直循环
		while(this.client.getState() == CuratorFrameworkState.STARTED && !haveTheLock) {
            
			List<String> children = this.getSortedChildren(); // 获取basePath节点下所有的子节点
            // 获取节点名字
			String sequenceNodeName = ourPath.substring(this.basePath.length() + 1);
            
            // getsTheLock方法，判断是否是第一个，是的话PredicateResults的getsTheLock是true，没有监听PredicateResults的pathToWatch=null，否者的pathToWatch = 前一个节点的node
			PredicateResults predicateResults = this.driver.getsTheLock(this.client, children, sequenceNodeName, this.maxLeases);
            
			if (predicateResults.getsTheLock()) { // 判断是否是第一个
				haveTheLock = true; //是的话加锁成功
			} else {
                // 不是的话，监听前一个
				String previousSequencePath = this.basePath + "/" + predicateResults.getPathToWatch();
				synchronized(this) {
					try {
						((BackgroundPathable)this.client.getData().usingWatcher(this.watcher)).forPath(previousSequencePath);
						if (millisToWait == null) {
							this.wait();
						} else {
							millisToWait = millisToWait - (System.currentTimeMillis() - startMillis);
							startMillis = System.currentTimeMillis();
							if (millisToWait > 0L) {
								this.wait(millisToWait);
							} else {
								doDelete = true;
								break;
							}
						}
					} catch (NoNodeException var19) {
					}
				}
			}
		}
	} catch (Exception var21) {
		ThreadUtils.checkInterrupted(var21);
		doDelete = true;
		throw var21;
	} finally {
		if (doDelete) { // 如果出现异常，删除节点
			this.deleteOurPath(ourPath);
		}

	}

	return haveTheLock;
}
```

getsTheLock方法如下：

```java
public PredicateResults getsTheLock(CuratorFramework client, List<String> children, String sequenceNodeName, int maxLeases) throws Exception {
    // 获取节点需要
	int ourIndex = children.indexOf(sequenceNodeName);
	validateOurIndex(sequenceNodeName, ourIndex);
	boolean getsTheLock = ourIndex < maxLeases; // maxLeases = 1  小于1也就是最小的序号
    // 如果最小就不需要监听，否者监听前一个
	String pathToWatch = getsTheLock ? null : (String)children.get(ourIndex - maxLeases);
	return new PredicateResults(pathToWatch, getsTheLock);
}
```

##### 1.3.2 可重入锁

Curator的可重入锁的实现的重入信息保存在InterProcessMutex的成员变量`ConcurrentMap<Thread, InterProcessMutex.LockData> threadData`中，所以Curator重入是相对于一个InterProcessMutex对象的，例如下面的就不是锁重入，tryMutexLockOne方法和tryMutexLockTwo方法各自创建了一个InterProcessMutex对象，它和Redisson锁重入不一样，Redisson锁重入信息保存在redis中：

```java
public void tryMutexLockOne(){
	InterProcessMutex lock = new InterProcessMutex(curatorFramework, "/lock");
	try {
		lock.acquire(); // 加锁
		tryMutexLockTwo(); // 重入了吗？
	} catch (Exception e) {
		e.printStackTrace();
	} finally {
		try {
			lock.release(); // 解锁
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
}

public void tryMutexLockTwo(){
	InterProcessMutex lock = new InterProcessMutex(curatorFramework, "/lock");
	try {
		lock.acquire(); // 加锁

	} catch (Exception e) {
		e.printStackTrace();
	} finally {
		try {
			lock.release(); // 解锁
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
}
```

##### 1.3.4 读写锁

读锁：

```java
public void tryReadLock(){
	InterProcessReadWriteLock readWriteLock = new InterProcessReadWriteLock(curatorFramework, "/lock");
	InterProcessMutex rLock = readWriteLock.readLock();
	try {
		rLock.acquire();
	} catch (Exception e) {
		e.printStackTrace();
	} finally {
		try {
			rLock.release();
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
}
```

写锁：

```java
public void tryWriteLock(){
	InterProcessReadWriteLock readWriteLock = new InterProcessReadWriteLock(curatorFramework, "/lock");
	InterProcessMutex wLock = readWriteLock.writeLock();
	try {
		wLock.acquire();
	} catch (Exception e) {
		e.printStackTrace();
	} finally {
		try {
			wLock.release();
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
}
```

原理：

先看`new InterProcessReadWriteLock(curatorFramework, "/lock");`做了什么：

```java
public InterProcessReadWriteLock(CuratorFramework client, String basePath, byte[] lockData) {
	lockData = lockData == null ? null : Arrays.copyOf(lockData, lockData.length);
    // 创建写锁
	this.writeMutex = new InterProcessReadWriteLock.InternalInterProcessMutex(client, basePath, "__WRIT__", lockData, 1, new InterProcessReadWriteLock.SortingLockInternalsDriver() {
		public PredicateResults getsTheLock(CuratorFramework client, List<String> children, String sequenceNodeName, int maxLeases) throws Exception {
			return super.getsTheLock(client, children, sequenceNodeName, maxLeases);
		}
	});
    // 创建读锁
	this.readMutex = new InterProcessReadWriteLock.InternalInterProcessMutex(client, basePath, "__READ__", lockData, 2147483647, new InterProcessReadWriteLock.SortingLockInternalsDriver() {
		public PredicateResults getsTheLock(CuratorFramework client, List<String> children, String sequenceNodeName, int maxLeases) throws Exception {
			return InterProcessReadWriteLock.this.readLockPredicate(children, sequenceNodeName);
		}
	});
}
```

和InterProcessMutex锁对比：

| 锁        | InterProcessMutex | readMutex         | writeMutex        |
| --------- | ----------------- | ----------------- | ----------------- |
| 类型      | InterProcessMutex | InterProcessMutex | InterProcessMutex |
| lockName  | `lock-`           | `__READ__`        | `__WRIT__`        |
| maxLeases | 1                 | 2147483647        | 1                 |

因为都是InterProcessMutex类型加锁的流程参考上面的，这里说一下区别就在于，判断是否有资格拥有锁，是通过getsTheLock方法实现的：

writeMutex的getsTheLock方法:

```java
this.writeMutex = new InterProcessReadWriteLock.InternalInterProcessMutex(client, basePath, "__WRIT__", lockData, 1, new InterProcessReadWriteLock.SortingLockInternalsDriver() {
    // writeMutex的getsTheLock方法
	public PredicateResults getsTheLock(CuratorFramework client, List<String> children, String sequenceNodeName, int maxLeases) throws Exception {
		return super.getsTheLock(client, children, sequenceNodeName, maxLeases);
	}
});
```

```java
public PredicateResults getsTheLock(CuratorFramework client, List<String> children, String sequenceNodeName, int maxLeases) throws Exception {
    // 获取节点需要
	int ourIndex = children.indexOf(sequenceNodeName);
	validateOurIndex(sequenceNodeName, ourIndex);
	boolean getsTheLock = ourIndex < maxLeases; // maxLeases = 1  小于1也就是最小的序号
    // 如果最小就不需要监听，否者监听前一个
	String pathToWatch = getsTheLock ? null : (String)children.get(ourIndex - maxLeases);
	return new PredicateResults(pathToWatch, getsTheLock);
}
```

readMutex的getsTheLock方法：

```java
this.readMutex = new InterProcessReadWriteLock.InternalInterProcessMutex(client, basePath, "__READ__", lockData, 2147483647, new InterProcessReadWriteLock.SortingLockInternalsDriver() {
    // getsTheLock方法
	public PredicateResults getsTheLock(CuratorFramework client, List<String> children, String sequenceNodeName, int maxLeases) throws Exception {
		return InterProcessReadWriteLock.this.readLockPredicate(children, sequenceNodeName);
	}
});
```

```java
private PredicateResults readLockPredicate(List<String> children, String sequenceNodeName) throws Exception {
	if (this.writeMutex.isOwnedByCurrentThread()) { // 判断拥有写锁锁的线程是自己
		return new PredicateResults((String)null, true); // null不需要监听，true加锁成功
	} else { //  //拥有写锁锁的线程不是自己
		int index = 0;
		int firstWriteIndex = 2147483647;
		int ourIndex = -1; // 记录最小的节点WRIT下表

		String node;
		for(Iterator var6 = children.iterator(); var6.hasNext(); ++index) { // 遍历所有的节点
			node = (String)var6.next();
			if (node.contains("__WRIT__")) { //  在找到自己的节点下标，就结束循环之前最大的__WRIT__下表
				firstWriteIndex = Math.min(index, firstWriteIndex);
			} else if (node.startsWith(sequenceNodeName)) {
				ourIndex = index; // 找到自己的节点下标，就结束循环
				break;
			}
		}
		// 校验下标是否合法
		StandardLockInternalsDriver.validateOurIndex(sequenceNodeName, ourIndex);
		boolean getsTheLock = ourIndex < firstWriteIndex; // 找到就会更新firstWriteIndex的值就会小于自己的节点下标
		node = getsTheLock ? null : (String)children.get(firstWriteIndex);
		return new PredicateResults(node, getsTheLock);
	}
}
```

##### 1.3.5 联锁

使用方式

```java
// 构造函数需要包含的锁的集合，或者一组ZooKeeper的path
public InterProcessMultiLock(List<InterProcessLock> locks);
public InterProcessMultiLock(CuratorFramework client, List<String> paths);

// 获取锁
public void acquire();
public boolean acquire(long time, TimeUnit unit);

// 释放锁
public synchronized void release();
```

联锁原理：

```java
public void acquire() throws Exception {
	this.acquire(-1L, (TimeUnit)null);
}

public boolean acquire(long time, TimeUnit unit) throws Exception {
	Exception exception = null;
	List<InterProcessLock> acquired = Lists.newArrayList();
	boolean success = true;
	Iterator var7 = this.locks.iterator(); 

	InterProcessLock lock;
	while(var7.hasNext()) { // 遍历
		lock = (InterProcessLock)var7.next();

		try {
			if (unit == null) { // 没有时间限制的
				lock.acquire(); // 每一个都去加锁
				acquired.add(lock); // 成功的保存在acquired集合中
			} else {
				if (!lock.acquire(time, unit)) {// 有时间限制的
					success = false;
					break;
				}

				acquired.add(lock);// 成功的保存在acquired集合中
			}
		} catch (Exception var11) {
			ThreadUtils.checkInterrupted(var11);
			success = false;
			exception = var11;
		}
	}

	if (!success) { // 整体没有成功
        // 遍历释放哪些加锁成功的zookeeper
		var7 = Lists.reverse(acquired).iterator();
		while(var7.hasNext()) {
			lock = (InterProcessLock)var7.next();

			try {
				lock.release();
			} catch (Exception var10) {
				ThreadUtils.checkInterrupted(var10);
			}
		}
	}

	if (exception != null) {
		throw exception;
	} else {
		return success;
	}
}
```

