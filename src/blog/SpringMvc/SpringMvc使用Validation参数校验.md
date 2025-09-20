---
icon: file-lines
title: SpringMvc使用Validation参数校验
author: Ms.Zyh
date: 2023-05-03
category:
  - SpringMvc
tag:
  - 必看
  - SpringMvc
sticky: false
star: false
---

在日常开发中为了防止非法参数对业务造成影响，不止前端会对参数进行校验，我们后端也要形成一个规范，需要对接口的参数进行校验！
### 一、参数校验
如果spring boot 版本低于2.3，不需要添加 `spring-boot-starter-validation `依赖，spring-boot-starter-web会自动依赖`spring-boot-starter-validation `：
```xml
<dependency> 
    <groupId>org.springframework.boot</groupId> 
    <artifactId>spring-boot-starter-validation</artifactId> 
</dependency>
```
常用注解：

|注解|解释|
|:-|:-|
|@Valid/@Validated|表示该参数需要进行数据校验|
|@NotNull|用于字段，表示该字段不能为null|
|@NotEmpty|用于集合或字符串字段，表示该字段不能为null并且长度/大小必须大于0|
|@NotBlank|用于字符串字段，表示该字段不能为null并且去除首尾空格后的长度必须大于0|
|@Size(min=, max=)|用于字符串或集合字段，表示该字段的长度/大小必须在指定的范围内|
|@Min(value=) /@Max(value=)|用于数值字段，表示该字段的值必须在指定的范围内|
|@Pattern(regexp=)|用于字符串字段，表示该字段的值必须匹配指定的正则表达式|
|@Email|用于字符串字段，表示该字段的值必须是一个有效的电子邮件地址|
|@Past/@Future|用于日期字段，表示该字段的值必须是一个过去的日期或一个未来的日期|
|@Positive /@Negative|用于数值字段，表示该字段的值必须是正数或负数|
|@AssertTrue|用于Boolean字段，表示该字段的值必须是true|

校验方式一：对象参数校验，如果参数比较多，一般使用VO对象接收参数
定义VO对象接收参数：
```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ValidatedVo {
    @NotNull(message = "notNullFiled不能为空")
    private String notNullFiled;
    @NotEmpty(message = "notEmptyFiled不能为空")
    private String notEmptyFiled;
    @NotBlank(message = "notBlankFiled不能为空")
    private String notBlankFiled;
    @Size(min = 1, max = 6, message = "sizeFiled长度必须在1-6之间")
    private List<String> sizeFiled;
    @Min(value = 1, message = "minOrMaxFiled最小值为1")
    @Max(value = 10, message = "minOrMaxFiled最大值为10")
    private Integer minOrMaxFiled;
    @Pattern(regexp = "^1[0-9]{10}$", message = "手机号码格式不正确")
    private String regexpFiled;
    @Email(message = "emailFiled格式不正确")
    private String emailFiled;
    @Past(message = "dateFiled必须为过去时间")
    private Date datePastFiled;
    @Future(message = "dateFiled必须为未来时间")
    private Date dateFutureFiled;
    @Positive(message = "positiveFiled必须为正数")
    private Integer positiveFiled;
    @Negative(message = "negativeFiled必须为负数")
    private Integer negativeFiled;
    @AssertTrue(message = "assertTrueFiled必须为true")
    private Boolean assertTrueFiled;
}
```
对象参数校验：
```java
@RestController
@RequestMapping("/validated")
public class ValidatedController {
    @PostMapping("/validatedMethod")
    public String validatedMethod(@RequestBody @Validated ValidatedVo validatedVo) {
        return "validatedVo:"+validatedVo;
    }
}
```
校验方式二：直接参数校验，如果参数比较多，一般直接使用接收参数
```java
@RestController
@RequestMapping("/validated")
public class ValidatedController {
    @GetMapping("/validatedUserName")
    public String validatedUserName(@RequestParam("userName") @Size(min = 1, max = 6, message = "userName长度必须在1-6之间") String userName) {  
        return "userName:"+userName;
    }
}

```

