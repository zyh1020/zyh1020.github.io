---
icon: file-lines
title: mybatis源码解析Mapp配置文件
author: Ms.Zyh
date: 2023-10-23
category:
  - Mybatis
tag:
  - 常用
  - Mybatis
sticky: false
star: false
---

### 一，加载Mapper配置文件

#### 1.1mappers有四种配置方式：

**方式一：**            

```xml
  <mappers>   
  	<package name="被代理对象（接口）的所在包"/> 
  </mappers>    
```

​         注意：注册指定包下的所有mapper接口；此种方法要求mapper接口名称和mapper映射文件**名称相同**，且放在同一个包中。

**方式二：** 

```xml
 <mappers>   
 	<mapper resource="mapper/myuser.xml"/> 
 </mappers>           
```

   注意：resource是以项目路径开始的

**方式三：**

```xml
<mappers>   
    <mapper url="http://xxx/xxx/xx.xml"/>
 </mappers>  
```

​	注意：url是远程配置文件

**方式四：**         

```xml
<mappers>  
	<mapper class="被代理对象（接口）的全路径名"/> 
</mappers>      
```

 注意：此种方法要求mapper接口名称和mapper映射文件名称相同，且放在同一个包中



mybatis是通过`this.mapperElement(root.evalNode("mappers"));`方法，至于为什么调用该方法，可以看上一篇文章，介绍解析mybatis的核心配置文件的文章。

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

#### 1.2解析cache-ref标签

配置样例：

```xml
<cache-ref namespace="xxx.xxx.xx.xxx.xxx"/>
```

查看`this.cacheRefElement(context.evalNode("cache-ref"));`方法：

```java
private void cacheRefElement(XNode context) {
        if (context != null) {
            // this.builderAssistant.getCurrentNamespace()获取的是当前mapper的namespace
            // context.getStringAttribute("namespace")获取的是cache-ref的属性值
            this.configuration.addCacheRef(this.builderAssistant.getCurrentNamespace(), context.getStringAttribute("namespace"));
            // 缓存引用解析器
            CacheRefResolver cacheRefResolver = new CacheRefResolver(this.builderAssistant, context.getStringAttribute("namespace"));

            try {
                // 解析
                cacheRefResolver.resolveCacheRef();
            } catch (IncompleteElementException var4) {
                this.configuration.addIncompleteCacheRef(cacheRefResolver);
            }
        }

    }
```

缓存解析器的构造方法：

```java
public CacheRefResolver(MapperBuilderAssistant assistant, String cacheRefNamespace) {
        this.assistant = assistant; // 当前Mapper
        this.cacheRefNamespace = cacheRefNamespace; // 当前cache-ref的Namespace属性值
}
```

跟进解析方法`cacheRefResolver.resolveCacheRef();`:

```java
public Cache resolveCacheRef() {
        return this.assistant.useCacheRef(this.cacheRefNamespace);
    }
}
```

继续跟进`this.assistant.useCacheRef(this.cacheRefNamespace);`方法：

```java
ublic Cache useCacheRef(String namespace) {
        if (namespace == null) {
            // 当前cache-ref的Namespace属性值不存在抛出异常
            throw new BuilderException("cache-ref element requires a namespace attribute.");
        } else {
            try {
                this.unresolvedCacheRef = true;
                // 根据cache-ref的Namespace属性值在配置缓存中找该缓存
                Cache cache = this.configuration.getCache(namespace);
                if (cache == null) {
                    // 缓存不存在抛出异常
                    throw new IncompleteElementException("No cache for namespace '" + namespace + "' could be found.");
                } else {
                    // 找到就引用一下
                    this.currentCache = cache;
                    this.unresolvedCacheRef = false;
                    return cache;
                }
            } catch (IllegalArgumentException var3) {
                throw new IncompleteElementException("No cache for namespace '" + namespace + "' could be found.", var3);
            }
        }
    }
```

#### 1.3解析cache标签

MyBatis 提供了一、二级缓存，其中一级缓存是 SqlSession 级别的，默认为开启状态。二级缓存配置在映射文件中，使用者需要显示配置才能开启。如下：

```xml
<cache/>
```

也可以使用第三方缓存：

```xml
<cache type="org.mybatis.caches.redis.RedisCache"/>
```

也可以配置一些属性：

```xml
<cache eviction="LRU"  flushInterval="60000"  size="512" readOnly="true"/>
```

eviction可用的清除策略有：

- LRU （默认的清除策略）– 最近最少使用：移除最长时间不被使用的对象。
- FIFO – 先进先出：按对象进入缓存的顺序来移除它们。
- SOFT – 软引用：基于垃圾回收器状态和软引用规则移除对象。
- WEAK – 弱引用：更积极地基于垃圾收集器状态和弱引用规则移除对象。


