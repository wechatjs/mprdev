import JDB from '../common/jdb';
import BaseDomain from './domain';
import { formatErrorStack, getAbsoultPath } from '../common/utils';
import { exceptionFormat, getIdByObject, objectFormat } from '../common/remote-obj';
import { Event } from './protocol';

export default class Debugger extends BaseDomain {
  namespace = 'Debugger';
  
  // javascript脚本集合
  scripts = new Map();
  scriptUrls = new Map();
  scriptUrlSet = new Set();
  scriptDebugOffsets = new Map();

  // javascript脚本的唯一id
  scriptId = 1;

  enabledCount = 0;

  constructor(options) {
    super(options);
    this.hookScriptElement();
  }

  /**
   * 启用debugger域
   * @public
   */
  enable() {
    this.enabledCount++;
    this.enableJsDebugger();
    this.sendCacheScripts();
    this.collectScripts();
  }

  disable() {
    this.enabledCount--;
    this.disableJsDebugger();
  }

  /**
   * 获取js脚本文件内容
   * @public
   * @param {Object} params
   * @param {Number} params.scriptId javascript脚本内容的id
   */
  getScriptSource({ scriptId }) {
    return {
      scriptSource: this.getScriptSourceById(scriptId)
    };
  }

  /**
   * 在当前作用域执行脚本
   * @public
   * @param {Object} params
   * @param {Number} params.callFrameId 调用帧id
   * @param {String} params.expression 表达式字符串
   * @param {Boolean} params.generatePreview 是否生成预览
   * @param {Boolean} params.silent 是否需要抛错误
   */
  evaluateOnCallFrame({ callFrameId, expression, generatePreview, silent }) {
    return JDB.runInSkipOver(() => {
      const res = {};
      try {
        res.result = objectFormat(JDB.eval(expression, callFrameId), { preview: generatePreview });
      } catch (err) {
        if (!silent) {
          res.result = objectFormat(err.toString(), { preview: generatePreview });
          res.exceptionDetails = exceptionFormat(err.toString());
        }
      }
      return res;
    });
  }

  /**
   * 获取允许断点的位置
   * @public
   * @param {Object} params
   * @param {Location} params.start javascript脚本开始位置
   * @param {Location} params.end javascript脚本结束位置
   */
  getPossibleBreakpoints({ start, end }) {
    const { scriptId, lineNumber } = start;
    return {
      locations:[{
        scriptId, lineNumber
      }]
    };
  }

  /**
   * 设置断点是否启用
   * @public
   * @param {Object} params
   * @param {Boolean} params.active 是否启用
   */
  setBreakpointsActive({ active }) {
    JDB.setBreakpointsActive(active);
  }

  /**
   * 设置js脚本文件断点
   * @public
   * @param {Object} params
   * @param {Number} params.lineNumber 断点所在行
   * @param {String} params.condition 条件断点执行脚本
   */
  setBreakpointByUrl({ url, lineNumber, condition }) {
    const scriptId = this.scriptUrls.get(url);
    if (typeof scriptId === 'string') {
      const offset = this.scriptDebugOffsets.get(scriptId) || 0;
      const breakpoint = JDB.setBreakpoint(url, lineNumber - offset, condition);
      if (breakpoint) {
        return {
          breakpointId: breakpoint.id,
          locations: [{
            scriptId,
            lineNumber: breakpoint.lineNumber + offset,
            columnNumber: 0
          }],
        };
      }
    }
    console.warn(`Failed to set breakpoint by "${url}"`);
    // 兜底返回
    const tmpId = Date.now() + Math.random();
    return {
      breakpointId: tmpId,
      locations: [{
        scriptId: scriptId || tmpId,
        lineNumber: lineNumber,
        columnNumber: 0
      }],
    };
  }

  /**
   * 移除断点
   * @public
   * @param {Object} params
   * @param {Number} params.breakpointId 断点id
   */
  removeBreakpoint({ breakpointId }) {
    JDB.removeBreakpoint(breakpointId);
  }

  /**
   * 异常时暂停
   * @public
   * @param {Object} params
   * @param {Number} params.state 异常类型
   */
  setPauseOnExceptions({ state }) {
    JDB.setPauseOnExceptions(state);
  }

  /**
   * 手动暂停
   * @public
   */
  pause() {
    JDB.pause();
  }

  /**
   * 恢复执行
   * @public
   */
  resume() {
    JDB.resume();
  }

  /**
   * 单步执行
   * @public
   */
  stepInto() {
    JDB.resume('stepInto');
  }

  /**
   * 跳出当前函数
   * @public
   */
  stepOut() {
    JDB.resume('stepOut');
  }

