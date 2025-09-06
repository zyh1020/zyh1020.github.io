---
icon: file-lines
# 标题
title: 'java异常'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-23
# 一个页面可以有多个分类
category:
  - Java
# 一个页面可以有多个标签
tag:
  - 常用
  - Java
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，java异常

#### 1.1 定义

异常就是有异于常态，和正常情况不一样，有错误出现。在java中，阻止当前方法或作用域的情况，称之为异常。

#### 1.2 异常的分类

- 运行时异常： `RuntimeException`类极其子类表示JVM在运行期间可能出现的错误。编译器不会检查此类异常，并且不要求处理异常，比如用空值对象的引用（`NullPointerException`）、数组下标越界（`ArrayIndexOutBoundException`）。此类异常属于不可查异常，一般是由程序逻辑错误引起的，在程序中可以选择捕获处理，也可以不处理。
- 非运行时异常：Exception中除`RuntimeException`极其子类之外的异常。编译器会检查此类异常，如果程序中出现此类异常，比如说`IOException`，必须对该异常进行处理，要么使用try-catch捕获，要么使用throws语句抛出，否则编译不通过。（不能只使用throw并没有处理异常）
- 错误：错误不是异常，而是脱离程序员控制的问题。错误在代码中通常被忽略。例如，当栈溢出时，一个错误就发生了，它们在编译也检查不到的。

#### 1.3 异常的处理

##### 1.3.1  try catch处理

格式：

```java
try {
   ...  //监视代码执行过程，一旦返现异常则直接跳转至catch，
        // 如果没有异常则直接跳转至finally
} catch (AException e) {
    ... //可选执行的代码块，如果没有任何异常发生则不会执行；
        //如果发现异常则进行处理或向上抛出。
} catch (BException e) {
    ... //可选执行的代码块，如果没有任何异常发生则不会执行；
        //如果发现异常则进行处理或向上抛出。
} finally {
    ... //必选执行的代码块，不管是否有异常发生，
        // 即使发生内存溢出异常也会执行，通常用于处理善后清理工作。
}
```

- 假设try代码块中的第四行出现异常，会直接跳转至对应catch代码块下，try代码块第四行以后的代码都不会执行了；
- try catch处理异常，如果产生异常执行对应异常的catch块处理异常，处理完毕后继续执行后续代码；如果没有产生异常，不会执行catch块中的异常，try块中执行完毕后继续执行后续代码
- 如果cath参数定义的异常，存在子父关系，那么子类异常必须写在父类异常的前面
- finallly：无论是否发生异常都会执行
- finally中最好不要写return语句

Exception常用方法：

| 方法                          | 说明                                   |
| ----------------------------- | -------------------------------------- |
| public String getMessage()    | 异常的简单信息                         |
| public String toString()      | 异常类型+异常的简单信息                |
| public void printStackTrace() | 异常类型+异常的简单信息+产生异常的位置 |

##### 1.3.2 throws和throw

①，throws的格式：

```
修饰符 返回值类型 方法名（参数） throws 异常类名1，异常类名2 ... { }
```

- 如果抛出的异常包含子父关系，只需声明父异常
- throws运用于方法声明之上，用于表示当前方法不处理异常**，**而是提醒该方法的调用者来处理异常,如果都不处理异常，最终由jvm处理。

②，throw的格式：

```
throw new 异常类名(参数)；
```

- throw用在方法内，用来抛出一个异常对象，将这个异常对象传递到调用者处，并结束当前方法的执行。     
- 如果throw抛出的异常是运行时异常，自己可以不处理异常，调用者也可可以不处理异常，最终异常会交给jvm处理。
- 如果throw抛出的异常是非运行时异常，自己必须处理异常，处理异常的方式有两种：第一种，直接try catch处理异常；第二种，使用throws再次声明抛出异常，调用者必须处理该异常，调用者也是两种方式，要么try catch处理异常，要么继续抛出异常，如果在一直没有处理异常，最终异常会交给jvm处理。

#### 1.4 自定义异常

格式：

```java
public class 异常名Exception extends Exception/ RuntimeException{
    //提供无产构造器
    public 异常名Exception(){
        super()
    }
    //提供有参构造器
     public 异常名Exception(String message){
        super(message)
    }
}
```

- 自定义异常类的类名一般是以Exception结尾，表明这是一个异常类；
- 自定义的异常类，必须继承Exception或RuntimeException

#### 1.5 return

案例1：try中的return语句示例：

```java
public class TestTemp {
    public static void main(String[] args) {
        System.out.println(returnInt());
    }
    public static int returnInt(){
        int a = 10;
        int b = 0;
        try {
            a = 20;
            b = a / 0; // 出现异常
            System.out.println("会执行标记1");
            a = 30;
            return a; // 不是它返回的 
        }catch (Exception e){
            System.out.println("会执行标记2");
            a = 40;
        }
        System.out.println("会执行标记3"); // 这句
        return a; // 和return写在这个地方和写在catch中一样
    }
}
```

结果：

```java
会执行标记2
会执行标记3
40
```

案例2：finally中return语句示例：

```java
public class TestTemp {
    public static void main(String[] args) {
        System.out.println(returnInt()); 
    }
    public static int returnInt(){
        int a = 10;
        int b = 0;
        try {
            a = 20;
            b = a / 0; // 出现异常
            System.out.println("会执行标记1");
            a = 30;
            return a;
        }catch (Exception e){
            a = 40;
            System.out.println("会执行标记2");
            return a;
        }finally {
            System.out.println("会执行标记3");
            a = 50;
            return a;
        }
    }
}
```

结果：

```
会执行标记2
会执行标记3
50
```

案例3： try finally中return语句示例：

```java
public class TestTemp {
    public static void main(String[] args) {
        System.out.println(returnInt()); // 输出 40
    }
    public static int returnInt(){
        int a = 10;
        try {
            a = 20;
            System.out.println("会执行标记1");
            return a;
        }finally {
            System.out.println("会执行标记3");
            a = 50;
            return a;
        }
    }
}
```

结果：

```
会执行标记1
会执行标记3
50
```

从案例2和案例3可以看出，finally中的逻辑由于始终会执行，那么如果finally中有返回就不会执行try或catch中的返回，所以不建议在finally中执行返回操作。

案例4：

```java
public class TestTemp {
    public static void main(String[] args) {
        System.out.println(returnInt()); // 输出 40
    }
    public static int returnInt(){
        int a = 10;
        int b = 0;
        try {
            a = 20;
            b = a / 0; // 出现异常
            System.out.println("会执行标记1");
            a = 30;
            return a;
        }catch (Exception e){
            System.out.println("会执行标记2");
            a = 40;
            return a;
        }finally {
            System.out.println("会执行标记3");
            a = 50;
        }
    }
}
```

结果：

```cmd
会执行标记2
会执行标记3
40
```

案例5：

```java
public class TestTemp {
    public static void main(String[] args) {
        System.out.println(returnInt()); // 输出 40
    }
    public static int returnInt(){
        int a = 10;
        int b = 0;
        try {
            a = 20;
            b = a / 0; // 出现异常
            System.out.println("会执行标记1");
            a = 30;
            return a;
        }catch (Exception e){
            System.out.println("会执行标记2");
            a = 40;
        }finally {
            System.out.println("会执行标记3");
            a = 50;
        }
        return a;
    }
}
```

结果：

```cmd
会执行标记2
会执行标记3
50
```