### 二、全局异常
参数的校验，如果校验失败，会抛出`MethodArgumentNotValidException`异常或抛出`ConstraintViolationException`异常
```java
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {
    /****
     * MethodArgumentNotValidException异常： 当 @Validated 修饰 java 对象时，如 (@RequestBody @Validated  ValidatedVo validatedVo)
     *  此时当 validatedVo 中的属性验证失败时，会抛出MethodArgumentNotValidException异常。
     */
    @ExceptionHandler({MethodArgumentNotValidException.class})
    public Result handleMethodArgumentNotValidException(MethodArgumentNotValidException ex) {
        BindingResult bindingResult = ex.getBindingResult();
        // 定义返回给前端的内容，只返回给前端最先报错的信息
        String msg = bindingResult.getFieldError().getDefaultMessage();
        log.error("校验失败，错误信息：{}", ex.getMessage());
        return Result.error(msg);
    }
    /**
     * ConstraintViolationException异常： 当 @Validated 修饰单个参数时，如（@RequestParam("userName") @Size(min = 1, max = 6, message = "userName长度必须在1-6之间") String userName），
     *  此时当 userName参数校验失败时，会抛出ConstraintViolationException异常。
     */
    @ExceptionHandler({ConstraintViolationException.class})
    public Result handleConstraintViolationException(ConstraintViolationException ex) {
        String message = ex.getMessage();
        log.error(message, ex);
        String msg = message.substring(message.indexOf(":") + 1).trim();
        return Result.error( msg);
    }
    /**
     *    全局异常
     */
    @ExceptionHandler(Exception.class)
    public Result handleException(Exception e){
        log.error(e.getMessage(), e);
        return Result.error(MessageConstant.UNKNOWN_ERROR);
    }
}
```

### 三、分组校验
在实际项目中，可能多个方法需要使用同一个VO类来接收参数，而不同方法的校验规则很可能是不一样的。
```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ValidatedVo {
    public interface AddRegister{}
    public interface UpdateRegister{}
    @Min(value = 1, message = "minOrMaxFiled最小值为1", groups = {AddRegister.class})
    @Max(value = 10, message = "minOrMaxFiled最大值为10", groups = {UpdateRegister.class})
    private Integer minOrMaxFiled;
    @NotBlank(message = "userName不能为空")
    private String userName;

}
```
```java
@RestController
@RequestMapping("/validated")
public class ValidatedController {
    
    @PostMapping("/validatedNoGroup")
    public String validatedNoGroup(@RequestBody @Validated ValidatedVo validatedVo) {
        return "validatedVo:"+validatedVo;
    }
    @PostMapping("/validatedAddGroup")
    public String validatedAddGroup(@RequestBody @Validated({ValidatedVo.AddRegister.class}) ValidatedVo validatedVo) {
        return "validatedVo:"+validatedVo;
    }

    @PostMapping("/validatedUpdateGroup")
    public String validatedUpdateGroup(@RequestBody @Validated({ValidatedVo.UpdateRegister.class}) ValidatedVo validatedVo) {
        return "validatedVo:"+validatedVo;
    }
    @PostMapping("/validateAddAndUpdateGroup")
    public String validateAddAndUpdateGroup(@RequestBody @Validated({ValidatedVo.AddRegister.class,ValidatedVo.UpdateRegister.class}) ValidatedVo validatedVo) {
        return "validatedVo:"+validatedVo;
    }
}

```

|接口|解释|
|:-|:-|
|/validated/validatedNoGroup| 未指定分组，只进行userName非空校验|
|/validated/validatedAddGroup| 指定add分组，只进行minOrMaxFiled最小值为1校验|
|/validated/validatedUpdateGroup|指定update分组，只进行minOrMaxFiled最大值为10校验|
|/validated/validateAddAndUpdateGroup| 指定add和update分组，进行minOrMaxFiled最小值为1校验和minOrMaxFiled最大值为10校验|

