---
icon: file-lines
# 标题
title: 'Lambda和Stream'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-04-30
# 一个页面可以有多个分类
category:
  - Java
# 一个页面可以有多个标签
tag:
  - 必看
  - Java
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，Lambda

#### 1.1 简介

Lambda 表达式是 JDK8 的一个新特性，可以取代大部分的匿名内部类，写出更优雅的 Java 代码，尤其在集合的遍历和其他集合操作中，可以极大地优化代码结构。

#### 1.2 对接口的要求

​	虽然使用 Lambda 表达式可以对某些接口进行简单的实现，但并不是所有的接口都可以使用 Lambda 表达式来实现。Lambda 规定接口中只能有一个需要被实现的方法，不是规定接口中只能有一个方法。

#### 1.3 @FunctionalInterface

`@FunctionalInterface`修饰函数式接口的，要求接口中的抽象方法只有一个。 这个注解往往会和 lambda 表达式一起出现。

#### 1.4 基础语法

定义函数式接口：

```java
/**无参无返回值*/
@FunctionalInterface
public interface NoReturnNoParam {
    void method();
}

/**一个参数无返回*/
@FunctionalInterface
public interface NoReturnOneParam {
    void method(int a);
}

/**多参数无返回*/
@FunctionalInterface
public interface NoReturnMultiParam {
    void method(int a, int b);
}

/*** 无参有返回*/
@FunctionalInterface
public interface ReturnNoParam {
    int method();
}

/**一个参数有返回值*/
@FunctionalInterface
public interface ReturnOneParam {
    int method(int a);
}
/**多个参数有返回值*/
@FunctionalInterface
public interface ReturnMultiParam {
    int method(int a, int b);
}
```

函数式接口对应的Lambda表达式：语法形式为` () -> {}`，其中 `() `用来描述参数列表，`{} `用来描述方法体，`->` 为 lambda运算符 ，读作(goes to)。

```java
public class Test1 {
    public static void main(String[] args) {

        //无参无返回
        NoReturnNoParam noReturnNoParam = () -> {
            System.out.println("NoReturnNoParam");
        };
        noReturnNoParam.method();

        //一个参数无返回
        NoReturnOneParam noReturnOneParam = (int a) -> {
            System.out.println("NoReturnOneParam param:" + a);
        };
        noReturnOneParam.method(6);

        //多个参数无返回
        NoReturnMultiParam noReturnMultiParam = (int a, int b) -> {
            System.out.println("NoReturnMultiParam param:" + "{" + a +"," + + b +"}");
        };
        noReturnMultiParam.method(6, 8);

        //无参有返回值
        ReturnNoParam returnNoParam = () -> {
            System.out.print("ReturnNoParam");
            return 1;
        };

        int res = returnNoParam.method();
        System.out.println("return:" + res);

        //一个参数有返回值
        ReturnOneParam returnOneParam = (int a) -> {
            System.out.println("ReturnOneParam param:" + a);
            return 1;
        };

        int res2 = returnOneParam.method(6);
        System.out.println("return:" + res2);

        //多个参数有返回值
        ReturnMultiParam returnMultiParam = (int a, int b) -> {
            System.out.println("ReturnMultiParam param:" + "{" + a + "," + b +"}");
            return 1;
        };

        int res3 = returnMultiParam.method(6, 8);
        System.out.println("return:" + res3);
    }
}
```

#### 1.5 简写规则

- 简化参数类型，可以不写参数类型，但是必须所有参数都不写
- 简化参数小括号，如果只有一个参数则可以省略参数小括号
- 简化方法体大括号，如果方法条只有一条语句，则可以省略方法体大括号
- 简化返回值，如果方法体只有一条语句，并且是 return 语句，则可以省略方法体大括号和return 关键字

