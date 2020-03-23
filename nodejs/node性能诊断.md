## 1. 基础工具介绍
### 1.1 ab
#### 1.1.1 简述
ab是apache自带的压测工具。ab非常实用，它不仅可以对apache服务器进行网站访问压力测试，也可以对或其它类型的服务器进行压力测试
#### 1.1.2 使用
```
// 其中－n表示请求数，－c表示并发数 可以使用ab -h 查看更多ab -c 20 -n 2000 
"http://localhost:3020/users/encrypt"
```
![image](https://user-images.githubusercontent.com/16440464/77308076-5d0c4180-6d35-11ea-85ec-03d02e3cf57f.png)

#### 1.1.3 结果分析（仅列出可能需要关注的）

1. Requests per second 吞吐率（后面括号中的mean 表示这是一个平均值）
2. Time per request 用户平均请求等待时间 用户平均请求等待时间
3. Time per request(across all concurrent requests) 服务器平均请求处理时间

![image](https://user-images.githubusercontent.com/16440464/77308108-6bf2f400-6d35-11ea-8a7b-b4eadc52699e.png)

### 1.2 Chrome DevTools

#### 1.2.1 简述Chrome 

开发者工具是一套内置于Google Chrome中的Web开发和调试工具，可用来对网站进行迭代、调试和分析。

#### 1.2.2 使用
1. 详细参考：[https://developers.google.com/web/tools/chrome-devtools/](https://developers.google.com/web/tools/chrome-devtools/)
2. 文中使用到的
    1. cpu分析: [ https://developers.google.com/web/tools/chrome-devtools/rendering-tools/js-execution]( https://developers.google.com/web/tools/chrome-devtools/rendering-tools/js-execution)
    2. 内存分析: [ https://developers.google.com/web/tools/chrome-devtools/rendering-tools/js-execution]( https://developers.google.com/web/tools/chrome-devtools/memory-problems/)

### 1.3 v8-profiler

#### 1.3.1 简述

v8-profiler集成了node-inspector。我们可以通过v8-profiler 收集一些运行时数据（例如：CPU 和内存）

#### 1.3.2 使用

参考 [https://github.com/node-inspector/v8-profiler](https://github.com/node-inspector/v8-profiler)

## 2. 问题定位与分析

### 2.1 CPU

#### 2.1.1 测试代码

1. 这里我们使用 CPU 密集型的计算函数 crypto.pbkdf2Sync做测试
```js
router.get('/encrypt', function encryptPassword(ctx, next) {
  const password = 'test'
  const salt = crypto.randomBytes(128).toString('base64')
  const encryptedPassword = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  ctx.body = encryptedPassword
})
```
 2. 然后使用v8-profiler做监控，用来收集 30s 的 V8 

 ```js
router.get('/cpuprofile', async function (ctx, next) {
  //Start Profiling
  console.log('Start Profiling');
  profiler.startProfiling('CPU profile')
  await _sleep(30*1000);
  console.log('Stop Profiling after 30s');
  //Stop Profiling after 30s
  const profile = profiler.stopProfiling()
  profile.export()
    .pipe(fs.createWriteStream(`cpuprofile-${Date.now()}.cpuprofile`))
    .on('finish', () => profile.delete())
  ctx.status = 204
})
```
#### 2.1.2 收集测试数据

1. 执行`curl localhost:3020/cpuprofile` 进行v8数据收集
2. 通过ab工具进行访问 `ab -c 20 -n 2000 "http://localhost:3020/encrypt"` 
3. 30s后即可得到数据

#### 2.1.3 数据分析
1. 使用chrome devtool 分析拿到的数据，在下面操作路径下，选择load 2.12中收集到的数据文

![image](https://user-images.githubusercontent.com/16440464/77308259-a65c9100-6d35-11ea-9b92-844cf0661c20.png)

2. JS Profiler 一共有三种模式
    1. Chart：显示按时间顺序排列的⽕焰图。
    2. Heavy (Bottom Up)：按照函数对性能的影响排列，同时可以检查函数的调⽤路径。
    3. Tree (Top Down)：显示调⽤结构的总体状况，从调⽤堆栈的顶端开始。

3. 火焰图
    1. 下图是火焰图调用堆栈，这里可以详细深入地查看记录过程中调用的函数。 横轴是时间，纵轴是调用堆栈。 堆栈由上而下组织。所以，上面的函数调用它下面的函数，以此类推。
    2. **高调用堆栈不一定很重要，只是表示调用了大量的函数。 但宽条表示调用需要很长时间完成。 这些需要优化**
    3. 简单分析：可以看到下图中，调用最耗时的是 pbkd2f，往上可以看到是我们测试demo中的encryptPassword

![image](https://user-images.githubusercontent.com/16440464/77308323-bf654200-6d35-11ea-90ad-c6b0e5ebf9d6.png)

4. Heavy (Bottom Up)：
  1. 按照函数对性能的影响列出函数，你可以检查函数的调用路径
  2. 简单分析：从下图同样可以快速定位出encryptPassword耗时最长

![image](https://user-images.githubusercontent.com/16440464/77308383-d3a93f00-6d35-11ea-80ac-93488bc35fd9.png)

5. Tree (Top Down)：
  1. 显示调用结构的总体状况，从调用堆栈的顶端开始。

![image](https://user-images.githubusercontent.com/16440464/77308427-e3c11e80-6d35-11ea-8c23-aaf8e574d02e.png)

### 2.2 内存

#### 2.2.1 测试代码
```js
let leakObject = null 
setInterval(function testMemoryLeak() {
    const originLeakObject = leakObject
    const unused = function () {
        if (originLeakObject) {
            console.log('originLeakObject')
        }
    }
    leakObject = {
        count: String(count++),
        leakStr: new Array(1e7).join('*'),
        leakMethod: function () {
            console.log('leakMessage');
        }
    }
}, 1000);
```

    上面是一段比较经典的内存泄漏。为什么这段程序会内存泄漏呢？
在执⾏函数的时候，如果遇到闭包，则会创建闭包作⽤域的内存空间，将该闭包所⽤到的局部变量添加进去，然后再遇到闭包时，会在之前创建好的作⽤域空间添加此闭包会⽤到⽽前闭包没⽤到的变量。函数结束时，会清除没有被闭包作⽤域引⽤的变量。
    可以看上面函数中产生了两个闭包，`leakMethod`和`unused`，`unused` 这个闭包引⽤了⽗作⽤域中的`originLeakObject` 变量，如果没有后⾯的`leakMethod`，则会在函数结束后被清除，闭包作⽤域也跟着被清除了。因为后⾯的`leakObject` 是**全局变量**，即 `leakMethod` 是全局变量，它引⽤的闭包作⽤域不会释放。⽽随着testMemoryLeak 不断的调⽤，originLeakObject 指向前⼀次的 leakObject，下次的leakObject.leakMethod ⼜会引⽤之前的 originLeakObject，从⽽形成⼀个闭包引⽤链，⽽ leakStr 是⼀个⼤字符串，得不到释放，从⽽造成了内存泄漏。

#### 2.2.2 数据分析
1. 借助上面测试代码生成的内存>100M的时候和>800M快照
2. Summary 视图：可以显示按构造函数名称分组的对象。使用此视图可以根据按构造函数名称分组的类型深入了解其内存使用
  - Constructor 表示使用此构造函数创建的所有对象。
  - Shallow Size 列显示通过特定构造函数创建的所有对象浅层大小的总和。浅层大小是指对象自身占用的内存大小。参考：
    - [https://developers.google.com/web/tools/chrome-devtools/memory-problems/memory-101#object-sizes](https://developers.google.com/web/tools/chrome-devtools/memory-problems/memory-101#object-sizes)
  - Retained Size 列显示同一组对象中最大的保留大小。某个对象删除后（其依赖项不再可到达）可以释放的内存大小称为保留大小。参考：
    - [https://developers.google.com/web/tools/chrome-devtools/memory-problems/memory-101#object-sizes](https://developers.google.com/web/tools/chrome-devtools/memory-problems/memory-101#object-sizes)
  - Distance 显示使用节点最短简单路径时距根节点的距离。

![image](https://user-images.githubusercontent.com/16440464/77308834-8a0d2400-6d36-11ea-88aa-3cfa39a1efcf.png)

3. Comparison 视图：可以显示两个快照之间的不同。使用此视图可以比较两个或多个内存快照在某个操作前后的差异。检查已释放内存的变化和参考计数让你可以确认是否存在内存泄漏及其原因。

![image](https://user-images.githubusercontent.com/16440464/77308864-972a1300-6d36-11ea-9aa7-84a9474ff28b.png)

4. Containment 视图：允许探索堆内容。提供了应用的对象结构的“俯瞰视图”，一般用不到

    在 Containment 视图中，我们可以查看整个 GC 路径，当然一般不会用到。因为展开在 Summary 和 Comparison 列举的每一项，都可以看到从 GC roots 到这个对象的路径。通过这些路径，你可以看到这个对象的句柄被什么持有，从而定位问题产生的原因。

## 3. 集成监控诊断工具

### 3.1 node-clinic

#### 3.1.1 简介
[node-clinic](https://link.zhihu.com/?target=https://github.com/nearform/node-clinic) 是 NearForm 开源的一款 Node.js 性能诊断工具，可以迅速地定位性能问题

#### 3.1.2 使用
**demo分析 - doctor**
执行`clinic doctor -- node ./bin/www ` 开启服务且使用ab压测
可以看出Event Loop 被阻塞，CPU Usage 也居高不下，一定是有 CPU 密集计算，与我们的测试代码吻合。
![image](https://user-images.githubusercontent.com/16440464/77309063-eff9ab80-6d36-11ea-8898-91e7429b263b.png)

**demo分析 - flame**
从doctor分析得知Event Loop 被阻塞，一定是有 CPU 密集计算，我们执行 `clinic flame -- node ./bin/www` 可以生成火焰图，定位具体问题

![image](https://user-images.githubusercontent.com/16440464/77309091-fe47c780-6d36-11ea-9e7b-301d0eb206b6.png)

### 3.3 alinode
#### 3.3.1 产品介绍

产品链接： [https://www.aliyun.com/product/nodejs](https://www.aliyun.com/product/nodejs)

产品介绍：alinode是面向中大型 Node.js 应用提供性能监控、安全提醒、故障排查、性能优化等服务的整体性解决方案。alinode 团队凭借对 Node.js 内核的深入理解，提供了完善的工具链和服务，协助客户主动、快速地发现和定位线上问题。

![image](https://user-images.githubusercontent.com/16440464/77309250-4https://guides.github.com/features/mastering-markdown/7981700-6d37-11ea-869e-69793a37cc0f.png)