flushInterval（刷新间隔）属性：可以被设置为任意的正整数，设置的值应该是一个以毫秒为单位的合理时间量。 默认情况是不设置，也就是没有刷新间隔，缓存仅仅会在调用语句时刷新。
size（引用数目）属性：可以被设置为任意正整数，要注意欲缓存对象的大小和运行环境中可用的内存资源。默认值是 1024。
readOnly（只读）属性：可以被设置为 true 或 false。只读的缓存会给所有调用者返回缓存对象的相同实例。 因此这些对象不能被修改。这就提供了可观的性能提升。而可读写的缓存会（通过序列化）返回缓存对象的拷贝。 速度上会慢一些，但是更安全，因此默认值是 false。

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
        //设置默认缓存类型为PerpetualCache
        this.implementation = PerpetualCache.class;
        if (this.decorators.isEmpty()) {
            this.decorators.add(LruCache.class);
        }
    }
}
```

以上就创建好了一个Cache的实例，然后把它添加到Configuration中，并且设置到currentCache属性中，这个属性后面还要使用，也就是Cache实例后面还要使用，我们后面再看。

#### 1.4解析parameterMap标签

​	parameterMap标签的作用和resultMap标签的作用是类似的，都是将查询结果集中列值的类型一一映射到java对象属性的类型上，在开发过程中不推荐这种方式。

配置示例：

```xml
<parameterMap type="java.util.Map" id="query_some_param">  
  <parameter property="firstName" javaType="java.lang.String" jdbcType="VARCHAR"/>  
   <parameter property="lastName" javaType="java.lang.String" jdbcType="VARCHAR"/>  
</parameterMap>  
```

查看`this.parameterMapElement(context.evalNodes("/mapper/parameterMap"));`方法：

```java
private void parameterMapElement(List<XNode> list) {
        Iterator var2 = list.iterator();

        while(var2.hasNext()) {
            XNode parameterMapNode = (XNode)var2.next();
            // 获取parameterMap的id和type属性
            String id = parameterMapNode.getStringAttribute("id");
            String type = parameterMapNode.getStringAttribute("type");
            // 通过resolveClass方法获取type的别名
            Class<?> parameterClass = this.resolveClass(type);
            // 获取parameterMap的子标签parameter
            List<XNode> parameterNodes = parameterMapNode.evalNodes("parameter");
            List<ParameterMapping> parameterMappings = new ArrayList();
            // 遍历子标签
            Iterator var9 = parameterNodes.iterator();	
            while(var9.hasNext()) {
                XNode parameterNode = (XNode)var9.next();
                // 获取parameter标签的property、javaType、jdbcType、mode、typeHandler、numericScales属性值
                String property = parameterNode.getStringAttribute("property");
                String javaType = parameterNode.getStringAttribute("javaType");
                String jdbcType = parameterNode.getStringAttribute("jdbcType");
                String resultMap = parameterNode.getStringAttribute("resultMap");
                String mode = parameterNode.getStringAttribute("mode");
                String typeHandler = parameterNode.getStringAttribute("typeHandler");
                Integer numericScale = parameterNode.getIntAttribute("numericScale");
                // 获取mode、javaType、jdbcType或typeHandler的别名
                ParameterMode modeEnum = this.resolveParameterMode(mode);
                Class<?> javaTypeClass = this.resolveClass(javaType);
                JdbcType jdbcTypeEnum = this.resolveJdbcType(jdbcType);
                Class<? extends TypeHandler<?>> typeHandlerClass = this.resolveClass(typeHandler);
                // 构建parameterMapping
                ParameterMapping parameterMapping = this.builderAssistant.buildParameterMapping(parameterClass, property, javaTypeClass, jdbcTypeEnum, resultMap, modeEnum, typeHandlerClass, numericScale);
                // 将每一个parameter标签构建的parameterMapping存入parameterMappings集合中
                parameterMappings.add(parameterMapping);
            }
			// 维护在mapper中
            this.builderAssistant.addParameterMap(id, parameterClass, parameterMappings);
        }

    }
```

#### 1.5解析resultMap标签

配置样例：

```xml
<resultMap type="xxx.xxx.xxxx.xxx" id="xxId">
    <id property="xxx" column="xx"/>
    <result property="xx" column="xx"/>
    <result property="xx" column="xx"/>
    <result property="xx" column="xx"/>
    <result property="xx" column="xx"/>
    <result property="xx" column="xx"/>
    <!-- 一对一 -->
    <association property="person" javaType="com.zyh.domain.Person" column="pid">
        <id property="pId" column="pid"/>
        <result property="pName" column="pname"/>
    </association>
    <!-- 一对多 -->
    <collection property="listCar" ofType="com.zyh.domain.Car">
        <id property="cId" column="cid"/>
        <result property="cName" column="cname"/>
    </collection>
</resultMap>
```

解析resultMap标签查看` this.resultMapElements(context.evalNodes("/mapper/resultMap"));`方法：

```java
private void resultMapElements(List<XNode> list) {
    	// 传入的是list，表示一个mapper文件中可以有多个resultMap标签
        Iterator var2 = list.iterator();
        while(var2.hasNext()) {
            XNode resultMapNode = (XNode)var2.next();
            try {
                // 解析resultMap元素
                this.resultMapElement(resultMapNode);
            } catch (IncompleteElementException var5) {
            }
        }

    }