```java
public class Test {
    public static void main(String[] args) {

        //1.简化参数类型，可以不写参数类型，但是必须所有参数都不写
        NoReturnMultiParam lamdba1 = (a, b) -> {
            System.out.println("简化参数类型");
        };
        lamdba1.method(1, 2);

        //2.简化参数小括号，如果只有一个参数则可以省略参数小括号
        NoReturnOneParam lambda2 = a -> {
            System.out.println("简化参数小括号");
        };
        lambda2.method(1);

        //3.简化方法体大括号，如果方法条只有一条语句，则可以胜率方法体大括号
        NoReturnNoParam lambda3 = () -> System.out.println("简化方法体大括号");
        lambda3.method();

        //4.简化返回值，如果方法体只有一条语句，并且是 return 语句，则可以省略方法体大括号
        ReturnOneParam lambda4 = a -> a+3;
        System.out.println(lambda4.method(5));
        
        ReturnMultiParam lambda5 = (a, b) -> a+b;
        System.out.println(lambda5.method(1, 1));
    }
}
```

#### 1.6  表达式引用方法

有时候我们不是必须要自己重写某个匿名内部类的方法，我们可以可以利用 lambda表达式的接口快速指向一个已经被实现的方法。

语法: `方法归属者::方法名` 静态方法的归属者为类名，普通方法归属者为对象

```java
public class Exe1 {
    public static void main(String[] args) {
        
        ReturnOneParam lambda1 = a -> doubleNum(a);
        System.out.println(lambda1.method(3));
        
		// ReturnOneParam 接口是有返回值一个参数的和Exe1类的doubleNum的方法参数和返回值一致
        // 可以将对象Exe1类的doubleNum方法指向ReturnOneParam函数式接口声明的变量
        ReturnOneParam lambda2 = Exe1::doubleNum;
        System.out.println(lambda2.method(3));

        Exe1 exe = new Exe1();
        // ReturnOneParam 接口是有返回值一个参数的和exe对象的addTwo的方法参数和返回值一致
        // 可以将对象exe的addTwo方法指向ReturnOneParam函数式接口声明的变量
        ReturnOneParam lambda4 = exe::addTwo;
        System.out.println(lambda4.method(2));
    }

    public static int doubleNum(int a) {
        return a * 2;
    }

    public int addTwo(int a) {
        return a + 2;
    }
}
```

一般我们需要声明接口，该接口作为对象的生成器，通过 `类名::new` 的方式来实例化对象，然后调用方法返回对象

```java
@FunctionalInterface
interface ItemCreatorBlankConstruct {
    Item getItem();
}
@FunctionalInterface
interface ItemCreatorParamContruct {
    Item getItem(int id, String name, double price);
}

public class Exe2 {
    public static void main(String[] args) {
        ItemCreatorBlankConstruct creator = () -> new Item();
        Item item = creator.getItem();

        ItemCreatorBlankConstruct creator2 = Item::new;
        Item item2 = creator2.getItem();

        ItemCreatorParamContruct creator3 = Item::new;
        Item item3 = creator3.getItem(111, "鼠标", 126.44);
    }
}
```

#### 1.7 Lambda 表达式中的闭包问题

这个问题我们在匿名内部类中也会存在，如果我们把注释放开会报错，告诉我 num 值是 final 不能被改变。这里我们虽然没有标识 num 类型为 final，但是在编译期间虚拟机会帮我们加上 final 修饰关键字，final 修饰的值是不可以更改的。

```java
public class Main {
    public static void main(String[] args) {
        int num = 10;
        Consumer<String> consumer = ele -> {
            System.out.println(num);
        };
        //num = num + 2;
        consumer.accept("hello");
    }
}
```

### 二，Stream

Stream的操作可以分为两大类：中间操作、终结操作

中间操作可分为：

- 无状态（Stateless）操作：指元素的处理不受之前元素的影响

- 有状态（Stateful）操作：指该操作只有拿到所有元素之后才能继续下去

终结操作可分为：

- 短路（Short-circuiting）操作：指遇到某些符合条件的元素就可以得到最终结果
- 非短路（Unshort-circuiting）操作：指必须处理完所有元素才能得到最终结果

#### 2.1 中间操作符

