# MpRdev &middot; [![npm](https://img.shields.io/npm/v/mprdev.svg?style=flat-square)](https://www.npmjs.com/package/mprdev) [![github-actions](https://img.shields.io/github/actions/workflow/status/wechatjs/mprdev/build.yml?style=flat-square)](https://github.com/wechatjs/mprdev/actions/workflows/build.yml)

**[English](./README.md) | 简体中文**

网页远程调试工具。

https://user-images.githubusercontent.com/25946398/190591248-bfac803e-cb2e-4e4c-a2d3-b2b50b2c9d06.mov

## 快速开始

工具分为SDK和DevTools服务，首先是DevTools服务部署：

```bash
npx mprdev -h 0.0.0.0 -p 8090
# 控制台输出的 DevTools: http://0.0.0.0:8090/remote_dev 为DevTools服务入口
# 假设服务器公网IP是123.123.123.123，那么服务地址就是123.123.123.123:8090
```

部署以后，需要前端页面接入SDK，并连接到部署的DevTools服务，才能进行远程调试。

前端页面接入SDK的时候，强烈建议通过CDN链接在页面最开头引入，这样能保证SDK能记录到所有的日志和请求，并且这种方式会在全局挂载 `window.RemoteDevSdk` 变量来暴露接口，方便后续使用。其次，在引入SDK后，假设DevTools服务部署在123.123.123.123:8090，那么当前端页面的SDK接入时，将该信息传入 `init` 建立连接：

```html
<script src="http://123.123.123.123:8090/remote_dev/sdk/index.js"></script>
<script>RemoteDevSdk.init({ host: '123.123.123.123', port: 8090 })</script>
```

最后，访问前端页面，打开DevTools服务，即可开始调试。

另外，如果前端页面无法直接连接DevTools服务部署的机器（比如机器处于内网），则需要对以下路径进行代理：

1. `/target`路径的WebSocket请求，保证SDK能连上DevTools服务；
2. `/devtool`路径的WebSocket请求，保证DevTools能连上DevTools服务；
3. `/remote_dev`路径的HTTPS/HTTP请求，保证DevTools服务入口的访问；

## 断点

目前，远程调试的断点能力是基于 [`vDebugger`](https://github.com/wechatjs/vdebugger) 实现的断点功能，因此相对于上述“快速开始”中的接入流程外，还需要额外的接入工作。为了实现断点调试，需要让SDK接管需要断点的JS脚本。

通常情况下，只需要将 `<script>` 的 `type` 属性改写成 `text/mprdev` 即可。不管是 `text/javascript` 还是 `module`，均适用：

```html
<script src="/test.js"></script>
<script type="module" src="/module.js"></script>
<script type="text/javascript">console.log(1)</script>
```

改写成：

```html
<script type="text/mprdev" src="/test.js"></script>
<script type="text/mprdev" src="/module.js"></script>
<script type="text/mprdev">console.log(1)</script>
```

如果上述方式不能满足要求，SDK还提供了两个接口，用于传入JS脚本源码：

```ts
function debug(script: string, url: string): void // 远程调试断点源码传入
function debugSrc(scriptSrc: string): void // 远程调试断点源码链接传入
```

1. `debug` 接口接受两个参数，分别是断点调试的源码 `script` 和源码对应的链接 `url`，源码对应的链接 `url` 参数用于唯一标识脚本以匹配DevTools服务中断点映射；
2. `debugSrc` 接口仅接受一个参数，源码对应的链接 `scriptSrc`，含义和 `debug` 的 `url` 相同。不同的地方在于，但该接口会实际通过该链接请求脚本源码来进行断点调试。

举个例子，假设页面HTML中会请求以下链接获取一段JS脚本：

```html
<script src="/test.js"></script>
```

为了能让远程调试SDK接管脚本执行并进行断点，可以改写页面HTML，通过使用 `debugSrc` 接口进行接管即可：

```html
<script>RemoteDevSdk.debugSrc('/test.js')</script>
<!-- 等同于 <script type="text/mprdev" src="/test.js"></script> -->
```

特别注意，使用 `type="text/mprdev"` 或 `debugSrc` 接管后，脚本加载将不会阻塞页面渲染，相当于给原来的 `<script>` 加上了defer属性，行为等同于：

```html
<script defer src="/test.js"></script>
```

如果无法接受 `<script>` 以defer的行为加载，或者无法通过上述改动页面HTML的方式让远程调试SDK接管脚本执行并进行断点，则可以在服务端返回JS脚本时，通过使用 `debug` 接口进行包裹，但要记得进行相应转义保证返回合法的JS脚本，以[Express](https://expressjs.com/)为例：

```js
app.use('/test.js', (req, res) => {
  res.send(`RemoteDevSdk.debug(\`${script.replace(/(`|\$|\\)/g, '\\$1')}\`, '${req.url}');`);
});
```

注意，使用 `debug` 接口包裹源码的时候，务必保证是如下格式，因为DevTools服务会进行严格匹配和过滤，保证调试面板上能对源码进行高亮显示：

```js
// 严格保证包裹的格式如下，其中%code%为源码脚本内容，%url%为脚本对应链接
RemoteDevSdk.debug(`%code%`, '%url%');

