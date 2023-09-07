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

export function getPropertyDescriptor(obj, key) {
  let dptor;
  let proto = obj;
  while (proto && !(dptor = Object.getOwnPropertyDescriptor(proto, key))) {
    proto = proto.__proto__;
  }
  return dptor;
}

export function formatErrorStack(error, callFrames) {
  const stack = callFrames.map((cf) => `    at ${cf.functionName} (${cf.url}:${cf.lineNumber + 1}:${cf.columnNumber + 1})`).join('\n');
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

export function requestSource(url, type, onload, onerror) {
  const now = performance.now();
  const entries = Array.from(performance.getEntries());
  const entry = entries.find((e) => e.name === url);
  const cached = !!entry && !entry.nextHopProtocol;
  const wallTime = (Date.now() - now) / 1000;
  const fetchStart = (entry?.fetchStart || now);
  const timestamp = fetchStart / 1000;
  const getResponseParams = (params) => Object.assign({}, params, {
    timestamp: (entry?.responseEnd || (fetchStart + performance.now() - now)) / 1000,
    fromDiskCache: cached,
    timing: entry?.nextHopProtocol ? {
      requestTime: timestamp,
      receiveHeadersEnd: entry?.responseStart - fetchStart,
      sendStart: entry?.requestStart - fetchStart,
      sendEnd: entry?.requestStart - fetchStart,
      dnsStart: entry?.domainLookupStart - fetchStart,
      dnsEnd: entry?.domainLookupEnd - fetchStart,
      connectStart: entry?.connectStart - fetchStart,
      connectEnd: entry?.connectEnd - fetchStart,
    } : (entry ? null : params.timing),
  });

  const retryWithCookie = (requestId) => {
    // 如果获取失败，带上cookie再请求一次
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    xhr.$$type = type;
    xhr.$$requestWillBeSent = () => {}; // 去掉发送日志
    xhr.$$responseHasBeenReceived = (params, emitEvent) => emitEvent(Object.assign(getResponseParams(params), { requestId, url })); // 复用原有requestId和url
    xhr.onerror = () => typeof onerror === 'function' && onerror(xhr);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        typeof onload === 'function' && onload(xhr);
      } else {
        typeof onerror === 'function' && onerror(xhr);
      }
    };
    xhr.open('GET', getUrlWithRandomNum(url));
    xhr.send();
  };

  const xhr = new XMLHttpRequest();
  xhr.$$type = type;
  xhr.$$requestWillBeSent = (params, emitEvent) => emitEvent(Object.assign({}, params, { wallTime, timestamp })); // 还原真实的请求时间
  xhr.$$responseHasBeenReceived = (params, emitEvent) => xhr.status >= 200 && xhr.status < 300 && emitEvent(getResponseParams(params));
  xhr.onerror = () => retryWithCookie(xhr.$$request.requestId);
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      typeof onload === 'function' && onload(xhr);
    } else {
      retryWithCookie(xhr.$$request.requestId);
    }
  };
  xhr.open('GET', url);
  xhr.send();
}
