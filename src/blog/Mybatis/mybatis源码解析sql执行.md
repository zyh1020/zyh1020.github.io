---
icon: file-lines
title: mybatis源码解析sql执行
author: Ms.Zyh
date: 2023-10-25
category:
  - Mybatis
tag:
  - 进阶
  - Mybatis
sticky: false
star: false
---

### 一，mybatis源码解析sql执行

mybatis的简单使用案例

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
				// 执行查询 底层执行jdbc
				//User user = (User)session.selectOne("com.tuling.mapper.selectById", 1);
				UserMapper mapper = session.getMapper(UserMapper.class);
				System.out.println(mapper.getClass());
				User user = mapper.selectById(1L);
				System.out.println(user.getUserName());
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

前面两篇文章介绍了通过`SqlSessionFactory sqlMapper = new SqlSessionFactoryBuilder().build(reader);`代码解析mybatis的配置文件和mapper的配置文件，本片文章主要介绍解析完成配置文件后，mybatis进行的操作。

#### 1.1获取`SqlSession`的过程

首先查看获取`SqlSession`的过程，查看`SqlSession session = sqlMapper.openSession();`方法，DefaultSqlSessionFactory实现SqlSessionFactory接口：

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
            // 根据Executor创建SqlSession
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

Executor分成两大类：

