---
icon: file-lines
# 标题
title: 'mybatis源码解析核心配置文件'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-25
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

### 一，mybatis源码解析核心配置文件

#### 1.1传统的jdbc

先看一看传统的jdbc，这样有助于学习mybatis：

```java
@Test
public void test() throws SQLException {
	Connection conn=null;
	PreparedStatement pstmt=null;
	try {
		// 1.加载驱动
		Class.forName("com.mysql.jdbc.Driver");
		// 2.创建连接
		conn= DriverManager.
		getConnection("jdbc:mysql://localhost:3306/mybatis_example", "root", "123456");
		// SQL语句
		String sql="select id,user_name,create_time from t_user where id=?";
		// 获得sql执行者
		pstmt=conn.prepareStatement(sql);
		pstmt.setInt(1,1);
		// 执行查询
		pstmt.execute();
		ResultSet rs= pstmt.getResultSet();
		rs.next();
		User user =new User();
		user.setId(rs.getLong("id"));
		user.setUserName(rs.getString("user_name"));
		user.setCreateTime(rs.getDate("create_time"));
		System.out.println(user.toString());
	} catch (Exception e) {
		e.printStackTrace();
	}finally{
		// 关闭资源
		try {
			if(conn!=null){
				conn.close();
			}
			if(pstmt!=null){
				pstmt.close();
			}
		} catch (SQLException e) {
			e.printStackTrace();
		}
	}
}
```

**jdbc问题总结如下：**

1、 数据库连接创建、释放频繁造成系统资源浪费，从而影响系统性能。如果使用数据库连接池可解决此问题。

2、 Sql语句在代码中硬编码，造成代码不易维护，实际应用中sql变化的可能较大，sql变动需要改变java代码。

3、 使用preparedStatement向占有位符号传参数存在硬编码，因为sql语句的where条件不一定，可能多也可能少，修改sql还要修改代码，系统不易维护。

4、 对结果集解析存在硬编码（查询列名），sql变化导致解析代码变化，系统不易维护，如果能将数据库记录封装成pojo对象解析比较方便。



#### 1.2mybatis案例

​	MyBatis简单介绍：MyBatis是一个持久层（ORM）框架，使用简单，学习成本较低。可以执行自己手写的SQL语句，比较灵活。但 是MyBatis的自动化程度不高，移植性也不高，有时从一个数据库迁移到另外一个数据库的时候需要自己修改配 置，所以称只为半自动ORM框架。

Mybatis最简单的使用列子如下：

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

总结下就是分为下面四个步骤： 

1. 从配置文件（通常是XML文件）得到`SessionFactory`; 
2. 从`SessionFactory`得到`SqlSession`； 
3. 通过`SqlSession`进行CRUD和事务的操作；
4.  执行完相关操作之后关闭`Session`。

#### 1.3加载mybatis核心配置文件

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

XMLConfigBuilder：

```java
public class XMLMapperBuilder extends BaseBuilder 
```

`XMLConfigBuilder`是继承抽象类`BaseBuilder`,`BaseBuilder`有很多子类，每个子类都有自己特定的责任：

