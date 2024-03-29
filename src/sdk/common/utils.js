import { exceptionFormat, objectFormat } from './remote-obj';

export function getAbsoultPath(url) {
  if (!url || typeof url !== 'string') return '';
  const absURL = new URL(url, location.href);
  return absURL.href;
}

export function key2UpperCase(key) {
  return key.replace(/^\S|-[a-z]/g, (s) => s.toUpperCase());
}

export function isMatches(element, selector) {
  // safair内核某些选择器无法解析时，调用matches方法会抛异常，这里捕获下
  try {
    if (element.matches) {
      return element.matches((selector));
    }
    // deprecated
    if (element.webkitMatchesSelector) {
      return element.webkitMatchesSelector(selector);
    }
    if (element.mozMatchesSelector) {
      return element.mozMatchesSelector(selector);
    }
  } catch {
    return false;
  }
}

export function isMobile() {
  return /ios|iphone|ipod|android/.test(navigator.userAgent.toLowerCase());
}

export function checkSideEffect(code) {
  // 代码补全需要执行代码，但如果有副作用的时候需要中断掉。js很难做到副作用检查，所以只能简单检查是否有副作用
  if (/^[a-zA-Z0-9]*$/.test(code)) {
    // 如果是单独一个变量，就认为没有
    return false;
  }
  // 默认都认为有副作用
  return true;
}

export function docReady(callback) {
  if (typeof callback !== 'function') return;
  if (document.readyState === 'loading') {
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') {
        callback();
      }
    });
  } else {
    callback();
  }
}

export function getPromiseState(promise) {
  const check = {};
  return Promise.race([promise, check]).then((res) => {
    return res === check ? ['pending', undefined] : ['fulfilled', res];
  }).catch((res) => ['rejected', res]);
}

export function getPropertyDescriptor(obj, key) {
  let dptor;
  let proto = obj;
  while (proto && !(dptor = Object.getOwnPropertyDescriptor(proto, key))) {
    proto = proto.__proto__;
  }
  return dptor;
}

export function formatErrorStack(error, callFrames) {
  const stack = callFrames.map((cf) => {
    let line = `    at ${cf.functionName}`;
    if (cf.url) {
      line += ` (${cf.url}`;
      if (cf.lineNumber + 1) {
        line += `:${cf.lineNumber + 1}`;
        if (cf.columnNumber + 1) {
          line += `:${cf.columnNumber + 1}`;
        }
      }
      line += `)`;
    }
  }).join('\n');
  return `${error.name}: ${error.message}\n${stack}`;
}