![image-20230105144552065](http://img.zouyh.top/article-img/20240917134953140.png)

一类是CachingExecutor，另一类是普通BaseExecutor。 普通BaseExecutor又分为三种基本的Executor执行器，SimpleExecutor、ReuseExecutor、 BatchExecutor。

- BatchExecutor：执行update（没有select，JDBC批处理不支持select），将所有 sql都添加到批处理中（addBatch()），等待统一执行（executeBatch()），它缓存了多个Statement对象，每个Statement对象都是addBatch()完毕后，等待逐一执行 executeBatch()批处理。与JDBC批处理相同。
- SimpleExecutor：每执行一次update或select，就开启一个Statement对象，用完 立刻关闭Statement对象。
- ReuseExecutor：执行update或select，以sql作为key查找Statement对象，存在就 使用，不存在就创建，用完后，不关闭Statement对象，而是放置于Map内，供下一次使用。简言之，就是重复使用Statement对象。

CachingExecutor其实是封装了普通的Executor，和普通的区别是在查询前先会查询缓存中是否存在结果，如果存在就使用缓存中的结果，如果不存在还是使用普通的Executor进行查询，再将查询出来的结果存入缓存。

到此为止，我们已经获得了SqlSession，拿到SqlSession就可以执行各种CRUD方法了，



小总结：mybatis通过`new SqlSessionFactoryBuilder().build(reader)`方法加载mybatis的核心配置文件和mapper配置文件，创建一个SqlSessionFactory（默认DefaultSqlSessionFactory），然后调用SqlSessionFactory的openSession()方法，SqlSessionFactory的openSession()方法会先创建一个Sql执行器（Executor），然后根据Executor创建SqlSession（默认使用DefaultSqlSession），SqlSession中包含了configration对象，所以通过SqlSession也能拿到全局配置,SqlSession对象中有CRUD各种执行方法，调用这些方法Executor执行器会代理配置的拦截器这些方法。

#### 1.2获取Mapper接口的代理对象

通过SqlSession的getMapper()方法，可以获取对应Mapper接口的代理对象：

```java
public <T> T getMapper(Class<T> type) {
        return this.configuration.getMapper(type, this);
    }
```

继续跟进`this.configuration.getMapper(type, this);`方法：

```java
public <T> T getMapper(Class<T> type, SqlSession sqlSession) {
        return this.mapperRegistry.getMapper(type, sqlSession);
    }
```

继续跟进`this.mapperRegistry.getMapper(type, sqlSession);`方法：

```java
public <T> T getMapper(Class<T> type, SqlSession sqlSession) {
    	// 根据Mapper的Class，获取解析Mapper配置文件MapperProxyFactory
        MapperProxyFactory<T> mapperProxyFactory = (MapperProxyFactory)this.knownMappers.get(type);
        if (mapperProxyFactory == null) {
            throw new BindingException("Type " + type + " is not known to the MapperRegistry.");
        } else {
            try {
                // 调用mapperProxyFactory的newInstance方法创建对象
                return mapperProxyFactory.newInstance(sqlSession);
            } catch (Exception var5) {
                throw new BindingException("Error getting mapper instance. Cause: " + var5, var5);
            }
        }
    }
```

跟进`mapperProxyFactory.newInstance(sqlSession);`方法：

```java
public T newInstance(SqlSession sqlSession) {
    	// 创建动态代理类MapperProxy，MapperProxy实现了InvocationHandler接口，InvocationHandler接口是proxy代理实例的调用处理程序实现的一个接口
        MapperProxy<T> mapperProxy = new MapperProxy(sqlSession, this.mapperInterface, this.methodCache);
        return this.newInstance(mapperProxy);
    }
```

继续跟进`this.newInstance(mapperProxy);`方法：

```java
protected T newInstance(MapperProxy<T> mapperProxy) {
    	// jdk的方式创建代理对象
        return Proxy.newProxyInstance(this.mapperInterface.getClassLoader(), new Class[]{this.mapperInterface}, mapperProxy);
    }
```

#### 1.3Mapper方法执行流程

下面是动态代理类MapperProxy，调用Mapper接口的所有方法都会先调用到这个代理类的 invoke方法

> 注意：由于Mybatis中的Mapper接口没有实现类，所以MapperProxy这个代理对象中没有委托类，也就是说MapperProxy干了代理类和委托类的事情

MapperProxy的invoke方法：

```java
 public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        try {
            // 如果是Object方法，则调用方法本身
            // 如果不是Object方法，则调用this.cachedInvoker(method)方法
            return Object.class.equals(method.getDeclaringClass()) ? method.invoke(this, args) : this.cachedInvoker(method).invoke(proxy, method, args, this.sqlSession);
        } catch (Throwable var5) {
            throw ExceptionUtil.unwrapThrowable(var5);
        }
    }
```

跟进`this.cachedInvoker(method)`方法：

```java
private MapperProxy.MapperMethodInvoker cachedInvoker(Method method) throws Throwable {
        try {
            MapperProxy.MapperMethodInvoker invoker = (MapperProxy.MapperMethodInvoker)this.methodCache.get(method);
            
            return invoker != null ? invoker : (MapperProxy.MapperMethodInvoker)this.methodCache.computeIfAbsent(method, (m) -> {
                // 如果调用接口的是默认方法（JDK8新增接口默认方法的概念）
                if (m.isDefault()) {
                    try {
                        return privateLookupInMethod == null ? new MapperProxy.DefaultMethodInvoker(this.getMethodHandleJava8(method)) : new MapperProxy.DefaultMethodInvoker(this.getMethodHandleJava9(method));
                    } catch (InstantiationException | InvocationTargetException | NoSuchMethodException | IllegalAccessException var4) {
                        throw new RuntimeException(var4);
                    }
                } else {
                    // 如果调用的普通方法（非default方法），则创建一个PlainMethodInvoker并放入缓存，其中MapperMethod保存对应接口方法的SQL以及入参和出参的数据类型等信息
                    return new MapperProxy.PlainMethodInvoker(new MapperMethod(this.mapperInterface, method, this.sqlSession.getConfiguration()));
                }
            });
        } catch (RuntimeException var4) {
            Throwable cause = var4.getCause();
            throw (Throwable)(cause == null ? var4 : cause);
        }
    }
```

PlainMethodInvoker类是Mapper接口普通方法的调用类，它实现了MethodInvoker接口。其内部封装了MapperMethod实例。

我们跳出`cachedInvoker`方法回到`MapperProxy::invoke`方法中：

```java
 public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        try {
            // 如果是Object方法，则调用方法本身
            // 如果不是Object方法，则调用this.cachedInvoker(method)方法
            return Object.class.equals(method.getDeclaringClass()) ? method.invoke(this, args) : this.cachedInvoker(method).invoke(proxy, method, args, this.sqlSession);
        } catch (Throwable var5) {
            throw ExceptionUtil.unwrapThrowable(var5);
        }
    }
```

我们可以看到当cacheInvoker返回了PalinMethodInvoker实例之后，紧接着调用了这个实例的`PlainMethodInvoker::invoke`方法:

```java
private static class PlainMethodInvoker implements MapperProxy.MapperMethodInvoker {
        private final MapperMethod mapperMethod;

        public PlainMethodInvoker(MapperMethod mapperMethod) {
            this.mapperMethod = mapperMethod;
        }
		// 实例的`PlainMethodInvoker::invoke`方法
        public Object invoke(Object proxy, Method method, Object[] args, SqlSession sqlSession) throws Throwable {
            return this.mapperMethod.execute(sqlSession, args);
        }
    }
```

`PlainMethodInvoker::invoke`方法调用的是`MapperMethod::execute`方法:

```java

    public Object execute(SqlSession sqlSession, Object[] args) {
        Object result;
        Object param;
        // 判断方法类型
        switch(this.command.getType()) {
        case INSERT:
            // 参数封装
            param = this.method.convertArgsToSqlCommandParam(args);
            result = this.rowCountResult(sqlSession.insert(this.command.getName(), param));
            break;
        case UPDATE:
            // 参数封装
            param = this.method.convertArgsToSqlCommandParam(args);
            result = this.rowCountResult(sqlSession.update(this.command.getName(), param));
            break;
        case DELETE:
            // 参数封装
            param = this.method.convertArgsToSqlCommandParam(args);
            result = this.rowCountResult(sqlSession.delete(this.command.getName(), param));
            break;
        case SELECT:
             // 查询 
            if (this.method.returnsVoid() && this.method.hasResultHandler()) {
                this.executeWithResultHandler(sqlSession, args);
                result = null;
            } else if (this.method.returnsMany()) { // 返回结果是多个
                result = this.executeForMany(sqlSession, args);
            } else if (this.method.returnsMap()) { // 返回结果是Map
                result = this.executeForMap(sqlSession, args);
            } else if (this.method.returnsCursor()) { // 返回结果是光标
                result = this.executeForCursor(sqlSession, args);
            } else {
                // 参数封装
                param = this.method.convertArgsToSqlCommandParam(args);
                // 可以看到动态代理最后还是使用SqlSession操作数据库的
                result = sqlSession.selectOne(this.command.getName(), param);
                if (this.method.returnsOptional() && (result == null || !this.method.getReturnType().equals(result.getClass()))) {
                    result = Optional.ofNullable(result);
                }
            }
            break;
        case FLUSH:
            result = sqlSession.flushStatements();
            break;
        default:
            throw new BindingException("Unknown execution method for: " + this.command.getName());
        }

        if (result == null && this.method.getReturnType().isPrimitive() && !this.method.returnsVoid()) {
            throw new BindingException("Mapper method '" + this.command.getName() + " attempted to return null from a method with a primitive return type (" + this.method.getReturnType() + ").");
        } else {
            return result;
        }
    }
```

##### 1.3.1参数封装

查看一下解析参数的`this.method.convertArgsToSqlCommandParam(args)`方法：

```java
public Object convertArgsToSqlCommandParam(Object[] args) {
            return this.paramNameResolver.getNamedParams(args);
        }
```

继续跟进`this.paramNameResolver.getNamedParams(args);`方法：

```java
public Object getNamedParams(Object[] args) {
    	// 获取参数的长度
        int paramCount = this.names.size();
        if (args != null && paramCount != 0) {
            // 没有使用@Param注解，并且paramCount = 1
            if (!this.hasParamAnnotation && paramCount == 1) {
                Object value = args[(Integer)this.names.firstKey()];
                // 判断处理集合和数组和对象的
                return wrapToMapIfCollection(value, this.useActualParamName ? (String)this.names.get(0) : null);
            } else {
                Map<String, Object> param = new ParamMap();
                int i = 0;
                // 遍历参数
                for(Iterator var5 = this.names.entrySet().iterator(); var5.hasNext(); ++i) {
                    Entry<Integer, String> entry = (Entry)var5.next();
                    // entry.getValue()参数的变量名、args[(Integer)entry.getKey()]表示参数值
                    param.put(entry.getValue(), args[(Integer)entry.getKey()]);
                    // 参数起别名，这也是为什么可以使用#{param1}表示第一个参数
                    String genericParamName = "param" + (i + 1);
                    if (!this.names.containsValue(genericParamName)) {
                        param.put(genericParamName, args[(Integer)entry.getKey()]);
                    }
                }
				// 封装成ParamMap
                return param;
            }
        } else {
            return null;
        }
    }
```

查看处理集合和数组的`wrapToMapIfCollection(value, this.useActualParamName ? (String)this.names.get(0) : null);`方法：

```java
public static Object wrapToMapIfCollection(Object object, String actualParamName) {
        // 封装成ParamMap
        ParamMap map;
    	// 判断是否是集合
        if (object instanceof Collection) {
            map = new ParamMap();
            map.put("collection", object);
            // 判断是否是List集合
            if (object instanceof List) {
                // 起个参数名
                map.put("list", object);
            }

            Optional.ofNullable(actualParamName).ifPresent((name) -> {
                map.put(name, object); // 遍历存值
            });
            return map;
        } else if (object != null && object.getClass().isArray()) {
            // 判断是否是数据
            map = new ParamMap();
            // 起别名
            map.put("array", object);
            Optional.ofNullable(actualParamName).ifPresent((name) -> {
                map.put(name, object);
            });
            return map;
        } else {
            // 如果都不是，直接返回
            return object;
        }
    }
```

参数封装完成后，以`result = sqlSession.selectOne(this.command.getName(), param);`方法为例，查询单个结果集：

```java
 public <T> T selectOne(String statement, Object parameter) {
     	// 调用
        List<T> list = this.selectList(statement, parameter);
        if (list.size() == 1) { // 取出一个结果
            return list.get(0);
        } else if (list.size() > 1) { // 结果是多个抛出异常
            throw new TooManyResultsException("Expected one result (or null) to be returned by selectOne(), but found: " + list.size());
        } else {
            return null; // 没有返回结果
        }
    }
```

继续跟进`List<T> list = this.selectList(statement, parameter);`方法：

```java
public <E> List<E> selectList(String statement, Object parameter) {
        return this.selectList(statement, parameter, RowBounds.DEFAULT);
    }
```

继续跟进`this.selectList(statement, parameter, RowBounds.DEFAULT);`方法：

```java
public <E> List<E> selectList(String statement, Object parameter, RowBounds rowBounds) {
        List var5;
        try {
            // 获取对应的MappedStatement的，MappedStatement对应的是一个Mapper配置文件，在解析Mapper配置文件生成MappedStatement，保存在this.configuration中。
            MappedStatement ms = this.configuration.getMappedStatement(statement);
            // 通过executor执行，this.wrapCollection(parameter)又判断一次本质上还是调用wrapToMapIfCollection方法
            var5 = this.executor.query(ms, this.wrapCollection(parameter), rowBounds, Executor.NO_RESULT_HANDLER);
        } catch (Exception var9) {
            throw ExceptionFactory.wrapException("Error querying database.  Cause: " + var9, var9);
        } finally {
            ErrorContext.instance().reset();
        }

        return var5;
    }
```

假设使用二级缓存，executor是CacheExecutor，跟进`this.executor.query(ms, this.wrapCollection(parameter), rowBounds, Executor.NO_RESULT_HANDLER);`方法：

```java
public <E> List<E> query(MappedStatement ms, Object parameterObject, RowBounds rowBounds, ResultHandler resultHandler) throws SQLException {
    	// 解析sql，从MappedStatement对象中获取BoundSql对象
        BoundSql boundSql = ms.getBoundSql(parameterObject);
   		// 获取缓存key 
        CacheKey key = this.createCacheKey(ms, parameterObject, rowBounds, boundSql);
        return this.query(ms, parameterObject, rowBounds, resultHandler, key, boundSql);
    }
```

##### 1.3.2解析sql

查看拼接sql的` BoundSql boundSql = ms.getBoundSql(parameterObject);`方法：

```java
public BoundSql getBoundSql(Object parameterObject) {
    	// 获取BoundSql对象，BoundSql对象是对动态sql的解析
        BoundSql boundSql = this.sqlSource.getBoundSql(parameterObject);
    	// 获取当前的sql语句有无绑定parameterMapping属性，parameterMapping属性，对应的是parameterMap标签，这个基本上不使用了，下面的代码就不细看了
        List<ParameterMapping> parameterMappings = boundSql.getParameterMappings();
        if (parameterMappings == null || parameterMappings.isEmpty()) {
            boundSql = new BoundSql(this.configuration, boundSql.getSql(), this.parameterMap.getParameterMappings(), parameterObject);
        }
        Iterator var4 = boundSql.getParameterMappings().iterator();
        while(var4.hasNext()) {
            ParameterMapping pm = (ParameterMapping)var4.next();
            String rmId = pm.getResultMapId();
            if (rmId != null) {
                ResultMap rm = this.configuration.getResultMap(rmId);
                if (rm != null) {
                    this.hasNestedResultMaps |= rm.hasNestedResultMaps();
                }
            }
        }

        return boundSql;
    }
```

查看`BoundSql boundSql = this.sqlSource.getBoundSql(parameterObject);`方法是如果创建BoundSql的

![image-20230105154021000](http://img.zouyh.top/article-img/20240917134957145.png)

SqlSource 接口只有一个方法，就是获取BoundSql对象，SqlSource接口的设计满足单一职责原则。SqlSource有四个实现类：ProviderSqlSource，DynamicSqlSource，RawSqlSource，StaticSqlSource。

如果sql中只包含#{}参数，不包含${}或者其它动态标签，那么会创建RawSqlSource，否则创建DynamicSqlSource对象，无论在Mapper调用时用户传入的参数格式是什么最后都会封装成StaticSqlSource。

先看一下DynamicSqlSource的getBoundSql方法：

```java
public BoundSql getBoundSql(Object parameterObject) {
    	
        DynamicContext context = new DynamicContext(this.configuration, parameterObject);
    	// ①，解析${}
    	// 调用sqlNode方法，会处理${}，也会处理动态标签
        // 最终将所有的SqlNode信息进行解析之后，追加到DynamicContext对象的StringBuilder对象中
        this.rootSqlNode.apply(context);
    	// 创建sql解析器
        SqlSourceBuilder sqlSourceParser = new SqlSourceBuilder(this.configuration);
    	// 获取传入的参数
        Class<?> parameterType = parameterObject == null ? Object.class : parameterObject.getClass();
    	// ②，解析#{}，然后封装到StaticSqlSource中
        SqlSource sqlSource = sqlSourceParser.parse(context.getSql(), parameterType, context.getBindings());
        // 将解析后的SQL语句还有入参绑定到一起（封装到一个对象中，此时还没有将参数替换到SQL占位符?）
   		BoundSql boundSql = sqlSource.getBoundSql(parameterObject);
        context.getBindings().forEach(boundSql::setAdditionalParameter);
        return boundSql;
    }
```

**①，解析`${}`**,查看`this.rootSqlNode.apply(context);`方法：

![image-20230105160532274](http://img.zouyh.top/article-img/20240917134954141.png)

SqlNode是什么？SqlNode是一个接口，有很多实现了如下：

![image-20230105160939529](http://img.zouyh.top/article-img/20240917134955142.png)

不同的实现类对应着Map中的不同的标签，比如mapper配置文件中的的`<if>`标签就对应IfSqlNode,`<where>`标签就对应TirmSqlNode.

这些sqlNode的生成是在解析mapper配置文件的时候，通过对应的handler来解析的，具体解析可以看我上一篇文章解析mapper配置文件的文章。

我们知道`${}`在拼接参数是不会添加引号，作为文本来解析，所以我们先看TextSqlNode的apply方法解析：

```java
public boolean apply(DynamicContext context) {
    	// 创建TextSqlNode的解析器
        GenericTokenParser parser = this.createParser(new TextSqlNode.BindingTokenParser(context, this.injectionFilter));
    	// parser.parse(this.text)解析，然后追加到DynamicContext对象的StringBuilder对象中
        context.appendSql(parser.parse(this.text));
        return true;
    }
```

查看`GenericTokenParser parser = this.createParser(new TextSqlNode.BindingTokenParser(context, this.injectionFilter));`方法是如何创建解析器的：

```java
private GenericTokenParser createParser(TokenHandler handler) {
        return new GenericTokenParser("${", "}", handler);
    }
```

然后调用`parser.parse(this.text)`方法解析：这个方法入下，看着很复杂其实就是解析替换标签。

```java
public String parse(String text) {
        if (text != null && !text.isEmpty()) {
            int start = text.indexOf(this.openToken);
            if (start == -1) {
                return text;
            } else {
                char[] src = text.toCharArray();
                int offset = 0;
                StringBuilder builder = new StringBuilder();

                for(StringBuilder expression = null; start > -1; start = text.indexOf(this.openToken, offset)) {
                    if (start > 0 && src[start - 1] == '\\') {
                        builder.append(src, offset, start - offset - 1).append(this.openToken);
                        offset = start + this.openToken.length();
                    } else {
                        if (expression == null) {
                            expression = new StringBuilder();
                        } else {
                            expression.setLength(0);
                        }

                        builder.append(src, offset, start - offset);
                        offset = start + this.openToken.length();

                        int end;
                        for(end = text.indexOf(this.closeToken, offset); end > -1; end = text.indexOf(this.closeToken, offset)) {
                            if (end <= offset || src[end - 1] != '\\') {
                                expression.append(src, offset, end - offset);
                                break;
                            }

                            expression.append(src, offset, end - offset - 1).append(this.closeToken);
                            offset = end + this.closeToken.length();
                        }

                        if (end == -1) {
                            builder.append(src, start, src.length - start);
                            offset = src.length;
                        } else {
                            builder.append(this.handler.handleToken(expression.toString()));
                            offset = end + this.closeToken.length();
                        }
                    }
                }

                if (offset < src.length) {
                    builder.append(src, offset, src.length - offset);
                }

                return builder.toString();
            }
        } else {
            return "";
        }
    }
```

**②，解析`#{}`**，查看`SqlSource sqlSource = sqlSourceParser.parse(context.getSql(), parameterType, context.getBindings());`方法：

```java
public SqlSource parse(String originalSql, Class<?> parameterType, Map<String, Object> additionalParameters) {
        SqlSourceBuilder.ParameterMappingTokenHandler handler = new SqlSourceBuilder.ParameterMappingTokenHandler(this.configuration, parameterType, additionalParameters);
        // 创建解析器
    	GenericTokenParser parser = new GenericTokenParser("#{", "}", handler);
        String sql;
        if (this.configuration.isShrinkWhitespacesInSql()) {
            // 也是调用parse解析
            sql = parser.parse(removeExtraWhitespaces(originalSql));
        } else {
            // 也是调用parse解析
            sql = parser.parse(originalSql);
        }
		// 最后封封装成为StaticSqlSource
        return new StaticSqlSource(this.configuration, sql, handler.getParameterMappings());
}
```

##### 1.3.3执行sql

解析完sql，我们把目光回到CachingExecutor的query方法：

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
    	// 获取mapper配置文件配置的，缓存
        Cache cache = ms.getCache();
    	// 判断是否使用缓存
        if (cache != null) {
            // 判断是否需要刷新缓存
            this.flushCacheIfRequired(ms);
            if (ms.isUseCache() && resultHandler == null) {
                this.ensureNoOutParams(ms, boundSql);
                // 获取缓存的值
                List<E> list = (List)this.tcm.getObject(cache, key);
                // 没有获取到
                if (list == null) {
                    // 没有获取到，调用query方法
                    list = this.delegate.query(ms, parameterObject, rowBounds, resultHandler, key, boundSql);
                    // 更新缓存值
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

`this.delegate.query(ms, parameterObject, rowBounds, resultHandler, key, boundSql);`方法：这次选择BaseExecutor，原因是在1.1.1获取`SqlSession`的过程章节中创建Executor是普通的执行器装饰成缓存执行器，所以选择BaseExecutor的query方法：

![image-20230105164531200](http://img.zouyh.top/article-img/20240917134955143.png)

BaseExecutor的query方法:

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
                // 读取缓存的值
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
            // 执行doQuery方法查询
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

查看`list = this.doQuery(ms, parameter, rowBounds, resultHandler, boundSql);`方法：

![image-20230105170039734](http://img.zouyh.top/article-img/20240917134956144.png)

BaseExecutor的子类实现了该方法，我们查看 SimpleExecutor的doQuery方法:

```java
public <E> List<E> doQuery(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql) throws SQLException {
        Statement stmt = null;

        List var9;
        try {
            // Configuration内部封装了ParameterHandler和ResultSetHandler,在解析mybatis的核心配置文件的时候添加的
            Configuration configuration = ms.getConfiguration();
            StatementHandler handler = configuration.newStatementHandler(this.wrapper, ms, parameter, rowBounds, resultHandler, boundSql);
            stmt = this.prepareStatement(handler, ms.getStatementLog());
            //StatementHandler封装了Statement, 让 StatementHandler 去处理
            var9 = handler.query(stmt, resultHandler);
        } finally {
            this.closeStatement(stmt);
        }

        return var9;
    }
```

接下来，咱们看看StatementHandler 的一个实现类 PreparedStatementHandler，PreparedStatementHandler封装的是PreparedStatement和原始通过JDBC操作类似, 看看PreparedStatementHandler的query怎么去处理的：

```java
public <E> List<E> query(Statement statement, ResultHandler resultHandler) throws SQLException {
    	// PreparedStatement通过JDBC操作时会用到
        PreparedStatement ps = (PreparedStatement)statement;
    	// 执行sql
        ps.execute();
    	// 结果交给了ResultSetHandler 去处理,处理完之后返回给客户端
        return this.resultSetHandler.handleResultSets(ps);
    }
```

到此，整个调用流程结束。

##### 1.3.4解析结果

解析结果是通过`this.resultSetHandler.handleResultSets(ps);`方法实现的

```java
public List<Object> handleResultSets(Statement stmt) throws SQLException {
        ErrorContext.instance().activity("handling results").object(this.mappedStatement.getId());
        List<Object> multipleResults = new ArrayList();
        int resultSetCount = 0;
    	// 获取第一个结果集
        ResultSetWrapper rsw = this.getFirstResultSet(stmt);
   		// 获取Mapper配置文件中配置的ResultMap
        List<ResultMap> resultMaps = this.mappedStatement.getResultMaps();
    	// ResultMap的数量
        int resultMapCount = resultMaps.size();
    	// 校验ResultMap的数量，如果rsw != null && resultMapCount < 1会抛出异常
        this.validateResultMapsCount(rsw, resultMapCount);

        while(rsw != null && resultMapCount > resultSetCount) {
            // 遍历ResultMap
            ResultMap resultMap = (ResultMap)resultMaps.get(resultSetCount);
            // 根据resultMap处理rsw生成java对象
            this.handleResultSet(rsw, resultMap, multipleResults, (ResultMapping)null);
            // 获取结果集的下一个结果
            rsw = this.getNextResultSet(stmt);
            this.cleanUpAfterHandlingResultSet();
            ++resultSetCount; // 自增
        }

        String[] resultSets = this.mappedStatement.getResultSets();
        if (resultSets != null) {
            while(rsw != null && resultSetCount < resultSets.length) {
                ResultMapping parentMapping = (ResultMapping)this.nextResultMaps.get(resultSets[resultSetCount]);
                if (parentMapping != null) {
                    String nestedResultMapId = parentMapping.getNestedResultMapId();
                    ResultMap resultMap = this.configuration.getResultMap(nestedResultMapId);
                    this.handleResultSet(rsw, resultMap, (List)null, parentMapping);
                }

                rsw = this.getNextResultSet(stmt);
                this.cleanUpAfterHandlingResultSet();
                ++resultSetCount;
            }
        }

        return this.collapseSingleResultList(multipleResults);
    }
```

查看`this.handleResultSet(rsw, resultMap, multipleResults, (ResultMapping)null);`方法：

```java
private void handleResultSet(ResultSetWrapper rsw, ResultMap resultMap, List<Object> multipleResults, ResultMapping parentMapping) throws SQLException {
        try {
            if (parentMapping != null) {
                this.handleRowValues(rsw, resultMap, (ResultHandler)null, RowBounds.DEFAULT, parentMapping);
            } else if (this.resultHandler == null) {
                DefaultResultHandler defaultResultHandler = new DefaultResultHandler(this.objectFactory);
                this.handleRowValues(rsw, resultMap, defaultResultHandler, this.rowBounds, (ResultMapping)null);
                multipleResults.add(defaultResultHandler.getResultList());
            } else {
                this.handleRowValues(rsw, resultMap, this.resultHandler, this.rowBounds, (ResultMapping)null);
            }
        } finally {
            this.closeResultSet(rsw.getResultSet());
        }

    }
```

可以看到，虽然按照parentMapping和resultHandler分成了3种情况，但最终都进入了handleRowValues方法:

```java
public void handleRowValues(ResultSetWrapper rsw, ResultMap resultMap, ResultHandler<?> resultHandler, RowBounds rowBounds, ResultMapping parentMapping) throws SQLException {
        if (resultMap.hasNestedResultMaps()) { // 判断有无嵌套的resultMap
            this.ensureNoRowBounds();
            this.checkResultHandler();
            this.handleRowValuesForNestedResultMap(rsw, resultMap, resultHandler, rowBounds, parentMapping);
        } else {
            this.handleRowValuesForSimpleResultMap(rsw, resultMap, resultHandler, rowBounds, parentMapping);
        }

    }
```

可以看到，分成嵌套和不嵌套两种方法，进行处理，这里我们只管理不嵌套的处理，嵌套的虽然会比不嵌套复杂一点，但总体类似，差别并不大。

```java
private void handleRowValuesForSimpleResultMap(ResultSetWrapper rsw, ResultMap resultMap, ResultHandler<?> resultHandler, RowBounds rowBounds, ResultMapping parentMapping) throws SQLException {
        DefaultResultContext<Object> resultContext = new DefaultResultContext();
        ResultSet resultSet = rsw.getResultSet();
    	// 游标滑动，实现分页效果
        this.skipRows(resultSet, rowBounds);
        while(this.shouldProcessMoreRows(resultContext, rowBounds) && !resultSet.isClosed() && resultSet.next()) {
            // 根据discriminate找到适合的ResultMap
            ResultMap discriminatedResultMap = this.resolveDiscriminatedResultMap(resultSet, resultMap, (String)null);
            // 重点在如果根据ResultMap和rsw封装参数
            Object rowValue = this.getRowValue(rsw, discriminatedResultMap, (String)null);
            this.storeObject(resultHandler, resultContext, rowValue, parentMapping, resultSet);
        }

    }
```

游标滑动，实现分页效果`this.skipRows(resultSet, rowBounds);`:

```java
private void skipRows(ResultSet rs, RowBounds rowBounds) throws SQLException {
        if (rs.getType() != 1003) {
            if (rowBounds.getOffset() != 0) {
                rs.absolute(rowBounds.getOffset());
            }
        } else {
            for(int i = 0; i < rowBounds.getOffset() && rs.next(); ++i) {
            }
        }

}
```

重点在如果根据ResultMap和rsw封装参数`Object rowValue = this.getRowValue(rsw, discriminatedResultMap, (String)null);`:

```java
private Object getRowValue(ResultSetWrapper rsw, ResultMap resultMap, String columnPrefix) throws SQLException {
        ResultLoaderMap lazyLoader = new ResultLoaderMap();
    	// ①，创建对象
        Object rowValue = this.createResultObject(rsw, resultMap, lazyLoader, columnPrefix);
        if (rowValue != null && !this.hasTypeHandlerForResultObject(rsw, resultMap.getType())) {
            MetaObject metaObject = this.configuration.newMetaObject(rowValue);
            boolean foundValues = this.useConstructorMappings;
            // ②，自动映射
            if (this.shouldApplyAutomaticMappings(resultMap, false)) {
                foundValues = this.applyAutomaticMappings(rsw, resultMap, metaObject, columnPrefix) || foundValues;
            }
			// ③，属性映射
            foundValues = this.applyPropertyMappings(rsw, resultMap, metaObject, lazyLoader, columnPrefix) || foundValues;
            foundValues = lazyLoader.size() > 0 || foundValues;
            rowValue = !foundValues && !this.configuration.isReturnInstanceForEmptyRow() ? null : rowValue;
        }

        return rowValue;
    }
```

①，创建对象

查看`Object rowValue = this.createResultObject(rsw, resultMap, lazyLoader, columnPrefix);`方法：

```java
private Object createResultObject(ResultSetWrapper rsw, ResultMap resultMap, ResultLoaderMap lazyLoader, String columnPrefix) throws SQLException {
        this.useConstructorMappings = false;
        List<Class<?>> constructorArgTypes = new ArrayList();
        List<Object> constructorArgs = new ArrayList();
    	// 生成对象
        Object resultObject = this.createResultObject(rsw, resultMap, constructorArgTypes, constructorArgs, columnPrefix);
    	
        if (resultObject != null && !this.hasTypeHandlerForResultObject(rsw, resultMap.getType())) {
            List<ResultMapping> propertyMappings = resultMap.getPropertyResultMappings();
            Iterator var9 = propertyMappings.iterator();

            while(var9.hasNext()) {
                ResultMapping propertyMapping = (ResultMapping)var9.next();
                // 属性嵌套查询且懒加载
                if (propertyMapping.getNestedQueryId() != null && propertyMapping.isLazy()) {
                    resultObject = this.configuration.getProxyFactory().createProxy(resultObject, lazyLoader, this.configuration, this.objectFactory, constructorArgTypes, constructorArgs);
                    break;
                }
            }
        }

        this.useConstructorMappings = resultObject != null && !constructorArgTypes.isEmpty();
        return resultObject;
    }
```

继续跟进`Object resultObject = this.createResultObject(rsw, resultMap, constructorArgTypes, constructorArgs, columnPrefix);`方法：

```java
private Object createResultObject(ResultSetWrapper rsw, ResultMap resultMap, List<Class<?>> constructorArgTypes, List<Object> constructorArgs, String columnPrefix) throws SQLException {
        Class<?> resultType = resultMap.getType();
        MetaClass metaType = MetaClass.forClass(resultType, this.reflectorFactory);
        List<ResultMapping> constructorMappings = resultMap.getConstructorResultMappings();
        if (this.hasTypeHandlerForResultObject(rsw, resultType)) {
            // 存在适用的typeHanlder类，事实上一般为基本数据类型或者其封装类
            return this.createPrimitiveResultObject(rsw, resultMap, columnPrefix);
        } else if (!constructorMappings.isEmpty()) {
            // 有参构造函数的constructor映射
            return this.createParameterizedResultObject(rsw, resultType, constructorMappings, constructorArgTypes, constructorArgs, columnPrefix);
        } else if (!resultType.isInterface() && !metaType.hasDefaultConstructor()) {
             // 判断是否开启自动映射
            if (this.shouldApplyAutomaticMappings(resultMap, false)) { 
                // 有参构造函数的自动映射
                return this.createByConstructorSignature(rsw, resultType, constructorArgTypes, constructorArgs);
            } else {
                throw new ExecutorException("Do not know how to create an instance of " + resultType);
            }
        } else {
            // 接口或者无参构造函数
            return this.objectFactory.create(resultType);
        }
    }
```

②，自动映射

在启用自动映射的前提下，进行自动映射，判断是否开启自动映射的条件`this.shouldApplyAutomaticMappings(resultMap, false)`：

```java
private boolean shouldApplyAutomaticMappings(ResultMap resultMap, boolean isNested) {
    	// resultMap配置了autoMapping = true
        if (resultMap.getAutoMapping() != null) {
            return resultMap.getAutoMapping();
        } else if (isNested) {
            //xml setting的属性autoMappingBehavior，有3个值：NONE(不启用)，PARTIAL(不嵌套的时候启动)，FULL(启动)
            return AutoMappingBehavior.FULL == this.configuration.getAutoMappingBehavior();
        } else {
            return AutoMappingBehavior.NONE != this.configuration.getAutoMappingBehavior();
        }
    }
```

自动映射查看` foundValues = this.applyAutomaticMappings(rsw, resultMap, metaObject, columnPrefix) || foundValues;`方法：

```java
private boolean applyAutomaticMappings(ResultSetWrapper rsw, ResultMap resultMap, MetaObject metaObject, String columnPrefix) throws SQLException {
        
        List<DefaultResultSetHandler.UnMappedColumnAutoMapping> autoMapping = this.createAutomaticMappings(rsw, resultMap, metaObject, columnPrefix);
        boolean foundValues = false;
        if (!autoMapping.isEmpty()) {
            Iterator var7 = autoMapping.iterator();

            while(true) {
                DefaultResultSetHandler.UnMappedColumnAutoMapping mapping;
                Object value;
                do {
                    if (!var7.hasNext()) {
                        return foundValues;
                    }

                    mapping = (DefaultResultSetHandler.UnMappedColumnAutoMapping)var7.next();
                    value = mapping.typeHandler.getResult(rsw.getResultSet(), mapping.column);
                    if (value != null) {
                        foundValues = true;
                    }
                } while(value == null && (!this.configuration.isCallSettersOnNulls() || mapping.primitive));

                metaObject.setValue(mapping.property, value);
            }
        } else {
            return foundValues;
        }
    }
```

继续跟进`List<DefaultResultSetHandler.UnMappedColumnAutoMapping> autoMapping = this.createAutomaticMappings(rsw, resultMap, metaObject, columnPrefix);`方法：

```java
private List<DefaultResultSetHandler.UnMappedColumnAutoMapping> createAutomaticMappings(ResultSetWrapper rsw, ResultMap resultMap, MetaObject metaObject, String columnPrefix) throws SQLException {
        String mapKey = resultMap.getId() + ":" + columnPrefix;
       // autoMappingsCache作为缓存，首先从缓存中获取
        List<DefaultResultSetHandler.UnMappedColumnAutoMapping> autoMapping = (List)this.autoMappingsCache.get(mapKey);
        if (autoMapping == null) { // 缓存未命中
            autoMapping = new ArrayList();
            List<String> unmappedColumnNames = rsw.getUnmappedColumnNames(resultMap, columnPrefix);
            Iterator var8 = unmappedColumnNames.iterator();

            while(true) {
                while(true) {
                    String columnName;
                    String propertyName;
                    while(true) {
                        if (!var8.hasNext()) {
                            this.autoMappingsCache.put(mapKey, autoMapping);
                            return (List)autoMapping;
                        }

                        columnName = (String)var8.next();
                        propertyName = columnName;
                        if (columnPrefix == null || columnPrefix.isEmpty()) {
                            break;
                        }

                        if (columnName.toUpperCase(Locale.ENGLISH).startsWith(columnPrefix)) {
                            propertyName = columnName.substring(columnPrefix.length());
                            break;
                        }
                    }
					// 驼峰
                    String property = metaObject.findProperty(propertyName, this.configuration.isMapUnderscoreToCamelCase());
                    if (property != null && metaObject.hasSetter(property)) { //存在set方法
                        // resultMap的应映射中已存在，忽略
                        if (!resultMap.getMappedProperties().contains(property)) {
                            Class<?> propertyType = metaObject.getSetterType(property);
                            if (this.typeHandlerRegistry.hasTypeHandler(propertyType, rsw.getJdbcType(columnName))) {
                                TypeHandler<?> typeHandler = rsw.getTypeHandler(propertyType, columnName);
                                ((List)autoMapping).add(new DefaultResultSetHandler.UnMappedColumnAutoMapping(columnName, property, typeHandler, propertyType.isPrimitive()));
                            } else {
                               // 没找到，根据autoMappingUnknownColumnBehavior属性（默认为NONE）进行处理：NONE(忽略)，WARNING(log.warn)，ERROR(抛异常)
                                this.configuration.getAutoMappingUnknownColumnBehavior().doAction(this.mappedStatement, columnName, property, propertyType);
                            }
                        }
                    } else {
                       // 没找到，根据autoMappingUnknownColumnBehavior属性（默认为NONE）进行处理：NONE(忽略)，WARNING(log.warn)，ERROR(抛异常)
                        this.configuration.getAutoMappingUnknownColumnBehavior().doAction(this.mappedStatement, columnName, property != null ? property : propertyName, (Class)null);
                    }
                }
            }
        } else {// 加入缓存
            return (List)autoMapping;
        }
    }
```

③，属性映射

```java
private boolean applyPropertyMappings(ResultSetWrapper rsw, ResultMap resultMap, MetaObject metaObject, ResultLoaderMap lazyLoader, String columnPrefix) throws SQLException {
        List<String> mappedColumnNames = rsw.getMappedColumnNames(resultMap, columnPrefix);
        boolean foundValues = false;
    	// 获取属性映射 
        List<ResultMapping> propertyMappings = resultMap.getPropertyResultMappings();
        Iterator var9 = propertyMappings.iterator();

        while(true) {
            while(true) {
                Object value;
                String property;
                do {
                    ResultMapping propertyMapping;
                    String column;
                    do { 
                        // 遍历
                        if (!var9.hasNext()) {
                            return foundValues; // 遍历完成跳出循环
                        }

                        propertyMapping = (ResultMapping)var9.next();
                        column = this.prependPrefix(propertyMapping.getColumn(), columnPrefix);
                        // 嵌套查询的属性，忽略colum
                        if (propertyMapping.getNestedResultMapId() != null) {
                            column = null;
                        }
                    } while(!propertyMapping.isCompositeResult() && (column == null || !mappedColumnNames.contains(column.toUpperCase(Locale.ENGLISH))) && propertyMapping.getResultSet() == null);
					//字段值	
                    value = this.getPropertyMappingValue(rsw.getResultSet(), metaObject, propertyMapping, lazyLoader, columnPrefix);
                    property = propertyMapping.getProperty();
                } while(property == null);

                if (value == DEFERRED) {
                    foundValues = true;
                } else {
                    if (value != null) {
                        foundValues = true;
                    }

                    if (value != null || this.configuration.isCallSettersOnNulls() && !metaObject.getSetterType(property).isPrimitive()) {
                        // 赋值给对象
                        metaObject.setValue(property, value);
                    }
                }
            }
        }
    }
```

