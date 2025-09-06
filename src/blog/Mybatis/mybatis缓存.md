---
icon: file-lines
# 标题
title: 'mybatis缓存'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-15
# 一个页面可以有多个分类
category:
  - Mybatis
# 一个页面可以有多个标签
tag:
  - 必看
  - Mybatis
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，mybatis的缓存

#### 1.1一级缓存

##### 1.1.1介绍

1. MyBatis的一级查询缓存（也叫作本地缓存）是基于`org.apache.ibatis.cache.impl.PerpetualCache` 类的HashMap本地缓存，其作用域是SqlSession，myBatis 默认一级查询缓存是开启状态，且不能关闭。

2. 在同一个SqlSession中两次执行相同的 sql查询语句，第一次执行完毕后，会将查询结果写入到缓存中，第二次会从缓存中直接获取数据，而不再到数据库中进行查询，这样就减少了数据库的访问，从而提高查询效率。

3. 基于PerpetualCache 的 HashMap本地缓存，其存储作用域为 Session，PerpetualCache 对象是在SqlSession中的Executor的localcache属性当中存放，当 Session flush 或 close 之后，该Session中的所有 Cache 就将清空。

##### 1.2.1使用

> 开启：myBatis 默认一级查询缓存是开启状态，且不能关闭，所以不用做任何配置。
>

我们验证一下一级缓存的存在：

```java
public class App {
	public static void main(String[] args) {
		String resource = "mybatis‐config.xml";
		Reader reader;
		try {
			//将XML配置文件构建为Configuration配置类
			reader = Resources.getResourceAsReader(resource);
			// 通过加载配置文件流构建一个SqlSessionFactory DefaultSqlSessionFactory
			SqlSessionFactory sqlMapper = new SqlSessionFactoryBuilder().build(reader);
			// 数据源 执行器 DefaultSqlSession
			SqlSession session = sqlMapper.openSession();
			try {
				// 获取mapper
				UserMapper mapper = session.getMapper(UserMapper.class);
				User user1 = mapper.selectById(1L);
                User user2 = mapper.selectById(1L);
				System.out.println(user1 == user2); // 输出的结果为true
			} catch (Exception e) {
 				e.printStackTrace();
 			}finally {
 				session.close();
			}
		} catch (IOException e) {
			e.printStackTrace();
		}
	}
}
```

查看输出：

```
Setting autocommit to false on JDBC Connection [com.mysql.cj.jdbc.ConnectionImpl@83dc97]
==>  Preparing: select * from user where id = ? 
==> Parameters: 1(Integer)
<==    Columns: id, age, name
<==        Row: 1, 19, 李四
<==      Total: 1
true
```

可以看到，这里只进行了一次查询，并且结果值返回的`true`，说明在`JVM`内存中只创建了一个对象出来。现在我们再来验证一下一级缓存是否真的只对同一个SqlSession有效，我们对上面的示例代码进行如下改变

```java
public class App {
	public static void main(String[] args) {
		String resource = "mybatis‐config.xml";
		Reader reader;
		try {
			//将XML配置文件构建为Configuration配置类
			reader = Resources.getResourceAsReader(resource);
			// 通过加载配置文件流构建一个SqlSessionFactory DefaultSqlSessionFactory
			SqlSessionFactory sqlSessionFactory = new SqlSessionFactoryBuilder().build(reader);
			// 数据源 执行器 DefaultSqlSession
			SqlSession session1 = sqlSessionFactory.openSession();
            SqlSession session2 = sqlSessionFactory.openSession();
            
			try {
				// 获取mapper
				UserMapper mapper1 = session1.getMapper(UserMapper.class);
                UserMapper mapper2 = session2.getMapper(UserMapper.class);
                User user1 = mapper1.selectById(1L);
                User user2 = mapper2.selectById(1L);
				System.out.println(user1 == user2); // 输出的结果为false
			} catch (Exception e) {
 				e.printStackTrace();
 			}finally {
 				session.close();
			}
		} catch (IOException e) {
			e.printStackTrace();
		}
	}
}
```

查看输出：

```
==>  Preparing: select * from user where id = ? 
==> Parameters: 1(Integer)
<==    Columns: id, age, name
<==        Row: 1, 19, 李四
<==      Total: 1
==>  Preparing: select * from user where id = ? 
==> Parameters: 1(Integer)
<==    Columns: id, age, name
<==        Row: 1, 19, 李四
<==      Total: 1
false
```

可以看到，这里只进行了二次查询，没有用到缓存，也就是不同SqlSession中不能共享一级缓存。

##### 1.2.3原理

首先让我们来想一想，既然一级缓存的作用域只对同一个SqlSession有效，那么一级缓存应该是存储在SqlSession内是最合适的。我们看一看SqlSession的创建过程,查看`SqlSession session1 = sqlSessionFactory.openSession();`方法：

```java
public SqlSession openSession() {
    	// this.configuration.getDefaultExecutorType()方法，获取默认的Executor
    	// openSessionFromDataSource方法是构建SqlSession的
        return this.openSessionFromDataSource(this.configuration.getDefaultExecutorType(), (TransactionIsolationLevel)null, false);
    }
```

继续跟进`this.openSessionFromDataSource(this.configuration.getDefaultExecutorType(), (TransactionIsolationLevel)null, false);`方法：

```java
private SqlSession openSessionFromDataSource(ExecutorType execType, TransactionIsolationLevel level, boolean autoCommit) {
        Transaction tx = null;

        DefaultSqlSession var8;
        try {
            // 获取环境配置
            Environment environment = this.configuration.getEnvironment();
            // 根据环境配置创建TransactionFactory
            TransactionFactory transactionFactory = this.getTransactionFactoryFromEnvironment(environment);
            tx = transactionFactory.newTransaction(environment.getDataSource(), level, autoCommit);
            // 创建执行器
            Executor executor = this.configuration.newExecutor(tx, execType);
            // 根据Executor创建DefaultSqlSession
            var8 = new DefaultSqlSession(this.configuration, executor, autoCommit);
        } catch (Exception var12) {
            this.closeTransaction(tx);
            throw ExceptionFactory.wrapException("Error opening session.  Cause: " + var12, var12);
        } finally {
            ErrorContext.instance().reset();
        }

        return var8;
    }
```

