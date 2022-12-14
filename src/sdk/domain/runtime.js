import { objectFormat, objectRelease, getObjectProperties, exceptionFormat, callOnObject } from '../common/remote-obj';
import { formatErrorStack } from '../common/utils';
import { isQuiteMode } from '../common/mode';
import { Event } from './protocol';
import BaseDomain from './domain';
import Debugger from './debugger';
import callsites from 'callsites';
import JDB from '../common/jdb';

const oriEval = window.eval;
const oriAlert = window.alert;
const oriConfirm = window.confirm;
const oriPrompt = window.prompt;

const locRegStr = '(.+):([0-9]+):([0-9]+)';
const locReg = new RegExp(locRegStr);
const iosReg = new RegExp(`(.*)@${locRegStr}`);
const androidReg = new RegExp(`\\(${locRegStr}\\)`);

export default class Runtime extends BaseDomain {
  namespace = 'Runtime';

  // 缓存console
  cacheConsole = [];
  // 缓存runtime时的error错误
  cacheError = [];

  isEnabled = false;

  socketSend = (type, data) => {
    if (type === 'console') {
      this.cacheConsole.push(data);
    } else if (type === 'error') {
      this.cacheError.push(data);
    }
    if (this.isEnabled) {
      this.send(data);
    }
  };

  constructor(options) {
    super(options);
    this.hookConsole();
    this.listenError();
  }

  /**
   * 获取调用堆栈
   * @static
   * @param {Error} error
   */
  static getCallFrames(error) {
    const scopeChain = JDB.getScopeChain();
    let callFrames = [];

    if (error) {
      const stack = error.stack;
      const stackLines = stack.split('\n');
      if (stackLines[0].includes(error.message)) {
        stackLines.shift(); // 去掉开头错误信息行
      }
      callFrames = stackLines.map((val) => Runtime.getPositionAndUrl(val));
    } else if (scopeChain.length) {
      callFrames = scopeChain.filter((scope) => !!scope.callFrame).reverse().map((scope) => {
        const callFrame = scope.callFrame;
        const cfFuncName = scope.name;
        const cfUrl = callFrame.debuggerId;
        const cfLineNumber = callFrame.lineNumber;
        const cfColumnNumber = callFrame.columnNumber;
        const cfScriptId = Debugger.scriptUrls.get(cfUrl) || '';
        return {
          functionName: cfFuncName,
          lineNumber: cfLineNumber - 1, // TODO: 因为需要用到debugger里的偏移量，但目前拿不到实例，先无脑-1
          columnNumber: cfColumnNumber,
          scriptId: cfScriptId,
          url: cfUrl,
        }
      });
    } else if (Error.captureStackTrace) {
      // Safari不支持captureStackTrace，这里判断下
      let consoleIdx = -1; // 记录hook的console位置，忽略这部分调用栈
      callFrames = callsites().map((val, idx) => {
        const url = val.getFileName();
        const funcName = val.getFunctionName() || '(anonymous)';
        if (funcName.includes('window.console.<computed>')) {
          consoleIdx = idx;
        }
        return {
          functionName: funcName,
          lineNumber: (val.getLineNumber() - 1) || 0,
          columnNumber: (val.getColumnNumber() - 1) || 0,
          scriptId: Debugger.scriptUrls.get(url) || '',
          url,
        }
      }).filter((_, idx) => idx > consoleIdx);
    } else {
      const tmpErr = new Error();
      const stack = tmpErr.stack;
      const stackLines = stack.split('\n');
      stackLines.shift(); // 去掉getCallFrames调用栈
      stackLines.shift(); // 去掉getPositionAndUrl调用栈
      stackLines.shift(); // 去掉runInNativeEnv调用栈
      callFrames = stackLines.map((val) => Runtime.getPositionAndUrl(val));
    }

    return callFrames;
  }

  /**
   * 从错误堆栈(stack)中获取到每条堆栈代码的行号列号
   * @static
   */
  static getPositionAndUrl(str) {
    let loc = str.trim();
    let functionName = loc;
    let lineNumber = 0;
    let columnNumber = 0;
    let url = '';

    if (iosReg.test(loc)) { // ios
      const res = loc.match(iosReg);
      functionName = res[1] || '(anonymous)';
      url = res[2];
      lineNumber = (res[3] * 1 - 1) || 0;
      columnNumber = (res[4] * 1 - 1) || 0;
    } else if (loc.startsWith('at')) { // android
      const locInfo = loc.split(' ');
      let res = locInfo[locInfo.length === 3 ? 2 : 1];
      if (typeof res === 'string') {
        res = res.match(locInfo.length === 3 ? androidReg : locReg);
      }
      if (res) {
        functionName = locInfo.length === 3 ? locInfo[1] : '(anonymous)';
        url = res[1];
        lineNumber = (res[2] * 1 - 1) || 0;
        columnNumber = (res[3] * 1 - 1) || 0;
      }
    } else if (locReg.test(loc)) {
      const res = loc.match(locReg);
      functionName = '(anonymous)';
      url = res[1];
      lineNumber = (res[2] * 1 - 1) || 0;
      columnNumber = (res[3] * 1 - 1) || 0;
    }

    if (functionName === loc) {
      return { functionName };
    }
    const scriptId = Debugger.scriptUrls.get(url) || '';
    return { functionName, lineNumber, columnNumber, url, scriptId };
  }

