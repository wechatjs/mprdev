import nodes from '../common/nodes';
import * as stylesheet from '../common/stylesheet';
import { escapeRegString, getAbsoultPath, isMatches } from '../common/utils';
import { Event } from './protocol';
import BaseDomain from './domain';
import Page from './page';

export default class CSS extends BaseDomain {
  namespace = 'CSS';

  // css样式集合
  styles = new Map();
  styleInsts = new Map();

  // css样式表的唯一id
  styleSheetId = 1;

  /**
   * 格式化css规则
   * @static
   * @param {String} rule css选择器规则
   * @param {Node} node dom节点
   */
  static formatCssRule(rule, node) {
    let index = 0;
    const selectors = rule.selectorText.split(',').map((item, i) => {
      const text = item.trim();
      if (isMatches(node, text)) {
        index = i;
      }
      return { text };
    });

    const cssText = /\{(.*)\}/.exec(rule.cssText)[1];

    return {
      index,
      cssRule: {
        style: {
          cssText,
          cssProperties: CSS.formatCssProperties(cssText),
          shorthandEntries: [],
        },
        selectorList: {
          selectors,
          text: rule.selectorText,
        },
      }
    };
  }

  /**
   * 获取内联css的范围
   * @static
   * @param {String} name css名称
   * @param {String} value css值
   * @param {String} cssText 完整的内联css文本
   */
  static getInlineStyleRange(name, value, cssText) {
    const lines = cssText.split('\n');
    let startLine = 0;
    let endLine = 0;
    let startColumn = 0;
    let endColumn = 0;
    let text = '';
  
    const reg = new RegExp(`(\\/\\*)?\\s*${escapeRegString(name)}:\\s*${escapeRegString(value)};?\\s*(\\*\\/)?`);
    for (let i = 0, len = lines.length; i < len; i++) {
      const line = lines[i];
      const match = line.match(reg);
      if (match) {
        text = match[0];
        startLine = i;
        startColumn = match.index || 0;
        endLine = i;
        endColumn = startColumn + text.length;
        break;
      }
    }
  
    return {
      range: {
        startLine,
        endLine,
        startColumn,
        endColumn,
      },
      text,
    };
  }

  /**
   * 格式化css属性为具体的数据结构
   * @static
   * @param {String} cssText css文本，eg：height:100px;width:100px !important;
   */
  static formatCssProperties(cssText = '') {
    return cssText.replace(/(\/\*|\*\/)/g, '').split(';').filter(val => val?.trim())
      .map((style) => {
        const [name, value] = style.split(':');
        return {
          name: name.trim(),
          value: value.trim(),
          text: style,
          important: value.includes('important'),
          disabled: false,
          shorthandEntries: [],
        };
      });
  }

  /**
   * 启用CSS域
   * @public
   */
  enable() {
    this.sendCacheStyles();
    this.collectStyles();
  }

  /**
   * 返回已收集过的样式文件
   * @private
   */
  sendCacheStyles() {
    for (const styleSheetId of this.styles.keys()) {
      const content = this.styles.get(styleSheetId);
      const style = this.styleInsts.get(styleSheetId);
      const sourceURL = getAbsoultPath(style.href);
      if (sourceURL) {
        this.send({
          method: Event.styleSheetAdded,
          params: {
            header: {
              frameId: Page.MAINFRAME_ID,
              styleSheetId,
              sourceURL,
              origin: 'regular',
              disabled: false,
              isConstructed: false,
              isInline: false,
              isMutable: true,
              length: content.length,
              startLine: 0,
              endLine: content.split('\n').length - 1,
              startColumn: 0,
              endColumn: content.split('\n').length - content.lastIndexOf('\n') - 1 - 1,
              title: style.title,
            }
          }
        });
      }
    }
  }

  /**
   * 收集页面的所有样式
   * @private
   */
  collectStyles() {
    const styleSheets = Array.from(document.styleSheets);
    styleSheets.forEach((style) => {
      if (!style.styleSheetId) {
        const styleSheetId = this.getStyleSheetId();
        const sourceURL = getAbsoultPath(style.href);
        this.styleInsts.set(styleSheetId, style);
        style.styleSheetId = styleSheetId;
        if (sourceURL) {
          this.fetchStyleSource(styleSheetId, sourceURL, (content) => {
            this.send({
              method: Event.styleSheetAdded,
              params: {
                header: {
                  frameId: Page.MAINFRAME_ID,
                  styleSheetId,
                  sourceURL,
                  origin: 'regular',
                  disabled: false,
                  isConstructed: false,
                  isInline: false,
                  isMutable: false,
                  length: content.length,
                  startLine: 0,
                  endLine: content.split('\n').length - 1,
                  startColumn: 0,
                  endColumn: content.split('\n').length - content.lastIndexOf('\n') - 1 - 1,
                  title: style.title,
                }
              }
            })
          });
        }
      }
    });
  }