查看创建执行器的`Executor executor = this.configuration.newExecutor(tx, execType);`方法：

```java
public Executor newExecutor(Transaction transaction, ExecutorType executorType) {
        executorType = executorType == null ? this.defaultExecutorType : executorType;
        executorType = executorType == null ? ExecutorType.SIMPLE : executorType;
        Object executor;
        if (ExecutorType.BATCH == executorType) { // 批处理执行器
            executor = new BatchExecutor(this, transaction);
        } else if (ExecutorType.REUSE == executorType) { // 重新使用执行器
            executor = new ReuseExecutor(this, transaction);
        } else { // 简单执行器
            executor = new SimpleExecutor(this, transaction);
        }

        if (this.cacheEnabled) {
            executor = new CachingExecutor((Executor)executor); // 普通的执行器装饰成缓存执行器
        }
		
    	// this.interceptorChain中存放的是mybatis核心配置文件配置的插件
    	// pluginAll方法中，使用了代理+装饰者模式的方式，创建Executor
        Executor executor = (Executor)this.interceptorChain.pluginAll(executor);
        return executor;
    }
```

查看简单`new SimpleExecutor(this, transaction);`的构造方法：

```java
public class SimpleExecutor extends BaseExecutor {
    public SimpleExecutor(Configuration configuration, Transaction transaction) {
        // 调用BaseExecutor父类的构造方法
        super(configuration, transaction);
    }
}
```

查看父类BaseExecutor的构造方法:

```java
public abstract class BaseExecutor implements Executor {
    private static final Log log = LogFactory.getLog(BaseExecutor.class);
    protected Transaction transaction;
    protected Executor wrapper;
    protected ConcurrentLinkedQueue<BaseExecutor.DeferredLoad> deferredLoads;
    protected PerpetualCache localCache;
    protected PerpetualCache localOutputParameterCache;
    protected Configuration configuration;
    protected int queryStack;
    private boolean closed;

    protected BaseExecutor(Configuration configuration, Transaction transaction) {
        this.transaction = transaction;
        this.deferredLoads = new ConcurrentLinkedQueue();
        // 创建一个缓存对象，PerpetualCache并不是线程安全的
		// 但SqlSession和Executor对象在通常情况下只能有一个线程访问，而且访问完成之后马上销毁。也就是session.close();
        this.localCache = new PerpetualCache("LocalCache");
        this.localOutputParameterCache = new PerpetualCache("LocalOutputParameterCache");
        this.closed = false;
        this.configuration = configuration;
        this.wrapper = this;
    }
}
```

到果然有一个localCache，而且上面我们有提到一级查询缓存（也叫作本地缓存）是基于`PerpetualCache` 类的HashMap本地缓存，看看PerpetualCache里面是什么：

```java
public class PerpetualCache implements Cache {
    private final String id;
    private final Map<Object, Object> cache = new HashMap(); // 找到底层结构
}
```

到此我们已经创建好了一个HashMap存储缓存的值，拿什么时候存值，什么时候取值？

我们知道sqlSession(默认DefaultSqlSession)执行CRUD操作时，底层是Executor，在上面我们创建了一个SimpleExecutor，当我执行

sqlSession的查询方法时，会调用SimpleExecutor的query方法（至于为什么可以看我写的mybatis源码解析sql执行的文章），但是我们发现SimpleExecutor中没有query方法，SimpleExecutor的query方法是继承父类BaseExecutor的query方法如下：

```java
public <E> List<E> query(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler) throws SQLException {
    	// 构建sql,不是本文重点
        BoundSql boundSql = ms.getBoundSql(parameter);
    	// 创建缓存的key
        CacheKey key = this.createCacheKey(ms, parameter, rowBounds, boundSql);
    	// 继续跟进query方法
        return this.query(ms, parameter, rowBounds, resultHandler, key, boundSql);
}
```

继续跟进`this.query(ms, parameter, rowBounds, resultHandler, key, boundSql);`方法:

```java
public <E> List<E> query(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler, CacheKey key, BoundSql boundSql) throws SQLException {
        ErrorContext.instance().resource(ms.getResource()).activity("executing a query").object(ms.getId());
        if (this.closed) {
            throw new ExecutorException("Executor was closed.");
        } else {
            // 判断是否是否配置了flushCache=true
            if (this.queryStack == 0 && ms.isFlushCacheRequired()) {
                this.clearLocalCache();
            }

            List list;
            try {
                ++this.queryStack;
                // 看到this.localCache，是不是很眼熟，这就是PerpetualCache
                // this.localCache.getObject(key)方法从PerpetualCache的HashMap成员中取值
                list = resultHandler == null ? (List)this.localCache.getObject(key) : null;
                // 判断缓存是否为空
                if (list != null) {
                    this.handleLocallyCachedOutputParameters(ms, key, parameter, boundSql);
                } else {
                    // 缓存为空，查询数据库后，存入缓存
                    list = this.queryFromDatabase(ms, parameter, rowBounds, resultHandler, key, boundSql);
                }
            } finally {
                --this.queryStack;
            }

            if (this.queryStack == 0) {
                Iterator var8 = this.deferredLoads.iterator();

                while(var8.hasNext()) {
                    BaseExecutor.DeferredLoad deferredLoad = (BaseExecutor.DeferredLoad)var8.next();
                    deferredLoad.load();
                }

                this.deferredLoads.clear();
                if (this.configuration.getLocalCacheScope() == LocalCacheScope.STATEMENT) {
                    this.clearLocalCache();
                }
            }

            return list;
        }
    }
```

缓存为空，查询数据库后，存入缓存，查看`list = this.queryFromDatabase(ms, parameter, rowBounds, resultHandler, key, boundSql);`方法：