```

继续跟踪解析resultMap元素的`this.resultMapElement(resultMapNode);`方法：

```java
 private ResultMap resultMapElement(XNode resultMapNode) {
        return this.resultMapElement(resultMapNode, Collections.emptyList(), (Class)null);
}
```

继续跟进`this.resultMapElement(resultMapNode, Collections.emptyList(), (Class)null);`方法：

```java
private ResultMap resultMapElement(XNode resultMapNode, List<ResultMapping> additionalResultMappings, Class<?> enclosingType) {
        ErrorContext.instance().activity("processing " + resultMapNode.getValueBasedIdentifier());
    	// 获取type属性值
        String type = resultMapNode.getStringAttribute("type", resultMapNode.getStringAttribute("ofType", resultMapNode.getStringAttribute("resultType", resultMapNode.getStringAttribute("javaType"))));
    	// 通过resolveClass方法获取type类型的别名
        Class<?> typeClass = this.resolveClass(type);
        if (typeClass == null) {
            typeClass = this.inheritEnclosingType(resultMapNode, enclosingType);
        }

        Discriminator discriminator = null;
    	// 记录解析结果
        List<ResultMapping> resultMappings = new ArrayList(additionalResultMappings);
    	// 获取resultMap标签的子标签
        List<XNode> resultChildren = resultMapNode.getChildren();
        Iterator var9 = resultChildren.iterator();
		// 遍历子标签
        while(var9.hasNext()) {
            XNode resultChild = (XNode)var9.next();
            // 如果子标签是constructor
            if ("constructor".equals(resultChild.getName())) {
                this.processConstructorElement(resultChild, typeClass, resultMappings);
            } else if ("discriminator".equals(resultChild.getName())) {// 如果子标签是discriminator
                discriminator = this.processDiscriminatorElement(resultChild, typeClass, resultMappings);
            } else { // 处理其余标签如id、result、assosationd等
                List<ResultFlag> flags = new ArrayList();
                if ("id".equals(resultChild.getName())) {
                    flags.add(ResultFlag.ID);
                }
				// ①，创建ResultMapping对象并保存在，记录解析结果的resultMappings集合中
                resultMappings.add(this.buildResultMappingFromContext(resultChild, typeClass, flags));
            }
        }
		// 获取Id id对于resultMap来说是很重要的,它是一个身份标识。具有唯一性
        String id = resultMapNode.getStringAttribute("id", resultMapNode.getValueBasedIdentifier());
    	// 获取继承结果集
        String extend = resultMapNode.getStringAttribute("extends");
   		// 获取自动映射 
        Boolean autoMapping = resultMapNode.getBooleanAttribute("autoMapping");
        // 创建ResultMapResolver对象
        ResultMapResolver resultMapResolver = new ResultMapResolver(this.builderAssistant, id, typeClass, extend, discriminator, resultMappings, autoMapping);

        try {
            // ②，根据前面获取到的信息构建 ResultMap对象
            return resultMapResolver.resolve();
        } catch (IncompleteElementException var14) {
            this.configuration.addIncompleteResultMap(resultMapResolver);
            throw var14;
        }
    }
```

①，重点看一看，如何解析id、result、assosationd标签的，查看`resultMappings.add(this.buildResultMappingFromContext(resultChild, typeClass, flags));`方法：

```java
private ResultMapping buildResultMappingFromContext(XNode context, Class<?> resultType, List<ResultFlag> flags) {
        String property;
    	// 获取节点的属性， 如果节点是构造函数只有name属性， 没有property，则获取的是 name, 否则获取 property
        if (flags.contains(ResultFlag.CONSTRUCTOR)) {
            property = context.getStringAttribute("name");
        } else {
            property = context.getStringAttribute("property");
        }
		// 获取子节点的各个属性值
        String column = context.getStringAttribute("column");
        String javaType = context.getStringAttribute("javaType");
        String jdbcType = context.getStringAttribute("jdbcType");
        String nestedSelect = context.getStringAttribute("select");
    	// 1，处理嵌套的结果集:association、collection和case并且不带有select属性的标签
        String nestedResultMap = context.getStringAttribute("resultMap", () -> {
            return this.processNestedResultMappings(context, Collections.emptyList(), resultType);
        });
    	// 默认情况下，在至少一个被映射到属性的列不为空时，子对象才会被创建
        String notNullColumn = context.getStringAttribute("notNullColumn");
    	// 当连接多个表时，你可能会不得不使用列别名来避免在 ResultSet 中产生重复的列名。
        String columnPrefix = context.getStringAttribute("columnPrefix");
    	// 默认的类型处理器。
        String typeHandler = context.getStringAttribute("typeHandler");
    	// 指定用于加载复杂类型的结果集名字。
        String resultSet = context.getStringAttribute("resultSet");
    	// 指定外键对应的列名，指定的列将与父类型中 column 的给出的列进行匹配
        String foreignColumn = context.getStringAttribute("foreignColumn");
    	// 可选的。有效值为 lazy 和 eager。 指定属性后，将在映射中忽略全局配置参数 lazyLoadingEnabled，使用属性的值。
        boolean lazy = "lazy".equals(context.getStringAttribute("fetchType", this.configuration.isLazyLoadingEnabled() ? "lazy" : "eager"));
    
    	// 获取别名
        Class<?> javaTypeClass = this.resolveClass(javaType);
        Class<? extends TypeHandler<?>> typeHandlerClass = this.resolveClass(typeHandler);
        JdbcType jdbcTypeEnum = this.resolveJdbcType(jdbcType);
        // 2，构建 ResultMapping 对象
        return this.builderAssistant.buildResultMapping(resultType, property, column, javaTypeClass, jdbcTypeEnum, nestedSelect, nestedResultMap, notNullColumn, columnPrefix, typeHandlerClass, flags, resultSet, foreignColumn, lazy);
    }