  /**
   * 获取指定DOM节点的匹配的样式
   * @public
   * @param {Object} params
   * @param {Number} params.nodeId DOM节点id
   */
  getMatchedStylesForNode({ nodeId }) {
    const matchedCSSRules = [];
    const node = nodes.getNodeById(nodeId);
    const styleSheets = Array.from(document.styleSheets);
    styleSheets.forEach((style) => {
      try {
        // chrome不允许访问不同域名下的css规则，这里捕获下错误
        // https://stackoverflow.com/questions/49993633/uncaught-domexception-failed-to-read-the-cssrules-property
        Array.from(style.cssRules).forEach((rule) => {
          if (isMatches(node, rule.selectorText)) {
            const { index, cssRule } = CSS.formatCssRule(rule, node);
            matchedCSSRules.push({
              matchingSelectors: [index],
              rule: cssRule,
            });
          }
        });
      } catch {
        // nothing to do.
      }
    });

    return {
      matchedCSSRules,
      ...this.getInlineStylesForNode({ nodeId })
    };
  }

  /**
   * 获取指定DOM节点的内联样式
   * @public
   * @param {Object} params
   * @param {Number} params.nodeId DOM节点id
   */
  getInlineStylesForNode({ nodeId }) {
    const node = nodes.getNodeById(nodeId);
    if (!(node instanceof Element)) return;
    const { style } = node || {};
    const cssText = node.getAttribute('style') || '';

    const cssTextLines = cssText.split('\n');
    const cssProperties = CSS.formatCssProperties(cssText);

    cssProperties.forEach((css) => {
      const { name, value } = css;
      const { text, range } = CSS.getInlineStyleRange(name, value, cssText);

      css.text = text;
      css.range = range;

      if (text.startsWith('/*')) {
        css.disabled = true;
      } else {
        css.disabled = false;
        css.implicit = false;
        css.parsedOk = !!style[name];
      }
    });

    return {
      inlineStyle: {
        styleSheetId: this.getStyleSheetId(node),
        cssText,
        cssProperties,
        shorthandEntries: [],
        range: {
          startLine: 0,
          startColumn: 0,
          endLine: cssTextLines.length - 1,
          endColumn: cssTextLines[cssTextLines.length - 1].length,
        },
      },
    };
  }

  /**
   * 获取指定DOM节点的计算样式
   * @public
   * @param {Object} params
   * @param {Number} params.nodeId DOM节点id
   */
  getComputedStyleForNode({ nodeId }) {
    const node = nodes.getNodeById(nodeId);
    if (!(node instanceof Element)) return;
    let computedStyle = window.getComputedStyle(node);
    computedStyle = Array.from(computedStyle).map(style => ({
      name: style,
      value: computedStyle[style]
    }));
    return { computedStyle };
  }

  /**
   * 获取样式内容
   * @public
   * @param {Object} params
   * @param {Number} params.styleSheetId 样式id
   */
  getStyleSheetText({ styleSheetId }) {
    return {
      text: this.styles.get(styleSheetId),
    };
  }

  /**
   * 拉取css文件源内容
   * @private
   * @param {Number} styleSheetId 样式文件id
   * @param {String} url 样式文件url地址
   * @param {Function} callback 回调
   */
  fetchStyleSource(styleSheetId, url, callback) {
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    xhr.$$type = 'Stylesheet';
    xhr.onload = () => {
      const content = xhr.responseText;
      this.styles.set(styleSheetId, content);
      if (typeof callback === 'function') callback(content);
    };
    xhr.onerror = () => {
      this.styles.set(styleSheetId, 'Cannot get style source code');
    };

    xhr.open('GET', url);
    xhr.send();
  }

  /**
   * 获取style样式的唯一标识id
   * @private
   */
  getStyleSheetId(node) {
    if (node) {
      const nodeId = nodes.getIdByNode(node);
      let styleSheetId = stylesheet.getInlineStyleSheetId(nodeId);
      if (!styleSheetId) {
        styleSheetId = `${this.styleSheetId++}`;
        stylesheet.setInlineStyleSheetId(nodeId, styleSheetId);
      }
      return styleSheetId;
    }
    return `${this.styleSheetId++}`;
  }