```java
 private <E> List<E> queryFromDatabase(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler, CacheKey key, BoundSql boundSql) throws SQLException {
        this.localCache.putObject(key, ExecutionPlaceholder.EXECUTION_PLACEHOLDER);
        List list;
        try {
            // 查询数据库
            list = this.doQuery(ms, parameter, rowBounds, resultHandler, boundSql);
        } finally {
            this.localCache.removeObject(key);
        }
		// 查询结果保存在PerpetualCache的HashMap成员中
        this.localCache.putObject(key, list);
        if (ms.getStatementType() == StatementType.CALLABLE) {
            this.localOutputParameterCache.putObject(key, parameter);
        }

        return list;
    }
```

以上就是一级缓存的存取流程，我们继续看看一级缓存什么时候会被清除：

1、就是获取缓存之前会先进行判断用户是否配置了flushCache=true属性，如果配置了则会清除一级缓存。可以参考上面BaseExecutor的query的源码。



2、在执行commit，rollback，update方法时会清空一级缓存。

```java
 // BaseExecutor的commit方法
public void commit(boolean required) throws SQLException {
        if (this.closed) {
            throw new ExecutorException("Cannot commit, transaction is already closed");
        } else {
            this.clearLocalCache(); // 清空一级缓存
            this.flushStatements();
            if (required) {
                this.transaction.commit();
            }

        }
    }
// BaseExecutor的rollback方法
 public void rollback(boolean required) throws SQLException {
        if (!this.closed) {
            try {
                this.clearLocalCache();// 清空一级缓存
                this.flushStatements(true);
            } finally {
                if (required) {
                    this.transaction.rollback();
                }

            }
        }

    }

// BaseExecutor的close方法
public void close(boolean forceRollback) {
        try {
            try {
                this.rollback(forceRollback);
            } finally {
                if (this.transaction != null) {
                    this.transaction.close();
                }

            }
        } catch (SQLException var11) {
            log.warn("Unexpected exception on closing transaction.  Cause: " + var11);
        } finally {
            this.transaction = null;
            this.deferredLoads = null;
            this.localCache = null;// 清空一级缓存
            this.localOutputParameterCache = null;
            this.closed = true;
        }

    }
```

#### 1.2二级缓存

##### 1.2.1介绍

​	二级缓存与一级缓存其机制相同，默认也是采用 PerpetualCache，HashMap存储，不同在于其存储作用域为 Mapper(Namespace)，每个Mapper中有一个Cache对象，存放在Configration中，并且将其放进当前Mapper的所有MappedStatement当中，并且可自定义存储源。

##### 1.2.2使用

①，基础使用

二级缓存的使用需要开启，开启方式如下：

在mybatis的核心配置文件中：

```xml
<settings>
    <!--开启二级缓存-->
    <setting name="cacheEnabled" value="true"/>
</settings>
```

开启之后还需要在`xxxMapper.xml`中配置标签：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="mybatis.mapper.UserMapper">
    <!--配置二级缓存-->
    <cache/>
</mapper>
```

测试二级缓存：

```java
public class App {
	public static void main(String[] args) {
		String resource = "mybatis‐config.xml";
		Reader reader;
		try {
			//将XML配置文件构建为Configuration配置类
			reader = Resources.getResourceAsReader(resource);
			// 通过加载配置文件流构建一个SqlSessionFactory DefaultSqlSessionFactory
			SqlSessionFactory sqlSessionFactory = new SqlSessionFactoryBuilder().build(reader);
			// 数据源 执行器 DefaultSqlSession
			SqlSession session1 = sqlSessionFactory.openSession();
            SqlSession session2 = sqlSessionFactory.openSession();
            
			try {
				// 获取mapper
				UserMapper mapper1 = session1.getMapper(UserMapper.class);
                UserMapper mapper2 = session2.getMapper(UserMapper.class);
                User user1 = mapper1.selectById(1L);
                User user2 = mapper2.selectById(1L);
				System.out.println(user1 == user2); // 输出的结果为false
			} catch (Exception e) {
 				e.printStackTrace();
 			}finally {
 				session.close();
			}
		} catch (IOException e) {
			e.printStackTrace();
		}
	}
}
```

输出结果

```java
==>  Preparing: select * from user where id = ? 
==> Parameters: 1(Integer)
<==    Columns: id, age, name
<==        Row: 1, 18, zyh
<==      Total: 1
Resetting autocommit to true on JDBC Connection [com.mysql.cj.jdbc.ConnectionImpl@a12036]
Closing JDBC Connection [com.mysql.cj.jdbc.ConnectionImpl@a12036]
Returned connection 156564788 to pool.
User(id=1, age=18, name=zyh)
Cache Hit Ratio [mybatis.mapper.UserMapper]: 0.5
User(id=1, age=18, name=zyh)
false
```

第二次查询没有执行`sql`语句，并且日志打印了缓存命中率为0.5，并且这两个对象不相等，这是为啥呢？

原因是二级缓存的使用必须要求缓存对象实现序列化接口，因为二级缓存的实现是通过将数据序列化在保存的，当第二次查询的时候，如果缓存中有那就将数据再反序列化出来，由于反序列化时每次都是重新创建的对象，因此即使是缓存命中也不相等，缓存命中为0.5的原因是第一次没有命中，第二次命中了，请求了2次因此 1/2 得到的就是0.5。

所以在使用二级缓存的时候，使用的对象必须要实现序列化接口，否则就会报错：

```
org.apache.ibatis.cache.CacheException: Error serializing object.  Cause: java.io.NotSerializableException: mybatis.model.User
```

②，使用redis保存数据

在`Mybatis`中已经有这个实现，只需引入依赖即可使用：

```xml
<dependency>
    <groupId>org.mybatis.caches</groupId>
    <artifactId>mybatis-redis</artifactId>
    <version>1.0.0-beta2</version>
</dependency>
```

然后还需要配置`redis.properties`文件，里面指定`redis`的配置，注意**这个文件名字不能修改**：

```properties
host=127.0.0.1
port=6379
password=
database=0
```

在mybatis的核心配置文件中：

```xml
<settings>
    <!--开启二级缓存-->
    <setting name="cacheEnabled" value="true"/>