```

1，查看处理结果集方法`this.processNestedResultMappings(context, Collections.emptyList(), resultType);`：

```java
private String processNestedResultMappings(XNode context, List<ResultMapping> resultMappings, Class<?> enclosingType) {
        // 处理嵌套的结果集:association、collection和case并且不带有select属性的标签
        if (Arrays.asList("association", "collection", "case").contains(context.getName()) && context.getStringAttribute("select") == null) {
            // 判断标签是否合格标准
            this.validateCollection(context, enclosingType);
            // 递归回到开始解析resultMap标签
            ResultMap resultMap = this.resultMapElement(context, resultMappings, enclosingType);
            return resultMap.getId();
        } else {
            return null;
        }
    }
```

2，查看构建 ResultMapping 对象方法`this.builderAssistant.buildResultMapping(resultType, property, column, javaTypeClass, jdbcTypeEnum, nestedSelect, nestedResultMap, notNullColumn, columnPrefix, typeHandlerClass, flags, resultSet, foreignColumn, lazy);`:

```java
public ResultMapping buildResultMapping(Class<?> resultType, String property, String column, Class<?> javaType, JdbcType jdbcType, String nestedSelect, String nestedResultMap, String notNullColumn, String columnPrefix, Class<? extends TypeHandler<?>> typeHandler, List<ResultFlag> flags, String resultSet, String foreignColumn, boolean lazy) {
    	// 解析Java类型
        Class<?> javaTypeClass = this.resolveResultJavaType(resultType, property, javaType);
    	// 类型处理器
        TypeHandler<?> typeHandlerInstance = this.resolveTypeHandler(javaTypeClass, typeHandler);
        List composites;
    	// 有属性nestedResultMapId表示嵌套查询和nestedQueryId表示延迟查询
        if (nestedSelect != null && !nestedSelect.isEmpty() || foreignColumn != null && !foreignColumn.isEmpty()) {
            composites = this.parseCompositeColumnName(column);
        } else {
            composites = Collections.emptyList();
        }
    	// 构建ResultMapping对象
        return (new org.apache.ibatis.mapping.ResultMapping.Builder(this.configuration, property, column, javaTypeClass)).jdbcType(jdbcType).nestedQueryId(this.applyCurrentNamespace(nestedSelect, true)).nestedResultMapId(this.applyCurrentNamespace(nestedResultMap, true)).resultSet(resultSet).typeHandler(typeHandlerInstance).flags((List)(flags == null ? new ArrayList() : flags)).composites(composites).notNullColumns(this.parseMultipleColumnNames(notNullColumn)).columnPrefix(columnPrefix).foreignColumn(foreignColumn).lazy(lazy).build();
    }
```

解析java类型查看`this.resolveResultJavaType(resultType, property, javaType);`方法：

```java
解析Java结果类型
private Class<?> resolveResultJavaType(Class<?> resultType, String property, Class<?> javaType) {
    if (javaType == null && property != null) {
        try {
            //获取ResultMap中的type属性的元类元类
            MetaClass metaResultType = MetaClass.forClass(resultType, this.configuration.getReflectorFactory());
            //如果result中没有设置javaType，则获取元类属性对那个的类型
            javaType = metaResultType.getSetterType(property);
        } catch (Exception var5) {
            ;
        }
    }

    // 都获取不到就是object
    if (javaType == null) {
        javaType = Object.class;
    }

    return javaType;
}
```

 ②，构建 ResultMap对象，查看`resultMapResolver.resolve();`方法：

```java
public ResultMap resolve() {
        return this.assistant.addResultMap(this.id, this.type, this.extend, this.discriminator, this.resultMappings, this.autoMapping);
    }