### 四、嵌套校验
实际场景中，有可能某个字段是一个对象，这种情况下，可以使用嵌套校验 。如果字段是集合，会对集合里面的每一项都进行校验，例如`List<User>`字段会对这个list里面的每一个User对象都进行校验：
```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ValidatedVo {
   public class Address{
       @NotNull
       @Length(min = 2, max = 10)
       private String addressName;
   }
   @Valid
   private Address address;
   @NotBlank
   private String name;
}
```
使用：
```java
@RestController
@RequestMapping("/validated")
public class ValidatedController {
    
    @PostMapping("/validatedMethod")
    public String validatedMethod(@RequestBody @Validated ValidatedVo validatedVo) {
        return "validatedVo:"+validatedVo;
    }
}
```
### 五、集合校验
在嵌套校验，如果字段是集合，会对集合里面的每一项都进行校验，例如`List<User>`字段会对这个list里面的每一个User对象都进行校验，但是如果集合不是成员变量，而是直接接收参数：
```java
@RestController
@RequestMapping("/validated")
public class ValidatedController {
    @PostMapping("/validatedMethod")
    public String validatedMethod(@RequestBody @Validated List<ValidatedVo> validatedVo) {
        return "validatedVo:"+validatedVo;
    }

}
```
我们直接使用java.util.Collection下的list或者set来接收数据，校验并不会生效，并不会对数组中的每一项都进行参数校验。这个时候我们可以自定义list集合来接收参数：
```java
public class ValidationList<T> implements List<T> {
    /**
     * @Delegate是lombok注解，作用是将list接口的实现 委托给成员变量list
     * 一定要加@Valid注解
     */
    @Valid
    @Delegate
    public List<T> list = new ArrayList<>();

}
```
然后使用自定义list集合来接收参数：
```java
@RestController
@RequestMapping("/validated")
public class ValidatedController {
    @PostMapping("/validatedMethod")
    public String validatedMethod(@RequestBody @Validated ValidationList<ValidatedVo> validatedVo) {
        return "validatedVo:"+validatedVo;
    }

}
```
### 六、自定义校验
业务需求总是比框架提供的这些简单校验要复杂的多，已有的注解不能满足所有的校验要求，特殊的情况需要自定义校验（自定义校验注解）
  - 自定义约束注解
```java
public @interface CheckParam {
    /**
     * 提供校验失败后的提示信息
     */
    String message() default "参数检查失败";
    /**
     * 制定分组
     */
    Class<?>[] groups() default {};
    /**
     * 负载获取到State注解的附加信息
     */
    Class<? extends Payload>[] payload() default {};
}

```
- 自定义规则类 实现 ConstraintValidator<自定义的约束注解,校验的数据类型>
```java
public class CheckParamValidator implements ConstraintValidator<CheckParam,String>{
    /**
     * 校验逻辑
     * @param value 校验字段
     * @param constraintValidatorContext
     * @return 校验结果
     */
    @Override
    public boolean isValid(String value, ConstraintValidatorContext constraintValidatorContext) {
        if("OK".equals(value)
                || "SUCCESS".equals(value)){
            return true;
        }
        return false;
    }
}
```
使用：
```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ValidatedVo {
   @CheckParam(message = "status必须是OK或者SUCCESS")
   private String status;
}
@RestController
@RequestMapping("/validated")
public class ValidatedController {

    @PostMapping("/validatedMethod")
    public String validatedMethod(@RequestBody @Validated ValidatedVo validatedVo) {
        return "validatedVo:"+validatedVo;
    }

}
```
### 七、快速失败(Fail Fast)
Spring Validation默认会校验完所有字段，然后才抛出异常。可以通过一些简单的配置，开启Fali Fast模式，一旦校验失败就立即返回。
```java
@Bean
public Validator validator() {
    ValidatorFactory validatorFactory = Validation.byProvider(HibernateValidator.class)
            .configure()
            // 快速失败模式
            .failFast(true)
            .buildValidatorFactory();
    return validatorFactory.getValidator();
}
```