</settings>
```

开启之后还需要在`xxxMapper.xml`中配置标签：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="mybatis.mapper.UserMapper">
    <!--配置二级缓存-->
   <cache type="org.mybatis.caches.redis.RedisCache"/>
</mapper>
```

测试缓存：

```java
public class App {
	public static void main(String[] args) {
		String resource = "mybatis‐config.xml";
		Reader reader;
		try {
			//将XML配置文件构建为Configuration配置类
			reader = Resources.getResourceAsReader(resource);
			// 通过加载配置文件流构建一个SqlSessionFactory DefaultSqlSessionFactory
			SqlSessionFactory sqlSessionFactory = new SqlSessionFactoryBuilder().build(reader);
			// 数据源 执行器 DefaultSqlSession
			SqlSession session1 = sqlSessionFactory.openSession();
            SqlSession session2 = sqlSessionFactory.openSession();
            
			try {
				// 获取mapper
				UserMapper mapper1 = session1.getMapper(UserMapper.class);
                UserMapper mapper2 = session2.getMapper(UserMapper.class);
                User user1 = mapper1.selectById(1L);
                User user2 = mapper2.selectById(1L);
				System.out.println(user1 == user2); // 输出的结果为false
			} catch (Exception e) {
 				e.printStackTrace();
 			}finally {
 				session.close();
			}
		} catch (IOException e) {
			e.printStackTrace();
		}
	}
}
```

输出结果

```java
==>  Preparing: select * from user where id = ? 
==> Parameters: 1(Integer)
<==    Columns: id, age, name
<==        Row: 1, 18, zyh
<==      Total: 1
Resetting autocommit to true on JDBC Connection [com.mysql.cj.jdbc.ConnectionImpl@a12036]
Closing JDBC Connection [com.mysql.cj.jdbc.ConnectionImpl@a12036]
Returned connection 156564788 to pool.
User(id=1, age=18, name=zyh)
Cache Hit Ratio [mybatis.mapper.UserMapper]: 0.5
User(id=1, age=18, name=zyh)
false
```

使用`redis`客户端连接工具查看是否缓存数据,发现`key`为：

```
677706599:5423390838:mybatis.mapper.UserMapper.selectById:0:2147483647:select *
        from user
        where id = ?:1:development
```

`value`为：

```
\xAC\xED\x00\x05sr\x00\x13java.util.ArrayListx\x81\xD2\x1D\x99\xC7a\x9D\x03\x00\x01I\x00\x04sizexp\x00\x00\x00\x01w\x04\x00\x00\x00\x01sr\x00\x12mybatis.model.User\xF4\xBB\x11O\xFF\xA4\xDC<\x02\x00\x03I\x00\x03ageI
```

##### 1.2.3原理

###### 	1.2.3.1xml配置解析流程

​	二级缓存的配置加载实际上就是解析`<cache>`标签或者是解析`@CacheNamespace`注解，从源码入口找到解析`mapper.xml`的地方，在解析`mapper.xml`的过程中会解析`<cache>`标签：

mybatis核心配置文件加载流程分析：

```java
String resource = "mybatis‐config.xml";
//将XML配置文件构建为Configuration配置类
reader = Resources.getResourceAsReader(resource);
// 通过加载配置文件流构建一个SqlSessionFactory DefaultSqlSessionFactory
SqlSessionFactory sqlMapper = new SqlSessionFactoryBuilder().build(reader);
```

通过上面代码发现，创建SqlSessionFactory的代码在SqlSessionFactoryBuilder中，进去一探究竟：

```java
 public SqlSessionFactory build(Reader reader) {
        return this.build((Reader)reader, (String)null, (Properties)null);
    }
```

继续跟进`this.build((Reader)reader, (String)null, (Properties)null)`方法：

```java
public SqlSessionFactory build(Reader reader, String environment, Properties properties) {
        SqlSessionFactory var5;
        try {
            // 创建一个XML配置类解析类XMLConfigBuilder
            XMLConfigBuilder parser = new XMLConfigBuilder(reader, environment, properties);
            // 通XML配置类解析类的parse方法解析配置文件，build方法返回DefaultSqlSessionFactory
            var5 = this.build(parser.parse());
        } catch (Exception var14) {
            throw ExceptionFactory.wrapException("Error building SqlSession.", var14);
        } finally {
            ErrorContext.instance().reset();

            try {
                reader.close();
            } catch (IOException var13) {
            }

        }

        return var5;
    }
```

继续查看`XMLConfigBuilder`的`parse()`方法:

```java
public Configuration parse() {
       // 通过parsed判断是否解析过配置类
        if (this.parsed) {
            // 如果解析过直接抛出异常
            throw new BuilderException("Each XMLConfigBuilder can only be used once.");
        } else {
            // 没有解析过，开始解析之前，将parsed置为true
            this.parsed = true;
            // 开始解析configuration节点
            this.parseConfiguration(this.parser.evalNode("/configuration"));
            return this.configuration;
        }
    }
```

继续跟进`this.parseConfiguration(this.parser.evalNode("/configuration"));`方法：