  /**
   * 启用rutime域
   * @public
   */
  enable() {
    this.isEnabled = true;
    this.cacheConsole.forEach(data => this.send(data));
    this.cacheError.forEach(data => this.send(data));

    if (isQuiteMode()) {
      const noop = () => { };
      window.alert = noop;
      window.confirm = noop;
      window.prompt = noop;
    } else {
      window.alert = oriAlert;
      window.confirm = oriConfirm;
      window.prompt = oriPrompt;
    }

    this.send({
      method: Event.executionContextCreated,
      params: {
        context: {
          id: 1,
          name: 'top',
          origin: location.origin,
        }
      }
    });
  }

  /**
   * 执行脚本
   * @public
   * @param {Object} params
   * @param {String} params.expression 表达式字符串
   * @param {Boolean} params.generatePreview 是否生成预览
   * @param {Boolean} params.silent 是否需要抛错误
   */
  evaluate({ expression, generatePreview, silent }) {
    return JDB.runInSkipOver(() => {
      const res = {};
      try {
        res.result = objectFormat(oriEval(expression), { preview: generatePreview });
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
   * 绑定特定对象调用函数
   * @public
   * @param {Object} params
   * @param {String} params.functionDeclaration 函数声明字符串
   * @param {String} params.objectId 绑定的对象id
   * @param {Array} params.arguments 调用参数
   * @param {Boolean} params.generatePreview 是否生成预览
   * @param {Boolean} params.silent 是否需要抛错误
   */
  callFunctionOn({ functionDeclaration, objectId, arguments: callArguments, generatePreview, silent }) {
    return JDB.runInSkipOver(() => {
      const res = {};
      try {
        const callFunction = oriEval(`(function(){return ${functionDeclaration}})()`);
        const callReturn = callOnObject({ objectId, callFunction, callArguments });
        res.result = objectFormat(callReturn, { preview: generatePreview });
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
   * 获取对象属性
   * @public
   */
  getProperties(params) {
    return JDB.runInSkipOver(() => {
      let res;
      try {
        res = getObjectProperties(params);
      } catch (err) {
        res = {
          result: objectFormat(err.toString(), { preview: params.generatePreview }),
          exceptionDetails: exceptionFormat(err.toString()),
        };
      }
      return res;
    });
  }

  /**
   * 释放对象
   * @public
   */
  releaseObject(params) {
    objectRelease(params);
  }

  /**
   * 拦截console对象的方法
   * @private
   */
  hookConsole() {
    const methods = {
      log: 'log',
      warn: 'warning',
      info: 'info',
      error: 'error',
    };

    Object.keys(methods).forEach((key) => {
      const nativeConsoleFunc = window.console[key];
      window.console[key] = (...args) => {
        return JDB.runInNativeEnv(() => {
          const callFrames = Runtime.getCallFrames();
          this.socketSend('console', {
            method: Event.consoleAPICalled,
            params: {
              type: methods[key],
              args: args.map(arg => objectFormat(arg, { preview: true })),
              executionContextId: 1,
              timestamp: Date.now(),
              stackTrace: { callFrames },
            }
          });
          return nativeConsoleFunc(...args);
        });
      };
    });
  }

  /**
   * 全局错误监听
   * @private
   */
  listenError() {
    const exceptionThrown = (error) => {
      return JDB.runInNativeEnv(() => {
        const callFrames = Runtime.getCallFrames(error);
        this.socketSend('error', {
          method: Event.exceptionThrown,
          params: {
            timestamp: Date.now(),
            exceptionDetails: {
              text: error ? 'Uncaught' : 'Script error.',
              exception: error ? {
                type: 'object',
                subtype: 'error',
                className: error.name,
                description: error && formatErrorStack(error, callFrames),
              } : null,
              stackTrace: { callFrames },
            }
          }
        });
      });
    };

    // 全局监听错误
    window.addEventListener('error', e => exceptionThrown(e.error));
    window.addEventListener('unhandledrejection', e => exceptionThrown(e.reason));
  }
}