export function simpleHash(str) {
  let hash = 0;
  for (let chr, i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}

export function escapeRegString(string) {
  return string.replace(/[\\\$\*\+\.\?\^\|\(\)\[\]\{\}]/g, (i) => `\\${i}`);
}

export function randomNum() {
  return Date.now() + Math.random();
}

export function getUrlWithRandomNum(url) {
  const loc = new URL(url);
  loc.searchParams.append('r', randomNum());
  return loc.href;
}

export function getImgRequestUrl(url) {
  if (url.match(/^http:\/\/localhost:\d+\/hevc/)) {
    const loc = new URL(url);
    const oriUrl = loc.searchParams.get('url');
    url = decodeURIComponent(oriUrl || url);
  }
  url = url.replace(/^http:\/\//, '//');
  return url;
}

export function getEvaluateResult(code, params, evaluate) {
  const { objectGroup, generatePreview, returnByValue, throwOnSideEffect } = params;
  let res;
  try {
    if (throwOnSideEffect && checkSideEffect(code)) {
      throw new EvalError('Possible side-effect in debug-evaluate');
    }
    const callReturn = evaluate(code);
    if (callReturn instanceof Promise) {
      res = getPromiseState(callReturn)
        .then(([promiseState, promiseResult]) => ({
          result: objectFormat(callReturn, {
            preview: generatePreview,
            group: objectGroup,
            value: returnByValue,
            pstate: promiseState,
            presult: promiseResult,
          }),
        }))
        .catch((err) => ({
          result: objectFormat(err.toString(), { preview: generatePreview, group: objectGroup }),
          exceptionDetails: exceptionFormat(err),
        }));
    } else {
      res = {
        result: objectFormat(callReturn, {
          preview: generatePreview,
          group: objectGroup,
          value: returnByValue,
        }),
      };
    }
  } catch (err) {
    res = {
      result: objectFormat(err.toString(), { preview: generatePreview, group: objectGroup }),
      exceptionDetails: exceptionFormat(err),
    };
  }
  return res;
}

export function getResponseParams(params, entry, requestTime, responseTime) {
  const now = requestTime * 1000;
  const cached = !!entry && (!entry.nextHopProtocol && entry.duration < 30);
  const fetchStart = entry?.fetchStart || now;
  return Object.assign({}, params, {
    timestamp: responseTime,
    fromDiskCache: cached,
    timing: entry?.nextHopProtocol ? {
      requestTime,
      receiveHeadersEnd: entry?.responseStart && entry?.responseStart - fetchStart,
      sendStart: entry?.requestStart && entry?.requestStart - fetchStart,
      sendEnd: entry?.requestStart && entry?.requestStart - fetchStart,
      dnsStart: entry?.domainLookupStart && entry?.domainLookupStart - fetchStart || -1,
      dnsEnd: entry?.domainLookupEnd && entry?.domainLookupEnd - fetchStart || -1,
      connectStart: entry?.connectStart && entry?.connectStart - fetchStart || -1,
      connectEnd: entry?.connectEnd && entry?.connectEnd - fetchStart || -1,
      sslStart: entry?.secureConnectionStart && entry?.secureConnectionStart - fetchStart || -1,
      sslEnd: entry?.secureConnectionStart && entry?.connectEnd - fetchStart || -1,
    } : (entry ? null : params.timing),
  });
};

export function requestSource(url, type, onload, onerror) {
  const now = performance.now();
  const entries = Array.from(performance.getEntries?.() || []);
  const entry = entries.find((e) => e.name === url);
  const wallTime = (Date.now() - now) / 1000;
  const fetchStart = entry?.fetchStart || now;
  const timestamp = fetchStart / 1000;
  const accept = type === 'Document' ? 'text/html' : '*/*';
  const getResParams = (params) => getResponseParams(params, entry, timestamp, (entry?.responseEnd || (fetchStart + performance.now() - now)) / 1000);

  const retryWithCookie = (requestId) => {
    // 如果获取失败，带上cookie再请求一次
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    xhr.$$type = type;
    xhr.$$requestWillBeSent = () => {}; // 去掉发送日志
    xhr.$$responseHasBeenReceived = (params, emitEvent) => emitEvent(Object.assign(getResParams(params), { requestId, url })); // 复用原有requestId和url
    xhr.onerror = () => typeof onerror === 'function' && onerror(xhr);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        typeof onload === 'function' && onload(xhr);
      } else {
        typeof onerror === 'function' && onerror(xhr);
      }
    };
    xhr.open('GET', getUrlWithRandomNum(url));
    xhr.setRequestHeader('Accept', accept);
    xhr.send();
  };

  const xhr = new XMLHttpRequest();
  xhr.$$type = type;
  xhr.$$requestWillBeSent = (params, emitEvent) => emitEvent(Object.assign({}, params, { wallTime, timestamp })); // 还原真实的请求时间
  xhr.$$responseHasBeenReceived = (params, emitEvent) => xhr.status >= 200 && xhr.status < 300 && emitEvent(getResParams(params));
  xhr.onerror = () => retryWithCookie(xhr.$$request.requestId);
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      typeof onload === 'function' && onload(xhr);
    } else {
      retryWithCookie(xhr.$$request.requestId);
    }
  };
  xhr.open('GET', url);
  xhr.setRequestHeader('Accept', accept);
  xhr.send();
}

function prepareStackTrace(_, stack) {
  if (typeof stack === 'string') {
    return stack
      .split('\n')
      .map(line => {
        const atIndex = line.indexOf('@');
        const [columnNumber, lineNumber, ...urlReverse] = line.split(':').reverse()

        const funcName = line.slice(0, atIndex);
        const url = urlReverse.reverse().join(':').slice(atIndex + 1);

        return {
          getFileName: () => url,
          getFunctionName: () => funcName,
          getLineNumber: () => isNaN(+lineNumber) ? +columnNumber : +lineNumber,
          getColumnNumber: () => isNaN(+lineNumber) ? undefined : +columnNumber,
        };
      });
  }
  return stack;
}

export function getCallSites() {
	const tmp = Error.prepareStackTrace;
	Error.prepareStackTrace = prepareStackTrace;

	const { stack } = new Error();
	Error.prepareStackTrace = tmp;

  if (typeof stack === 'string') return prepareStackTrace(undefined, stack).slice(1);
	return stack.slice(1);
}