```java
private void parseConfiguration(XNode root) {
        try {
            // 解析properties标签，并set到Configration对象中
            this.propertiesElement(root.evalNode("properties"));
            // 解析setting标签
            Properties settings = this.settingsAsProperties(root.evalNode("settings"));
            // 添加vfs的自定义实现，这个功能不怎么用
            this.loadCustomVfs(settings);
            // 配置日志实现类，这个功能也不怎么用
            this.loadCustomLogImpl(settings);
            // 解析typeAliases标签，配置类的别名，配置后就可以用别名来替代全限定名
            this.typeAliasesElement(root.evalNode("typeAliases"));
            // 解析plugins标签，将解析拦截器和拦截器的属性，set到Configration的interceptorChain中
            this.pluginElement(root.evalNode("plugins"));
            // Mybatis创建对象是会使用objectFactory来创建对象，一般情况下不会自己配置这个objectFactory，使用系统默认的
            this.objectFactoryElement(root.evalNode("objectFactory"));
            this.objectWrapperFactoryElement(root.evalNode("objectWrapperFactory"));
            this.reflectorFactoryElement(root.evalNode("reflectorFactory"));
            // 设置在setting标签中配置的配置
            this.settingsElement(settings);
            // 解析环境信息，包括事物管理器和数据源，SqlSessionFactoryBuilder在解析时需要指定环境id，如果不指定的话，会选择默认的环境；
            //最 后将这些信息set到Configration的Environment属性里面
            this.environmentsElement(root.evalNode("environments"));
            this.databaseIdProviderElement(root.evalNode("databaseIdProvider"));
            // 无论是 MyBatis 在预处理语句（PreparedStatement）中设置一个参数时，还是从结果集中取出一个值时，都会用类型处理器将获取的值以合适的方式转换成 Java 类型。解析typeHandler。            
            this.typeHandlerElement(root.evalNode("typeHandlers"));
            // 解析Mapper文件
            this.mapperElement(root.evalNode("mappers"));
        } catch (Exception var3) {
            throw new BuilderException("Error parsing SQL Mapper Configuration. Cause: " + var3, var3);
        }
    }
```

mybatis是通过`this.mapperElement(root.evalNode("mappers"));`方法：

```java
private void mapperElement(XNode parent) throws Exception {
        if (parent != null) {
            // 获取mappers标签的子标签
            Iterator var2 = parent.getChildren().iterator();
            while(true) {
                while(var2.hasNext()) {
                    // 循环遍历
                    XNode child = (XNode)var2.next();
                    String resource;
                    // 方式一：包扫描的方式
                    if ("package".equals(child.getName())) {
                        // 如果mappers标签的子标签是package，获取package的name属性。
                        resource = child.getStringAttribute("name");
                        // 通过name值，获取name下的所有mapper配置文件
                        this.configuration.addMappers(resource);
                    } else {
                        // 获取resource、url和class对应属性值
                        resource = child.getStringAttribute("resource");
                        String url = child.getStringAttribute("url");
                        String mapperClass = child.getStringAttribute("class");
                        XMLMapperBuilder mapperParser;
                        InputStream inputStream;
                        //方式二：通过resource属性加载文件
                        if (resource != null && url == null && mapperClass == null) {
                            ErrorContext.instance().resource(resource);
                            inputStream = Resources.getResourceAsStream(resource);
                            mapperParser = new XMLMapperBuilder(inputStream, this.configuration, resource, this.configuration.getSqlFragments());
                            mapperParser.parse();
                        } else if (resource == null && url != null && mapperClass == null) {
                            //方式三：通过url属性加载文件
                            ErrorContext.instance().resource(url);
                            inputStream = Resources.getUrlAsStream(url);
                            mapperParser = new XMLMapperBuilder(inputStream, this.configuration, url, this.configuration.getSqlFragments());
                            mapperParser.parse();
                        } else {
                            if (resource != null || url != null || mapperClass == null) {
                                throw new BuilderException("A mapper element may only specify a url, resource or class, but not more than one.");
                            }
							// 方式四：通过class属性加载文件
                            Class<?> mapperInterface = Resources.classForName(mapperClass);
                            this.configuration.addMapper(mapperInterface);
                        }
                    }
                }

                return;
            }
        }
    }
```

**方式一**包扫描的方式，查看`this.configuration.addMappers(resource);`方法：

```java
public void addMappers(String packageName) {
        this.mapperRegistry.addMappers(packageName);
    }
```

```java
public void addMappers(String packageName) {
        this.addMappers(packageName, Object.class);
    }
```

```java
public void addMappers(String packageName, Class<?> superType) {
       // 又是创建ResolverUtil工具类
        ResolverUtil<Class<?>> resolverUtil = new ResolverUtil();
       // 根据packageName获取，该包下的所有Class
        resolverUtil.find(new IsA(superType), packageName);
    	// 遍历Class
        Set<Class<? extends Class<?>>> mapperSet = resolverUtil.getClasses();
        Iterator var5 = mapperSet.iterator();
        while(var5.hasNext()) {
            Class<?> mapperClass = (Class)var5.next();
            // 方式四通过class属性加载文件
            this.addMapper(mapperClass);
        }

    }
```

**方式四**通过class属性加载文件，查看`this.configuration.addMapper(mapperInterface);`和上面的`this.addMapper(mapperClass);`方法最终都是调用如下方法：

```java
public <T> void addMapper(Class<T> type) {
        // 判断Class是否是接口
        if (type.isInterface()) {
            // 配置文件是否正在加载
            if (this.hasMapper(type)) {
                // 正在加载过就抛出异常
                throw new BindingException("Type " + type + " is already known to the MapperRegistry.");
            }

            boolean loadCompleted = false;

            try {
                // 加载之前，存入this.knownMappers中
                this.knownMappers.put(type, new MapperProxyFactory(type));
                // 创建MapperAnnotationBuilder对象，
                MapperAnnotationBuilder parser = new MapperAnnotationBuilder(this.config, type);
                // 解析
                parser.parse();
                loadCompleted = true;
            } finally {
                // 完成解析
                if (!loadCompleted) {
                    // 移出
                    this.knownMappers.remove(type);
                }

            }
        }

    }
```

配置文件是否加载过，查看`this.hasMapper(type)`方法：

```java
public <T> boolean hasMapper(Class<T> type) {
   		 // 加载之前，存入this.knownMappers中
        return this.knownMappers.containsKey(type);
    }
```

创建MapperAnnotationBuilder对象

```java
public MapperAnnotationBuilder(Configuration configuration, Class<?> type) {
    	// 将全类名中的"."替换为"/"
        String resource = type.getName().replace('.', '/') + ".java (best guess)";
        this.assistant = new MapperBuilderAssistant(configuration, resource);
        this.configuration = configuration;
        this.type = type;
    }
```

解析查看`parser.parse();`方法：