  /**
   * 跳过当前语句
   * @public
   */
  stepOver() {
    JDB.resume('stepOver');
  }

  /**
   * 返回已收集过的js脚本文件
   * @private
   */
  sendCacheScripts() {
    for (const url of this.scriptUrls.keys()) {
      const scriptId = this.scriptUrls.get(url);
      const sourceMapURL = this.getSourceMappingURL(this.getScriptSourceById(scriptId));
      this.send({
        method: Event.scriptParsed,
        params: {
          scriptId,
          sourceMapURL,
          startColumn: 0,
          startLine: 0,
          endColumn: 999999,
          endLine: 999999,
          scriptLanguage: 'JavaScript',
          url,
        }
      });
      JDB.checkIfBreakWhenEnable(url);
    }
  }

  /**
   * 收集页面的所有script
   * @private
   */
  collectScripts() {
    this.scriptUrlSet = new Set(
      Array.from(document.querySelectorAll('script'))
        .map((se) => se.getAttribute('src'))
        .filter(Boolean)
        .map((s) => getAbsoultPath(s))
        .concat(Array.from(this.scriptUrlSet))
    );
    Array.from(this.scriptUrlSet).forEach((absSrc) => {
      this.fetchScriptSource(absSrc);
    });
  }

  /**
   * hook script标签原型，收集js创建的所有script
   * @private
   */
  hookScriptElement() {
    const oriScriptElProtoSrcDptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    if (oriScriptElProtoSrcDptor?.configurable && typeof oriScriptElProtoSrcDptor.set === 'function') {
      const domainThis = this;
      const oriSetter = oriScriptElProtoSrcDptor.set;
      Object.defineProperty(HTMLScriptElement.prototype, 'src', Object.assign({}, oriScriptElProtoSrcDptor, {
        set(src) {
          if (src) {
            const absSrc = getAbsoultPath(src);
            domainThis.scriptUrlSet.add(absSrc);
            if (domainThis.enabledCount) {
              domainThis.fetchScriptSource(absSrc);
            }
          }
          return oriSetter.apply(this, arguments);
        },
      }));
    }
  }

  /**
   * 启用断点调试器
   * @private
   */
  enableJsDebugger() {
    if (this.enabledCount) {
      JDB.error = (params) => this.setDebuggerErrorStack(params);
      JDB.resumed = () => this.send({ method: Event.resumed });
      JDB.paused = (params) => this.sendDebuggerPausedEvent(params);
    }
  }

  /**
   * 禁用断点调试器
   * @private
   */
  disableJsDebugger() {
    if (!this.enabledCount) {
      JDB.error = () => {};
      JDB.paused = () => JDB.setOverlay('已在调试程序中暂停，请打开面板操作', true);
      JDB.resumed = () => {};
      if (JDB.getPausedInfo()) {
        JDB.setOverlay('已在调试程序中暂停，请打开面板操作', true);
      }
    }
  }

  /**
   * 设置错误的调用栈信息
   * @private
   * @param {Object} params
   * @param {Object} params.error 错误
   * @param {Object} params.scopeChian 作用域链
   */
  setDebuggerErrorStack(params) {
    const { error, scopeChain } = params;
    if (error.name && error.message) {
      error.stack = formatErrorStack(error, scopeChain.filter((scope) => !!scope.callFrame).map((scope) => {
        const callFrame = scope.callFrame;
        const cfFuncName = scope.name;
        const cfUrl = callFrame.debuggerId;
        const cfScriptId = this.scriptUrls.get(cfUrl);
        const cfLineNumber = callFrame.lineNumber;
        const cfColumnNumber = callFrame.columnNumber;
        const cfOffset = this.scriptDebugOffsets.get(cfScriptId) || 0;
        return {
          functionName: cfFuncName,
          lineNumber: cfLineNumber + cfOffset,
          columnNumber: cfColumnNumber,
          url: cfUrl
        };
      }).reverse());
    }
  }