  /**
   * 设置css内容
   * @public
   * @param {Array} edits
   * @param {String} edits.styleSheetId
   * @param {String} edits.text
   * @param {Object} edits.range
   */
  setStyleTexts({ edits }) {
    const styles = edits.map((edit) => {
      const { styleSheetId, text } = edit;
      const nodeId = stylesheet.getInlineStyleNodeId(styleSheetId);
      if (nodeId) {
        const node = nodes.getNodeById(nodeId);
        node.setAttribute('style', text);
        return this.getInlineStylesForNode({ nodeId }).inlineStyle;
      }
      // TODO: 如果styleSheet没有ownerNode
      const styleSheet = stylesheet.getStyleSheetById(styleSheetId);
      const cssRule = styleSheet.cssRules.item(0);
      const { selectorText } = cssRule;
      const newText = `${selectorText} { ${text} }`;
      styleSheet.replaceSync(newText);

      this.styles.set(styleSheetId, newText);

      this.send({
        method: Event.styleSheetChanged,
        params: { styleSheetId },
      });

      return { styleSheetId };
    });
  
    return { styles };
  }

  /**
   * 新建styleSheet
   * @param {String} frameId Page.frameId
   * @public
   */
  createStyleSheet({ frameId }) {
    const newStyleSheetId = this.getStyleSheetId();
    stylesheet.createStyleSheet(newStyleSheetId);

    this.send({
      method: Event.styleSheetAdded,
      params: {
        header: {
          styleSheetId: newStyleSheetId,
          frameId,
          origin: 'inspector',
          disabled: false,
          isConstructed: false,
          isInline: false,
          isMutable: false,
          length: 0,
          sourceURL: "",
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          title: "",
        }
      }
    });

    return { styleSheetId: newStyleSheetId };
  }

  /**
   * 新增selector->cssText规则
   * @public
   */
  addRule({ styleSheetId, ruleText, location }) {
    const selectorsText = ruleText.slice(0, ruleText.indexOf('{'));
    const cssText = ruleText.slice(ruleText.indexOf('{') + 1, ruleText.indexOf('}'));

    const formatSelectorsText = selectorsText.trim();
    const formatCssText = cssText.trim();

    const cssProperties = CSS.formatCssProperties(formatCssText);
    const selectors = selectorsText.split(',').map((sel, idx, arr) => {
      const selectorText = sel?.trim();
      if (!selectorText) return null;

      const prefixText = arr.slice(0, idx).join('');
      const firstWordIdxInSel = sel.indexOf(selectorText.at(0));
      const lastWordIdxInSel = sel.lastIndexOf(selectorText.at(selectorText.length - 1));
      const range = {
        startLine: (
          (prefixText.indexOf('\n') >= 0 ? prefixText.split('\n').length - 1 : 0)
          + (sel.indexOf('\n') >= 0 ? sel.slice(0, firstWordIdxInSel).split('\n').length - 1 : 0)
        ),
        endLine: `${prefixText}${sel}`.split('\n').length - 1,
        startColumn: firstWordIdxInSel - sel.slice(0, firstWordIdxInSel).lastIndexOf('\n') - 1,
        endColumn: lastWordIdxInSel - sel.lastIndexOf('\n', lastWordIdxInSel) - 1,
      };

      return {
        range,
        text: selectorText,
      };
    }).filter(val => val !== null);

    // styleSheet内容替换
    const styleSheet = stylesheet.getStyleSheetById(styleSheetId);
    const pos = styleSheet.cssRules.length;
    styleSheet.replaceSync(ruleText, pos);

    // 储存下styleSheet的内容
    this.styles.set(styleSheetId, ruleText);

    // TODO: 让styleSheet能够应用到相应节点上

    // 告诉调试端styleSheet发生了变化
    this.send({
      method: Event.styleSheetChanged,
      params: { styleSheetId },
    });
    
    return {
      rule: {
        styleSheetId,
        style: {
          styleSheetId,
          cssText: formatCssText,
          cssProperties,
          range: {
            startLine: ruleText.slice(0, ruleText.indexOf('{')).split('\n').length - 1,
            endLine: ruleText.slice(0, ruleText.indexOf('}') - 1).split('\n').length - 1,
            startColumn: ruleText.slice(0, ruleText.indexOf('{')).replace(/.*\n/g, '').length + 1,
            endColumn: ruleText.slice(0, ruleText.indexOf('}')).replace(/.*\n/g, '').length,
          },
          shorthandEntries: [],
        },
        origin: 'inspector',
        media: [],
        selectorList: {
          selectors,
          text: formatSelectorsText,
        },
      }
    };
  }
}
