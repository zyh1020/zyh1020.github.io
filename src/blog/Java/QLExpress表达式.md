---
icon: file-lines
title: QLExpress表达式
author: Ms.Zyh
date: 2023-05-09
category:
  - Java
tag:
  - 必看
  - Java
sticky: false
star: false
---

### 一，背景介绍
由阿里的电商业务规则、表达式（布尔组合）、特殊数学公式计算（高精度）、语法分析、脚本二次定制等强需求而设计的一门动态脚本引擎解析工具。
在阿里集团有很强的影响力，同时为了自身不断优化、发扬开源贡献精神，于2012年开源。
QLExpress脚本引擎被广泛应用在阿里的电商业务场景，具有以下的一些特性:
- 线程安全，引擎运算过程中的产生的临时变量都是threadlocal类型。
- 高效执行，比较耗时的脚本编译过程可以缓存在本地机器，运行时的临时变量创建采用了缓冲池的技术，和groovy性能相当。
- 弱类型脚本语言，和groovy，javascript语法类似，虽然比强类型脚本语言要慢一些，但是使业务的灵活度大大增强。
- 安全控制,可以通过设置相关运行参数，预防死循环、高危系统api调用等情况。
- 代码精简，依赖最小，250k的jar包适合所有java的运行环境，在android系统的低端pos机也得到广泛运用。

### 二，简单案例

导入jar包：
```pom
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>QLExpress</artifactId>
    <version>3.2.0</version>
</dependency>
```
简单使用：
```java
@Test
void test() throws Exception {
    // 表达式执行器
    ExpressRunner runner = new ExpressRunner();
    // 存储表达式执行变量的上下文
    DefaultContext<String, Object> context = new DefaultContext<>();
    context.put("a",1);
    context.put("b",2);
    context.put("c",3);
    // 简单的表达式
    String express = "a + b * c"; 
    // 通过执行器执行表达式
    Object execute = runner.execute(express, context, null, true, false);
    System.out.println(execute);
}

//支持 +,-,*,/,<,>,<=,>=,==,!=,<>【等同于!=】,%,mod【取模等同于%】,++,--,
//in【类似sql】,like【sql语法】,&&,||,!,等操作符
//支持for，break、continue、if then else 等标准的程序控制逻辑
@Test
void test() throws Exception {
    String express = "n = 10;\n" +
            "sum = 0;\n" +
            "for(i = 0; i < n; i++) {\n" +
            "   sum = sum + i;\n" +
            "}\n" +
            "return sum;";
    ExpressRunner runner = new ExpressRunner();
    DefaultContext<String, Object> context = new DefaultContext<>();
    Object result = runner.execute(express, context, null, true, false);
    System.out.println(result);// 输出：45
}
```
#### 2.1 和java语法相比
- 要避免的一些ql写法错误
- 不支持`try{}catch{}`
- 注释目前只支持 `/** **/`，不支持单行注释 `//`
- 不支持java8的lambda表达式
- 不支持for循环集合操作`for (Item item : list)`
- 弱类型语言，请不要定义类型声明,更不要用Template（Map<String, List>之类的）
- array的声明不一样
- min,max,round,print,println,like,in 都是系统默认函数的关键字，请不要作为变量名