| 流方法   | 含义                                                         |
| -------- | ------------------------------------------------------------ |
| filter   | 用于通过设置的条件过滤出元素                                 |
| map      | 与转换类似，但其中的细微差别在于它是“创建一个新版本”而不是去修改 |
| distinct | 去重根据流所生成元素的hashCode和equals方法实现               |
| sorted   | 返回排序后的流                                               |
| limit    | 会返回一个不超过给定长度的流                                 |
| skip     | 返回一个扔掉了前n个元素的流                                  |
| flatMap  | 使用flatMap方法的效果是，各个数组并不是分别映射成一个流，而是映射成流的内容。所有使用map(Arrays::stream)时生成的单个流都被合并起来，即扁平化为一个流 |
| peek     | 对元素进行遍历处理                                           |

创建一批数据下面测试方法时使用：

```java
private static List<User> getUserList() {
	List<User> userList = new ArrayList<>();
	userList.add(new User(1,"张三",18,"上海"));
	userList.add(new User(2,"王五",16,"上海"));
	userList.add(new User(3,"李四",20,"上海"));
	userList.add(new User(4,"张雷",22,"北京"));
	userList.add(new User(5,"张超",15,"深圳"));
	userList.add(new User(6,"李雷",24,"北京"));
	userList.add(new User(7,"王爷",21,"上海"));
	userList.add(new User(8,"张三丰",18,"广州"));
	userList.add(new User(9,"赵六",16,"广州"));
	userList.add(new User(10,"赵无极",26,"深圳"));
	return userList;
}
```

##### 2.1.1 filter 

> 用于通过设置的条件过滤出元素

```java
// 过滤id > 6 的用户
List<User> userList = getUserList();
List<User> filetrUserList = userList.stream().filter(user -> user.getId() > 6).collect(Collectors.toList());
filetrUserList.forEach(System.out::println);
```

结果：

```
User(id=7, name=王爷, age=21, ads=上海)
User(id=8, name=张三丰, age=18, ads=广州)
User(id=9, name=赵六, age=16, ads=广州)
User(id=10, name=赵无极, age=26, ads=深圳)
```



##### 2.1.2 map

> 与转换类似，但其中的细微差别在于它是“创建一个新版本”而不是去修改

```java
// 将用户名称取出，转换成String集合
List<User> userList = getUserList();
List<String> mapUserList = userList.stream().map(user -> user.getName()).collect(Collectors.toList());
mapUserList.forEach(System.out::println);
```

结果：

```
张三
王五
李四
张雷
张超
李雷
王爷
张三丰
赵六
赵无极
```

##### 2.1.3 distinct

> 去重根据流所生成元素的hashCode和equals方法实现

```java
// 根据城市去重
List<User> userList = getUserList();
List<String> distinctUsers =  userList.stream().map(User::getCity).distinct().collect(Collectors.toList());
distinctUsers.forEach(System.out::println);
```

结果：

```
上海
北京
深圳
广州
```

##### 2.1.4 sorted

> 返回排序后的流

```java
// 排序，根据名字倒序
List<User> userList = getUserList();
userList.stream().sorted(Comparator.comparing(User::getName).reversed())
    .collect(Collectors.toList())
	.forEach(System.out::println);
```

结果：

```
User(id=10, name=赵无极, age=26, city=深圳)
User(id=9, name=赵六, age=16, city=广州)
User(id=7, name=王爷, age=21, city=上海)
User(id=2, name=王五, age=16, city=上海)
User(id=6, name=李雷, age=24, city=北京)
User(id=3, name=李四, age=20, city=上海)
User(id=4, name=张雷, age=22, city=北京)
User(id=5, name=张超, age=15, city=深圳)
User(id=8, name=张三丰, age=18, city=广州)
User(id=1, name=张三, age=18, city=上海)
```

##### 2.1.5 limit

> 会返回一个不超过给定长度的流

```java
// 取前5条数据
List<User> userList = getUserList();
userList.stream().limit(5)
	.collect(Collectors.toList())
	.forEach(System.out::println);
```

结果：