```java
public void parse() {
        String resource = this.type.toString();
    	// 判断configuration的this.loadedResources集合中是否包含resource
        if (!this.configuration.isResourceLoaded(resource)) {
             // ----重点：加载该命名空间下对应的xml
            this.loadXmlResource();
            // ---- 下面是注解方式
            // 为configuration的this.loadedResources集合添加resource
            this.configuration.addLoadedResource(resource);
            // 设置命名空间，即类的全路径名
            this.assistant.setCurrentNamespace(this.type.getName());
            // 解析二级缓存注解CacheNamespace
            this.parseCache();
            // 解析二级缓存注解CacheNamespaceRef
            this.parseCacheRef();
            // 获取类的的所有方法
            Method[] var2 = this.type.getMethods();
            int var3 = var2.length;
            // 遍历所有方法
            for(int var4 = 0; var4 < var3; ++var4) {
                Method method = var2[var4];
                // 检查下method类型，不能是桥接方法和接口中的默认方法
                if (this.canHaveStatement(method)) {
                    // select操作解析@select,@SelectProvider注释方法中的带有@ResultMap的方法
                    if (this.getAnnotationWrapper(method, false, Select.class, SelectProvider.class).isPresent() && method.getAnnotation(ResultMap.class) == null) {
                        this.parseResultMap(method);
                    }

                    try {
                        // 解析Statement
                        this.parseStatement(method);
                    } catch (IncompleteElementException var7) {
                        this.configuration.addIncompleteMethod(new MethodResolver(this, method));
                    }
                }
            }
        }
		// 解析IncompleteMethod，解析失败的方法。
        this.parsePendingMethods();
    }
```

查看加载该命名空间下对应的xml的`this.loadXmlResource();`方法：

```java
private void loadXmlResource() {
        if (!this.configuration.isResourceLoaded("namespace:" + this.type.getName())) {
            // 将包名中的"."转换为"/"
            String xmlResource = this.type.getName().replace('.', '/') + ".xml";
            InputStream inputStream = this.type.getResourceAsStream("/" + xmlResource);
            if (inputStream == null) {
                try {
                    inputStream = Resources.getResourceAsStream(this.type.getClassLoader(), xmlResource);
                } catch (IOException var4) {
                }
            }

            if (inputStream != null) {
                // 以流的形式创建XMLMapperBuilder对象，
                XMLMapperBuilder xmlParser = new XMLMapperBuilder(inputStream, this.assistant.getConfiguration(), xmlResource, this.configuration.getSqlFragments(), this.type.getName());
                xmlParser.parse();
            }
        }

    }
```

通过上面的方法可以看出，和**方式二通过resource属性加载文件**和**方式三通过url属性加载文件**是一样的，继续跟进` xmlParser.parse();`方法：

```java
 public void parse() {
         // 该节点是否被解析过或加载过
        if (!this.configuration.isResourceLoaded(this.resource)) {
            //解析mapper节点
            this.configurationElement(this.parser.evalNode("/mapper"));
            // 加入到已经解析的列表，防止重复解析
            this.configuration.addLoadedResource(this.resource);
            // 将mapper注册给Configuration
            this.bindMapperForNamespace();
        }
		// 下面分别用来处理失败的<resultMap>、<cache-ref>、SQL语句
        this.parsePendingResultMaps();
        this.parsePendingCacheRefs();
        this.parsePendingStatements();
    }
```

查看如何解析mapper节点的`this.configurationElement(this.parser.evalNode("/mapper"));`方法：

```java
private void configurationElement(XNode context) {
        try {
            // 获取mapper标签的namespace属性
            String namespace = context.getStringAttribute("namespace");
            if (namespace != null && !namespace.isEmpty()) {
                // 绑定当前命名空间
                this.builderAssistant.setCurrentNamespace(namespace);
                // 解析cache-ref标签
                this.cacheRefElement(context.evalNode("cache-ref"));
                // 解析cache标签
                this.cacheElement(context.evalNode("cache"));
                // 解析parameterMap标签
                this.parameterMapElement(context.evalNodes("/mapper/parameterMap"));
                // 解析resultMap标签
                this.resultMapElements(context.evalNodes("/mapper/resultMap"));
                // 解析sql标签
                this.sqlElement(context.evalNodes("/mapper/sql"));
                // 解析select或者insert或者update或者delete标签
                this.buildStatementFromContext(context.evalNodes("select|insert|update|delete"));
            } else {
                throw new BuilderException("Mapper's namespace cannot be empty");
            }
        } catch (Exception var3) {
            throw new BuilderException("Error parsing Mapper XML. The XML location is '" + this.resource + "'. Cause: " + var3, var3);
        }
    }
```

查看` this.cacheElement(context.evalNode("cache"));`方法，是如何解析cache标签的：

```java
private void cacheElement(XNode context) {
        if (context != null) {
            //  获取type属性，如果type没有指定就用默认的PERPETUAL
            String type = context.getStringAttribute("type", "PERPETUAL");
            // PERPETUAL早已经注册过的别名的PerpetualCache
            Class<? extends Cache> typeClass = this.typeAliasRegistry.resolveAlias(type);
            //获取淘汰方式，默认为LRU，最近最少使用到的先淘汰
            String eviction = context.getStringAttribute("eviction", "LRU");
            // LRU早已经注册过的别名的LruCache
            Class<? extends Cache> evictionClass = this.typeAliasRegistry.resolveAlias(eviction);
            // 解析刷新间隔
            Long flushInterval = context.getLongAttribute("flushInterval");
            // 大小
            Integer size = context.getIntAttribute("size");
            // 是否只读
            boolean readWrite = !context.getBooleanAttribute("readOnly", false);
            boolean blocking = context.getBooleanAttribute("blocking", false);
            // 获取子节点配置
            Properties props = context.getChildrenAsProperties();
            // 构建缓存对象
            this.builderAssistant.useNewCache(typeClass, evictionClass, flushInterval, size, readWrite, blocking, props);
        }

    }
```

###### 1.2.3.2创建缓存对象流程

