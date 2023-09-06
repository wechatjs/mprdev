import jsCookie from 'js-cookie';
import { getAbsoultPath, key2UpperCase } from '../common/utils';
import { Event } from './protocol';
import BaseDomain from './domain';
import JDB from '../common/jdb';

const getWallTime = (now) => Date.now() / 1000 - now;
const getTimestamp = () => performance.now() / 1000;
const getHttpResLen = (s, st, h, bl) => `HTTP/1.1 ${s} ${st}\n${h}\n\n\n`.length + bl; // 计算统计响应大小的

export default class Network extends BaseDomain {
  namespace = 'Network';

  // 请求的唯一id
  requestId = 1;

  // 请求响应的集合
  responseText = new Map();

  // 用户缓存的请求
  cacheRequest = [];

  isEnabled = false;

  socketSend = (data) => {
    this.cacheRequest.push(data);
    if (this.isEnabled) {
      this.send(data);
    }
  };

  constructor(options) {
    super(options);
    this.hookXhr();
    this.hookFetch();
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
    this.isEnabled = true;
    this.cacheRequest.forEach((data) => this.send(data));
  }

  /**
   * 获取请求响应内容
   * @public
   * @param {Object} params
   * @param {Number} params.requestId 请求唯一标识id
   */
  getResponseBody({ requestId }) {
    return {
      body: this.responseText.get(requestId),
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
        // 调用原始的send方法
        xhrSend.call(this, data);

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
        let receiveHeadersEnd;
        this.addEventListener('readystatechange', () => {
          return JDB.runInNativeEnv(() => {
            if (this.readyState === 3) {
              receiveHeadersEnd = (getTimestamp() - requestTime) * 1000 - 0.1;
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
                encodedDataLength: getHttpResLen(this.status, this.statusText, headers, Number(this.getResponseHeader('Content-Length')) || this.responseText.length),
                timing: {
                  requestTime,
                  receiveHeadersEnd,
                  sendStart: 0.1,
                  sendEnd: 0.2,
                },
              };

              if (typeof this.$$responseHasBeenReceived === 'function') {
                this.$$responseHasBeenReceived(responseHasBeenReceivedParams, responseHasBeenReceivedEvent);
              } else {
                responseHasBeenReceivedEvent(responseHasBeenReceivedParams);
              }
            }
          });
        });

        this.addEventListener('load', () => {
          return JDB.runInNativeEnv(() => {
            if (this.responseType === '' || this.responseType === 'text') {
              // 请求结束后缓存响应结果，在getResponseBody时会用到
              instance.responseText.set(this.$$request.requestId, this.responseText);
            }
          });
        });
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

            let responseBody = ''
            const responseTime = getTimestamp();
            const contentType = headers.get('Content-Type');
            if (['application/json', 'application/javascript', 'text/plain', 'text/html', 'text/css'].some((type) => contentType.includes(type))) {
              responseBody = response.clone().text();
            }

            instance.sendNetworkEvent({
              url,
              requestId,
              status,
              statusText,
              headersText,
              type: 'Fetch',
              blockedCookies: [],
              headers: responseHeaders,
              encodedDataLength: getHttpResLen(status, statusText, headersText, Number(headers.get('Content-Length')) || responseBody.length),
              timing: {
                requestTime,
                receiveHeadersEnd: (responseTime - requestTime) * 1000 - 0.1,
                sendStart: 0.1,
                sendEnd: 0.2,
              },
            });

            instance.responseText.set(requestId, responseBody);

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
   * 发送network相关的协议
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
}
