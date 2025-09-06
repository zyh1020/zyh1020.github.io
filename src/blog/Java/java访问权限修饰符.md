---
icon: file-lines
# 标题
title: 'java访问权限修饰符'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-11
# 一个页面可以有多个分类
category:
  - Java
# 一个页面可以有多个标签
tag:
  - 基础
  - Java
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---





### 一，结论

| 修饰符    | 当前类(案例1) | 同一包内(案例2) | 子孙类(案例3) | 子孙类(不同包)(案例4) | 其他包(案例5) |
| --------- | ------------- | --------------- | ------------- | --------------------- | ------------- |
| public    | Y             | Y               | Y             | Y                     | Y             |
| protected | Y             | Y               | Y             | Y/N(案例4.1)          | N             |
| default   | Y             | Y               | Y             | N                     | N             |
| private   | Y             | N               | N             | N                     | N             |

- public : 对所有类可见
- protected : 对同一包内的类和所有子类可见
- default (即默认，什么也不写）: 在同一包内可见
- private : 在同一类内可见

注意：

- protected和private不能修饰外部类
- protected和private不能声明接口及接口的成员变量和成员方法
- 接口的成员变量和成员方法默认不写修饰符是public

- protected修饰符子孙类(不同包)Y/N的解释：通过继承访问父类中的protected属性或方法，而不是直接通过父类实例访问protected属性或方法，可以查看下方的4.1案例解释。

### 二，案例

各类的关系图

<img src="http://img.zouyh.top/article-img/20240917134938103.png" alt="image-20230210173356120" style="zoom:67%;" />


```java
package package01;
public class A01 {
    private String privateName = "privateName";
    public String publicName = "publicName";
    protected String protectedName="protectedName";
    String defaultName = "defaultName";
    public void publicFun(){
        System.out.println("，，，，A01的publicFun方法，，，，，");
    }
    private void privateFun(){
        System.out.println("，，，，A01的privateFun方法，，，，，");
    }
    protected void protectedFun(){
        System.out.println("，，，，A01的protectedFun方法，，，，，");
    }
    void defaultFun(){
        System.out.println("，，，，A01的defaultFun方法，，，，，");
    }
}
```

案例1：当前类A1，如下图结对应上方表格第二列结果
![image-20230210172832388](http://img.zouyh.top/article-img/20240917134940108.png)

案例2：同一包下的A02类，如下图结对应上方表格第三列结果
<img src="http://img.zouyh.top/article-img/20240917134939104.png" alt="image-20230210171147984" style="zoom:67%;" />



案例3：同一包下的子孙B01类，如下图结对应上方表格第四列结果
<img src="http://img.zouyh.top/article-img/20240917134939105.png" alt="image-20230210171647861" style="zoom: 67%;" />



案例4：不同包下的子孙B02类，如下图结对应上方表格第五列结果
<img src="http://img.zouyh.top/article-img/20240917134939106.png" alt="image-20230210171754599" style="zoom:67%;" />



案例4.1:protected修饰符子孙类(不同包)Y/N的解释

```java
public class A01{    
   protected String name;    
}
// 假设B03是不同包的子类
public class B03 extends A01{
    public void print(){
        /*通过父类直接访问*/
        Animal a = new Animal();
        System.out.println(a.name);       //不允许
        /*通过继承访问*/        
        System.out.println(this.name);    //允许
        
    }
}
```

案例5：不同包下的A03类，如下图结对应上方表格第六列结果

<img src="http://img.zouyh.top/article-img/20240917134939107.png" alt="image-20230210172725725" style="zoom:67%;" />