```
User(id=1, name=张三, age=18, city=上海)
User(id=2, name=王五, age=16, city=上海)
User(id=3, name=李四, age=20, city=上海)
User(id=4, name=张雷, age=22, city=北京)
User(id=5, name=张超, age=15, city=深圳)
```

##### 2.1.6 skip

> 返回一个扔掉了前n个元素的流

```java
// 跳过第几条取后几条
List<User> userList = getUserList();
userList.stream().skip(7)
    .collect(Collectors.toList())
    .forEach(System.out::println);
```

结果：

```
User(id=8, name=张三丰, age=18, city=广州)
User(id=9, name=赵六, age=16, city=广州)
User(id=10, name=赵无极, age=26, city=深圳)
```

##### 2.1.7 flatMap

> 使用flatMap方法的效果是，各个数组并不是分别映射成一个流，而是映射成流的内容。所有使用map(Arrays::stream)时生成的单个流都被合并起来，即扁平化为一个流

```
//数据拆分一对多映射
List<User> userList = getUserList();
userList.stream().flatMap(user -> Arrays.stream(user.getName().split(",")))
.forEach(System.out::println);
```

结果：

```
张三
王五
李四
张雷
张超
李雷
王爷
张三丰
赵六
赵无极
```

map：对流中每一个元素进行处理
flatMap：流扁平化，让你把一个流中的“每个值”都换成另一个流，然后把所有的流连接起来成为一个流 
本质区别：map是对一级元素进行操作，flatmap是对二级元素操作，map返回一个值；flatmap返回一个流，多个值。

应用场景：map对集合中每个元素加工,返回加工后结果；flatmap对集合中每个元素加工后，做扁平化处理后，拆分层级，放到同一层然后返回

##### 2.1.8 peek

```java
// 对元素进行遍历处理，每个用户ID加1输出
List<User> userList = getUserList();
userList.stream().peek(user -> user.setId(user.getId()+1))
.forEach(System.out::println);
```

结果：

```
User(id=2, name=张三, age=18, city=上海)
User(id=3, name=王五, age=16, city=上海)
User(id=4, name=李四, age=20, city=上海)
User(id=5, name=张雷, age=22, city=北京)
User(id=6, name=张超, age=15, city=深圳)
User(id=7, name=李雷, age=24, city=北京)
User(id=8, name=王爷, age=21, city=上海)
User(id=9, name=张三丰, age=18, city=广州)
User(id=10, name=赵六, age=16, city=广州)
User(id=11, name=赵无极, age=26, city=深圳)
```

#### 2.2 终端操作符

| 流方法    | 含义                                   |
| --------- | -------------------------------------- |
| collect   | 收集器，将流转换为其他形式             |
| forEach   | 遍历流                                 |
| findFirst | 返回第一个元素                         |
| findAny   | 将返回当前流中的任意元素               |
| count     | 返回流中元素总数                       |
| sum       | 求和                                   |
| max       | 最大值                                 |
| min       | 最小值                                 |
| anyMatch  | 检查是否至少匹配一个元素，返回boolean  |
| allMatch  | 检查是否匹配所有元素，返回boolean      |
| noneMatch | 检查是否没有匹配所有元素，返回boolean  |
| reduce    | 可以将流中元素反复结合起来，得到一个值 |

##### 2.2.1 collect

> 收集器，将流转换为其他形式

```java
// 将流转换为其他形式
List<User> userList = getUserList();
Set set = userList.stream().collect(Collectors.toSet());
set.forEach(System.out::println);
```

结果：

```
User(id=2, name=王五, age=16, city=上海)
User(id=9, name=赵六, age=16, city=广州)
User(id=1, name=张三, age=18, city=上海)
User(id=4, name=张雷, age=22, city=北京)
User(id=6, name=李雷, age=24, city=北京)
User(id=8, name=张三丰, age=18, city=广州)
User(id=5, name=张超, age=15, city=深圳)
User(id=3, name=李四, age=20, city=上海)
User(id=7, name=王爷, age=21, city=上海)
User(id=10, name=赵无极, age=26, city=深圳)
```

##### 2.2.2 forEach

>   遍历流

