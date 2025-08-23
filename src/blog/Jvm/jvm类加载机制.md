---
icon: document
# 标题
title: 'jvm类加载机制'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-13
# 一个页面可以有多个分类
category:
  - Jvm
# 一个页面可以有多个标签
tag:
  - 干货
  - Jvm
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，jvm类加载机制

#### 1.1 什么是类加载机制

​	java代码编译后就会生成JVM能够识别的二进制字节流文件*.class文件，将class文件加载到内存，最终成为可以被JVM直接使用的Java类型，这个过程叫做JVM的类加载机制。

#### 1.2 类加载过程

class文件中的“类”从加载到JVM内存中，到卸载出内存过程有七个生命周期阶段：

<img src="http://img.zouyh.top/article-img/20240917135023217.png" alt="image-20230203103002359" style="zoom: 80%;" />

类加载机制包括了前五个阶段，要注意的是加载、验证、准备、初始化、卸载的开始顺序是确定的，只是按顺序开始，进行与结束的顺序并不一定，解析阶段可能在初始化之后开始，另外，类加载无需等到程序中“首次使用”的时候才开始，JVM预先加载某些类也是被允许的。

#### 1.3 类加载过程之加载

我们平常说的加载大多不是指的类加载机制，只是类加载机制中的第一步加载。在这个阶段，JVM主要完成三件事：

1. 通过全类名获取定义此类的二进制字节流（获取的方式，可以通过jar包、war包、网络中获取、JSP文件生成等方式）
2. 将字节流所代表的静态存储结构转换为**方法区**的运行时数据结构，这里只是转化了数据结构，并未合并数据。
3. 在内存中生成一个代表该类的 Class 对象,作为方法区这些数据的访问入口。

##### 1.3.1 类加载器

​	类加载器负责加载所有的类，所有被载入内存中的类都生成一个`java.lang.Class`实例对象，该对象用于代表该类。正如一个对象有一个唯一的标识一样，一个载入JVM的类也有一个唯一的标识。在Java中，一个类用其全限定类名（包名+类名）作为标识；在JVM中，一个类用其全限定类名和其类加载器作为其唯一标识。

​	例如：如果在`www.zyh`的包中有一个名为`StringTest`的类，如果被被类加载器kl实例负责加载，则该`StringTest`类对应的Class对象在JVM中表示为`www.zyh.StringTest.kl`，如果被类加载器k2实例负责加载，则该`StringTest`类对应的Class对象在JVM中表示为`www.zyh.StringTest.k2`。同一个JVM内，两个相同包名和类名的类对象可以共存，因为他们的类加载器可以不一样，所以看两个类对象是否是同一个，除了看类的包名和类名是否都相同之外，还需要他们的类加载器也是同一个才能认为他们是同一个。

JVM预定义有三种类加载器，当一个JVM启动的时候，Java开始使用如下三种类加载器：

- 根类加载器（bootstrap class loader）：它用来加载 Java 的核心类，是用原生代码来实现的，并不继承自 `java.lang.ClassLoader`,负责加载$JAVA_HOME中jre/lib/rt.jar里所有的class，由C++实现，不是ClassLoader子类。
- 扩展类加载器（extensions class loader)：它负责加载JRE的扩展目录，lib/ext或者由java.ext.dirs系统属性指定的目录中的JAR包的类。由Java语言实现，是ClassLoader子类，父类加载器为null。
- 系统类加载器（system class loader：被称为系统（也称为应用）类加载器，它负责在JVM启动时加载来自Java命令的-classpath选项、java.class.path系统属性，或者CLASSPATH换将变量所指定的JAR包和类路径。由Java语言实现，父类加载器为ExtClassLoader。
- 自定义类加载器：继承ClassLoader类重写loadClass方法；程序可以通过ClassLoader的静态方法getSystemClassLoader()来获取系统类加载器，如果没有特别指定，用户自定义的类加载器都以此系统类加载器加载器作为父加载器。

##### 1.3.2 类加载器的初始化

​	c++会调用java创建JVM启动器`sun.misc.Launcher`实例，`sun.misc.Launcher`的构造方法:

```java
public Launcher() {
    Launcher.ExtClassLoader var1;
    try {
        // ①，构造扩展类加载器，在构造的过程中将其父加载器设置为null
        var1 = Launcher.ExtClassLoader.getExtClassLoader();
    } catch (IOException var10) {
        throw new InternalError("Could not create extension class loader", var10);
    }
     try {
         // ②，构造系统类加载器，在构造的过程中将其父加载器设置为ExtClassLoader，Launcher的loader属性值是系统类加载器，我们一般都是用这个类加载器来加载我们自己写的应用程序
         this.loader = Launcher.AppClassLoader.getAppClassLoader(var1);
     } catch (IOException var9) {
          throw new InternalError("Could not create application class loader", var9);
      }
      Thread.currentThread().setContextClassLoader(this.loader);
      String var2 = System.getProperty("java.security.manager");
      //省略一些不需关注代码
}
```

​	`sun.misc.Launcher`初始化使用了单例模式设计，保证一个JVM虚拟机内只有一个`sun.misc.Launcher`实例。在Launcher构造方法内部，其创建了两个类加载器，分别是扩展类加载器`sun.misc.Launcher.ExtClassLoader`和系统类加载器`sun.misc.Launcher.AppClassLoader`, 根类加载器不是由java语言实现的，这里就不太看了。

##### 1.3.3 双亲委派

###### 1.3.3.1 双亲委派的工作流程

