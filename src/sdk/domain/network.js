import jsCookie from 'js-cookie';
import { getAbsoultPath, getImgRequestUrl, key2UpperCase } from '../common/utils';
import { Event } from './protocol';
import BaseDomain from './domain';
import JDB from '../common/jdb';

const oriFetch = window.fetch;
const getWallTime = (now) => Date.now() / 1000 - now;
const getTimestamp = () => performance.now() / 1000;
const getHttpResLen = (s, st, h, bl) => `HTTP/1.1 ${s} ${st}\n${h}\n\n\n`.length + bl; // 计算统计响应大小的

export default class Network extends BaseDomain {
  namespace = 'Network';

  // 请求的唯一id
  requestId = 1;

  // 请求响应的集合
  responseText = new Map();

  // 图片缓存的请求
  cacheImgRequest = [];

  // 用户缓存的请求
  cacheRequest = [];

  isEnabled = false;

  constructor(options) {
    super(options);
    this.hookXhr();
    this.hookFetch();
    this.hookImage();
  }

  /**
   * 格式化http响应头
   * @static
   * @param {String} header http响应头 eg：content-type: application/json; charset=UTF-8\n date: Wed, 15 Sep 2021 07:20:26 GMT
   */
  static formatResponseHeader(header) {
    const headers = {};
    header.split(/[\r\n]/).filter(Boolean)
      .forEach((item) => {
        const [key, val] = item.split(':');
        headers[key2UpperCase(key)] = val.trim();
      });
    return headers;
  }

  /**
   * 获取默认的http请求头，目前只有ua、cookie
   * @static
   */
  static getDefaultHeaders() {
    const headers = {
      'User-Agent': navigator.userAgent,
    };
    if (document.cookie) {
      headers.Cookie = document.cookie;
    }
    return headers;
  }

  /**
   * 启用network域
   * @public
   */
  enable() {
    this.cacheRequest.forEach((data) => this.send(data));
    if (!this.isEnabled) {
      this.isEnabled = true;
      this.cacheImgRequest.forEach(({ url, responseTime, success }) => this.sendImgNetworkEvent(url, responseTime, success));
    }
  }

  /**
   * 获取请求响应内容
   * @public
   * @param {Object} params
   * @param {Number} params.requestId 请求唯一标识id
   */
  getResponseBody({ requestId }) {
    const body = this.responseText.get(requestId);
    const base64Match = body?.match(/^data:.+;base64,/);
    if (base64Match?.index === 0) {
      return {
        body: body.substring(base64Match[0].length),
        base64Encoded: true,
      };
    }
    return {
      body,
      base64Encoded: false,
    };
  }

  /**
   * 获取cookie
   * @public
   */
  getCookies() {
    const cookies = jsCookie.get();
    return {
      cookies: Object.keys(cookies).map((name) => ({ name, value: cookies[name] }))
    };
  }

  /**
   * 删除指定cookie
   * @public
   * @param {Object} params
   * @param {String} params.name cookie的名称
   */
  deleteCookies({ name }) {
    jsCookie.remove(name, { path: '/' });
  }

  /**
   * 设置cookie
   * @public
   * @param {Object} params
   * @param {String} params.name cookie的名称
   * @param {String} params.value cookie的值
   * @param {String} params.path 路径
   */
  setCookie({ name, value, path }) {
    jsCookie.set(name, value, { path });
  }

  /**
   * 设置缓存禁用
   * @public
   * @param {Object} params
   * @param {Boolean} params.cacheDisabled 是否禁用缓存
   */
  setCacheDisabled({ cacheDisabled }) {
    if (cacheDisabled) {
      console.warn('[RemoteDev][Network]', 'Cache disabled is unsupported');
    }
  }

  /**
   * 获取请求的唯一标识id
   * @private
   */
  getRequestId() {
    return this.requestId++;
  }