跟进构建缓存对象的方法`this.builderAssistant.useNewCache(typeClass, evictionClass, flushInterval, size, readWrite, blocking, props);`

```java
/**
* 创建一个新的缓存
* @param typeClass 缓存的实现类
* @param evictionClass 缓存的清理类，即使用哪种包装类来清理缓存
* @param flushInterval 缓存清理时间间隔
* @param size 缓存大小
* @param readWrite 缓存是否支持读写
* @param blocking 缓存是否支持阻塞
* @param props 缓存配置属性
* @return 缓存
*/
public Cache useNewCache(Class<? extends Cache> typeClass, Class<? extends Cache> evictionClass, Long flushInterval, Integer size, boolean readWrite, boolean blocking, Properties props) {
        // 建造者模式
        Cache cache = (new CacheBuilder(this.currentNamespace)).implementation((Class)this.valueOrDefault(typeClass, PerpetualCache.class)).addDecorator((Class)this.valueOrDefault(evictionClass, LruCache.class)).clearInterval(flushInterval).size(size).readWrite(readWrite).blocking(blocking).properties(props).build();
        // 添加缓存到 Configuration 对象中
        this.configuration.addCache(cache);
        // 设置当前缓存对象
        this.currentCache = cache;
        return cache;
    }
```

建造者模式方法跟进：

```java
public Cache build() {
    	// 设置缓存的默认实现、默认装饰器（仅设置，并未装配）
        this.setDefaultImplementations();
        // 创建默认的缓存
        Cache cache = this.newBaseCacheInstance(this.implementation, this.id);
        // 设置缓存的属性
        this.setCacheProperties((Cache)cache);
        // 缓存实现是PerpetualCache，即不是用户自定义的缓存实现
        if (PerpetualCache.class.equals(cache.getClass())) {
            Iterator var2 = this.decorators.iterator();
			// 生成装饰器实例，并装配。入参依次是装饰器类、被装饰的缓存
            while(var2.hasNext()) {
                Class<? extends Cache> decorator = (Class)var2.next();
                cache = this.newCacheDecoratorInstance(decorator, (Cache)cache);
                // 为装饰器设置属性
                this.setCacheProperties((Cache)cache);
            }
			// 为缓存增加标准的装饰器
            cache = this.setStandardDecorators((Cache)cache);
        } else if (!LoggingCache.class.isAssignableFrom(cache.getClass())) {
            // 增加日志装饰器
            cache = new LoggingCache((Cache)cache);
        }

        return (Cache)cache;
    }
```

设置缓存的默认实现`this.setDefaultImplementations();`方法：

```java
private void setDefaultImplementations() {
    if (this.implementation == null) {
        // 设置默认缓存类型为PerpetualCache
        this.implementation = PerpetualCache.class;
        if (this.decorators.isEmpty()) {
            // 增加LruCache
            this.decorators.add(LruCache.class);
        }
    }
}
```

查看为缓存增加标准的装饰器`cache = this.setStandardDecorators((Cache)cache);`方法：

```java
private Cache setStandardDecorators(Cache cache) {
        try {
            MetaObject metaCache = SystemMetaObject.forObject(cache);
            if (this.size != null && metaCache.hasSetter("size")) {
                metaCache.setValue("size", this.size);
            }

            if (this.clearInterval != null) {
                // 缓存调度的
                cache = new ScheduledCache((Cache)cache);
                ((ScheduledCache)cache).setClearInterval(this.clearInterval);
            }

            if (this.readWrite) {
                // 缓存序列
                cache = new SerializedCache((Cache)cache);
            }
				// 缓存日志
            Cache cache = new LoggingCache((Cache)cache);
            // 缓存同步
            cache = new SynchronizedCache(cache);
            if (this.blocking) {
                // 缓存阻塞
                cache = new BlockingCache((Cache)cache);
            }

            return (Cache)cache;
        } catch (Exception var3) {
            throw new CacheException("Error building standard cache decorators.  Cause: " + var3, var3);
        }
    }
```

以上就创建好了一个Cache的实例，然后把它添加到Configuration中，并且设置到currentCache属性中，这个属性后面还要使用，也就是Cache实例后面还要使用，我们后面再看。

###### 1.2.3.3缓存使用流程

查看`SqlSession session1 = sqlSessionFactory.openSession();`方法：

```java
public SqlSession openSession() {
    	// this.configuration.getDefaultExecutorType()方法，获取默认的Executor
    	// openSessionFromDataSource方法是构建SqlSession的
        return this.openSessionFromDataSource(this.configuration.getDefaultExecutorType(), (TransactionIsolationLevel)null, false);
    }
```

继续跟进`this.openSessionFromDataSource(this.configuration.getDefaultExecutorType(), (TransactionIsolationLevel)null, false);`方法：

```java
private SqlSession openSessionFromDataSource(ExecutorType execType, TransactionIsolationLevel level, boolean autoCommit) {
        Transaction tx = null;

        DefaultSqlSession var8;
        try {
            // 获取环境配置
            Environment environment = this.configuration.getEnvironment();
            // 根据环境配置创建TransactionFactory
            TransactionFactory transactionFactory = this.getTransactionFactoryFromEnvironment(environment);
            tx = transactionFactory.newTransaction(environment.getDataSource(), level, autoCommit);
            // 创建执行器
            Executor executor = this.configuration.newExecutor(tx, execType);
            // 根据Executor创建DefaultSqlSession
            var8 = new DefaultSqlSession(this.configuration, executor, autoCommit);
        } catch (Exception var12) {
            this.closeTransaction(tx);
            throw ExceptionFactory.wrapException("Error opening session.  Cause: " + var12, var12);
        } finally {
            ErrorContext.instance().reset();
        }

        return var8;
    }
```

查看创建执行器的`Executor executor = this.configuration.newExecutor(tx, execType);`方法：