  /**
   * 发送断点暂停事件
   * @private
   * @param {Object} params
   * @param {Object} params.debuggerId 脚本id
   * @param {Object} params.breakpointId 断点id
   * @param {Object} params.lineNumber 断点行号
   * @param {Object} params.scopeChian 作用域链
   * @param {Object} params.reason 断点原因
   * @param {Object} params.data 断点数据
   */
  sendDebuggerPausedEvent(params) {
    const { breakpointId, scopeChain, reason, data } = params;
    const globalScope = {
      type: 'global',
      object: {
        type: 'object',
        className: 'Window',
        description: 'Window',
        objectId: getIdByObject(window),
      },
    };
    const callFrames = scopeChain
      .filter((scope) => !!scope.callFrame).map((scope) => {
        const callFrameId = scope.callFrameId;
        const callFrame = scope.callFrame;
        const cfFuncName = scope.name;
        const cfUrl = callFrame.debuggerId;
        const cfScriptId = this.scriptUrls.get(cfUrl);
        const cfLineNumber = callFrame.lineNumber;
        const cfOffset = this.scriptDebugOffsets.get(cfScriptId) || 0;
        return {
          url: cfUrl,
          callFrameId,
          functionName: cfFuncName,
          location: {
            scriptId: cfScriptId,
            lineNumber: cfLineNumber + cfOffset,
          },
          scopeChain: [globalScope],
        }
      })
      .reverse();
    this.send({
      method: Event.paused,
      params: {
        callFrames: callFrames,
        reason: reason || 'other',
        data: data ? objectFormat(data) : null,
        hitBreakpoints: breakpointId ? [breakpointId] : [],
      }
    });
  }

  /**
   * 拉取js文件源内容
   * @private
   * @param {String} url javascript文件的链接地址
   */
  fetchScriptSource(url) {
    if (!this.scriptUrls.get(url)) {
      const scriptId = this.getScriptId();
      const xhr = new XMLHttpRequest();
      this.scriptUrls.set(url, scriptId);
      xhr.$$type = 'Script';
      xhr.onload = () => {
        const scriptSource = JDB.commentDebuggerCall(xhr.responseText);
        const sourceMapURL = this.getSourceMappingURL(scriptSource);
        this.scripts.set(scriptId, scriptSource);
        this.scriptDebugOffsets.set(scriptId, this.getScriptDebugOffset(xhr.responseText));
        this.parseImportScriptSource(xhr.responseText, url);
        this.parseDebugScriptSource(xhr.responseText, url);
        this.send({
          method: Event.scriptParsed,
          params: {
            scriptId,
            sourceMapURL,
            startColumn: 0,
            startLine: 0,
            endColumn: 999999,
            endLine: 999999,
            scriptLanguage: 'JavaScript',
            url,
          }
        });
        JDB.checkIfBreakWhenEnable(url);
      };
      xhr.open('GET', url);
      xhr.send();
    }
  }

  /**
   * 解析js文件中的import
   * @private
   * @param {Number} scriptSource js内容
   * @param {String} url js链接地址
   */
  parseImportScriptSource(scriptSource, url) {
    const importStrList = scriptSource.match(/(?:^|\n)\s*?import[\s|(][\s\S]*?['|"].*?['|"]\)?/g);
    importStrList?.forEach((importStr) => {
      const match = importStr.match(/(?:^|\n)\s*?import[\s|(][\s\S]*?['|"](.*?)['|"]\)?/);
      if (match?.[1] && /^[.|/]/.test(match[1])) {
        const importURL = new URL(match[1], url);
        this.scriptUrlSet.add(importURL.href);
        this.fetchScriptSource(importURL.href);
      }
    });
  }

  /**
   * 解析js文件中的远程调试debugScript
   * @private
   * @param {Number} scriptSource js内容
   * @param {String} url js链接地址
   */
  parseDebugScriptSource(scriptSource, url) {
    const debugStrList = scriptSource.match(/RemoteDevSdk\.debugSrc\(['|"].*?['|"]\)/g);
    debugStrList?.forEach((debugStr) => {
      const match = debugStr.match(/RemoteDevSdk\.debugSrc\(['|"](.*?)['|"]\)/);
      if (match?.[1] && /^[.|/]/.test(match[1])) {
        const debugURL = new URL(match[1], url);
        this.scriptUrlSet.add(debugURL.href);
        this.fetchScriptSource(debugURL.href);
      }
    });
  }

  /**
   * 获取javascript内容
   * @private
   * @param {Number} scriptId javascript脚本唯一标识
   */
  getScriptSourceById(scriptId) {
    return this.scripts.get(scriptId);
  }

  /**
   * 获取javascript的source mapping url
   * @private
   * @param {String} scriptSource javascript脚本内容
   */
  getSourceMappingURL(scriptSource) {
    if (!scriptSource) return null;
    const sourceMappingURLMatch = scriptSource.match(/\/\/#\ssourceMappingURL=(.+)/);
    return sourceMappingURLMatch?.[1];
  }

  /**
   * 获取javascript脚本的唯一标识id
   * @private
   */
  getScriptId() {
    return `${this.scriptId++}`;
  }

  /**
   * 获取debug脚本开始位置
   * @param {String} script
   * @private
   */
  getScriptDebugOffset(script) {
    const lines = script.split('\n');
    for (let offset = 0; offset < lines.length; offset++) {
      if (lines[offset].indexOf('RemoteDevSdk.debug') !== -1) {
        return offset - 1;
      }
    }
    return -1;
  }
}