```java
//java语法：使用泛型来提醒开发者检查类型
keys = new ArrayList<String>();
deviceName2Value = new HashMap<String, String>(7);
String[] deviceNames = {"ng", "si", "umid", "ut", "mac", "imsi", "imei"};
int[] mins = {5, 30};
 
//ql写法：
keys = new ArrayList();
deviceName2Value = new HashMap();
deviceNames = ["ng", "si", "umid", "ut", "mac", "imsi", "imei"];
mins = [5, 30];
 
//java语法：对象类型声明
FocFulfillDecisionReqDTO reqDTO = param.getReqDTO();
//ql写法：
reqDTO = param.getReqDTO();
 
//java语法：数组遍历
for(Item item : list) {
}
//ql写法：
for(i = 0; i < list.size(); i++){
    item = list.get(i);
}
 
//java语法：map遍历
for(String key : map.keySet()) {
    System.out.println(map.get(key));
}
//ql写法：
keySet = map.keySet();
objArr = keySet.toArray();
for (i = 0; i < objArr.length; i++) {
    key = objArr[i];
    System.out.println(map.get(key));
}
```
#### 2.2 java对象操作
```java
import com.ql.util.express.test.OrderQuery;
//系统自动会import java.lang.*,import java.util.*;
 
query = new OrderQuery();           // 创建class实例，自动补全类路径
query.setCreateDate(new Date());    // 设置属性
query.buyer = "张三";                // 调用属性，默认会转化为setBuyer("张三")
result = bizOrderDAO.query(query);  // 调用bean对象的方法
System.out.println(result.getId()); // 调用静态方法
脚本函数
@Test
void test11() throws Exception {
    String e = "function add(int a, int b){\n" +
            "    return a + b;\n" +
            "};\n" +
            " \n" +
            "function sub(int a, int b){\n" +
            "    return a - b;\n" +
            "};\n" +
            " \n" +
            "return add(c, d) + sub(c, d);";
    ExpressRunner runner = new ExpressRunner();
    IExpressContext<String, Object> context = new DefaultContext<>();
    context.put("c", 100);
    context.put("d", 10);
    Object result = runner.execute(e, context, null, false, false);
    System.out.println(result);
}
```