```java
 // 遍历流
 List<User> userList = getUserList();
 userList.forEach(System.out::println);
```

结果：

```
User(id=1, name=张三, age=18, city=上海)
User(id=2, name=王五, age=16, city=上海)
User(id=3, name=李四, age=20, city=上海)
User(id=4, name=张雷, age=22, city=北京)
User(id=5, name=张超, age=15, city=深圳)
User(id=6, name=李雷, age=24, city=北京)
User(id=7, name=王爷, age=21, city=上海)
User(id=8, name=张三丰, age=18, city=广州)
User(id=9, name=赵六, age=16, city=广州)
User(id=10, name=赵无极, age=26, city=深圳)
```

##### 2.2.3 findFirst

>   返回第一个元素

```java
// 返回第一个元素
List<User> userList = getUserList();
User firstUser = userList.stream().findFirst().get();
System.out.println(firstUser);
```

结果：

```
User(id=1, name=张三, age=18, city=上海)
```

##### 2.2.4 findAny

>  将返回当前流中的任意元素

```java
// 将返回当前流中的任意元素
List<User> userList = getUserList();
User firstUser = userList.stream().findAny().get();
System.out.println(firstUser);
```

##### 2.2.5 count

>  返回流中元素总数

```java
// 返回流中元素总数
List<User> userList = getUserList();
long count = userList.stream().filter(user -> user.getAge() > 20).count();
System.out.println(count);
```

结果：

```
4
```

##### 2.2.6 sum

>  求和

```
// 求和id
List<User> userList = getUserList();
int sum = userList.stream().mapToInt(User::getId).sum();
System.out.println(sum);
```

结果：

```
55
```

##### 2.2.7 max

> 最大值

```java
 // id最大值
 List<User> userList = getUserList();
 int max = userList.stream().max(Comparator.comparingInt(User::getId)).get().getId();
 System.out.println(max);
```

结果：

```
10
```

##### 2.2.8 min

> 最小值 

```java
 // id最小值
 List<User> userList = getUserList();
 int max = userList.stream().min(Comparator.comparingInt(User::getId)).get().getId();
 System.out.println(max);
```

结果：

```
1
```

##### 2.2.9 anyMatch

> 检查是否至少匹配一个元素，返回boolean

```java
 // 检查是否至少匹配一个元素
 List<User> userList = getUserList();
 boolean matchAny = userList.stream().anyMatch(user -> "北京".equals(user.getCity()));
 System.out.println(matchAny);
```

结果：

```
true
```

##### 2.2.10 allMatch

> 检查是否匹配所有元素，返回boolean

```java
 // 检查是否至少匹配一个元素
 List<User> userList = getUserList();
 boolean allMatch = userList.stream().allMatch(user -> "北京".equals(user.getCity()));
 System.out.println(allMatch);
```

结果：

```
false
```

##### 2.2.11 noneMatch

> 检查是否没有匹配所有元素，返回boolean

```java
 // 检查是否至少匹配一个元素
 List<User> userList = getUserList();
 boolean noneMatch = userList.stream().noneMatch(user -> "北京".equals(user.getCity()));
 System.out.println(noneMatch);
```

结果：

```
false
```

##### 2.2.12 reduce

> 可以将流中元素反复结合起来，得到一个值

```java
  // 将流中元素反复结合起来，得到一个值
  List<User> userList = getUserList();
  Optional reduce = userList.stream().reduce((user, user2) -> {
 	 return user;
  });
  if(reduce.isPresent()) System.out.println(reduce.get());
```

结果：

```
User(id=1, name=张三, age=18, city=上海)
```

#### 2.3 Collect收集

Collector：结果收集策略的核心接口，具备将指定元素累加存放到结果容器中的能力；并在Collectors工具中提供了Collector接口的实现类.

##### 2.3.1 toList

```java
// 将用户ID存放到List集合中
List<Integer> idList = userList.stream().map(User::getId).collect(Collectors.toList()) ;
```

##### 2.3.2 toMap