// DevTools服务会对包裹后的脚本进行如下替换，保证调试面板能正常高亮显示源码
script.replace(/RemoteDevSdk\.debug\(`([\s\S]+)`,?.*\);?/, (_, code) => code.replace(/\\`/g, '`').replace(/\\\$/g, '$'));
```

## 拓展功能

### 向 Network 面板传入自定义请求记录

如果你的请求不是通过 XHR 或者 Fetch 接口发送的，那么你的请求可能无法被 Network 面板捕获。  
SDK`(version>=0.3.0)` 提供了两个接口用于记录你的自定义请求。

```ts
// 记录请求即将发出
const requestId = window.RemoteDev.instance.Network.customRequestWillBeSent(requestOptions);
// 记录请求已经完成
window.RemoteDev.instance.Network.customRequestFinished(Object.assign({}, responseOptions, { requestId }));

// 接口的类型
interface RequestOptions {
  url: string; // 请求 url
  method?: string; // request method, 缺省值: 'GET'
  requestHeaders?: Record<string, string>; // 请求头
  requestBody?: string; // 请求体
  type?: string; // request type, 可以参考 CDP 的 Network.ResourceType(https://chromedevtools.github.io/devtools-protocol/tot/Network/#type-ResourceType)，缺省值: 'XHR'
  initiator?: Network.Initiator; // https://chromedevtools.github.io/devtools-protocol/tot/Network/#type-Initiator
  requestTime?: number; // 请求发起时间
}
interface ResponseOptions {
  requestId: number; // 从 customRequestWillBeSent 方法获取到的唯一请求 ID
  url: string; // 请求 url
  status?: number; // http 状态码
  statusText?: string; // http 状态
  responseHeaders?: Record<string, string>; // 响应头
  responseBody?: string; // 响应体
  type?: string; // request type, 可以参考 CDP 的 Network.ResourceType(https://chromedevtools.github.io/devtools-protocol/tot/Network/#type-ResourceType)，缺省值: 'XHR'
  requestTime: number; // 请求发起时间
  duration?: number; // 请求花费时间, 缺省值: 100
  fromDiskCache?: boolean; // 是否命中缓存，缺省值: false
}
```


## SDK接口类型

```ts
declare interface InitOptions {
  host?: string | string[] // DevTools服务部署的Host/IP (如果传入列表，将依次尝试直到连接成功)
  port?: number // DevTools服务部署的端口
  uin?: number // 用户ID，用于DevTools服务显示和搜索入口
  title?: string // 页面标题，用于DevTools服务显示搜索入口
  protocol?: 'wss:' | 'ws:' // 指定WebSocket协议
}

export declare const version: string // 远程调试SDK版本
export declare function init(opts: InitOptions): void // 远程调试初始化
export declare function debug(script: string, url: string): void // 远程调试断点源码传入
export declare function debugSrc(scriptSrc: string): void // 远程调试断点源码链接传入
export declare function debugCache(check: boolean | ((url: string) => boolean)): void // 控制是否通过url强缓存远程调试断点源码，可减少页面加载耗时
export declare function getId(): string // 获取远程调试设备ID

declare const RemoteDevSdk: {
  version: typeof version
  init: typeof init
  debug: typeof debug
  debugSrc: typeof debugSrc
  debugCache: typeof debugCache
  getId: typeof getId
  instance: Record<string, Record<string, Function>>
}

export default RemoteDevSdk

declare global {
  interface Window {
    RemoteDevSdk: typeof RemoteDevSdk
  }
}
```

## 开发

```bash
git clone https://github.com/wechatjs/mprdev
cd mprdev

npm install
npm run dev & npm start

# 调试页面：http://localhost:8090/remote_dev/test
# DevTools入口：http://localhost:8090/remote_dev
```

## 参考

- [Chrome Devtools Protocol](https://chromedevtools.github.io/devtools-protocol)

## 协议

[MIT](./LICENSE)