```

继续跟进`this.assistant.addResultMap(this.id, this.type, this.extend, this.discriminator, this.resultMappings, this.autoMapping);`方法：

```java
 public ResultMap addResultMap(String id, Class<?> type, String extend, Discriminator discriminator, List<ResultMapping> resultMappings, Boolean autoMapping) {
        // 验证当前命名空间
        id = this.applyCurrentNamespace(id, false);
    	// ResultMap是否有继承
        extend = this.applyCurrentNamespace(extend, true);
        ResultMap resultMap;
        // 如果有继承关系，解析ResultMap的继承关系
        if (extend != null) {
            // 判断configuration中是否保存有继承的resultMap
            if (!this.configuration.hasResultMap(extend)) {
                throw new IncompleteElementException("Could not find a parent resultmap with id '" + extend + "'");
            }
			// 获取继承的resultMap
            resultMap = this.configuration.getResultMap(extend);
            // 获取父级的属性映射
            List<ResultMapping> extendedResultMappings = new ArrayList(resultMap.getResultMappings());
            // 删除当前ResultMap中已有的父级属性映射，为当前属性映射覆盖父级属性属性创造条件
            extendedResultMappings.removeAll(resultMappings);
            boolean declaresConstructor = false;
            Iterator var10 = resultMappings.iterator();
			// 如果当前ResultMap设置有构建器，则移除父级构建器
            while(var10.hasNext()) {
                ResultMapping resultMapping = (ResultMapping)var10.next();
                if (resultMapping.getFlags().contains(ResultFlag.CONSTRUCTOR)) {
                    declaresConstructor = true;
                    break;
                }
            }

            if (declaresConstructor) {
                extendedResultMappings.removeIf((resultMappingx) -> {
                    return resultMappingx.getFlags().contains(ResultFlag.CONSTRUCTOR);
                });
            }
			// 最终从父级继承而来的所有属性映射
            resultMappings.addAll(extendedResultMappings);
        }
		// 创建当前的ResultMap
        resultMap = (new org.apache.ibatis.mapping.ResultMap.Builder(this.configuration, id, type, resultMappings, autoMapping)).discriminator(discriminator).build();
       // 将当期的ResultMap加入到Configuration
        this.configuration.addResultMap(resultMap);
        return resultMap;
    }
```

最后看一下ResultMap的成员变量含义：

```java
public class ResultMap {
  // 全局配置信息
  private Configuration configuration;
  // resultMap的编号
  private String id;
  // 最终输出结果对应的Java类
  private Class<?> type;
  // XML中的<result>的列表，即ResultMapping列表
  private List<ResultMapping> resultMappings;
  // XML中的<id>的列表
  private List<ResultMapping> idResultMappings;
  // XML中的<constructor>中各个属性的列表
  private List<ResultMapping> constructorResultMappings;
  // XML中非<constructor>相关的属性列表
  private List<ResultMapping> propertyResultMappings;
  // 所有参与映射的数据库中字段的集合
  private Set<String> mappedColumns;
  // 所有参与映射的Java对象属性集合
  private Set<String> mappedProperties;
  // 鉴别器
  private Discriminator discriminator;
  // 是否存在嵌套映射
  private boolean hasNestedResultMaps;
  // 是否存在嵌套查询
  private boolean hasNestedQueries;
  // 是否启动自动映射
  private Boolean autoMapping;
}
```

#### 1.6解析sql标签

配置示例：

sql模板：            

```xml
  <sql id="唯一标志">  
  	<!-- 重用/复用的sql语句 --> 
  </sql>       
```

引用模板： 

```xml
<include refid="重用/复用的sql语句的唯一标志"/>  
```

 解析sql标签查看`this.sqlElement(context.evalNodes("/mapper/sql"));`   方法：

```java
private void sqlElement(List<XNode> list) {
        if (this.configuration.getDatabaseId() != null) {
            // 调用 sqlElement 解析 <sql> 节点
            this.sqlElement(list, this.configuration.getDatabaseId());
        }
    	// 再次调用 sqlElement，不同的是，这次调用，该方法的第二个参数为 null
		this.sqlElement(list, (String)null);
}
```

查看`this.sqlElement`方法：

```java
private void sqlElement(List<XNode> list, String requiredDatabaseId) {
        Iterator var3 = list.iterator();
        while(var3.hasNext()) {
            XNode context = (XNode)var3.next();
            // 获取sql标签的databaseId和id属性
            String databaseId = context.getStringAttribute("databaseId");
            String id = context.getStringAttribute("id");
            // applyCurrentNamespace的结果是id = currentNamespace + "." + id
            id = this.builderAssistant.applyCurrentNamespace(id, false);
            // 检测当前 databaseId 和 requiredDatabaseId 是否一致
            if (this.databaseIdMatchesCurrent(id, databaseId, requiredDatabaseId)) {
                // 将 <id, XNode> 键值对缓存到XMLMapperBuilder对象的 sqlFragments 属性中，以供后面的sql语句使用
                this.sqlFragments.put(id, context);
            }
        }

    }
```

#### 1.7解析select、insert、update、delete标签

解析select、insert、update、delete标签查看`this.buildStatementFromContext(context.evalNodes("select|insert|update|delete"));`方法：

```java
private void buildStatementFromContext(List<XNode> list) {
        if (this.configuration.getDatabaseId() != null) {
            this.buildStatementFromContext(list, this.configuration.getDatabaseId());
        }

        this.buildStatementFromContext(list, (String)null);
    }
```

继续跟进`this.buildStatementFromContext`方法：

```java
private void buildStatementFromContext(List<XNode> list, String requiredDatabaseId) {
        Iterator var3 = list.iterator();

        while(var3.hasNext()) {
            XNode context = (XNode)var3.next();
            // XMLStatementBuilder是用来解析
            XMLStatementBuilder statementParser = new XMLStatementBuilder(this.configuration, this.builderAssistant, context, requiredDatabaseId);
            try {
                // 解析方法
                statementParser.parseStatementNode();
            } catch (IncompleteElementException var7) {
                this.configuration.addIncompleteStatement(statementParser);
            }
        }

    }