  /**
   * 拦截XMLHttpRequest请求
   * @private
   */
  hookXhr() {
    const instance = this;
    const xhrSend = XMLHttpRequest.prototype.send;
    const xhrOpen = XMLHttpRequest.prototype.open;
    const xhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.open = function (...params) {
      return JDB.runInNativeEnv(() => {
        const [method, url] = params;
        // 将一些必要的信息挂载到xhr实例上面
        this.$$request = {
          method,
          url: getAbsoultPath(url),
          requestId: instance.getRequestId(),
          headers: Network.getDefaultHeaders(),
        };

        // 调用原始的open方法
        xhrOpen.apply(this, params);
      });
    };

    XMLHttpRequest.prototype.send = function (data) {
      return JDB.runInNativeEnv(() => {
        const request = this.$$request;
        const { requestId, url, method } = request;
        if (method.toLowerCase() === 'post') {
          request.postData = data;
          request.hasPostData = !!data;
        }

        const requestTime = getTimestamp();
        const requestWillBeSentEvent = (params) => instance.socketSend({ method: Event.requestWillBeSent, params });
        const requestWillBeSentParams = {
          requestId,
          request,
          documentURL: location.href,
          timestamp: requestTime,
          wallTime: getWallTime(requestTime),
          type: this.$$type || 'XHR',
        };

        if (typeof this.$$requestWillBeSent === 'function') {
          this.$$requestWillBeSent(requestWillBeSentParams, requestWillBeSentEvent);
        } else {
          requestWillBeSentEvent(requestWillBeSentParams);
        }

        // 监听事件
        let sendStart;
        this.addEventListener('readystatechange', () => {
          return JDB.runInNativeEnv(() => {
            if (this.readyState === 2) {
              sendStart = (getTimestamp() - requestTime) * 1000 / 2;
            } else if (this.readyState === 4) {
              // 请求完成后，获取到http响应头
              const headers = this.getAllResponseHeaders();
              const responseHeaders = Network.formatResponseHeader(headers);

              const responseHasBeenReceivedEvent = (params) => instance.sendNetworkEvent(params);
              const responseHasBeenReceivedParams = {
                requestId,
                url: getAbsoultPath(url),
                headers: responseHeaders,
                blockedCookies: [],
                headersText: headers,
                type: this.$$type || 'XHR',
                status: this.status,
                statusText: this.statusText,
                encodedDataLength: getHttpResLen(this.status, this.statusText, headers, Number(this.getResponseHeader('Content-Length')) || 0),
                timing: {
                  requestTime,
                  receiveHeadersEnd: (getTimestamp() - requestTime) * 1000 - 0.01,
                  sendEnd: sendStart + 0.01,
                  sendStart,
                },
              };

              if (typeof this.$$responseHasBeenReceived === 'function') {
                this.$$responseHasBeenReceived(responseHasBeenReceivedParams, responseHasBeenReceivedEvent);
              } else {
                responseHasBeenReceivedEvent(responseHasBeenReceivedParams);
              }

              if (this.responseType === '' || this.responseType === 'text') {
                // 请求结束后缓存响应结果，在getResponseBody时会用到
                instance.responseText.set(this.$$request.requestId, this.responseText);
              }
            }
          });
        });

        // 调用原始的send方法
        xhrSend.call(this, data);
      });
    };

    XMLHttpRequest.prototype.setRequestHeader = function (key, value) {
      return JDB.runInNativeEnv(() => {
        if (this.$$request) {
          this.$$request.headers[key] = value;
        }
        xhrSetRequestHeader.call(this, key, value);
      });
    };
  }

  /**
   * 拦截Fetch请求
   * @private
   */
  hookFetch() {
    const instance = this;
    const originFetch = window.fetch;

    window.fetch = function (request, initConfig = {}) {
      return JDB.runInNativeEnv(() => {
        let url;
        let method;
        let data = '';
        // request是string时，此时为请求的url
        if (typeof request === 'string') {
          url = request;
          method = initConfig.method || 'get';
          data = initConfig.body;
        } else {
          // 否则是Request对象
          ({ url, method } = request);
        }

        url = getAbsoultPath(url);
        const requestId = instance.getRequestId();
        const requestTime = getTimestamp();
        const sendRequest = {
          url,
          method,
          requestId,
          headers: Network.getDefaultHeaders(),
        };

        if (method.toLowerCase() === 'post') {
          sendRequest.postData = data;
          sendRequest.hasPostData = !!data;
        }

        instance.socketSend({
          method: Event.requestWillBeSent,
          params: {
            requestId,
            documentURL: location.href,
            timestamp: requestTime,
            wallTime: getWallTime(requestTime),
            type: 'Fetch',
            request: sendRequest,
          }
        });

        return originFetch(request, initConfig).then((response) => {
          return JDB.runInNativeEnv(() => {
            const { headers, status, statusText } = response;
            const responseHeaders = {};
            let headersText = '';
            headers.forEach((val, key) => {
              key = key2UpperCase(key);
              responseHeaders[key] = val;
              headersText += `${key}: ${val}\r\n`;
            });

            const responseTime = getTimestamp();
            const sendStart = (responseTime - requestTime) * 1000 / 2;
            const contentType = headers.get('Content-Type');

            instance.sendNetworkEvent({
              url,
              requestId,
              status,
              statusText,
              headersText,
              type: 'Fetch',
              blockedCookies: [],
              headers: responseHeaders,
              encodedDataLength: getHttpResLen(status, statusText, headersText, Number(headers.get('Content-Length')) || 0),
              timing: {
                requestTime,
                receiveHeadersEnd: sendStart * 2 - 0.01,
                sendEnd: sendStart + 0.01,
                sendStart,
              },
            });

            if (['application/json', 'application/javascript', 'text/plain', 'text/html', 'text/css'].some((type) => contentType.includes(type))) {
              response.clone().text().then((responseBody) => {
                instance.responseText.set(requestId, responseBody);
              });
            }

            return response;
          });
        }).catch((error) => {
          return JDB.runInNativeEnv(() => {
            instance.sendNetworkEvent({
              url,
              requestId,
              blockedCookies: [],
              type: 'Fetch',
            });
            throw error;
          });
        });
      });
    };
  }