#### 2.3 集合操作
```java
@Test
public void testSet() throws Exception {
    ExpressRunner runner = new ExpressRunner(false, false);
    DefaultContext<String, Object> context = new DefaultContext<String, Object>();
    String express = "abc = NewMap(1:1, 2:2); return abc.get(1) + abc.get(2);";
    Object r = runner.execute(express, context, null, false, false);
    System.out.println(r);
    express = "abc = NewList(1, 2, 3); return abc.get(1) + abc.get(2)";
    r = runner.execute(express, context, null, false, false);
    System.out.println(r);
    express = "abc = [1, 2, 3]; return abc[1] + abc[2];";
    r = runner.execute(express, context, null, false, false);
    System.out.println(r);
}
```
### 三，ExpressRunner的属性
#### 3.1 isPrecise
```java
/**
 * 是否需要高精度计算
 */
private boolean isPrecise;
```
赋值方式：
```java
/**
* 无参构造isPrecise默认false
*/
public ExpressRunner() {
    this(false, false);
}
/**
* 可以通过构造参数的方式指定isPrecise值
*/
public ExpressRunner(boolean isPrecise, boolean isTrace) {
    this(isPrecise, isTrace, new DefaultExpressResourceLoader(), (NodeTypeManager)null);
}
```
作用：高精度计算在会计财务中非常重要，java的float、double、int、long存在很多隐式转换，做四则运算和比较的时候其实存在非常多的安全隐患。所以类似汇金的系统中，会有很多BigDecimal转换代码。而使用QLExpress，你只要关注数学公式本身 订单总价 = 单价 * 数量 + 首重价格 + （ 总重量 - 首重） * 续重单价 ，然后设置这个属性为true即可，所有的中间运算过程都会保证不丢失精度。
#### 3.2 isTrace
```java
/**
 * 是否输出所有的跟踪信息，同时还需要log级别是DEBUG级别
 */
private boolean isTrace;
```
赋值方式：
```java
/**
* 无参构造isTrace默认false
*/
public ExpressRunner() {
    this(false, false);
}
/**
* 可以通过构造参数的方式指定isTrace值
*/
public ExpressRunner(boolean isPrecise, boolean isTrace) {
    this(isPrecise, isTrace, new DefaultExpressResourceLoader(), (NodeTypeManager)null);
}
```
作用：这个主要是是否输出脚本的编译解析过程，一般对于业务系统来说关闭之后会提高性能。
#### 3.3 isShortCircuit
```java
/**
 * 是否使用逻辑短路特性
 */
private boolean isShortCircuit;
```
赋值方式：
```java
ExpressRunner runner = new ExpressRunner();
runner.setShortCircuit(false);
```
作用：在很多业务决策系统中，往往需要对布尔条件表达式进行分析输出，普通的java运算一般会通过逻辑短路来减少性能的消耗。例如规则公式：
`star > 10000 and shopType in ('tmall', 'juhuasuan') and price between (100, 900)`
假设第一个条件 star>10000 不满足就停止运算。但业务系统却还是希望把后面的逻辑都能够运算一遍，并且输出中间过程，保证更快更好的做出决策。
### 四，ExpressRunner的方法
#### 4.1 执行脚本
```java
Object execute(String expressString, IExpressContext<String, Object> context, List<String> errorList, boolean isCache, boolean isTrace);
```
该方法是ExpressRunner的通过调用该方法来执行脚本，参数介绍如下：
- expressString：程序文本，即要执行的QLExpress脚本。
- context：执行上下文，包含变量和其他环境信息。这是一个 IExpressContext<String, Object> 类型的对象，用于存储和传递脚本中所需的变量和数据。可以扩展为包含ApplicationContext从spring容器中获取变量值。
- errorList：输出的错误信息List
- isCache：是否使用Cache中的指令集。建议设置为 true，以提高执行效率。Cache会缓存已经编译过的脚本，避免重复编译。
- isTrace：是否输出详细的执行指令信息。建议设置为 false，除非需要详细的执行过程信息进行调试。
- 返回值：返回执行脚本的结果
使用案例：
``` java
ExpressRunner runner = new ExpressRunner();
DefaultContext<String, Object> context = new DefaultContext<String, Object>();
context.put("a", 1);
context.put("b", 2);
context.put("c", 3);
String express = "a + b * c";
Object r = runner.execute(express, context, null, true, false);
System.out.println(r);
```
上面提到参数`IExpressContext<String, Object>  context`，用于存储和传递脚本中所需的变量和数据，可以扩展为包含ApplicationContext从spring容器中获取变量值，在实际中我们很希望能够无缝的集成到spring框架中，可以仿照下面的例子使用一个子类：
```
public class QLExpressContext extends HashMap<String, Object> implements IExpressContext<String, Object> {
    private final ApplicationContext context;
 
    // 构造函数，传入context 和 ApplicationContext
    public QLExpressContext(Map<String, Object> map, ApplicationContext aContext) {
        super(map);
        this.context = aContext;
    }
 
    /**
     * 抽象方法：根据名称从属性列表中提取属性值
     */
    public Object get(Object name) {
        Object result;
        result = super.get(name);
        try {
            if (result == null && this.context != null && this.context.containsBean((String)name)) {
                // 如果在Spring容器中包含bean，则返回String的Bean
                result = this.context.getBean((String)name);
            }
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return result;
    }
 
    public Object put(String name, Object object) {
        return super.put(name, object);
    }
}
```
#### 4.2 操作符相关函数
```java
// 1，添加操作符和关键字的别名
void addOperatorWithAlias(String keyWordName, String realKeyWordName, String errorInfo);

// 2，添加操作符号,可以设置优先级
void addOperator(String name, Operator op);
void addOperator(String name, String aRefOpername, Operator op);
 
// 3，替换操作符处理
OperatorBase replaceOperator(String name, OperatorBase op);
```
关键字起别名使用案例：
```java
@Test
void test() throws Exception {
    ExpressRunner runner = new ExpressRunner();
    runner.addOperatorWithAlias("如果", "if", null);
    runner.addOperatorWithAlias("则", "then", null);
    runner.addOperatorWithAlias("否则", "else", null);
    DefaultContext<String, Object> context = new DefaultContext<String, Object>();
    context.put("语文",100);
    context.put("数学",100);
    context.put("英语",100);
    String express = "如果 (语文 + 数学 + 英语 > 270) 则 {return 1;} 否则 {return 0;}";
    Object execute = runner.execute(express, context, null, false, false);
    System.out.println(execute); // 输出：1
    String express1 = "if (语文 + 数学 + 英语 > 270) then {return 1;} else {return 0;}";
    Object execute1 = runner.execute(express1, context, null, false, false);
    System.out.println(execute1);// 输出：1

}
```
#### 4.3 自定义操作符
```java
/**
* 自定义函数/自定义操作符号
*/
public class JoinOperator extends Operator {
    public Object executeInner(Object[] list) throws Exception {
        Object opdata1 = objects[0];
        Object opdata2 = objects[1];
        if (opdata1 instanceof List) {
            ((List)opdata1).add(opdata2);
            return opdata1;
        } else {
            List result = new ArrayList();
            for (Object opdata : objects) {
                result.add(opdata);
            }
            return result;
        }
    }
}
@Test
void test() throws Exception {
    ExpressRunner runner = new ExpressRunner();
    runner.addOperator("join",new JoinOperator());
    Object execute = runner.execute("1 join 2 join 3", null, null, true, false);
    System.out.println(execute);
    OperatorBase join = runner.getFunction("join");
    System.out.println(join);
}
```
#### 4.4 通过操作符的方式添加函数
添加和获取函数：
```java
//通过name获取function的定义
OperatorBase getFunciton(String name);
//通过自定义的Operator来实现，添加函数
void addFunction(String name, OperatorBase op);
```
使用案例：
```java
/**
* 自定义函数/自定义操作符号
*/
public class JoinOperator extends Operator {
    public Object executeInner(Object[] list) throws Exception {
        List result = new ArrayList();
        Object opdata = list[0];
        if (opdata instanceof List) {
            result.addAll((List)opdata);
        } else {
            result.add(opdata);
        }
        for (int i = 1; i < list.length; i++) {
            result.add(list[i]);
        }
        return result;
    }
}
@Test
void test() throws Exception {
    ExpressRunner expressRunner = new ExpressRunner();
    // 添加函数
    expressRunner.addFunction("join",new JoinOperator());
    // 获取函数
    OperatorBase operatorBase = expressRunner.getFunction("join");
    System.out.println("operatorBase:"+operatorBase); // 输出：operatorBase:join
    if(operatorBase instanceof JoinOperator){
        JoinOperator  joinOperator = (JoinOperator)operatorBase;
        System.out.println(joinOperator.executeInner(new Object[]{1,2,3})); // 输出：[1, 2, 3]
    }
    Object execute = expressRunner.execute("return join(1,2,3);", null,Arrays.asList("报错提示"), true, false);
    System.out.println(execute); // 输出：[1, 2, 3] 
}
```
#### 4.5 通过java类或对象方式添加函数
```java
// 添加对象方法
void addFunctionOfServiceMethod(String name, Object aServiceObject, String aFunctionName, Class<?>[] aParameterClassTypes, String errorInfo);
 
// 添加类方法
void addFunctionOfClassMethod(String name, String aClassName, String aFunctionName, Class<?>[] aParameterClassTypes, String errorInfo);
 ```