```

继续跟进解析`statementParser.parseStatementNode();`方法:

```java
public void parseStatementNode() {
   		 // 读取当前节点的id与databaseId
        String id = this.context.getStringAttribute("id");
        String databaseId = this.context.getStringAttribute("databaseId");
    	// 验证id与databaseId是否匹配。MyBatis允许多数据库配置，因此有些语句只对特定数据库生效
        if (this.databaseIdMatchesCurrent(id, databaseId, this.requiredDatabaseId)) {
            // 读取节点名,即是select|insert|update|delete中的哪一个
            String nodeName = this.context.getNode().getNodeName();
            // 读取和判断语句类型
            SqlCommandType sqlCommandType = SqlCommandType.valueOf(nodeName.toUpperCase(Locale.ENGLISH));
            boolean isSelect = sqlCommandType == SqlCommandType.SELECT;
            // select不刷新缓存
            boolean flushCache = this.context.getBooleanAttribute("flushCache", !isSelect);
            // select使用缓存
            boolean useCache = this.context.getBooleanAttribute("useCache", isSelect);
            // 结果排序
            boolean resultOrdered = this.context.getBooleanAttribute("resultOrdered", false);
            
            // 处理语句中的Include标签，就是引用的sql片段
            XMLIncludeTransformer includeParser = new XMLIncludeTransformer(this.configuration, this.builderAssistant);
            includeParser.applyIncludes(this.context.getNode());
            // 参数类型
            String parameterType = this.context.getStringAttribute("parameterType");
            // 参数类型的别名
            Class<?> parameterTypeClass = this.resolveClass(parameterType);
            // 语句类型
            String lang = this.context.getStringAttribute("lang");
            LanguageDriver langDriver = this.getLanguageDriver(lang);
            // 处理SelectKey节点，在这里会将KeyGenerator加入到Configuration.keyGenerators中
            this.processSelectKeyNodes(id, parameterTypeClass, langDriver);
            // 此时，<selectKey> 和 <include> 节点均已被解析完毕并被删除，开始进行SQL解析
            String keyStatementId = id + "!selectKey";
            keyStatementId = this.builderAssistant.applyCurrentNamespace(keyStatementId, true);
            Object keyGenerator;
            // 判断是否已经有解析好的KeyGenerator
            if (this.configuration.hasKeyGenerator(keyStatementId)) {
                keyGenerator = this.configuration.getKeyGenerator(keyStatementId);
            } else {
                // 全局或者本语句只要启用自动key生成，则使用key生成
                keyGenerator = this.context.getBooleanAttribute("useGeneratedKeys", this.configuration.isUseGeneratedKeys() && SqlCommandType.INSERT.equals(sqlCommandType)) ? Jdbc3KeyGenerator.INSTANCE : NoKeyGenerator.INSTANCE;
            }
			// 1，SqlSource解析sql语句的
            SqlSource sqlSource = langDriver.createSqlSource(this.configuration, this.context, parameterTypeClass);
            // 获取各种配置项
            StatementType statementType = StatementType.valueOf(this.context.getStringAttribute("statementType", StatementType.PREPARED.toString()));
            Integer fetchSize = this.context.getIntAttribute("fetchSize");
            Integer timeout = this.context.getIntAttribute("timeout");
            String parameterMap = this.context.getStringAttribute("parameterMap");
            String resultType = this.context.getStringAttribute("resultType");
            Class<?> resultTypeClass = this.resolveClass(resultType);
            String resultMap = this.context.getStringAttribute("resultMap");
            String resultSetType = this.context.getStringAttribute("resultSetType");
            ResultSetType resultSetTypeEnum = this.resolveResultSetType(resultSetType);
            if (resultSetTypeEnum == null) {
                resultSetTypeEnum = this.configuration.getDefaultResultSetType();
            }

            String keyProperty = this.context.getStringAttribute("keyProperty");
            String keyColumn = this.context.getStringAttribute("keyColumn");
            String resultSets = this.context.getStringAttribute("resultSets");
            // 2，在MapperBuilderAssistant的帮助下创建MappedStatement对象，并写入到Configuration中
            this.builderAssistant.addMappedStatement(id, sqlSource, statementType, sqlCommandType, fetchSize, timeout, parameterMap, parameterTypeClass, resultMap, resultTypeClass, resultSetTypeEnum, flushCache, useCache, resultOrdered, (KeyGenerator)keyGenerator, keyProperty, keyColumn, databaseId, langDriver, resultSets);
        }
    }
```

##### 1，使用语言驱动来创建sqlSource

查看` SqlSource sqlSource = langDriver.createSqlSource(this.configuration, this.context, parameterTypeClass);`方法：

```java
public SqlSource createSqlSource(Configuration configuration, XNode script, Class<?> parameterType) {
    	// SqlSource通过XMLScriptBuilder实现解析
        XMLScriptBuilder builder = new XMLScriptBuilder(configuration, script, parameterType);
        return builder.parseScriptNode();
    }
