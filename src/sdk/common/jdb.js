import vDebugger from 'vdebugger';
import localForage from 'localforage';
import { docReady, getUrlWithRandomNum, simpleHash } from './utils';

// 显示调试蒙层
const debugMark = document.createElement('div');
const debugTips = document.createElement('div');
const debugGo = document.createElement('span');
debugMark.className = 'devtools-debugger';
debugTips.className = 'devtools-debugger';
debugGo.className = 'devtools-debugger';
debugMark.style.cssText = 'display:none;position:fixed;top:0;bottom:0;left:0;right:0;z-index:999999999;background:rgba(0,0,0,.3);font-family:Arial';
debugTips.style.cssText = 'color:#333;background:#ffffcc;margin:24px auto 0;font-size:17px;height:24px;line-height:24px;padding:2px 4px 2px 6px;border-radius:2px';
debugGo.style.cssText = 'color:#1a73e8;padding-left:8px;cursor:pointer';
debugGo.innerText = '►';
debugGo.addEventListener('touchstart', () => JDB.resume(), true);
debugMark.addEventListener('touchstart', (e) => e.preventDefault());
debugMark.appendChild(debugTips);
docReady(() => document.body.appendChild(debugMark));

const oriFetch = window.fetch;
const codeFetch = (url) => oriFetch(url).then((res) =>
  res.ok ? res.text() : oriFetch(getUrlWithRandomNum(url), { credentials: 'include' }).then((res) => res.text())
);

const cacheKey = 'debug_cache';
const useCache = sessionStorage.getItem(cacheKey);
localForage.config({ driver: localForage.INDEXEDDB, storeName: cacheKey });

if (!useCache) {
  // 只在当前页面会话中缓存转换结果，如果第一次进来，清空上一次缓存
  sessionStorage.setItem(cacheKey, true);
  localForage.clear();
}

export default class JDB {
  static error = () => {};
  static paused = () => JDB.setOverlay('已在调试程序中暂停，请打开面板操作', true);
  static resumed = () => {};
  static forceCache = () => false;

  constructor(rawCode, debuggerId) {
    const run = vDebugger.debug(rawCode, debuggerId);
    run && run();
  }

  /**
   * 因为调试工具拉取script文本是异步的，提供方法用于检查目前的script是否命中了断点
   * @param {String} debuggerId
   */
  static checkIfBreakWhenEnable(debuggerId) {
    const pausedInfo = JDB.getPausedInfo();
    if (pausedInfo?.debuggerId === debuggerId) {
      JDB.paused(pausedInfo);
    }
  }

  /**
   * 在原生环境下执行代码
   * @param {Function} callback 执行回调
   */
  static runInNativeEnv(callback) {
    return vDebugger.runInNativeEnv(callback);
  }

  /**
   * 跳过调试执行代码
   * @param {Function} callback 执行回调
   */
  static runInSkipOver(callback) {
    return vDebugger.runInSkipOver(callback);
  }

  /**
   * 恢复执行
   * @param {String} type 恢复类型
   */
  static resume(type) {
    return vDebugger.resume(type);
  }

  /**
   * 暂停执行
   */
  static pause() {
    return vDebugger.setExecutionPause(true);
  }

  /**
   * 异常时暂停执行
   * @param {String} state 异常类型
   */
  static setPauseOnExceptions(state) {
    return vDebugger.setExceptionPause(state !== 'none');
  }

  /**
   * 在特定作用域下执行表达式
   * @param {String} expression 表达式
   * @param {Number} callFrameId 调用帧id
   */
  static eval(expression, callFrameId) {
    return vDebugger.evaluate(expression, callFrameId);
  }

  /**
   * 获取可能的断点位置
   * @param {String} debuggerId 调试器id，通常是script的url
   */
  static getPossibleBreakpoints(debuggerId) {
    return vDebugger.getPossibleBreakpoints(debuggerId);
  }

  /**
   * 设置断点
   * @param {String} debuggerId 调试器id，通常是script的url
   * @param {Number} lineNumber 尝试断点的行号
   * @param {Number} columnNumber 尝试断点的列号
   * @param {String} condition 条件断点的条件
   */
  static setBreakpoint(debuggerId, lineNumber, columnNumber, condition) {
    return vDebugger.setBreakpoint(debuggerId, lineNumber, columnNumber, condition);
  }

  /**
   * 移除断点
   * @param {Number} id 断点id
   */
  static removeBreakpoint(id) {
    return vDebugger.removeBreakpoint(id);
  }

  /**
   * 是否禁用断点
   * @param {Boolean} active
   */
  static setBreakpointsActive(active) {
    return vDebugger.setBreakpointsActive(active);
  }

  /**
   * 获取作用域链
   */
  static getScopeChain() {
    return vDebugger.getScopeChain();
  }

  /**
   * 判断目前是否暂停
   */
  static getPausedInfo() {
    return vDebugger.getPausedInfo();
  }

  /**
   * 注释掉debug包裹，方便调试工具高亮
   * @param {String} script
   */
  static commentDebuggerCall(script) {
    return script.replace(/RemoteDevSdk\.debug\(`([\s\S]+)`,?.*\);?/, (_, code) => {
      // return `/* RemoteDevSdk.debug(\` */${code.replace(/\\`/g, '`')}/* \`).replace(/\\\$/g, '$'); */`;
      return code.replace(/\\`/g, '`').replace(/\\\$/g, '$');
    });
  }

  /**
   * 获取转换脚本，如果有缓存，则使用缓存
   * @param {String} importUrl 脚本url
   */
  static getTransCode(importUrl) {
    // 如果是直接强缓存，则检查缓存并返回，有缓存时不再发起请求
    if (JDB.forceCache(importUrl)) {
      return localForage.getItem(importUrl).then((cache) => {
        return cache || codeFetch(importUrl)
          .then((script) => localForage.setItem(importUrl, vDebugger.transform(script, importUrl)));
      });
    }
    // 否则仍然发起请求，再判断是否使用缓存
    return codeFetch(importUrl).then((script) => {
      const hash = simpleHash(script) + importUrl;
      return localForage.getItem(hash)
        .then((cache) => cache || localForage.setItem(hash, vDebugger.transform(script, importUrl)));
    });
  }

  /**
   * 显示调试蒙层
   * @param {String} message 提示信息
   * @param {Boolean} banResume 禁用恢复按钮
   */
  static setOverlay(message, banResume) {
    if (message) {
      debugTips.innerText = message;
      if (!banResume) {
        debugTips.appendChild(debugGo);
      }
      debugMark.style.display = 'flex';
    } else {
      debugMark.style.display = 'none';
    }
  }
}

vDebugger.addEventListener('error', (params) => JDB.error(params));
vDebugger.addEventListener('paused', (params) => JDB.paused(params));
vDebugger.addEventListener('resumed', () => JDB.setOverlay());
vDebugger.addEventListener('resumed', () => JDB.resumed());
vDebugger.setModuleRequest(JDB.getTransCode);