使用案例：
```
/**
* 定义java对象
*/
public class BeanExample {
    public static String upper(String abc) {
        return abc.toUpperCase();
    }
    public boolean anyContains(String str, String searchStr) {
        char[] s = str.toCharArray();
        for (char c : s) {
            if (searchStr.contains(c+"")) {
                return true;
            }
        }
        return false;
    }
}
 @Test
void test() throws Exception {
    ExpressRunner runner = new ExpressRunner();
    runner.addFunctionOfClassMethod("upper", BeanExample.class.getName(), "upper", new String[] {"String"}, null);
    runner.addFunctionOfServiceMethod("contains", new BeanExample(), "anyContains", new Class[] {String.class, String.class}, null);
    DefaultContext<String, Object> expressContext = new DefaultContext<>();
    expressContext.put("a","abc");
    expressContext.put("b","bc");
    Object execute = runner.execute("upper(a)", expressContext, Arrays.asList("报错信息！"), true, false);
    System.out.println(execute); // 输出：ABC
    Object execute2 = runner.execute("contains(a,b)", expressContext, Arrays.asList("报错信息！"), true, false);
    System.out.println(execute2); // 输出：true
}
``` 
#### 4.6 宏相关函数
```java
// 类似于mybatis中公共sql片段
void addMacro(String macroName, String express);
使用案例：
@Test
void test() throws Exception {
    ExpressRunner runner = new ExpressRunner();
    runner.addMacro("计算平均成绩", "(语文+数学+英语)/3.0");
    runner.addMacro("是否优秀", "计算平均成绩>90");
    IExpressContext<String, Object> context = new DefaultContext<String, Object>();
    context.put("语文", 99);
    context.put("数学", 99);
    context.put("英语", 95);
    Object result = runner.execute("是否优秀", context, null, false, false);
    System.out.println(result);
}
```
#### 4.7 语法相关函数
```java
// 获取一个表达式需要的外部变量名称列表
String[] getOutVarNames(String express);
// 获取一个表达式需要的函数名称列表
String[] getOutFunctionNames(String express);
// 如果调用过程不出现异常，指令集instructionSet就可以被加载运行（execute）
ExpressRunner runner = new ExpressRunner();
InstructionSet instructionSet = runner.parseInstructionSet(express);
```
使用案例：
```
@Test
void test() throws Exception {
    String e = "function add(int a, int b){\n" +
            "    return a + b;\n" +
            "};\n" +
            " \n" +
            "function sub(int a, int b){\n" +
            "    return a - b;\n" +
            "};\n" +
            " \n" +
            "return add(c, d) + sub(c, d);";
    IExpressContext<String, Object> context = new DefaultContext<>();
    context.put("c", 100);
    context.put("d", 10);
    ExpressRunner runner = new ExpressRunner();
    Object result = runner.execute(e, context, null, false, false);
    System.out.println(result);
    String[] outFunctionNames = runner.getOutFunctionNames(e);
    for (String outFunctionName : outFunctionNames) {
        System.out.println("----->outFunctionName:"+outFunctionName);
    }
    String[] outVarNames = runner.getOutVarNames(e);
    for (String outVarName : outVarNames) {
        System.out.println("----->outVarName:"+outVarName);
    }
    try {
        InstructionSet instructionSet = runner.parseInstructionSet(e);
    } catch (Exception ex) {
        throw new RuntimeException(ex);
    }
}
```
输出结果：
```
----->outVarName:c
----->outVarName:d
```
#### 4.8 安全相关函数
```java
ExpressRunner runner = new ExpressRunner();
QLExpressRunStrategy.setForbiddenInvokeSecurityRiskMethods(true);
DefaultContext<String, Object> context = new DefaultContext<String, Object>();
try {
    express = "System.exit(1);";
    Object r = runner.execute(express, context, null, true, false);
    System.out.println(r);
    throw new Exception("没有捕获到不安全的方法");
} catch (QLException e) {
    System.out.println(e);
}
```
在不同的场景下，应用可以配置不同的安全级别，安全级别由低到高：
- 黑名单控制：QLExpress 默认会阻断一些高危的系统 API, 用户也可以自行添加, 但是开放对 JVM 中其他所有类与方法的访问, 最灵活, 但是很容易被反射工具类绕过，只适用于脚本安全性有其他严格控制的场景，禁止直接运行终端用户输入
- 白名单控制：QLExpress 支持编译时白名单和运行时白名单机制, 编译时白名单设置到类级别, 能够在语法检查阶段就暴露出不安全类的使用, 但是无法阻断运行时动态生成的类(比如通过反射), 运行时白名单能够确保运行时只可以直接调用有限的 Java 方法, 必须设置了运行时白名单, 才算是达到了这个级别
- 沙箱模式：QLExpress 作为一个语言沙箱, 只允许通过自定义函数/操作符/宏与应用交互, 不允许与 JVM 中的类产生交互
##### 4.8.1 黑名单控制
QLExpess 目前默认添加的黑名单有：
- `java.lang.System.exit`
- `java.lang.Runtime.exec`
- `java.lang.ProcessBuilder.start`
- `java.lang.reflect.Method.invoke`
- `java.lang.reflect.Class.forName`
- `java.lang.reflect.ClassLoader.loadClass`
- `java.lang.reflect.ClassLoader.findClass`
同时支持通过 `QLExpressRunStrategy.addSecurityRiskMethod` 额外添加
`com.ql.util.express.example.MultiLevelSecurityTest#blockWhiteListControlTest`
```java
// 必须将该选项设置为 true
QLExpressRunStrategy.setForbidInvokeSecurityRiskMethods(true);
// 这里不区分静态方法与成员方法, 写法一致
// 不支持重载, riskMethod 的所有重载方法都会被禁止
QLExpressRunStrategy.addSecurityRiskMethod(RiskBean.class, "riskMethod");
ExpressRunner expressRunner = new ExpressRunner();
DefaultContext<String, Object> context = new DefaultContext<>();
try {
    expressRunner.execute("import com.ql.util.express.example.RiskBean;" +
                          "RiskBean.riskMethod()", context, null, true, false);
    fail("没有捕获到不安全的方法");
} catch (Exception e) {
    assertTrue(e.getCause() instanceof QLSecurityRiskException);
}
```
##### 4.8.2 编译期白名单
编译期白名单：编译期白名单是类维度的，脚本中只允许显式引用符合白名单条件的类，支持两种设置方式，精确设置某个类，以及设置某个类的全部子类。
案例：
```java
// 设置编译期白名单
QLExpressRunStrategy.setCompileWhiteCheckerList(Arrays.asList(
    // 精确设置
    CheckerFactory.must(Date.class),
    // 子类设置
    CheckerFactory.assignable(List.class)
));
ExpressRunner expressRunner = new ExpressRunner();
// Date 在编译期白名单中, 可以显示引用
expressRunner.execute("new Date()", new DefaultContext<>(), null,
                      false, true);
// LinkedList 是 List 的子类, 符合白名单要求
expressRunner.execute("LinkedList ll = new LinkedList; ll.add(1); ll.add(2); ll",
                      new DefaultContext<>(), null, false, true);
try {
    // String 不在白名单中, 不可以显示引用
    // 但是隐式引用, a = 'mmm', 或者定义字符串常量 'mmm' 都是可以的
    expressRunner.execute("String a = 'mmm'", new DefaultContext<>(), null,
                          false, true);
} catch (Exception e) {
    assertTrue(e.getCause() instanceof QLSecurityRiskException);
}
```