```

跟进`builder.parseScriptNode();`方法：

```java
public SqlSource parseScriptNode() {
    	// 解析XML节点节点，得到节点树MixedSqlNode
        MixedSqlNode rootSqlNode = this.parseDynamicTags(this.context);
        Object sqlSource;
        // 根据节点树是否为动态，创建对应的SqlSource对象
        if (this.isDynamic) {
            sqlSource = new DynamicSqlSource(this.configuration, rootSqlNode);
        } else {
            sqlSource = new RawSqlSource(this.configuration, rootSqlNode, this.parameterType);
        }

        return (SqlSource)sqlSource;
    }
```

解析XML节点节点，得到节点树MixedSqlNode查看`this.parseDynamicTags(this.context);`方法：

```java
protected MixedSqlNode parseDynamicTags(XNode node) {
    	// XNode拆分出的SqlNode列表
        List<SqlNode> contents = new ArrayList();
        NodeList children = node.getNode().getChildNodes();
   		// 遍历循环遍历每一个子XNode
        for(int i = 0; i < children.getLength(); ++i) {
            XNode child = node.newXNode(children.item(i));
            String nodeName;
            // 节点类型是4或3表示静态文本类型
            if (child.getNode().getNodeType() != 4 && child.getNode().getNodeType() != 3) {
                // 节点类型是1表示仍然是一个
                if (child.getNode().getNodeType() == 1) {
                    // 获取节点名称即标签名称
                    nodeName = child.getNode().getNodeName();
                    // 根据节点名字，找到对应的处理器，where标签找where的，if找if的
                    XMLScriptBuilder.NodeHandler handler = (XMLScriptBuilder.NodeHandler)this.nodeHandlerMap.get(nodeName);
                    // 找不到就抛出异常
                    if (handler == null) {
                        throw new BuilderException("Unknown element <" + nodeName + "> in SQL statement.");
                    }
					// 找到就继续解析节点
                    handler.handleNode(child, contents);
                    this.isDynamic = true;
                }
            } else { // 节点类型是4或3表示静态文本类型
                nodeName = child.getStringBody("");
                TextSqlNode textSqlNode = new TextSqlNode(nodeName);
                if (textSqlNode.isDynamic()) {
                    contents.add(textSqlNode); //创建静态节点
                    this.isDynamic = true;
                } else {
                    contents.add(new StaticTextSqlNode(nodeName));
                }
            }
        }

        return new MixedSqlNode(contents);
    }
```

对于if、trim、where等这些动态节点，是通过对应的handler来解析的，查看`handler.handleNode(child, contents);`方法：

![image-20230104172752427](http://img.zouyh.top/article-img/20240917134953139.png)

XMLScriptBuilder的handleNode有很多实现，不同的实现解析不通的标签，接下来以WhereHandler的为例，查看WhereHandler的`handler.handleNode(child, contents);`方法：

```java
public void handleNode(XNode nodeToHandle, List<SqlNode> targetContents) {
    		// 递归调用 parseDynamicTags解析 <where> 节点，
            MixedSqlNode mixedSqlNode = XMLScriptBuilder.this.parseDynamicTags(nodeToHandle);
    		// 创建 WhereSqlNode
            WhereSqlNode where = new WhereSqlNode(XMLScriptBuilder.this.configuration, mixedSqlNode);
    		// 添加到 targetContents
            targetContents.add(where);
}
```

##### 2，构建MappedStatement对象

SqlSource解析sql语句的完成后，继续 查看`this.builderAssistant.addMappedStatement(id, sqlSource, statementType, sqlCommandType, fetchSize, timeout, parameterMap, parameterTypeClass, resultMap, resultTypeClass, resultSetTypeEnum, flushCache, useCache, resultOrdered, (KeyGenerator)keyGenerator, keyProperty, keyColumn, databaseId, langDriver, resultSets);`方法：

```java
 public MappedStatement addMappedStatement(String id, SqlSource sqlSource, StatementType statementType, SqlCommandType sqlCommandType, Integer fetchSize, Integer timeout, String parameterMap, Class<?> parameterType, String resultMap, Class<?> resultType, ResultSetType resultSetType, boolean flushCache, boolean useCache, boolean resultOrdered, KeyGenerator keyGenerator, String keyProperty, String keyColumn, String databaseId, LanguageDriver lang, String resultSets) {
     
     	//	判断缓存引用是否解析
        if (this.unresolvedCacheRef) {
            throw new IncompleteElementException("Cache-ref not yet resolved");
        } else {
            // 拼接上命名空间，id = 当前mapper的命名空间+"."+id
            id = this.applyCurrentNamespace(id, false);
            
            boolean isSelect = sqlCommandType == SqlCommandType.SELECT;
            // 创建者模式，设置各种属性
            org.apache.ibatis.mapping.MappedStatement.Builder statementBuilder = (new org.apache.ibatis.mapping.MappedStatement.Builder(this.configuration, id, sqlSource, sqlCommandType)).resource(this.resource).fetchSize(fetchSize).timeout(timeout).statementType(statementType).keyGenerator(keyGenerator).keyProperty(keyProperty).keyColumn(keyColumn).databaseId(databaseId).lang(lang).resultOrdered(resultOrdered).resultSets(resultSets).resultMaps(this.getStatementResultMaps(resultMap, resultType, id)).resultSetType(resultSetType).flushCacheRequired((Boolean)this.valueOrDefault(flushCache, !isSelect)).useCache((Boolean)this.valueOrDefault(useCache, isSelect)).cache(this.currentCache);
            // 获取或创建 ParameterMap
            ParameterMap statementParameterMap = this.getStatementParameterMap(parameterMap, parameterType, id);
            if (statementParameterMap != null) {
                statementBuilder.parameterMap(statementParameterMap);
            }
			// 创建MappedStatement
            MappedStatement statement = statementBuilder.build();
            // 维护到configuration 的 mappedStatements 集合中
            this.configuration.addMappedStatement(statement);
            return statement;
        }
    }
