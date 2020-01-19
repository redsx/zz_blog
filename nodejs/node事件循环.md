# node: event loop
## 什么是事件循环
Event loop是一种程序结构，是实现异步的一种机制。这种异步执行的运行机制如下：
1. 所有同步任务都在主线程上执行，形成一个[执行栈](http://www.ruanyifeng.com/blog/2013/11/stack.html)（execution context stack）。
2. 主线程之外，还存在一个"任务队列"（task queue）。只要异步任务有了运行结果，就在"任务队列"之中放置一个事件。
3. 一旦"执行栈"中的所有同步任务执行完毕，系统就会读取"任务队列"，看看里面有哪些事件。那些对应的异步任务，于是结束等待状态，进入执行栈，开始执行。
4. 主线程不断重复上面的第三步。
为了更好地理解Event Loop，可以参考下图（转引自Philip Roberts的演讲 [What the heck is the event loop anyway](http://2014.jsconf.eu/speakers/philip-roberts-what-the-heck-is-the-event-loop-anyway.html) ）

![image](https://user-images.githubusercontent.com/16440464/72681850-87a60800-3b02-11ea-8415-7ef807db8430.png)

## Node.js的事件循环
当 Node.js 启动后，它会初始化事件轮询；处理已提供的输入脚本，它可能会调用一些异步的 API、调度定时器，或者调用 `process.nextTick()`，然后开始处理事件循环
下面的图表展示了事件循环操作顺序的简化概览:

![image](https://user-images.githubusercontent.com/16440464/72681858-98ef1480-3b02-11ea-8f5c-986fa098ea80.png)


每个阶段都有一个**FIFO**的回调队列（queue）要执行。而每个阶段有自己的特殊之处，简单说，就是当event loop进入某个阶段后，会执行该阶段特定的（任意）操作，然后才会执行这个阶段的队列里的回调。当队列被执行完，或者执行的回调数量达到上限后，event loop会进入下个阶段
### 阶段概述
- timers: 这个阶段执行`setTimeout()`和`setInterval()`设定的回调。
- I/O callbacks: 执行被推迟到下一个iteration的 I/O 回调。
- idle, prepare: 仅内部使用。
- poll: 获取新的I/O事件；node会在适当条件下阻塞在这里。这个阶段执行几乎所有的回调，除了close回调，timer的回调，和`setImmediate()`的回调。
- check: 执行`setImmediate()`设定的回调。
- close callbacks: 执行比如`socket.on('close', ...)`的回调。
### 阶段详情
#### Timer
一个timer指定 可以执行所提供回调 的阈值，而不是用户希望其执行的确切时间。在指定的一段时间间隔后， timer回调会被尽可能早的运行。但系统调度或者其它回调的执行可能会延迟timer回调的执行。
#### I/O callbacks
这个阶段执行一些系统操作的回调。比如TCP错误，如一个TCP socket在想要连接时收到`ECONNREFUSED`,类unix系统会等待以报告错误，这就会放到 **I/O callbacks** 阶段的队列执行。
#### poll
阶段有两个重要的功能：
1. 执行下限时间已经达到的timers的回调。
2. 处理 poll 队列里的事件。
当事件循环进入 poll 阶段且 没有timer时 ，将发生以下两种情况之一：
- 如果 poll 队列 不是空的 event loop会遍历队列并同步执行回调，直到队列清空或执行的回调数到达系统上限；。
- 如果 poll 队列 是空的 ，还有两件事发生：
  - 如果设置了 setImmediate() 回调，则事件循环将结束  poll 阶段，并继续 check 阶段以执行那些被调度的脚本。
  - 如果脚本 未被 setImmediate()设置回调，event loop将阻塞在该阶段等待回调被加入 poll 队，然后立即执行。
一旦  poll 队列为空，event loop将检查`已达到时间阈值的timer`。如果一个或多个timer达到设定时间，则事件循环将绕回计timer阶段以执行这些timer回调。
#### check
这个阶段允许在 poll 阶段结束后立即执行回调。如果 poll 阶段空闲，并且有被`setImmediate()`设定的回调，event loop会转到 check 阶段而不是继续等待。
`setImmediate()`实际上是一个特殊的timer，跑在event loop中一个独立的阶段。它使用libuv的API来设定在 poll 阶段结束后立即执行回调。
通常上来讲，随着代码执行，event loop终将进入 poll 阶段，在这个阶段等待请求连接等时间。但是，只要有被`setImmediate()`设定了回调，一旦 poll 阶段空闲，那么程序将结束 poll 阶段并进入 check 阶段，而不是继续等待poll events。
#### close callbacks
如果一个 socket 或 handle 被突然关掉（比如 `socket.destroy()`），close事件将在这个阶段被触发，否则将通过process.nextTick()触发。
### 举例说明Event loop
#### 🌰setimmediate立即执行？
**执行：**
```js
const now = Date.now();
setTimeout(() => console.log("------ timer 1000 ------"), 1000);
setTimeout(() => console.log("------ timer 1 ------"), 1);
setImmediate(() => console.log("------ immediate ------"));
```
**输出：**
```js
*timer*[uv__run_timers]: enter
*timer*[uv__run_timers]: exit
*I/O callbacks*[uv__run_pending]: enter
*I/O callbacks*[uv__run_pending]: exit
*poll*[uv__io_poll]: enter
*poll*[uv__io_poll]: QUEUE NOT EMPTY
*poll*[uv__io_poll]: QUEUE NOT EMPTY
*poll*[uv__io_poll]: QUEUE EMPTY
*timer*[uv__run_timers]: enter
------ timer 1 ------
*timer*[uv__run_timers]: exit
*I/O callbacks*[uv__run_pending]: enter
*I/O callbacks*[uv__run_pending]: exit
*poll*[uv__io_poll]: enter
*poll*[uv__io_poll]: QUEUE NOT EMPTY
*poll*[uv__io_poll]: QUEUE NOT EMPTY
*poll*[uv__io_poll]: QUEUE EMPTY
*poll*[uv__io_poll]: exit
*check*[uv__run_check]: enter
------ immediate ------
*check*[uv__run_check]: exit
*closing*[uv__run_closing_handles]: enter
*closing*[uv__run_closing_handles]: exit
*timer*[uv__run_timers]: enter
*timer*[uv__run_timers]: exit
*I/O callbacks*[uv__run_pending]: enter
*I/O callbacks*[uv__run_pending]: exit
*poll*[uv__io_poll]: enter
*poll*[uv__io_poll]: QUEUE EMPTY
---------- 等待poll ----------

*poll*[uv__io_poll]: exit
*check*[uv__run_check]: enter
*check*[uv__run_check]: exit
*closing*[uv__run_closing_handles]: enter
*closing*[uv__run_closing_handles]: exit
*timer*[uv__run_timers]: enter
------ timer 1000 ------
*timer*[uv__run_timers]: exit
*I/O callbacks*[uv__run_pending]: enter
*I/O callbacks*[uv__run_pending]: exit
*poll*[uv__io_poll]: enter
*poll*[uv__io_poll]: exit
*check*[uv__run_check]: enter
*check*[uv__run_check]: exit
*closing*[uv__run_closing_handles]: enter
*closing*[uv__run_closing_handles]: exit
```
**分析：**
1. 第一次poll阶段，发现timer 1到达执行阈值，回到timer阶段
一旦  poll 队列为空，event loop将检查`已达到时间阈值的timer`。如果一个或多个timer达到设定时间，则事件循环将绕回计timer阶段以执行这些timer回调。
2. 再次循环进入poll阶段，无timer回调达到时间，且设置了`setImmediate`回调，则结束poll 到check阶段
如果设置了 `setImmediate() `回调，则事件循环将结束  poll 阶段，并继续 check 阶段以执行那些被调度的脚本。
3. 第三次timer时间到达前poll处于阻塞等待回调加入，注意等待是有超时时间的，以上只截取等待一次log
如果脚本 未被 `setImmediate()`设置回调，event loop将阻塞在该阶段等待回调被加入 poll 队，然后立即执行。
#### 🌰setimmediate真的立即执行
**执行：**
```js
const fs = require('fs')
const now = Date.now();

fs.readFile(__filename, () => {
    console.log('------ readfile ------')
    setTimeout(() => console.log('------ fs: timer ------'), 0);
    setImmediate(() => console.log('------ fs: immediate ------'));
});
```
**输出：**
```
*timer*[uv__run_timers]: enter
*timer*[uv__run_timers]: exit
*I/O callbacks*[uv__run_pending]: enter
*I/O callbacks*[uv__run_pending]: exit
*poll*[uv__io_poll]: enter
*poll*[uv__io_poll]: QUEUE EMPTY
*poll*[uv__io_poll] timeout: 8099
*poll*[uv__io_poll] nfds: 1
------ readfile ------
*poll*[uv__io_poll]: exit
*check*[uv__run_check]: enter
------ fs: immediate ------
*check*[uv__run_check]: exit
*closing*[uv__run_closing_handles]: enter
*closing*[uv__run_closing_handles]: exit
*timer*[uv__run_timers]: enter
------ fs: timer ------
*timer*[uv__run_timers]: exit
*I/O callbacks*[uv__run_pending]: enter
*I/O callbacks*[uv__run_pending]: exit
```
**分析：**
1. 为什么这一次fs: immediate会先执行？
  1. 看打印出来的日志可以知道poll阶段回调执行完成之后进入check阶段，check阶段会执行setImmediate回调
  2. 然后进入下一轮循环timer执行
2. 为什么例1中timer会先执行？与本例有什么不同？
  1. 例1中之所以会先执行，是因为在执行poll阶段时poll队列为空，检查发现timer到达执行时间，才跳回timer阶段执行
  2. 例1中两者都在主模块中运行，本例在回调中运行，poll阶段回调执行完成之后进入check阶段，`setImmediate`的回调永远先执行。所以说`setImmediate`真的是立即执行的
#### 🌰setImmediate和process. nextTick()
**执行：**
```js
setTimeout(() => {
    console.log("------ timer 1 ------")
    process.nextTick(() => console.log("------ nextTick 1 ------"));
}, 1);
setImmediate(() => console.log("------ immediate 2 ------"));
process.nextTick(() => console.log("------ nextTick ------"));
```
**输出：**
```
*timer*[uv__run_timers]: enter
*timer*[uv__run_timers]: exit
*I/O callbacks*[uv__run_pending]: enter
*I/O callbacks*[uv__run_pending]: exit
*poll*[uv__io_poll]: enter
*poll*[uv__io_poll] timeout: -1
------ nextTick ------
*timer*[uv__run_timers]: enter
------ timer 1 ------
------ nextTick 1 ------
*timer*[uv__run_timers]: exit
*I/O callbacks*[uv__run_pending]: enter
*I/O callbacks*[uv__run_pending]: exit
*poll*[uv__io_poll]: enter
*poll*[uv__io_poll]: exit
*check*[uv__run_check]: enter
------ immediate 2 ------
*check*[uv__run_check]: exit
*closing*[uv__run_closing_handles]: enter
*closing*[uv__run_closing_handles]: exit
```
**分析：**
1. `process.nextTick`在当前操作完成后处理，不管目前处于事件循环的哪个阶段，它都会立即执行
2. 而`setImmediate`只能在 check 阶段执行回调
#### 其他补充
以上例子中有涉及修改node源码打印执行日志可以参考 [node源码编译&使用]( https://github.com/redsx/zz_blog/issues/1 )
```c
// deps/uv/src/unix/core.c
int uv_run(uv_loop_t* loop, uv_run_mode mode) {
  //...
  while (r != 0 && loop->stop_flag == 0) {
    uv__update_time(loop);
    printf("*timer*[uv__run_timers]: enter\n");
    uv__run_timers(loop);
    printf("*timer*[uv__run_timers]: exit\n");

    printf("*I/O callbacks*[uv__run_pending]: enter\n");
    ran_pending = uv__run_pending(loop);
    printf("*I/O callbacks*[uv__run_pending]: exit\n");
    uv__run_idle(loop);
    uv__run_prepare(loop);
    timeout = 0;
    if ((mode == UV_RUN_ONCE && !ran_pending) || mode == UV_RUN_DEFAULT) {
      timeout = uv_backend_timeout(loop);
    }

    printf("*poll*[uv__io_poll]: enter\n");
    uv__io_poll(loop, timeout);
    printf("*poll*[uv__io_poll]: exit\n");

    printf("*check*[uv__run_check]: enter\n");
    uv__run_check(loop);
    printf("*check*[uv__run_check]: exit\n");

    printf("*closing*[uv__run_closing_handles]: enter\n");
    uv__run_closing_handles(loop);
    printf("*closing*[uv__run_closing_handles]: exit\n");
    //...
}
```
## 浏览器的事件循环
### 对比Nodejs事件循环
浏览器的事件循环事表现出的状态与node中大致相同。但是浏览器的有自己的一套事件循环模型。
浏览器至少有一个事件循环，一个事件循环至少有一个任务队列。此外每个事件循环都有一个microtask queue。
>An event loop has one or more task queues. A task queue is a set of tasks.
>
>Each event loop has a microtask queue, which is a queue of microtasks, initially empty. A microtask is a colloquial way of referring to a task that was created via the queue a microtask algorithm.

### macrotask(任务队列) & microtask
Macrotasks包含生成dom对象、解析HTML、执行主线程js代码、更改当前URL还有其他的一些事件如页面加载、输入、网络事件和定时器事件。从浏览器的角度来看，macrotask代表一些离散的独立的工作。当执行完一个task后，浏览器可以继续其他的工作如页面重渲染和垃圾回收。
Microtasks则是完成一些更新应用程序状态的较小任务，如处理promise的回调和DOM的修改，这些任务在浏览器重渲染前执行。Microtask应该以异步的方式尽快执行，其开销比执行一个新的macrotask要小。Microtasks使得我们可以在UI重渲染之前执行某些任务，从而避免了不必要的UI渲染，这些渲染可能导致显示的应用程序状态不一致。
![image](https://user-images.githubusercontent.com/16440464/72681864-ac01e480-3b02-11ea-9436-a9d6bed699c2.png)

上图看出一些细节：
1. 一次事件循环只会执行一个macrotask
2. 一次事件循环却可以处理完所有的microtask，且microtasks都应该在下次渲染前执行完。
### 举例说明
#### 🌰一个简易事件循环
**执行：**
```js
console.log('script start');

setTimeout(function() {
  console.log('setTimeout');
}, 0);

Promise.resolve().then(function() {
  console.log('promise1');
}).then(function() {
  console.log('promise2');
});

console.log('script end');
```
**输出：**
```
script start
script end
promise1
promise2
setTimeout
```
**分析：**
![browser-deom1-excute-animate](https://user-images.githubusercontent.com/16440464/72681875-c63bc280-3b02-11ea-86af-87e3697b232c.gif)

🌰复杂的事件循环触发
**执行：**
```js
//<div class="outer">
//  <div class="inner"></div>
//</div>
var outer = document.querySelector('.outer');
var inner = document.querySelector('.inner');
// Let's listen for attribute changes on the outer element
new MutationObserver(function() {
  console.log('mutate');
}).observe(outer, {
  attributes: true
});

// Here's a click listener…
function onClick() {
  console.log('click');

  setTimeout(function() {
    console.log('timeout');
  }, 0);

  Promise.resolve().then(function() {
    console.log('promise');
  });

  outer.setAttribute('data-random', Math.random());
}

// …which we'll attach to both elements
inner.addEventListener('click', onClick);
outer.addEventListener('click', onClick);
```
**输出：**
```
click
promise
mutate
click
promise
mutate
timeout
timeout
```
分析：

![2020-01-19 20-58-05 2020-01-19 20_59_46](https://user-images.githubusercontent.com/16440464/72681885-e10e3700-3b02-11ea-8024-69020047c0f9.gif)

参考文章
[JavaScript 运行机制详解：再谈Event Loop](http://www.ruanyifeng.com/blog/2014/10/event-loop.html)
[Node.js的event loop及timer/setImmediate/nextTick](https://github.com/creeperyang/blog/issues/26)
[html规范.事件循环](https://html.spec.whatwg.org/multipage/webappapis.html#event-loop)
[深入理解js事件循环机(浏览器篇)](http://lynnelv.github.io/js-event-loop-browser)
[HTML系列：macrotask和microtask](https://zhuanlan.zhihu.com/p/24460769)
[asks, microtasks, queues and schedules](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/)