##### 4.8.3 运行期白名单
Math 不在白名单中,对于不满足编译期类型白名单的脚本无需运行, 即可通过 checkSyntax 检测出
`assertFalse(expressRunner.checkSyntax("Math.abs(-1)"));`
编译期白名单只能检测出脚本编译时能够确认的类型，任何运行时出现的类型都是无法检测的，诸如各种反射Class.forName, ClassLoader.loadClass，或者没有声明类型的变量等等，因为编译期白名单只能增加黑客的作案成本，是容易被绕过。因此建议编译期白名单只用来帮助脚本校验，如果需要接收终端用户输入，运行期白名单是务必要配置的。

> 注意：如果有白名单设置，所有的黑名单设置就都会无效，以白名单为准。默认没有白名单设置。
案例：
```java
// 必须将该选项设置为 true
QLExpressRunStrategy.setForbidInvokeSecurityRiskMethods(true);
// 有白名单设置时, 则黑名单失效
QLExpressRunStrategy.addSecureMethod(RiskBean.class, "secureMethod");
// 白名单中的方法, 允许正常调用
expressRunner.execute("import com.ql.util.express.example.RiskBean;" +
                      "RiskBean.secureMethod()", context, null, true, false);
try {
    // java.lang.String.length 不在白名单中, 不允许调用
    expressRunner.execute("'abcd'.length()", context,
                          null, true, false);
    fail("没有捕获到不安全的方法");
} catch (Exception e) {
    assertTrue(e.getCause() instanceof QLSecurityRiskException);
}
```
另一种方式：
```java
// setSecureMethods 设置方式
Set<String> secureMethods = new HashSet<>();
secureMethods.add("java.lang.String.length");
secureMethods.add("java.lang.Integer.valueOf");
QLExpressRunStrategy.setSecureMethods(secureMethods);
// 白名单中的方法, 允许正常调用
Object res = expressRunner.execute("Integer.valueOf('abcd'.length())", context,
                                   null, true, false);
assertEquals(4, res);
try {
    // java.lang.Long.valueOf 不在白名单中, 不允许调用
    expressRunner.execute("Long.valueOf('abcd'.length())", context,
                          null, true, false);
    fail("没有捕获到不安全的方法");
} catch (Exception e) {
    assertTrue(e.getCause() instanceof QLSecurityRiskException);
}
```
从上可以看出白名单有两种设置方式：
● 添加：`QLExpressRunStrategy.addSecureMethod`
● 置换：`QLExpressRunStrategy.setSecureMethods`
在应用中使用的时，推荐将白名单配置在诸如 etcd,configServer 等配置服务中，根据需求随时调整。