```



#### 1.8补充

让我们的目光再次回到XMLMapperBuilder的parse()方法，看看执行完`his.configurationElement(this.parser.evalNode("/mapper"));`方法的后续操作。

```java
 public void parse() {
         // 该节点是否被解析过或加载过
        if (!this.configuration.isResourceLoaded(this.resource)) {
            //解析mapper节点
            this.configurationElement(this.parser.evalNode("/mapper"));
            // 加入到已经解析的列表，防止重复解析
            this.configuration.addLoadedResource(this.resource);
            // 1，将mapper注册给Configuration
            this.bindMapperForNamespace();
        }
		// 下面分别用来处理失败的<resultMap>、<cache-ref>、SQL语句
        this.parsePendingResultMaps();
        this.parsePendingCacheRefs();
        this.parsePendingStatements();
    }
```

查看一下`this.bindMapperForNamespace();`方法：

```java
 private void bindMapperForNamespace() {
     	// 获取mapper映射文件的命名空间
        String namespace = this.builderAssistant.getCurrentNamespace();
        if (namespace != null) {
            
            Class boundType = null;
            try {
                // 根据命名空间找到对应的mappe接口类
                boundType = Resources.classForName(namespace);
            } catch (ClassNotFoundException var4) {
            }
			// 检测当前mappe接口类是否被绑定过
            if (boundType != null && !this.configuration.hasMapper(boundType)) {
                // 添加资源
                this.configuration.addLoadedResource("namespace:" + namespace);
                // 绑定 mapper 类
                this.configuration.addMapper(boundType);
            }
        }

    }
```

 绑定mapper类，查看`this.configuration.addMapper(boundType);`方法：

```java
public <T> void addMapper(Class<T> type) {
        this.mapperRegistry.addMapper(type);
    }
```

继续跟进`this.mapperRegistry.addMapper(type);`方法：

```java
public <T> void addMapper(Class<T> type) {
    	// 判断是否是接口
        if (type.isInterface()) {
            // 判断是否绑定过
            if (this.hasMapper(type)) {
                throw new BindingException("Type " + type + " is already known to the MapperRegistry.");
            }
            boolean loadCompleted = false;
            try {
                // type和MapperProxyFactory 进行绑定，MapperProxyFactory可为mapper接口生成代理类
                this.knownMappers.put(type, new MapperProxyFactory(type));
                // mapper解析注解中的信息
                MapperAnnotationBuilder parser = new MapperAnnotationBuilder(this.config, type);
                parser.parse();
                loadCompleted = true;
            } finally {
                if (!loadCompleted) {
                    this.knownMappers.remove(type);
                }

            }
        }

    }
```

MapperProxyFactory对象的作用就是为了实现`UserMapper mapper = session.getMapper(UserMapper.class);`方式获取代理对象。

```java
public class MapperProxyFactory<T> {
    private final Class<T> mapperInterface;
    private final Map<Method, MapperMethodInvoker> methodCache = new ConcurrentHashMap();

    // 构造方法
    public MapperProxyFactory(Class<T> mapperInterface) {
        this.mapperInterface = mapperInterface;
    }

    public Class<T> getMapperInterface() {
        return this.mapperInterface;
    }

    public Map<Method, MapperMethodInvoker> getMethodCache() {
        return this.methodCache;
    }

    // 创建实例
    protected T newInstance(MapperProxy<T> mapperProxy) {
        return Proxy.newProxyInstance(this.mapperInterface.getClassLoader(), new Class[]{this.mapperInterface}, mapperProxy);
    }

    public T newInstance(SqlSession sqlSession) {
        MapperProxy<T> mapperProxy = new MapperProxy(sqlSession, this.mapperInterface, this.methodCache);
        return this.newInstance(mapperProxy);
    }
}
```



转载：

版权声明：本文为CSDN博主「长安不及十里」的原创文章，遵循CC 4.0 BY-SA版权协议，转载请附上原文出处链接及本声明。
原文链接：https://blog.csdn.net/weixin_44451022/article/details/128520296
