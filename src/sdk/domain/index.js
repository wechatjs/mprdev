import Dom from './dom';
import DomStorage from './dom-storage';
import Overlay from './overlay';
import Runtime from './runtime';
import Page from './page';
import Network from './network';
import Css from './css';
import SourceDebugger from './debugger';
import Emulation from './emulation';
import Input from './input';
import protocol from './protocol';

export default class ChromeDomain {
  protocol = {};

  constructor(options) {
    this.registerProtocal(options);
  }

  /**
   * 执行协议方法
   * @public
   * @param {Object} message socket的数据
   */
  execute(message = {}) {
    const { id, method, params } = message;
    const methodCall = this.protocol[method];
    if (typeof methodCall !== 'function') {
      return { id };
    }
    const result = methodCall(params);
    if (result instanceof Promise) {
      return result.then((resolved) => ({ id, result: resolved }));
    }
    return { id, result };
  }

  /**
   * 注册协议
   * @private
   */
  registerProtocal(options) {
    const domains = [
      new Dom(options),
      new DomStorage(options),
      new Overlay(options),
      new Runtime(options),
      new Page(options),
      new Network(options),
      new Css(options),
      new SourceDebugger(options),
      new Emulation(options),
      new Input(options),
    ];

    domains.forEach((domain) => {
      const { namespace } = domain;
      const cmds = protocol[namespace];
      cmds.forEach((cmd) => {
        this.protocol[`${namespace}.${cmd}`] = domain[cmd].bind(domain);
      });
    });
  }
}
