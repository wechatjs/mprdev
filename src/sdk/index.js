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

  const port = opts.port;
  const hostList = [].concat(opts.host || location.hostname);
  const protocol = opts.protocol || (location.protocol === 'https:' ? 'wss:' : 'ws:');

  let socket;
  let domain;
  let trialIdx = 0;

  const handleMessage = ({ data }) => {
    return JDB.runInNativeEnv(() => {
      try {
        const message = JSON.parse(data);
        const ret = domain.execute(message);
        socket.send(JSON.stringify(ret));
      } catch (err) {
        console.error('[RemoteDev][Message]', err.toString());
      }
    });
  };

  const getDevUrl = (host) => {
    const match = host.match(/^(.+?)([\/|\?|#].*)$/);
    const base = `${match?.[1] || host}${port ? (':' + port) : ''}${match?.[2] || ''}`;
    return `//${base}/target/${getId()}?${query}`;
  };

  const initSocket = () => {
    const host = hostList[trialIdx];
    const devUrl = getDevUrl(host);
    socket = new ReconnectingWebSocket(`${protocol}${devUrl}`);
    socket.addEventListener('message', handleMessage);
    socket.addEventListener('open', () => {
      if (!domain) {
        domain = new ChromeDomain({ socket });
      }
    });
    socket.addEventListener('error', (e) => {
      if (!domain) {
        socket.close();
        if (++trialIdx < hostList.length) {
          // 如果还有host列表，继续尝试下一个
          initSocket();
          console.warn('[RemoteDev][Connection]', `Failed to open a WebSocket connection of "${hostList[trialIdx - 1]}" and try the next host`);
        } else {
          // 否则，所有host的websocket初始化失败，用第一个host来回退到httpsocket
          const devUrl = getDevUrl(hostList[0]);
          socket = new HttpSocket(`${location.protocol}${devUrl}`);
          socket.addEventListener('message', handleMessage);
          domain = new ChromeDomain({ socket });
          console.warn('[RemoteDev][Connection]', 'Failed to open a WebSocket connection and fallback to HTTP');
        }
      } else {
        console.error('[RemoteDev][Connection]', e?.error?.toString() || 'WebSocket unknown error');
      }
    });
  };

  initSocket();

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
      console.error('[RemoteDev][Debug]', err.toString());
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
    docReady(() => init({ host: host.split(','), port, uin, title, protocol }));
  }
}