```java
// 将用户ID和Name以Key-Value形式存放到Map集合中
Map<Integer,String> userMap = userList.stream().collect(Collectors.toMap(User::getId,User::getName));
```

##### 2.3.3 toSet

```java
// 将用户所在城市存放到Set集合中
Set<String> citySet = userList.stream().map(User::getCity).collect(Collectors.toSet());
```

##### 2.3.4 counting

```java
 // 符合条件的用户总数
long count = userList.stream().filter(user -> user.getId()>1).collect(Collectors.counting());
```

##### 2.3.5 summingInt

```java
// 对结果元素即用户ID求和
Integer sumInt = userList.stream().filter(user -> user.getId()>2).collect(Collectors.summingInt(User::getId)) ;
```

##### 2.3.6 minBy

```java
// 筛选元素中ID最小的用户
User maxId = userList.stream().collect(Collectors.minBy(Comparator.comparingInt(User::getId))).get() ;
```

##### 2.3.7 joining

```java
// 将用户所在城市，以指定分隔符链接成字符串；
String joinCity = userList.stream().map(User::getCity).collect(Collectors.joining("||"));
```

##### 2.3.8 groupingBy

```java
// 按条件分组，以城市对用户进行分组；
Map<String,List<User>> groupCity = userList.stream().collect(Collectors.groupingBy(User::getCity));
```

##### 2.3.9 orElse(null)和orElseGet(null)

orElse(null)：表示如果一个都没找到返回null（orElse()中可以塞默认值。如果找不到就会返回orElse中设置的默认值）

```java
public T orElse(T other) {
        return value != null ? value : other;
}
```

orElseGet(null)：表示如果一个都没找到返回null（orElseGet()中可以塞默认值。如果找不到就会返回orElseGet中设置的默认值）

orElse（） 接受类型T的 任何参数，而orElseGet（）接受类型为Supplier的函数接口，该接口返回类型为T的对象

```java
public T orElseGet(Supplier<? extends T> other) {
        return value != null ? value : other.get();
}
```

orElse(null)和orElseGet(null)区别：

- 当返回Optional的值是空值null时，无论orElse还是orElseGet都会执行
- 当返回的Optional有不是空值null时，orElse会执行，而orElseGet不会执行

```java
public class TestTemp {
    public static void main(String[] args) {
        List<User> userList = getUserList();
        User a =  userList.stream().filter(userT-> userT.getAge() == 12).findFirst().orElse(getMethod("a"));
        User b =  userList.stream().filter(userT11-> userT11.getAge() == 12).findFirst().orElseGet(()->getMethod("b"));
        //有值
        User c =  userList.stream().filter(userT2-> userT2.getAge() == 16).findFirst().orElse(getMethod("c"));
        User d =  userList.stream().filter(userT22-> userT22.getAge() == 16).findFirst().orElseGet(()->getMethod("d"));
        System.out.println("a："+a);
        System.out.println("b："+b);
        System.out.println("c："+c);
        System.out.println("d："+d);


    }
    private static List<User> getUserList() {
        List<User> userList = new ArrayList<>();
        userList.add(new User(1,"张三",18,"上海"));
        userList.add(new User(2,"王五",16,"上海"));
        userList.add(new User(3,"李四",20,"上海"));
        userList.add(new User(4,"张雷",22,"北京"));
        userList.add(new User(5,"张超",15,"深圳"));
        userList.add(new User(6,"李雷",24,"北京"));
        userList.add(new User(7,"王爷",21,"上海"));
        userList.add(new User(8,"张三丰",18,"广州"));
        userList.add(new User(9,"赵六",16,"广州"));
        userList.add(new User(10,"赵无极",26,"深圳"));
        return userList;
    }
    public static User getMethod(String name){
        System.out.println(name + "执行了方法");
        return null;
    }
}
```

结果：

```
a执行了方法
b执行了方法
c执行了方法
a：null
b：null
c：User(id=2, name=王五, age=16, city=上海)
d：User(id=2, name=王五, age=16, city=上海)
```

参考链接：https://blog.csdn.net/MinggeQingchun/article/details/123184273