![image-20230203111937292](http://img.zouyh.top/article-img/20240917135025219.png)

双亲委派模型的工作过程如下：

1.  首先，检查一下指定名称的类是否已经加载过，如果加载过了，就不需要再加载，直接返回。
2.  如果此类没有加载过，那么，再判断一下是否有父加载器；如果有父加载器，则由父加载器加载，如果没有父类（扩展类没有父类），调用根类加载器来加载。
3. 如果父加载器及根类加载器类加载器都没有找到指定的类，那么调用当前类加载器的findClass方法来完成类加载。

ClassLoader的loadClass方法，里面实现了双亲委派机制：

```java
protected Class loadClass(String name, boolean resolve)throws ClassNotFoundException{
    synchronized (getClassLoadingLock(name)) {
        // 检查当前类加载器是否已经加载了该类
        Class c = findLoadedClass(name);
        if (c == null) { // 没有加载
            long t0 = System.nanoTime();
            try{
                  if (parent != null) { 
                        // 如果当前加载器父加载器不为空则委托父加载器加载该类
                        c = parent.loadClass(name, false); // 递归
                    } else { // 如果当前加载器父加载器为空则委托根类类加载器加载该类
                        c = findBootstrapClassOrNull(name);
                    }
            }catch (ClassNotFoundException e) {
           }
           if (c == null) {
              
               long t1 = System.nanoTime();
               //都会调用URLClassLoader的findClass方法在加载器的类路径里查找并加载该类
               c = findClass(name);
                sun.misc.PerfCounter.getParentDelegationTime().addTime(t1 ‐ t0);
                sun.misc.PerfCounter.getFindClassTime().addElapsedTimeFrom(t1);
                sun.misc.PerfCounter.getFindClasses().increment();
             }
         }
         if (resolve) { // 不会执行
             resolveClass(c);
         }
         return c;
      }
   }
}
```

###### 1.3.3.2 双亲委派的这个亲是指什么？

​	这里的“亲”并不指父亲，因为扩展类加载器、系统类加载器和自定义类加载器都是继承ClassLoader的，而根类加载器是由C++实现，不是ClassLoader子类，也不存在继承关系，这里的“亲”是ClassLoader中有个成员变量为parent，类型也是ClassLoader。

```java
public abstract class ClassLoader {
    // ClassLoader中有个成员变量为parent
    private ClassLoader parent;
    // 省略，，，
}
```

扩展类加载器的parent  = null、系统类加载器的parent = 扩展类加载器、自定义类加载器的的parent = 系统类加载器。

目光回到JVM启动器会创建`sun.misc.Launcher`实例，Launcher构造方法：

![1](http://img.zouyh.top/article-img/20240917135023218.png)

扩展类加载器的parent  = null很容易理解，因为根类加载器是由C++实现的；系统类加载器的parent = 扩展类加载器通过上图可以看出，在创建系统类加载器的时候，传入的参数就是扩展类加载器；那么为什么自定义类加载器的的parent = 系统类加载器? 

因为自定义类加载器需要继承ClassLoader类，在创建自定义类加载器的时候会隐式的调用ClassLoader类的无参构造方法,如下：

```java
protected ClassLoader() {
        this(checkCreateClassLoader(), getSystemClassLoader());
}
```

跟进`this(checkCreateClassLoader(), getSystemClassLoader());`方法：

```java
private ClassLoader(Void var1, ClassLoader var2) {
        this.package2certs = new Hashtable(11);
        this.classes = new Vector();
        this.domains = new HashSet();
        this.packages = new HashMap();
        this.defaultDomain = null;
        this.nativeLibraries = new Vector();
        this.defaultAssertionStatus = false;
        this.packageAssertionStatus = null;
        this.classAssertionStatus = null;
        this.parent = var2; // 为成员变量赋值
    }
```

由上方代码可知，为自定义成员parent变量赋值的是传入的第二个参数，第二个参数是getSystemClassLoader()方法的返回值，所以跟进`getSystemClassLoader()`方法：

```java
public static ClassLoader getSystemClassLoader() {
        initSystemClassLoader(); // 初始化系统类型加载器
        if (scl == null) {
            return null;
        } else {
            SecurityManager var0 = System.getSecurityManager();
            if (var0 != null) {
                ClassLoader var1 = getCallerClassLoader();
                if (var1 != null && var1 != scl && !scl.isAncestor(var1)) {
                    var0.checkPermission(SecurityConstants.GET_CLASSLOADER_PERMISSION);
                }
            }

            return scl; //返回值scl成员变量，在initSystemClassLoader();中赋值的
        }
    }
```

跟进初始化系统类型加载器` initSystemClassLoader();`方法：

```java
 private static synchronized void initSystemClassLoader() {
        if (!sclSet) {
            if (scl != null) {
                throw new IllegalStateException("recursive invocation");
            }

            Launcher var0 = Launcher.getLauncher();
            if (var0 != null) {
                Throwable var1 = null;
                // getClassLoader()方法的返回值就是系统类加载器，在Launcher的构造方法的代码中（上面的图片），在创建的系统类加载器后，将值赋值给了Launcher的loader成员变量。
                scl = var0.getClassLoader();

                try {
                    SystemClassLoaderAction var2 = new SystemClassLoaderAction(scl);
                    scl = (ClassLoader)AccessController.doPrivileged(var2);
                } catch (PrivilegedActionException var3) {
                    var1 = var3.getCause();
                    if (var1 instanceof InvocationTargetException) {
                        var1 = var1.getCause();
                    }
                }

                if (var1 != null) {
                    if (var1 instanceof Error) {
                        throw (Error)var1;
                    }

                    throw new Error(var1);
                }
            }

            sclSet = true;
        }

    }
```

​	Launcher的` getClassLoader()`方法：在Launcher的构造方法的代码中（上面的图片），在创建的系统类加载器后，将值赋值给了Launcher的loader成员变量。

```java
public ClassLoader getClassLoader() {
        return this.loader;
}
```

###### 1.3.3 为什么要设计双亲委派机制？

- 沙箱安全机制：自己写的java.lang.String.class类不会被加载，这样便可以防止核心API库被随意篡改
- 避免类的重复加载：当父亲已经加载了该类时，就没有必要子ClassLoader再加载一次，保证**被加载类的唯一性**

###### 1..3.4 打破双亲委派机制

用自定义类加载器打破双亲委派原则

```java
public class MyClassLoaderTest {
    static class MyClassLoader extends ClassLoader {
        private String classPath;
        public MyClassLoader(String classPath) {
            this.classPath = classPath;
        }
        private byte[] loadByte(String name) throws Exception {
            name = name.replaceAll("\\.", "/");
            FileInputStream fis = new FileInputStream(classPath + "/" + name
                    + ".class");
            int len = fis.available();
            byte[] data = new byte[len];
            fis.read(data);
            fis.close();
            return data;

        }
        protected Class<?> findClass(String name) throws ClassNotFoundException {
            try {
                byte[] data = loadByte(name);
                return defineClass(name, data, 0, data.length);
            } catch (Exception e) {
                e.printStackTrace();
                throw new ClassNotFoundException();
            }
        }

        protected Class<?> loadClass(String name, boolean resolve)
                throws ClassNotFoundException {
            synchronized (getClassLoadingLock(name)) {
                Class<?> c = findLoadedClass(name); // 判断类有没有被加载
                if (c == null) {
                    long t1 = System.nanoTime();
                    c = findClass(name);
                    sun.misc.PerfCounter.getFindClassTime().addElapsedTimeFrom(t1);
                    sun.misc.PerfCounter.getFindClasses().increment();
                }
                if (resolve) {
                    resolveClass(c);
                }
                return c;
            }
        }
    }

}
```

举例1：在自定义类加载器代码中添加如下代码，测试加载自己写的String类

```java
public static void main(String args[]) throws Exception { 
    MyClassLoader classLoader = new MyClassLoader("D:/test");
    // 将自己写的String的class文件放在D:/test/java/lang下
    // 通过自定义方式加载自己写的String
    Class clazz = classLoader.loadClass("java.lang.String");
    System.out.println(clazz.getClassLoader().getClass().getName());
}
```

输出结果：

```java
java.lang.SecurityException: Prohibited package name: java.lang
	at java.lang.ClassLoader.preDefineClass(ClassLoader.java:662)
	at java.lang.ClassLoader.defineClass(ClassLoader.java:761)
```

异常产生的原因，跟进`java.lang.ClassLoader.preDefineClass`方法：

```java
private ProtectionDomain preDefineClass(String name,
                                            ProtectionDomain pd)
    {
        if (!checkName(name))
            throw new NoClassDefFoundError("IllegalName: " + name)
        if ((name != null) && name.startsWith("java.")) { // 禁止以java为包名的开头
            throw new SecurityException
                ("Prohibited package name: " +
                 name.substring(0, name.lastIndexOf('.')));
        }
        if (pd == null) {
            pd = defaultDomain;
        }

        if (name != null) checkCerts(name, pd.getCodeSource());

        return pd;
    }
```

举例2：继续实验，既然是因为是以java为包名开头的原因，那就加载一个不是以java为包名的开头，更改代码如下：

```java
public static void main(String[] args) {
        MyClassLoader classLoader = new MyClassLoader("D:/test");
        try {
            // 将自己写的StringTest的class文件放在D:/test/www/zyh下
        	// 通过自定义方式加载自己写的StringTest
            Class<?> clazz = classLoader.loadClass("www.zyh.StringTest");
        } catch (ClassNotFoundException e) {
            e.printStackTrace();
        }
    }
```

输出结果：

```java
java.io.FileNotFoundException: D:\test\java\lang\Object.class (系统找不到指定的路径。)
```

​	因为java中所有类都继承了Object，而加载自定义类`www.zyh.StringTest`，之后还会加载其父类，而最顶级的父类Object是java官方的类，只能由BootstrapClassLoader加载。

​	实验到这就进入了死胡同，java规定自定义的类加载器不能加载以java包名为开头的类，加载不以java开头的类时，加载自定义类后还会加载其父类，java中所有类都继承了Object，而父类Object又是java包名为开头的类，这怎么办？最简解决方式很简单，以`www.zyh`包名为开头的类交给我们自定义的加载器，不以`www.zyh`包名为开头的类还交由原来的类加载器加载，自定义类加载器的loadClass方法代码如下：

```java
protected Class<?> loadClass(String name, boolean resolve)
                throws ClassNotFoundException {
            synchronized (getClassLoadingLock(name)) {
                Class<?> c = findLoadedClass(name); // 判断类有没有被加载
                if (c == null) {
                    if(name.startsWith("www.zyh")){ //
                        c = findClass(name);
                    }else { // 原来的还是老样子
                        c = this.getParent().loadClass(name);
                    }

                }
                return c;
            }
        }
```

​	到此我们已经算是打破了双亲委派，因为双亲委派的核心在于ClassLoader的loadClass方法，我们通过重写ClassLoader的loadClass方法，将以`www.zyh`包名为开头的类交给我们自定义的加载器加载并没有走原来的双亲委派的逻辑。

举例3：我们在前面提到过，不同的类加载器实例负责加载同一个类（相同包名和类名的类对象），在同一个JVM内，是可以共存。我们验证一下，更改代码如下：

```java
public static void main(String[] args) {
        MyClassLoader k1 = new MyClassLoader("D:/test");
     	MyClassLoader k2 = new MyClassLoader("D:/test");
        try {  
            Class<?> clazz1 = k1.loadClass("www.zyh.StringTest");
            Class<?> clazz2 = k2.loadClass("www.zyh.StringTest");
            System.out.println(clazz1.getClassLoader());
            System.out.println(clazz2.getClassLoader());
        } catch (ClassNotFoundException e) {
            e.printStackTrace();
        }
    }
```

输出结果：

```
www.zyh.MyClassLoaderTest$MyClassLoader@34340fab
www.zyh.MyClassLoaderTest$MyClassLoader@2b80d80f
```

###### 1.3.5 Tomcat打破双亲委派机制

我们思考一下，为什么Tomcat需要打破双亲委派，Tomcat是个web容器， 那么它要解决什么问题： 

1. 一个web容器可能需要部署两个应用程序，不同的应用程序可能会**依赖同一个第三方类库的不同版本**，例如项目一需要依赖Spring5，项目二需要依赖Spring4，Spring5和Spring4肯定有许多重名的类，Tomcat不可能只加载一个版本的类。

2. 部署在同一个web容器中**相同的类库相同的版本可以共享**。否则，如果服务器有10个应用程序，那么要有10份相同的类库加载进虚拟机。 

3. **web容器也有自己依赖的类库，不能与应用程序的类库混淆**。基于安全考虑，应该让容器的类库和程序的类库隔离开来。 

4. web容器要支持jsp的修改，我们知道，jsp 文件最终也是要编译成class文件才能在虚拟机中运行，但程序运行后修改jsp已经是司空见惯的事情， web容器需要支持 jsp 修改后不用重启。

Tomcat 如果使用默认的双亲委派类加载机制行不行？*

答案是不行的。为什么？

第一个问题，如果使用默认的类加载器机制，那么是无法加载两个相同类库的不同版本的，默认的类加器是不管你是什么版本的，只在乎你的全限定类名，并且只有一份。

第二个问题，默认的类加载器是能够实现的，因为他的职责就是保证**唯一性**。

第三个问题和第一个问题一样。

我们再看第四个问题，我们想我们要怎么实现jsp文件的热加载，jsp 文件其实也就是class文件，那么如果修改了，但类名还是一样，类加载器会直接取方法区中已经存在的，修改后的jsp是不会重新加载的。那么怎么办呢？我们可以直接卸载掉这jsp文件的类加载器，所以你应该想到了，每个jsp文件对应一个唯一的类加载器，当一个jsp文件修改了，就直接卸载这个jsp类加载器。重新创建类加载器，重新加载jsp文件。

Tomcat自定义加载器详解：

<img src="http://img.zouyh.top/article-img/20240917135023216.png" alt="image-20230203163725311" style="zoom:67%;" />

tomcat的几个主要类加载器：

- commonLoader：Tomcat最基本的类加载器，加载路径中的class可以被Tomcat容器本身以及各个Webapp访问；
- sharedLoader：各个Webapp共享的类加载器，加载路径中的class对于所有Webapp可见，但是对于Tomcat容器不可见；
- catalinaLoader：Tomcat容器私有的类加载器，加载路径中的class对于Webapp不可见；
- WebappClassLoader：各个Webapp私有的类加载器，加载路径中的class只对当前Webapp可见，比如加载war包里相关的类，每个war包应用都有自己的WebappClassLoader，实现相互隔离，比如不同war包应用引入了不同的spring版本，这样实现就能加载各自的spring版本；

tomcat 这种类加载机制违背了java 推荐的双亲委派模型了吗？

答案是：违背了。 很显然，tomcat 为了实现隔离性，没有遵守这个约定，**每个webappClassLoader加载自己的目录下的class文件，不会传递给父类加载器，打破了双亲委派机制**。



补充，实现Tomcat的JasperLoader热加载原理：后台启动线程监听jsp文件变化，如果变化了找到该jsp对应的servlet类的加载器引用(gcroot)，重新生成新的**JasperLoader**加载器赋值给引用，然后加载新的jsp对应的servlet类，之前的那个加载器因为没有gcroot引用了，下一次gc的时候会被销毁。



#### 1.4 类加载过程之连接

​	类的加载过程后生成了类的`java.lang.Class`对象，接着会进入连接阶段，连接阶段负责将类的二进制数据合并入JRE（Java运行时环境）中，类的连接大致分三个阶段。

##### 1.4.1 验证

​	验证被加载后的类是否有正确的结构**，**类数据是否会符合虚拟机的要求，确保不会危害虚拟机安全。包含文件格式校验，元数据校验，字节码校验，符号引用校验

##### 1.4.2 准备

​	为类的静态变量（static filed）在方法区分配内存，并赋默认初值（0值或null值）。如static int a = 100;静态变量a就会在准备阶段被赋默认值0。对于一般的成员变量是在类实例化时候，随对象一起分配在堆内存中。另外，静态常量（static final filed）会在准备阶段赋程序设定的初值，如static final int a = 666;  静态常量a就会在准备阶段被直接赋值为666，对于静态变量，这个操作是在初始化阶段进行的。

##### 1.4.3 解析

​	将类的二进制数据中的符号引用换为直接引用。在java中，一个java类将会编译成一个class文件。在编译时，java类并不知道引用类的实际内存地址，因此只能使用符号引用来代替。比如`org.simple.People`类引用`org.simple.Tool`类，在编译时People类并不知道Tool类的实际内存地址，因此只能使用符号org.simple.Tool(假设)来表示Tool类的地址。而在类装载器装载People类时，此时可以通过虚拟机获取Tool类的实际内存地址，因此便可以既将符号`org.simple.Tool`替换为Tool类的实际内存地址，及直接引用地址。

#### 1.5 类加载过程之类初始化

> **类**的初始化，不是对象的初始化，**类**的初始化主要工作是**为静态变量赋程序设定的初值**。

##### 1.5.1 Java程序初始化顺序：

1. 父类的静态变量
2. 父类的静态代码块
3. 子类的静态变量
4. 子类的静态代码块
5. 父类的非静态变量
6. 父类的非静态代码块
7. 父类的构造方法
8. 子类的非静态变量
9. 子类的非静态代码块
10. 子类的构造方法

##### 1.5.2 类初始化时机

Java虚拟机规范中严格规定了有且只有五种情况必须对类进行初始化：

- 使用new字节码指令创建类的实例，或者使用getstatic读取或putstatic设置一个静态字段的值（final修饰的变量，放入常量池中的常量除外），或者invkestatic调用一个静态方法的时候，对应类必须进行过初始化。
- 通过java.lang.reflect包的方法对类进行反射调用的时候，如果类没有进行过初始化，则要首先进行初始化。
- 当初始化一个类的时候，如果发现其父类没有进行过初始化，则首先触发父类初始化。
- 当虚拟机启动时，用户需要指定一个主类（包含main()方法的类），虚拟机会首先初始化这个类。
- 使用jdk1.7的动态语言支持时，如果一个java.lang.invoke.MethodHandle实例最后的解析结果REF_getStatic、REF_putStatic、RE_invokeStatic的方法句柄，并且这个方法句柄对应的类没有进行初始化，则需要先触发其初始化。

> 虚拟机规范使用了“有且只有”这个词描述，这五种情况被称为“主动引用”，除了这五种情况，所有其他的类引用方式都不会触发类初始化，被称为“被动引用”。