  /**
   * 拦截Image请求
   * @private
   */
  hookImage() {
    const instance = this;
    const handleImage = (e, success) => {
      if (e.target.tagName.toLowerCase() === 'img') {
        const url = e.target.src;
        const responseTime = getTimestamp();
        if (this.isEnabled) {
          instance.sendImgNetworkEvent(url, responseTime, success);
        } else {
          this.cacheImgRequest.push({ url, responseTime, success });
        }
      }
    };
    document.addEventListener('load', (e) => handleImage(e, true), true);
    document.addEventListener('error', (e) => handleImage(e, false), true);
  }

  /**
   * 发送图片network相关协议
   * @private
   */
  sendImgNetworkEvent(url, responseTime, success) {
    const instance = this;
    const requestStart = getTimestamp();
    const requestUrl = getImgRequestUrl(url);
    oriFetch(requestUrl, { responseType: 'blob' })
      .then((response) => {
        const { headers, status: fetchStatus, statusText } = response;
        const responseEnd = getTimestamp();
        const responseHeaders = {};
        let headersText = '';
        headers.forEach((val, key) => {
          key = key2UpperCase(key);
          responseHeaders[key] = val;
          headersText += `${key}: ${val}\r\n`;
        });

        const status = success ? 200 : fetchStatus;
        const requestId = instance.getRequestId();
        const requestTime = responseTime - responseEnd + requestStart;
        const sendStart = (responseTime - requestTime) * 1000 / 4;
        const sendRequest = {
          url,
          method: 'GET',
          requestId,
          headers: Network.getDefaultHeaders(),
        };

        instance.socketSend({
          method: Event.requestWillBeSent,
          params: {
            requestId,
            documentURL: location.href,
            timestamp: requestTime,
            wallTime: getWallTime(requestTime),
            type: 'Image',
            request: sendRequest,
          },
        });

        response.blob().then((blob) => {
          instance.sendNetworkEvent({
            url,
            requestId,
            status,
            statusText,
            headersText,
            type: 'Image',
            blockedCookies: [],
            timestamp: responseTime,
            headers: responseHeaders,
            encodedDataLength: getHttpResLen(status, statusText, headersText, blob.size || 0),
            timing: {
              requestTime,
              receiveHeadersEnd: sendStart * 2 - 0.01,
              sendEnd: sendStart + 0.01,
              sendStart,
            },
          });
          const reader = new FileReader();
          reader.onload = () => instance.responseText.set(requestId, reader.result);
          reader.readAsDataURL(blob);
        });
      });
  }

  /**
   * 发送network相关的协议
   * @private
   */
  sendNetworkEvent(params) {
    const {
      requestId, headers, headersText, type, url, status, statusText,
      encodedDataLength, fromDiskCache, timestamp, timing,
    } = params;

    this.socketSend({
      method: Event.responseReceivedExtraInfo,
      params: { requestId, headers, blockedCookies: [], headersText },
    });

    this.socketSend({
      method: Event.responseReceived,
      params: {
        type,
        requestId,
        timestamp: timestamp || getTimestamp(),
        response: {
          url,
          status,
          statusText,
          headers,
          fromDiskCache,
          mimeType: (headers['Content-Type'] || headers['content-type'] || '').split(';')[0],
          timing: !timing ? null : Object.assign({
            receiveHeadersEnd: 0,
            sendStart: 0,
            sendEnd: 0,
            pushStart: 0,
            pushEnd: 0,
            proxyStart: -1,
            proxyEnd: -1,
            dnsStart: -1,
            dnsEnd: -1,
            connectStart: -1,
            connectEnd: -1,
            sslStart: -1,
            sslEnd: -1,
          }, timing),
        },
      },
    });

    this.socketSend({
      method: Event.loadingFinished,
      params: {
        requestId,
        encodedDataLength: fromDiskCache ? 0 : encodedDataLength,
        timestamp: timestamp || getTimestamp(),
      },
    });
  }

  /**
   * 缓存并发送数据
   * @private
   */
  socketSend(data) {
    this.cacheRequest.push(data);
    if (this.isEnabled) {
      this.send(data);
    }
  }
}
