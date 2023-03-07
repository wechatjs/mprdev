import qs from 'query-string';
import { v4 as uuid } from 'uuid';
import { version } from '../../package.json';
import { docReady, escapeRegString, getAbsoultPath } from './common/utils';
import ReconnectingWebSocket from 'reconnecting-websocket';
import HttpSocket from './common/httpsocket';
import ChromeDomain from './domain/index';
import JDB from './common/jdb';

// 获取页面icon
function getDocumentFavicon() {
  const links = document.head.querySelectorAll('link');
  const icon = Array.from(links).find((link) => {
    const rel = link.getAttribute('rel');
    return rel.includes('icon') || rel.includes('shortcut');
  });
  let iconUrl = '';
  if (icon) {
    iconUrl = getAbsoultPath(icon.getAttribute('href'));
  }
  return iconUrl;
}

// 获取调试id
export function getId() {
  let id = sessionStorage.getItem('debug_id');
  if (!id) {
    id = uuid();
    sessionStorage.setItem('debug_id', id);
  }
  return id;
}

// 获取uin
function getUin() {
  return window.user_uin;
}

// 获取title
function getTitle() {
  return window.msg_title || window.title || window.cgiData?.title || document.title || '';
}

// 初始化远程调试
export function init(opts = {}) {
  if (window.__remote_dev_sdk_inited__ || window !== top) return;

  const query = qs.stringify({
    url: location.href,
    uin: opts.uin || getUin(),
    title: opts.title || getTitle(),
    favicon: getDocumentFavicon(),
    ua: navigator.userAgent,
    time: Date.now(),
  });

  const host = opts.host || location.hostname;
  const port = opts.port || location.port;
  const protocol = opts.protocol || (location.protocol === 'https:' ? 'wss:' : 'ws:');
  const devUrl = `//${host}${port ? (':' + port) : ''}/target/${getId()}?${query}`;
  let socket = new ReconnectingWebSocket(`${protocol}${devUrl}`);
  let domain;

  const handleMessage = ({ data }) => {
    return JDB.runInNativeEnv(() => {
      try {
        const message = JSON.parse(data);
        const ret = domain.execute(message);
        socket.send(JSON.stringify(ret));
      } catch (err) {
        console.error(err);
      }
    });
  };

  socket.addEventListener('message', handleMessage);
  socket.addEventListener('open', () => {
    domain = new ChromeDomain({ socket });
  });
  socket.addEventListener('error', () => {
    if (!domain) {
      // websocket初始化失败，回退到httpsocket
      socket.close();
      socket = new HttpSocket(`${location.protocol}${devUrl}`);
      socket.addEventListener('message', handleMessage);
      domain = new ChromeDomain({ socket });
      console.warn('Fallback to connect DevTools by HTTP polling because of WebSocket connection failure');
    }
  });

  window.__remote_dev_sdk_inited__ = opts;
}

// 断点脚本转换工具
export function debug(rawCode, rawUrl) {
  let url = rawUrl;
  if (!url) {
    const scriptTag = document.currentScript;
    if (scriptTag) {
      url = scriptTag.src;
    }
  }
  if (!rawCode || typeof rawCode !== 'string') {
    throw new Error('Parameter "string" must be nonempty string for "RemoteDevSdk.debug"');
  }
  if (!url || typeof url !== 'string') {
    throw new Error('Parameter "url" of the script must be nonempty string for "RemoteDevSdk.debug"');
  }
  const importUrl = getAbsoultPath(url);
  JDB.rawCodeCache.set(importUrl, rawCode);
  new JDB(rawCode, importUrl);
}

// 断点脚本拉取及转换工具
const debugSrcResList = [];
function debugSrcResHandler() {
  let result = null;
  while (result = debugSrcResList[0]) {
    if (!result.rawCode) return;
    debugSrcResList.shift();
    try {
      new JDB(result.rawCode, result.importUrl);
    } catch (err) {
      console.error(err);
    }
  }
}
export function debugSrc(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Parameter "url" of the script must be nonempty string for "RemoteDevSdk.debugSrc"');
  }
  const importUrl = getAbsoultPath(rawUrl);
  const result = { importUrl, rawCode: null };
  debugSrcResList.push(result);
  JDB.getTransCode(importUrl).then((rawCode) => {
    result.rawCode = rawCode;
    debugSrcResHandler();
  });
}

// 设置断点工具是否强缓存编译结果
export function debugCache(check) {
  JDB.forceCache = (importUrl) => {
    let res = false;
    if (typeof check === 'function') {
      try { res = check(importUrl) } catch (err) { /* empty */ }
    } else if (typeof check === 'boolean') {
      res = check;
    }
    return res === true;
  };
}

export { version }
export default { version, init, debug, debugSrc, debugCache, getId }

if (document.currentScript?.src) {
  const matchUrl = (key) => document.currentScript.src.match(new RegExp(`(\\\\?|&)${escapeRegString(key)}=([^&]*)(&|$)`));
  const host = matchUrl('host')?.[2];
  const port = matchUrl('port')?.[2] * 1;
  const uin = matchUrl('uin')?.[2] * 1;
  const protocol = matchUrl('protocol')?.[2];
  const title = decodeURIComponent(matchUrl('title')?.[2] || '');
  if (host || port || uin || title) {
    docReady(() => init({ host, port, uin, title, protocol }));
  }
}