```java
public Executor newExecutor(Transaction transaction, ExecutorType executorType) {
        executorType = executorType == null ? this.defaultExecutorType : executorType;
        executorType = executorType == null ? ExecutorType.SIMPLE : executorType;
        Object executor;
        if (ExecutorType.BATCH == executorType) { // 批处理执行器
            executor = new BatchExecutor(this, transaction);
        } else if (ExecutorType.REUSE == executorType) { // 重新使用执行器
            executor = new ReuseExecutor(this, transaction);
        } else { // 简单执行器
            executor = new SimpleExecutor(this, transaction);
        }
	
    	// 这个就是我们配置在mybatis核心配置文件中配置的<setting name="cacheEnabled" value="true"/>
        if (this.cacheEnabled) {
            executor = new CachingExecutor((Executor)executor); // 普通的执行器装饰成缓存执行器
        }
		
    	// this.interceptorChain中存放的是mybatis核心配置文件配置的插件
    	// pluginAll方法中，使用了代理+装饰者模式的方式，创建Executor
        Executor executor = (Executor)this.interceptorChain.pluginAll(executor);
        return executor;
    }
```

一级缓存装饰成SimpleExecutor就可以了，而二级缓存又将SimpleExecutor装饰为CachingExecutor了。

同样的sqlSession(默认DefaultSqlSession)执行CRUD操作时，底层是Executor，在上面我们创建了一个CachingExecutor，当我执行

sqlSession的查询方法时，会调用CachingExecutor的query方法（至于为什么可以看我写的mybatis源码解析sql执行的文章）：

```java
public <E> List<E> query(MappedStatement ms, Object parameterObject, RowBounds rowBounds, ResultHandler resultHandler) throws SQLException {
    	// 拼接sql，从MappedStatement对象中获取BoundSql对象
        BoundSql boundSql = ms.getBoundSql(parameterObject);
   		// 获取缓存key 
        CacheKey key = this.createCacheKey(ms, parameterObject, rowBounds, boundSql);
        return this.query(ms, parameterObject, rowBounds, resultHandler, key, boundSql);
    }
```

继续跟进`this.query(ms, parameterObject, rowBounds, resultHandler, key, boundSql);`方法：

```java
public <E> List<E> query(MappedStatement ms, Object parameterObject, RowBounds rowBounds, ResultHandler resultHandler, CacheKey key, BoundSql boundSql) throws SQLException {
    	// 重点：获取加载mapper配置文件解析cache标签创建的缓存对象，这个就是1.2.3.2创建的缓存对象
        Cache cache = ms.getCache();
    	// 判断是否使用缓存
        if (cache != null) {
            // 判断是否需要刷新缓存
            this.flushCacheIfRequired(ms);
            if (ms.isUseCache() && resultHandler == null) {
                this.ensureNoOutParams(ms, boundSql);
                // 获取缓存二级缓存的值
                List<E> list = (List)this.tcm.getObject(cache, key);
                // 没有获取到
                if (list == null) {
                    // 没有获取到，调用query方法
                    list = this.delegate.query(ms, parameterObject, rowBounds, resultHandler, key, boundSql);
                    // 更新二级缓存值
                    this.tcm.putObject(cache, key, list);
                }
				// 返回获取的值
                return list;
            }
        }
		// 没有使用缓存，调用query方法
        return this.delegate.query(ms, parameterObject, rowBounds, resultHandler, key, boundSql);
    }
```

`this.delegate.query(ms, parameterObject, rowBounds, resultHandler, key, boundSql);`方法：这次选择BaseExecutor：

![image-20230105164531200](http://img.zouyh.top/article-img/20240917134957146.png)

BaseExecutor的query方法，这个就很熟悉了在上面的1.2.3一级缓存使用原理中介绍过BaseExecutor的query方法:

```java
public <E> List<E> query(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler, CacheKey key, BoundSql boundSql) throws SQLException {
        ErrorContext.instance().resource(ms.getResource()).activity("executing a query").object(ms.getId());
        if (this.closed) {
            throw new ExecutorException("Executor was closed.");
        } else {
            // 是否刷新缓存
            if (this.queryStack == 0 && ms.isFlushCacheRequired()) {
                this.clearLocalCache();
            }

            List list;
            try {
                ++this.queryStack;
                // 读取一级缓存的值
                list = resultHandler == null ? (List)this.localCache.getObject(key) : null;
                if (list != null) {
                    // 缓存值不为空更新缓存
                    this.handleLocallyCachedOutputParameters(ms, key, parameter, boundSql);
                } else {
                    // 缓存的值为空，查询数据库
                    list = this.queryFromDatabase(ms, parameter, rowBounds, resultHandler, key, boundSql);
                }
            } finally {
                --this.queryStack;
            }

            if (this.queryStack == 0) {
                Iterator var8 = this.deferredLoads.iterator();

                while(var8.hasNext()) {
                    BaseExecutor.DeferredLoad deferredLoad = (BaseExecutor.DeferredLoad)var8.next();
                    deferredLoad.load();
                }

                this.deferredLoads.clear();
                if (this.configuration.getLocalCacheScope() == LocalCacheScope.STATEMENT) {
                    this.clearLocalCache();
                }
            }
            return list;
        }
    }
```

缓存的值为空，查询数据库，查看`list = this.queryFromDatabase(ms, parameter, rowBounds, resultHandler, key, boundSql); `方法：

```java
 private <E> List<E> queryFromDatabase(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler, CacheKey key, BoundSql boundSql) throws SQLException {
      	// 查询标识 
        this.localCache.putObject(key, ExecutionPlaceholder.EXECUTION_PLACEHOLDER);

        List list;
        try {
            // 执行doQuery方法查询数据库
            list = this.doQuery(ms, parameter, rowBounds, resultHandler, boundSql);
        } finally {
            // 查询结束标识
            this.localCache.removeObject(key);
        }
		// 将查询结果放入缓存
        this.localCache.putObject(key, list);
        if (ms.getStatementType() == StatementType.CALLABLE) {
            this.localOutputParameterCache.putObject(key, parameter);
        }

        return list;
    }
```

到此，整个调用流程结束。

#### 1.3总结（图）

![mybatis的缓存](http://img.zouyh.top/article-img/20240917134958147.jpg)

