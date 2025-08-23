---
icon: document
# 标题
title: 'java对象的拷贝'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-04
# 一个页面可以有多个分类
category:
  - Java
# 一个页面可以有多个标签
tag:
  - 干货
  - Java
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，java对象的拷贝 

​	将一个对象的引用复制给另一个对象，一共有三种方式。第一种是直接赋值，第二种方式是浅拷贝，第三种是深拷贝，这三种方式实际上都是为了拷贝对象。

#### 1.1 直接赋值

​	直接赋值是通过`=`进行赋值操作的，直接赋值对于不可变类而言相当于深拷贝，常见的不可变类八个基本类型的包装类和String类都属于不可变类。

案例1，不可变类的赋值操作：

```java
public static void main(String[] args) {
    Integer a = 1;
    String b = "1";
    Integer c = a;
    String d = b;
    System.out.println("修改前c:"+b); // 输出 1
    System.out.println("修改前d:"+bb);// 输出 1
    a = 2;
    b = "2";
    System.out.println("修改前c:"+b);// 输出 2
    System.out.println("修改前d:"+bb);// 输出 2
}
```

可以看出a直接将值赋值给b，a的改变并不会影响b的值。

案例2，可变类赋值操作：

为了测试方便，新建User类，没有实际的业务功能，只是为了测试

```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class User {
    private Integer id;
    private String name;
    private Integer age;
}
```

进行赋值操作：

```java
public class CopyTest {
    public static void main(String[] args) {
        User user = new User(1, "张三", 25);
        User newUser = user;
        System.out.println(newUser.toString()); // 输出User(id=1, name=张三, age=25）
        user.setAge(26);
        user.setName("李四");
        System.out.println(newUser.toString());// 输出User(id=1, name=李四, age=26）
    }
}
```

可以看出user直接将值赋值给newUser，user属性的改变会影响newUser的值。

#### 1.2 浅拷贝

创建一个新对象，然后将当前对象的非静态字段复制到该新对象。

- 基本数据类型复制的是值，八个基本类型的包装类和String类，因为是不可变类，所以即使进行的是浅拷贝，也相当于进行深拷贝；
- 引用数据类型复制的是对象的引用

浅拷贝需要继承`Cloneable`接口，重写`clone()`方法 ,为了测试方便，新建User类和Student类，没有实际的业务功能，只是为了测试

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Student {
    private Integer id;
    private Integer score;
}
```

```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class User implements Cloneable {
    private Integer id;
    private String name;
    private Integer age;
    private Student student;

    @Override
    public Object clone(){
        try{
            return (User) super.clone();
        }catch (Exception e){
            e.printStackTrace();
            return null;
        }
    }
}
```

通过调用`clone()`方法，进行拷贝：

```java
public class CopyTest {
    public static void main(String[] args) {
        Student student = new Student(1, 66);
        User user = new User(1, "张三", 18, student);
        User newUser = (User) user.clone(); // 浅拷贝
        System.out.println(newUser.toString());
        student.setScore(90); // 引用数据类型
        user.setName("李四"); // 基本数据类型
        System.out.println(newUser.toString());
        System.out.println(user.toString());
    }

```

结果：

```cmd
User(id=1, name=张三, age=18, student=Student(id=1, score=66))
User(id=1, name=李四, age=18, student=Student(id=1, score=90))
User(id=1, name=张三, age=18, student=Student(id=1, score=90))
```

可以发现原对象user中的Student实例值改变后，拷贝对象newUser中的student实例值也跟着变了，说明是同一个引用。

#### 1.3 深拷贝

​	创建一个新对象，然后将当前对象的非静态字段复制到该新对象。无论该字段是基本类型的还是引用类型，都复制独立的一份。当你修改其中一个对象的任何内容时，都不会影响另一个对象的内容。

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Student implements Cloneable {
    private Integer id;
    private Integer score;

    @Override
    public Object clone(){
        try{
            return (Student) super.clone(); //成员属性都是基本类型
        }catch (Exception e){
            e.printStackTrace();
            return null;
        }
    }
}
```

```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class User implements Cloneable {
    private Integer id;
    private String name;
    private Integer age;
    private Student student;

    @Override
    public Object clone() {
        User user = null;
        try {
            user = (User) super.clone(); // 基本类型的
        } catch (Exception e) {
            e.printStackTrace();
        }
        user.student = (Student) student.clone();//调用student的clone方法
        return user;
    }
}
```

通过调用`clone()`方法，进行拷贝：

```java
public class CopyTest {
    public static void main(String[] args) {
        Student student = new Student(1, 66);
        User user = new User(1, "张三", 18, student);
        User newUser = (User) user.clone(); // 浅拷贝
        System.out.println(newUser.toString());
        student.setScore(90); // 引用数据类型
        user.setName("李四"); // 基本数据类型
        System.out.println(newUser.toString());
        System.out.println(user.toString());
    }

```

结果：

```cmd
User(id=1, name=张三, age=18, student=Student(id=1, score=66))
User(id=1, name=李四, age=18, student=Student(id=1, score=66))
User(id=1, name=张三, age=18, student=Student(id=1, score=90))
```

​	可以发现原对象user中的Student实例值改变后，拷贝对象newUser中的student实例值没有跟着变了，说明是不是同一个引用，但是通过构造方法Student实例值赋值给user，user的Student属性和`Student student = new Student(1, 66);`是同一个引用。

> 建议使用Spring BeanUtils的copyProperties方法来进行深拷贝，如果没有集成spring框架可以采用序列化的方式或者采用上述方式为引用类型属性单独调用clone方法