##### 4.8.4 沙箱模式
如果你厌烦上述复杂的配置，只是想完全关闭 QLExpress 和 Java 应用的自由交互，那么推荐使用沙箱模式。
在沙箱模式中，脚本不可以：
- import Java 类
- 显式引用 Java 类，比如 String a = 'mmm'
- 取 Java 类中的字段：a = new Integer(11); a.value
- 调用 Java 类中的方法：Math.abs(12)
在沙箱模式中，脚本可以：
- 使用 QLExpress 的自定义操作符/宏/函数，以此实现与应用的受控交互
- 使用 . 操作符获取 Map 的 key 对应的 value，比如 a 在应用传入的表达式中是一个 Map，那么可以通过 a.b 获取
- 所有不涉及应用 Java 类的操作
案例：
```java
// 开启沙箱模式
QLExpressRunStrategy.setSandBoxMode(true);
ExpressRunner expressRunner = new ExpressRunner();
// 沙箱模式下不支持 import 语句
assertFalse(expressRunner.checkSyntax("import com.ql.util.express.example.RiskBean;"));
// 沙箱模式下不支持显式的类型引用
assertFalse(expressRunner.checkSyntax("String a = 'abc'"));
assertTrue(expressRunner.checkSyntax("a = 'abc'"));
// 无法用 . 获取 Java 类属性或者 Java 类方法
try {
    expressRunner.execute("'abc'.length()", new DefaultContext<>(),
                          null, false, true);
    fail();
} catch (QLException e) {
    // 没有找到方法:length
}
try {
    DefaultContext<String, Object> context = new DefaultContext<>();
    context.put("test", new CustBean(12));
    expressRunner.execute("test.id", context,
                          null, false, true);
    fail();
} catch (RuntimeException e) {
    // 无法获取属性:id
}
 
// 沙箱模式下可以使用 自定义操作符/宏/函数 和应用进行交互
expressRunner.addFunction("add", new Operator() {
    @Override
    public Object executeInner(Object[] list) throws Exception {
        return (Integer) list[0] + (Integer) list[1];
    }
});
assertEquals(3, expressRunner.execute("add(1,2)", new DefaultContext<>(),
                                      null, false, true));
// 可以用 . 获取 map 的属性
DefaultContext<String, Object> context = new DefaultContext<>();
HashMap<Object, Object> testMap = new HashMap<>();
testMap.put("a", "t");
context.put("test", testMap);
assertEquals("t", expressRunner.execute("test.a", context,
                                        null, false, true));
```
在沙箱模式下，为了进一步保障内存的安全，建议同时限制脚本能够申请的最大数组长度以及超时时间，设置方法如下：
```java
// 限制最大申请数组长度为10, 默认没有限制
QLExpressRunStrategy.setMaxArrLength(10);
ExpressRunner runner = new ExpressRunner();
String code = "byte[] a = new byte[11];";
try {
    // 20ms 超时时间
    runner.execute(code, new DefaultContext<>(), null, false, false, 20);
    Assert.fail();
} catch (QLException e) {
}
 
QLExpressRunStrategy.setMaxArrLength(-1);
// 20ms 超时时间
runner.execute(code, new DefaultContext<>(), null, false, false, 20);
```