![image-20230102000123412](http://img.zouyh.top/article-img/20240917134952137.png)

常见的`XMLConfigBuilder`是用来解析mybatis的核心配置文件的、`XMLMapperBuilder`是用来解析mapper的配置文件的、`XMLStatementBuilder`是用来解析mapper的配置文件中的节点元素的比如select标签等等。

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

##### 1.3.1解析properties标签

配置样例：

```xml
<properties resource="jdbc.properties"></properties>
```

查看`this.propertiesElement(root.evalNode("properties"));`方法：

```java
 private void propertiesElement(XNode context) throws Exception {
        if (context != null) {
        	// 读取properties标签中的property标签<property name="" value=""/>
            Properties defaults = context.getChildrenAsProperties();
            // 读取properties标签中的resource、url属性
            String resource = context.getStringAttribute("resource");
            String url = context.getStringAttribute("url");
            // resource和url属性不能同时出现在properties标签中
            if (resource != null && url != null) {
                throw new BuilderException("The properties element cannot specify both a URL and a resource based property file reference.  Please specify one or the other.");
            }
            // url或者resource对应要文件转化为InputStream，最后放到Properties对象，由于defaults是key-value结构，所以会覆盖相同key的值	
            if (resource != null) {
                defaults.putAll(Resources.getResourceAsProperties(resource));
            } else if (url != null) { 
                defaults.putAll(Resources.getUrlAsProperties(url));
            }
			//获得configuration中的variables变量的值，此变量可以通过SqlSessionFactoryBuilder.build()传入properties属性值
            Properties vars = this.configuration.getVariables();
            // 如果调用build的时候传入了properties属性，放到defaults中
            if (vars != null) {
                defaults.putAll(vars);
            }
            // 放到XMLConfigBuilder和Configuration对象中
            this.parser.setVariables(defaults);
            this.configuration.setVariables(defaults);
        }

    }
```

##### 1.3.2解析typeAliases标签

配置样例：

```xml
<typeAliases>
       <package name="cn.com.mybatis.bean"></package>
       <typeAlias alias="user" type="cn.com.mybatis.bean.User"></typeAlias>
</typeAliases>
```

查看` this.typeAliasesElement(root.evalNode("typeAliases"));`方法：

```java
private void typeAliasesElement(XNode parent) {
        if (parent != null) {
            // 获取typeAliases的所有子标签
            Iterator var2 = parent.getChildren().iterator();
            while(var2.hasNext()) {
                XNode child = (XNode)var2.next();
                String alias;
                // 方式一：通过包扫描批量起别名
                if ("package".equals(child.getName())) {
                    alias = child.getStringAttribute("name");
                    this.configuration.getTypeAliasRegistry().registerAliases(alias);
                } else {
                    // 方式二：通过typeAlias标签单独起别名
                    alias = child.getStringAttribute("alias");
                    String type = child.getStringAttribute("type");
                    try {
                        Class<?> clazz = Resources.classForName(type);
                        if (alias == null) {
                            this.typeAliasRegistry.registerAlias(clazz);
                        } else {
                            this.typeAliasRegistry.registerAlias(alias, clazz);
                        }
                    } catch (ClassNotFoundException var7) {
                        throw new BuilderException("Error registering typeAlias for '" + alias + "'. Cause: " + var7, var7);
                    }
                }
            }
        }

    }
```

**方式一**通过包扫描批量起别名，查看`this.configuration.getTypeAliasRegistry().registerAliases(alias);`方法：

```java
public void registerAliases(String packageName){
    registerAliases(packageName, Object.class);
  }
```

可以看到从Configuration中获得TypeAliasRegistry，然后调用其registerAliases方法：

```java
public void registerAliases(String packageName){
    registerAliases(packageName, Object.class);
}
```

继续跟进`registerAliases(packageName, Object.class);`方法：

```java
public void registerAliases(String packageName, Class<?> superType) {
    	// 创建一个工具类对象
        ResolverUtil<Class<?>> resolverUtil = new ResolverUtil();
    	// 通过packageName把该包下的所有类进行加载，把其Class对象放到resolverUtil的matches中
        resolverUtil.find(new IsA(superType), packageName);
       // 获取到加载的Class对象
        Set<Class<? extends Class<?>>> typeSet = resolverUtil.getClasses();
    	// 遍历对象
        Iterator var5 = typeSet.iterator();
        while(var5.hasNext()) {
            Class<?> type = (Class)var5.next();
            // 判断不是匿名类，接口，枚举类，就调用registerAlias方法起别名
            if (!type.isAnonymousClass() && !type.isInterface() && !type.isMemberClass()) {
                this.registerAlias(type);
            }
        }

    }
```

继续跟进`this.registerAlias(type);`方法

```java
public void registerAlias(Class<?> type) {
    	// 获取一个类的简单类名，如xxx.xx.xxx.xx.User 则其简单名称为User
        String alias = type.getSimpleName();
       // 获取这个类上有没有@Alias注解
        Alias aliasAnnotation = (Alias)type.getAnnotation(Alias.class);
        if (aliasAnnotation != null) {
            // 如果有@Alias注解，则使用注解上配置的value属性作为别名
            alias = aliasAnnotation.value();
        }
		// 调用registerAlias方法起别名
        this.registerAlias(alias, type);
    }
```

继续跟进`this.registerAlias(alias, type);`方法：

```java
public void registerAlias(String alias, Class<?> value) {
		// 如果alias==null即别名为空，就抛出异常
        if (alias == null) {
            throw new TypeException("The parameter alias cannot be null");
        } else {
            // 别名首字母小写化
            String key = alias.toLowerCase(Locale.ENGLISH);
            // 如果已经注册了改别名则会抛异常
            if (this.typeAliases.containsKey(key) && this.typeAliases.get(key) != null && !((Class)this.typeAliases.get(key)).equals(value)) {
                throw new TypeException("The alias '" + alias + "' is already mapped to the value '" + ((Class)this.typeAliases.get(key)).getName() + "'.");
            } else {
                // 没有注册过上，就保存在this.typeAliases中。
                this.typeAliases.put(key, value);
            }
        }
    }
```

**方式二**通过typeAlias标签单独起别名，查看` this.typeAliasRegistry.registerAlias(clazz);`和`this.typeAliasRegistry.registerAlias(alias, clazz);`方法：

` this.typeAliasRegistry.registerAlias(clazz);`方法如下:

```java
public void registerAlias(Class<?> type) {
    	// 获取一个类的简单类名，如xxx.xx.xxx.xx.User 则其简单名称为User
        String alias = type.getSimpleName();
       // 获取这个类上有没有@Alias注解
        Alias aliasAnnotation = (Alias)type.getAnnotation(Alias.class);
        if (aliasAnnotation != null) {
            // 如果有@Alias注解，则使用注解上配置的value属性作为别名
            alias = aliasAnnotation.value();
        }
		// 调用registerAlias方法起别名
        this.registerAlias(alias, type);
    }
```

`this.typeAliasRegistry.registerAlias(alias, clazz);`方法如下：

```java
public void registerAlias(String alias, Class<?> value) {
		// 如果alias==null即别名为空，就抛出异常
        if (alias == null) {
            throw new TypeException("The parameter alias cannot be null");
        } else {
            // 别名首字母小写化
            String key = alias.toLowerCase(Locale.ENGLISH);
            // 如果已经注册了改别名则会抛异常
            if (this.typeAliases.containsKey(key) && this.typeAliases.get(key) != null && !((Class)this.typeAliases.get(key)).equals(value)) {
                throw new TypeException("The alias '" + alias + "' is already mapped to the value '" + ((Class)this.typeAliases.get(key)).getName() + "'.");
            } else {
                // 没有注册过上，就保存在this.typeAliases中。
                this.typeAliases.put(key, value);
            }
        }
    }
```

以上就是所有的解析，另在写Mapper映射文件和核心配置文件的时候会使用一些自定义的别名，这些别名是怎么注册的那，在Configuration、TypeAliasRegistry类中进行了注册，如Configuration中的：

```java
public Configuration() {
    typeAliasRegistry.registerAlias("JDBC", JdbcTransactionFactory.class);
    typeAliasRegistry.registerAlias("MANAGED", ManagedTransactionFactory.class);

    typeAliasRegistry.registerAlias("JNDI", JndiDataSourceFactory.class);
    typeAliasRegistry.registerAlias("POOLED", PooledDataSourceFactory.class);
    typeAliasRegistry.registerAlias("UNPOOLED", UnpooledDataSourceFactory.class);

    typeAliasRegistry.registerAlias("PERPETUAL", PerpetualCache.class);
    typeAliasRegistry.registerAlias("FIFO", FifoCache.class);
    typeAliasRegistry.registerAlias("LRU", LruCache.class);
    typeAliasRegistry.registerAlias("SOFT", SoftCache.class);
    typeAliasRegistry.registerAlias("WEAK", WeakCache.class);

    typeAliasRegistry.registerAlias("DB_VENDOR", VendorDatabaseIdProvider.class);

    typeAliasRegistry.registerAlias("XML", XMLLanguageDriver.class);
    typeAliasRegistry.registerAlias("RAW", RawLanguageDriver.class);

    typeAliasRegistry.registerAlias("SLF4J", Slf4jImpl.class);
    typeAliasRegistry.registerAlias("COMMONS_LOGGING", JakartaCommonsLoggingImpl.class);
    typeAliasRegistry.registerAlias("LOG4J", Log4jImpl.class);
    typeAliasRegistry.registerAlias("LOG4J2", Log4j2Impl.class);
    typeAliasRegistry.registerAlias("JDK_LOGGING", Jdk14LoggingImpl.class);
    typeAliasRegistry.registerAlias("STDOUT_LOGGING", StdOutImpl.class);
    typeAliasRegistry.registerAlias("NO_LOGGING", NoLoggingImpl.class);

    typeAliasRegistry.registerAlias("CGLIB", CglibProxyFactory.class);
    typeAliasRegistry.registerAlias("JAVASSIST", JavassistProxyFactory.class);

    languageRegistry.setDefaultDriverClass(XMLLanguageDriver.class);
    languageRegistry.register(RawLanguageDriver.class);
  }
```

TypeAliasRegistry中的：

```java
//默认的构造方法，初始化系统内置的别名
  public TypeAliasRegistry() {
    registerAlias("string", String.class);

    registerAlias("byte", Byte.class);
    registerAlias("long", Long.class);
    registerAlias("short", Short.class);
    registerAlias("int", Integer.class);
    registerAlias("integer", Integer.class);
    registerAlias("double", Double.class);
    registerAlias("float", Float.class);
    registerAlias("boolean", Boolean.class);

    registerAlias("byte[]", Byte[].class);
    registerAlias("long[]", Long[].class);
    registerAlias("short[]", Short[].class);
    registerAlias("int[]", Integer[].class);
    registerAlias("integer[]", Integer[].class);
    registerAlias("double[]", Double[].class);
    registerAlias("float[]", Float[].class);
    registerAlias("boolean[]", Boolean[].class);

    registerAlias("_byte", byte.class);
    registerAlias("_long", long.class);
    registerAlias("_short", short.class);
    registerAlias("_int", int.class);
    registerAlias("_integer", int.class);
    registerAlias("_double", double.class);
    registerAlias("_float", float.class);
    registerAlias("_boolean", boolean.class);

    registerAlias("_byte[]", byte[].class);
    registerAlias("_long[]", long[].class);
    registerAlias("_short[]", short[].class);
    registerAlias("_int[]", int[].class);
    registerAlias("_integer[]", int[].class);
    registerAlias("_double[]", double[].class);
    registerAlias("_float[]", float[].class);
    registerAlias("_boolean[]", boolean[].class);

    registerAlias("date", Date.class);
    registerAlias("decimal", BigDecimal.class);
    registerAlias("bigdecimal", BigDecimal.class);
    registerAlias("biginteger", BigInteger.class);
    registerAlias("object", Object.class);

    registerAlias("date[]", Date[].class);
    registerAlias("decimal[]", BigDecimal[].class);
    registerAlias("bigdecimal[]", BigDecimal[].class);
    registerAlias("biginteger[]", BigInteger[].class);
    registerAlias("object[]", Object[].class);
      
    registerAlias("map", Map.class);
    registerAlias("hashmap", HashMap.class);
    registerAlias("list", List.class);
    registerAlias("arraylist", ArrayList.class);
    registerAlias("collection", Collection.class);
    registerAlias("iterator", Iterator.class);
      
    registerAlias("ResultSet", ResultSet.class);
  }
```

##### 1.3.3解析plugins标签

首先了解一下插件，在之前的源码中我们也发现了，mybatis内部对于插件的处理确实使用的代理模式，既然是代理模式，我们应该了解MyBatis 允许哪些对象的哪些方法允许被拦截，并不是每一个运行的节点都是可以被修改的。只有清楚了这些对象的方法的作用，当我们自己编写插件的时候才知道从哪里去拦截。在MyBatis 官网有答案：

![img](http://img.zouyh.top/article-img/20240917134953138.png)

Executor 会拦截到CachingExcecutor 或者BaseExecutor。因为创建Executor 时是先创建CachingExcecutor，再包装拦截。从代码顺序上能看到后面我们会详细分析。

我们可以通过mybatis的分页插件来看看整个插件从包装拦截器链到执行拦截器链的过程。

**自定义分页插件**

```java
/*
 * 自定义分页插件实现的简易版分页插件
 */
@Intercepts({
        @Signature(type = Executor.class,method = "query" ,args ={MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class} ), // 需要代理的对象和方法
        @Signature(type = Executor.class,method = "query" ,args ={MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class, CacheKey.class, BoundSql.class} ) // 需要代理的对象和方法
})
public class MyPageInterceptor implements Interceptor {

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        System.out.println("简易版的分页插件：逻辑分页改成物理分页");

        // 修改sql 拼接Limit 0,10
        Object[] args = invocation.getArgs();
        // MappedStatement 对mapper映射文件里面元素的封装
        MappedStatement ms= (MappedStatement) args[0];
        // BoundSql 对sql和参数的封装
        Object parameterObject=args[1];
        BoundSql boundSql = ms.getBoundSql(parameterObject);
        // RowBounds 封装了逻辑分页的参数 ：当前页offset，一页数limit
        RowBounds rowBounds= (RowBounds) args[2];

        // 拿到原来的sql语句
        String sql = boundSql.getSql();
        String limitSql=sql+ " limit "+rowBounds.getOffset()+","+ rowBounds.getLimit();
        //将分页sql重新封装一个BoundSql 进行后续执行
        BoundSql pageBoundSql = new BoundSql(ms.getConfiguration(), limitSql, boundSql.getParameterMappings(), parameterObject);
        // 被代理的对象
        Executor executor= (Executor) invocation.getTarget();
        CacheKey cacheKey = executor.createCacheKey(ms, parameterObject, rowBounds, pageBoundSql);
        // 调用修改过后的sql继续执行查询
        return  executor.query(ms,parameterObject,rowBounds, (ResultHandler) args[3],cacheKey,pageBoundSql);
    }
}
```

拦截签名跟参数的顺序有严格要求，如果按照顺序找不到对应方法会抛出异常：

```
 org.apache.ibatis.exceptions.PersistenceException:
            ### Error opening session.  Cause: org.apache.ibatis.plugin.PluginException: 
            Could not find method on interface org.apache.ibatis.executor.Executor named query
```

**分页插件使用**

1，添加pom依赖：

```
<dependency>
	<groupId>com.github.pagehelper</groupId>
	<artifactId>pagehelper</artifactId>
	<version>1.2.15</version>
</dependency>
```

2，插件注册，在mybatis-config.xml 中注册插件:

```xml
<configuration>
	<plugins>
		<!-- com.github.pagehelper为PageHelper类所在包名 -->
		<plugin interceptor="com.github.pagehelper.PageHelper">
			<property name="helperDialect" value="mysql" />
			<!-- 该参数默认为false -->
			<!-- 设置为true时，会将RowBounds第一个参数offset当成pageNum页码使用 -->
			<!-- 和startPage中的pageNum效果一样 -->
			<property name="offsetAsPageNum" value="true" />
			<!-- 该参数默认为false -->
			<!-- 设置为true时，使用RowBounds分页会进行count查询 -->
			<property name="rowBoundsWithCount" value="true" />
			<!-- 设置为true时，如果pageSize=0或者RowBounds.limit = 0就会查询出全部的结果 -->
			<!-- （相当于没有执行分页查询，但是返回结果仍然是Page类型） -->
			<property name="pageSizeZero" value="true" />
			<!-- 3.3.0版本可用 - 分页参数合理化，默认false禁用 -->
			<!-- 启用合理化时，如果pageNum<1会查询第一页，如果pageNum>pages会查询最后一页 -->
			<!-- 禁用合理化时，如果pageNum<1或pageNum>pages会返回空数据 -->
			<property name="reasonable" value="true" />
			<!-- 3.5.0版本可用 - 为了支持startPage(Object params)方法 -->
			<!-- 增加了一个`params`参数来配置参数映射，用于从Map或ServletRequest中取值 -->
			<!-- 可以配置pageNum,pageSize,count,pageSizeZero,reasonable,不配置映射的用默认值 -->
			<!-- 不理解该含义的前提下，不要随便复制该配置 -->
			<property name="params" value="pageNum=start;pageSize=limit;" />
		</plugin>
	</plugins>
</configuration>
```

3，调用：

```java
// 获取配置文件
InputStream inputStream = Resources.getResourceAsStream("mybatis/mybatis-config.xml");
// 通过加载配置文件获取SqlSessionFactory对象
SqlSessionFactory factory = new SqlSessionFactoryBuilder().build(inputStream);
try (SqlSession sqlSession = sqlSessionFactory.openSession()) {
    // Mybatis在getMapper就会给我们创建jdk动态代理
    EmpMapper mapper = sqlSession.getMapper(EmpMapper.class);
    PageHelper.startPage(1, 5);
    List<Emp> list=mapper.selectAll(); 
    PageInfo<ServiceStation> info = new PageInfo<ServiceStation>(list, 3);                   
          System.out.println("当前页码："+info.getPageNum());
          System.out.println("每页的记录数："+info.getPageSize());
          System.out.println("总记录数："+info.getTotal());
          System.out.println("总页码："+info.getPages());
          System.out.println("是否第一页："+info.isIsFirstPage());
          System.out.println("连续显示的页码：");
          int[] nums = info.getNavigatepageNums();
          for (int i = 0; i < nums.length; i++) {
               System.out.println(nums[i]);
          }     
}  
```

以上就是对插件的简单应用，让我继续回到解析plugins标签这个主线来。

配置样例：

```xml
<plugins>
		<plugin interceptor="xxx.xx.xxx.xxxInterceptor1"/>
		<plugin interceptor="xxx.xx.xxx.xxxInterceptor2"/>
        <plugin interceptor="xxx.xx.xxx.xxxInterceptor3">
                <property name="xxname" value="xxvalue" />
        </plugin>
</plugins>
```

查看` this.pluginElement(root.evalNode("plugins"));`方法：

```java
private void pluginElement(XNode parent) throws Exception {
        if (parent != null) {
            // 获取plugins的子标签，即plugin标签。
            Iterator var2 = parent.getChildren().iterator();
            // 遍历
            while(var2.hasNext()) {
                XNode child = (XNode)var2.next();
                // 获取plugin标签的interceptor属性
                String interceptor = child.getStringAttribute("interceptor");
                // 获取plugin标签的property标签
                Properties properties = child.getChildrenAsProperties();
                // 创建插件实例
                Interceptor interceptorInstance = (Interceptor)this.resolveClass(interceptor).getDeclaredConstructor().newInstance();
                // 设置插件的属性
                interceptorInstance.setProperties(properties);
                // 将插件保存到configuration的InterceptorChain成员变量中，InterceptorChain中有一个List<Interceptor> interceptors，来保存插件
                this.configuration.addInterceptor(interceptorInstance);
            }
        }

    }
```

以上就是插件的注册过程，至于插件的代理和拦截是怎么实现的？后面会继续分析

##### 1.3.4解析environments标签

示例配置：

```xml
<!-- 和spring整合后 environments配置将废除    -->
<environments default="development">
   <environment id="development">
      <!-- 使用jdbc事务管理 -->
      <transactionManager type="JDBC" />
      <!-- 数据库连接池 -->
      <dataSource type="POOLED">
         <property name="driver" value=""/>
         <property name="url" value="" />
         <property name="username" value="" />
         <property name="password" value="" />
      </dataSource>
   </environment>
</environments>
```

查看`this.environmentsElement(root.evalNode("environments"));`方法：

```java
private void environmentsElement(XNode context) throws Exception {
        if (context != null) {
            // environment是构造XMLConfigBuilder对象时外部传入的environment的id,若不空，则就用这个id指定的environment
            if (this.environment == null) {
                // 若为null，则使用environment属性default的值作为environment的id 
                this.environment = context.getStringAttribute("default");
            }
			// 获取environments的子标签并遍历
            Iterator var2 = context.getChildren().iterator();
            while(var2.hasNext()) {
                XNode child = (XNode)var2.next();
                // 获取environment的id
                String id = child.getStringAttribute("id");
                // 如果是特定的，也就是跟environment值一样的,才解析
                if (this.isSpecifiedEnvironment(id)) {
                    // 解析transactionManager标签，创建事务工厂
                    TransactionFactory txFactory = this.transactionManagerElement(child.evalNode("transactionManager"));
                    // 解析dataSource标签，创建数据源
                    DataSourceFactory dsFactory = this.dataSourceElement(child.evalNode("dataSource"));
                    DataSource dataSource = dsFactory.getDataSource();
                    // 构造Environment对象 
                    Builder environmentBuilder = (new Builder(id)).transactionFactory(txFactory).dataSource(dataSource);
                    // Environment对象保存到configuration对象中
                    this.configuration.setEnvironment(environmentBuilder.build());
                }
            }
        }

    }
```

①，**解析transactionManager标签,创建事务工厂**，查看`TransactionFactory txFactory = this.transactionManagerElement(child.evalNode("transactionManager"));`方法：

```java
private TransactionFactory transactionManagerElement(XNode context) throws Exception {
        if (context != null) {
            // 读取type的属性值
            String type = context.getStringAttribute("type");
            // 获取属性值，为了后面填充
            Properties props = context.getChildrenAsProperties();
            // 根据type创建通过resolveClass方法获取全类名，然后通过反射获取实例
            TransactionFactory factory = (TransactionFactory)this.resolveClass(type).getDeclaredConstructor().newInstance();
            // 填充属性
            factory.setProperties(props);
            return factory;
        } else {
            throw new BuilderException("Environment declaration requires a TransactionFactory.");
        }
    }
```

查看`this.resolveClass(type)`方法是如何获取全类名的：

```java
protected <T> Class<? extends T> resolveClass(String alias) {
    	// alias表示别名
        if (alias == null) {
            return null;
        } else {
            try {
                // 继续
                return this.resolveAlias(alias);
            } catch (Exception var3) {
                throw new BuilderException("Error resolving class. Cause: " + var3, var3);
            }
        }
    }
```

继续跟进`this.resolveAlias(alias);`方法：

```java
protected <T> Class<? extends T> resolveAlias(String alias) {
        return this.typeAliasRegistry.resolveAlias(alias);
    }
```

继续跟进`this.typeAliasRegistry.resolveAlias(alias);`方法：

```java
public <T> Class<T> resolveAlias(String string) {
        try {
            if (string == null) {
                return null;
            } else {
                // 别名转小写
                String key = string.toLowerCase(Locale.ENGLISH);
                Class value;
                // 判断typeAliases是否包含
                if (this.typeAliases.containsKey(key)) {
                    value = (Class)this.typeAliases.get(key);
                } else {
                    value = Resources.classForName(string);
                }

                return value;
            }
        } catch (ClassNotFoundException var4) {
            throw new TypeException("Could not resolve type alias '" + string + "'.  Cause: " + var4, var4);
        }
    }
```

在1.3.2解析typeAliases标签中，会把起别名的值存放在this.typeAliases中，在Configuration中默认添加的JDBC对应值`JdbcTransactionFactory.class`

```java
public Configuration() {
    typeAliasRegistry.registerAlias("JDBC", JdbcTransactionFactory.class);
}
```

②，**解析dataSource标签，创建数据源**查看`DataSourceFactory dsFactory = this.dataSourceElement(child.evalNode("dataSource"));`方法：

```java
private DataSourceFactory dataSourceElement(XNode context) throws Exception {
        if (context != null) {
            // 获取dataSource的type属性
            String type = context.getStringAttribute("type");
            Properties props = context.getChildrenAsProperties();
            // 同样根据type创建通过resolveClass方法获取全类名，然后通过反射获取实例
            DataSourceFactory factory = (DataSourceFactory)this.resolveClass(type).getDeclaredConstructor().newInstance();
            // 属性填充
            factory.setProperties(props);
            return factory;
        } else {
            throw new BuilderException("Environment declaration requires a DataSourceFactory.");
        }
    }
```

同样在1.3.2解析typeAliases标签中，会把起别名的值存放在this.typeAliases中，在Configuration中默认添加的POOLED对应值`PooledDataSourceFactory.class`

```java
public Configuration() {
     typeAliasRegistry.registerAlias("POOLED", PooledDataSourceFactory.class);
}
```

##### 1.3.5解析typeHandlers标签

**Mybatis中的TypeHandler是什么？**

​	无论是 MyBatis 在预处理语句（PreparedStatement）中设置一个参数时，还是从结果集中取出一个值时，都会用类型处理器将获取的值以合适的方式转换成 Java 类型。Mybatis默认为我们实现了许多TypeHandler, 当我们没有配置指定TypeHandler时，Mybatis会根据参数或者返回结果的不同，默认为我们选择合适的TypeHandler处理。

那么，我们怎么自定义实现一个TypeHandler ?

1，自定义一个只需要实现BaseTypeHandler接口就可以：

```java
@MappedJdbcTypes(JdbcType.VARCHAR)
//此处如果不用注解指定jdbcType, 那么，就可以在配置文件中通过"jdbcType"属性指定， 同理， javaType 也可通过 @MappedTypes指定
public class ExampleTypeHandler extends BaseTypeHandler<String> {

  @Override
  public void setNonNullParameter(PreparedStatement ps, int i, String parameter, JdbcType jdbcType) throws SQLException {
    ps.setString(i, parameter);
  }

  @Override
  public String getNullableResult(ResultSet rs, String columnName) throws SQLException {
    return rs.getString(columnName);
  }

  @Override
  public String getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
    return rs.getString(columnIndex);
  }

  @Override
  public String getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
    return cs.getString(columnIndex);
  }
}
```

2，配置

```xml
<configuration>
  <typeHandlers>
      <!-- 由于自定义的TypeHandler在定义时已经通过注解指定了jdbcType, 所以此处不用再配置jdbcType -->
      <typeHandler handler="ExampleTypeHandler"/>
  </typeHandlers>
</configuration>
```



查看` this.typeHandlerElement(root.evalNode("typeHandlers"));`方法：

```java
private void typeHandlerElement(XNode parent) {
        if (parent != null) {
            // 获取typeHandlers的子标签
            Iterator var2 = parent.getChildren().iterator();
			// 遍历子标签
            while(var2.hasNext()) {
                XNode child = (XNode)var2.next();
                String typeHandlerPackage;
                // 方式一：子节点为package时，获取其name属性的值，然后自动扫描package下的自定义typeHandler
                if ("package".equals(child.getName())) {
                    typeHandlerPackage = child.getStringAttribute("name");
                    this.typeHandlerRegistry.register(typeHandlerPackage);
                } else {
                    // 方式二：节点为package时，获取javaType属性和handler，注册typeHandler
                    typeHandlerPackage = child.getStringAttribute("javaType");
                    String jdbcTypeName = child.getStringAttribute("jdbcType");
                    String handlerTypeName = child.getStringAttribute("handler");
                    // resolveClass获取javaType的别名
                    Class<?> javaTypeClass = this.resolveClass(typeHandlerPackage);
                    // JdbcType是一个枚举类型，resolveJdbcType方法是在获取枚举类型的值
                    JdbcType jdbcType = this.resolveJdbcType(jdbcTypeName);
                    // resolveClass获取handlerType的别名
                    Class<?> typeHandlerClass = this.resolveClass(handlerTypeName);
                    if (javaTypeClass != null) {
                        if (jdbcType == null) {
                            // 保存到typeHandlerRegistry中
                            this.typeHandlerRegistry.register(javaTypeClass, typeHandlerClass);
                        } else {
                            // 保存到typeHandlerRegistry中
                            this.typeHandlerRegistry.register(javaTypeClass, jdbcType, typeHandlerClass);
                        }
                    } else {
                        // 保存到typeHandlerRegistry中
                        this.typeHandlerRegistry.register(typeHandlerClass);
                    }
                }
            }
        }

    }
```

查看`his.typeHandlerRegistry.register(typeHandlerClass)方法`，看看如何保存typeHandler的：

```java
public void register(Class<?> typeHandlerClass) {
        boolean mappedTypeFound = false;
    	
        MappedTypes mappedTypes = (MappedTypes)typeHandlerClass.getAnnotation(MappedTypes.class);
        if (mappedTypes != null) {
            // 获取mappedTypes注解的值
            Class[] var4 = mappedTypes.value();
            int var5 = var4.length;
            for(int var6 = 0; var6 < var5; ++var6) {
                // 遍历
                Class<?> javaTypeClass = var4[var6];
                // 注册指定了jdbcType和typeHandlerClass
                this.register(javaTypeClass, typeHandlerClass);
                mappedTypeFound = true;
            }
        }

        if (!mappedTypeFound) {
            this.register(this.getInstance((Class)null, typeHandlerClass));
        }

```

查看`this.register(javaTypeClass, typeHandlerClass);`方法：

```java
public void register(Class<?> javaTypeClass, Class<?> typeHandlerClass) {
    	// getInstance获取实例,register方法注册
        this.register(javaTypeClass, this.getInstance(javaTypeClass, typeHandlerClass));
    }
```

查看`this.getInstance(javaTypeClass, typeHandlerClass)`方法：

```java
public <T> TypeHandler<T> getInstance(Class<?> javaTypeClass, Class<?> typeHandlerClass) {
        Constructor c;
        if (javaTypeClass != null) {
            try {
                // 根据typeHandlerClass通过反射创建实例
                c = typeHandlerClass.getConstructor(Class.class);
                return (TypeHandler)c.newInstance(javaTypeClass);
            } catch (NoSuchMethodException var5) {
            } catch (Exception var6) {
                throw new TypeException("Failed invoking constructor for handler " + typeHandlerClass, var6);
            }
        }

        try {
            // 根据typeHandlerClass通过反射创建实例
            c = typeHandlerClass.getConstructor();
            return (TypeHandler)c.newInstance();
        } catch (Exception var4) {
            throw new TypeException("Unable to find a usable constructor for " + typeHandlerClass, var4);
        }
    }
```



继续查看`this.register(javaTypeClass, this.getInstance(javaTypeClass, typeHandlerClass));`方法：

```java
public <T> void register(Class<T> javaType, TypeHandler<? extends T> typeHandler) {
        this.register((Type)javaType, (TypeHandler)typeHandler);
    }
```

```java
private <T> void register(Type javaType, TypeHandler<? extends T> typeHandler) {
      // 解析handlerType的MappedTypes注解，通过注解指定了jdbcType, 在xml配置中就不用再配置jdbcType
        MappedJdbcTypes mappedJdbcTypes = (MappedJdbcTypes)typeHandler.getClass().getAnnotation(MappedJdbcTypes.class);
        if (mappedJdbcTypes != null) {
            JdbcType[] var4 = mappedJdbcTypes.value();
            int var5 = var4.length;
            for(int var6 = 0; var6 < var5; ++var6) {
                JdbcType handledJdbcType = var4[var6];
                // 注册
                this.register(javaType, handledJdbcType, typeHandler);
            }

            if (mappedJdbcTypes.includeNullJdbcType()) {
                this.register((Type)javaType, (JdbcType)null, (TypeHandler)typeHandler);
            }
        } else {
            this.register((Type)javaType, (JdbcType)null, (TypeHandler)typeHandler);
        }

    }
```

最终会调用：

```java
 private void register(Type javaType, JdbcType jdbcType, TypeHandler<?> handler) {
        if (javaType != null) {
            // JdbcType类型对应的map是否存在
            Map<JdbcType, TypeHandler<?>> map = (Map)this.typeHandlerMap.get(javaType);
            // 不存在就创建
            if (map == null || map == NULL_TYPE_HANDLER_MAP) {
                map = new HashMap();
            }
			// 将JdbcType和handler存放在map
            ((Map)map).put(jdbcType, handler);
            // 最终维护在TypeHandlerRegistry的typeHandlerMap中
            this.typeHandlerMap.put(javaType, map);
        }

        this.allTypeHandlersMap.put(handler.getClass(), handler);
    }
```

最终维护在TypeHandlerRegistry的typeHandlerMap中，查看构造函数，会发现维护了很多默认的：

```java
 public TypeHandlerRegistry() {
        this(new Configuration());
    }

    public TypeHandlerRegistry(Configuration configuration) {
        this.jdbcTypeHandlerMap = new EnumMap(JdbcType.class);
        this.typeHandlerMap = new ConcurrentHashMap();
        this.allTypeHandlersMap = new HashMap();
        this.defaultEnumTypeHandler = EnumTypeHandler.class;
        this.unknownTypeHandler = new UnknownTypeHandler(configuration);
        this.register((Class)Boolean.class, (TypeHandler)(new BooleanTypeHandler()));
        this.register((Class)Boolean.TYPE, (TypeHandler)(new BooleanTypeHandler()));
        this.register((JdbcType)JdbcType.BOOLEAN, (TypeHandler)(new BooleanTypeHandler()));
        this.register((JdbcType)JdbcType.BIT, (TypeHandler)(new BooleanTypeHandler()));
        this.register((Class)Byte.class, (TypeHandler)(new ByteTypeHandler()));
        this.register((Class)Byte.TYPE, (TypeHandler)(new ByteTypeHandler()));
        this.register((JdbcType)JdbcType.TINYINT, (TypeHandler)(new ByteTypeHandler()));
        this.register((Class)Short.class, (TypeHandler)(new ShortTypeHandler()));
        this.register((Class)Short.TYPE, (TypeHandler)(new ShortTypeHandler()));
        this.register((JdbcType)JdbcType.SMALLINT, (TypeHandler)(new ShortTypeHandler()));
        this.register((Class)Integer.class, (TypeHandler)(new IntegerTypeHandler()));
        this.register((Class)Integer.TYPE, (TypeHandler)(new IntegerTypeHandler()));
        this.register((JdbcType)JdbcType.INTEGER, (TypeHandler)(new IntegerTypeHandler()));
        this.register((Class)Long.class, (TypeHandler)(new LongTypeHandler()));
        this.register((Class)Long.TYPE, (TypeHandler)(new LongTypeHandler()));
        this.register((Class)Float.class, (TypeHandler)(new FloatTypeHandler()));
        this.register((Class)Float.TYPE, (TypeHandler)(new FloatTypeHandler()));
        this.register((JdbcType)JdbcType.FLOAT, (TypeHandler)(new FloatTypeHandler()));
        this.register((Class)Double.class, (TypeHandler)(new DoubleTypeHandler()));
        this.register((Class)Double.TYPE, (TypeHandler)(new DoubleTypeHandler()));
        this.register((JdbcType)JdbcType.DOUBLE, (TypeHandler)(new DoubleTypeHandler()));
        this.register((Class)Reader.class, (TypeHandler)(new ClobReaderTypeHandler()));
        this.register((Class)String.class, (TypeHandler)(new StringTypeHandler()));
        this.register((Class)String.class, JdbcType.CHAR, (TypeHandler)(new StringTypeHandler()));
        this.register((Class)String.class, JdbcType.CLOB, (TypeHandler)(new ClobTypeHandler()));
        this.register((Class)String.class, JdbcType.VARCHAR, (TypeHandler)(new StringTypeHandler()));
        this.register((Class)String.class, JdbcType.LONGVARCHAR, (TypeHandler)(new StringTypeHandler()));
        this.register((Class)String.class, JdbcType.NVARCHAR, (TypeHandler)(new NStringTypeHandler()));
        this.register((Class)String.class, JdbcType.NCHAR, (TypeHandler)(new NStringTypeHandler()));
        this.register((Class)String.class, JdbcType.NCLOB, (TypeHandler)(new NClobTypeHandler()));
        this.register((JdbcType)JdbcType.CHAR, (TypeHandler)(new StringTypeHandler()));
        this.register((JdbcType)JdbcType.VARCHAR, (TypeHandler)(new StringTypeHandler()));
        this.register((JdbcType)JdbcType.CLOB, (TypeHandler)(new ClobTypeHandler()));
        this.register((JdbcType)JdbcType.LONGVARCHAR, (TypeHandler)(new StringTypeHandler()));
        this.register((JdbcType)JdbcType.NVARCHAR, (TypeHandler)(new NStringTypeHandler()));
        this.register((JdbcType)JdbcType.NCHAR, (TypeHandler)(new NStringTypeHandler()));
        this.register((JdbcType)JdbcType.NCLOB, (TypeHandler)(new NClobTypeHandler()));
        this.register((Class)Object.class, JdbcType.ARRAY, (TypeHandler)(new ArrayTypeHandler()));
        this.register((JdbcType)JdbcType.ARRAY, (TypeHandler)(new ArrayTypeHandler()));
        this.register((Class)BigInteger.class, (TypeHandler)(new BigIntegerTypeHandler()));
        this.register((JdbcType)JdbcType.BIGINT, (TypeHandler)(new LongTypeHandler()));
        this.register((Class)BigDecimal.class, (TypeHandler)(new BigDecimalTypeHandler()));
        this.register((JdbcType)JdbcType.REAL, (TypeHandler)(new BigDecimalTypeHandler()));
        this.register((JdbcType)JdbcType.DECIMAL, (TypeHandler)(new BigDecimalTypeHandler()));
        this.register((JdbcType)JdbcType.NUMERIC, (TypeHandler)(new BigDecimalTypeHandler()));
        this.register((Class)InputStream.class, (TypeHandler)(new BlobInputStreamTypeHandler()));
        this.register((Class)Byte[].class, (TypeHandler)(new ByteObjectArrayTypeHandler()));
        this.register((Class)Byte[].class, JdbcType.BLOB, (TypeHandler)(new BlobByteObjectArrayTypeHandler()));
        this.register((Class)Byte[].class, JdbcType.LONGVARBINARY, (TypeHandler)(new BlobByteObjectArrayTypeHandler()));
        this.register((Class)byte[].class, (TypeHandler)(new ByteArrayTypeHandler()));
        this.register((Class)byte[].class, JdbcType.BLOB, (TypeHandler)(new BlobTypeHandler()));
        this.register((Class)byte[].class, JdbcType.LONGVARBINARY, (TypeHandler)(new BlobTypeHandler()));
        this.register((JdbcType)JdbcType.LONGVARBINARY, (TypeHandler)(new BlobTypeHandler()));
        this.register((JdbcType)JdbcType.BLOB, (TypeHandler)(new BlobTypeHandler()));
        this.register(Object.class, this.unknownTypeHandler);
        this.register(Object.class, JdbcType.OTHER, this.unknownTypeHandler);
        this.register(JdbcType.OTHER, this.unknownTypeHandler);
        this.register((Class)Date.class, (TypeHandler)(new DateTypeHandler()));
        this.register((Class)Date.class, JdbcType.DATE, (TypeHandler)(new DateOnlyTypeHandler()));
        this.register((Class)Date.class, JdbcType.TIME, (TypeHandler)(new TimeOnlyTypeHandler()));
        this.register((JdbcType)JdbcType.TIMESTAMP, (TypeHandler)(new DateTypeHandler()));
        this.register((JdbcType)JdbcType.DATE, (TypeHandler)(new DateOnlyTypeHandler()));
        this.register((JdbcType)JdbcType.TIME, (TypeHandler)(new TimeOnlyTypeHandler()));
        this.register((Class)java.sql.Date.class, (TypeHandler)(new SqlDateTypeHandler()));
        this.register((Class)Time.class, (TypeHandler)(new SqlTimeTypeHandler()));
        this.register((Class)Timestamp.class, (TypeHandler)(new SqlTimestampTypeHandler()));
        this.register((Class)String.class, JdbcType.SQLXML, (TypeHandler)(new SqlxmlTypeHandler()));
        this.register((Class)Instant.class, (TypeHandler)(new InstantTypeHandler()));
        this.register((Class)LocalDateTime.class, (TypeHandler)(new LocalDateTimeTypeHandler()));
        this.register((Class)LocalDate.class, (TypeHandler)(new LocalDateTypeHandler()));
        this.register((Class)LocalTime.class, (TypeHandler)(new LocalTimeTypeHandler()));
        this.register((Class)OffsetDateTime.class, (TypeHandler)(new OffsetDateTimeTypeHandler()));
        this.register((Class)OffsetTime.class, (TypeHandler)(new OffsetTimeTypeHandler()));
        this.register((Class)ZonedDateTime.class, (TypeHandler)(new ZonedDateTimeTypeHandler()));
        this.register((Class)Month.class, (TypeHandler)(new MonthTypeHandler()));
        this.register((Class)Year.class, (TypeHandler)(new YearTypeHandler()));
        this.register((Class)YearMonth.class, (TypeHandler)(new YearMonthTypeHandler()));
        this.register((Class)JapaneseDate.class, (TypeHandler)(new JapaneseDateTypeHandler()));
        this.register((Class)Character.class, (TypeHandler)(new CharacterTypeHandler()));
        this.register((Class)Character.TYPE, (TypeHandler)(new CharacterTypeHandler()));
    }
```

以上就是解析mybatis几个标签的的过程，解析Mapper配置文件比较重要，单独写一篇解析Mapper配置文件的文章。

