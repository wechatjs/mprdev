import nodes from '../common/nodes';
import * as stylesheet from '../common/stylesheet';
import { escapeRegString, getAbsoultPath, getUrlWithRandomNum, isMatches, requestSource } from '../common/utils';
import { Event } from './protocol';
import BaseDomain from './domain';
import Page from './page';

export default class CSS extends BaseDomain {
  namespace = 'CSS';

  // css样式集合
  styles = new Map();
  styleRules = new Map();

  // css样式表的唯一id
  styleSheetId = 1;

  /**
   * 格式化css规则
   * @static
   * @param {Number} styleSheetId 样式文件id
   * @param {String} rule css选择器规则
   * @param {Node} node dom节点
   */
  static formatCssRule(styleSheetId, rule, node) {
    let index = 0;
    const selectors = rule.selectorText.split(',').map((item, i) => {
      const text = item.trim();
      if (isMatches(node, text)) {
        index = i;
      }
      return { text };
    });

    const cssText = /\{([\s\S]*)\}/.exec(rule.cssText)[1];

    return {
      index,
      cssRule: {
        styleSheetId,
        style: {
          styleSheetId,
          cssText,
          cssProperties: CSS.formatCssProperties(cssText, rule.range),
          shorthandEntries: [],
          range: rule.range,
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
   * @param {String} cssText css文本，eg: height:100px;width:100px !important;
   * @param {Object} cssRange css文本范围，eg: {startLine, startColumn, endLine, endColumn}
   */
  static formatCssProperties(cssText = '', cssRange) {
    return cssText.replace(/(\/\*|\*\/)/g, '').split(';').map(val => val?.trim()).filter(Boolean)
      .map((style) => {
        const [name, value] = style.split(':');
        let range;
        if (cssRange) {
          const leftExcludes = cssText.substring(0, cssText.indexOf(style)).split('\n');
          const leftIncludes = (leftExcludes.join('\n') + style).split('\n');
          range = {
            startLine: cssRange.startLine + leftExcludes.length - 1,
            startColumn: leftExcludes[leftExcludes.length - 1].length,
            endLine: cssRange.startLine + leftIncludes.length - 1,
            endColumn: leftIncludes[leftIncludes.length - 1].length,
          };
        }
        return {
          name: name.trim(),
          value: value.trim(),
          text: style,
          important: value.includes('important'),
          disabled: false,
          implicit: false,
          shorthandEntries: [],
          range,
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
      const style = stylesheet.getStyleSheetById(styleSheetId);
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
        stylesheet.setStyleSheet(styleSheetId, style);
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
   * 拉取css文件源内容
   * @private
   * @param {Number} styleSheetId 样式文件id
   * @param {String} url 样式文件url地址
   * @param {Function} callback 回调
   */
  fetchStyleSource(styleSheetId, url, callback) {
    const onload = (xhr) => {
      const content = xhr.responseText;
      this.styles.set(styleSheetId, content);
      this.styleRules.set(styleSheetId, this.parseStyleRules(content));
      if (typeof callback === 'function') callback(content);
    };
    const onerror = () => {
      this.styles.set(styleSheetId, 'Cannot get style source code');
      this.styleRules.set(styleSheetId, this.parseStyleRules(''));
    };
    // 先不带credentials请求一次，如果失败了再带credentials请求一次
    requestSource(url, 'Stylesheet', false, onload, () => {
      requestSource(getUrlWithRandomNum(url), 'Stylesheet', true, onload, onerror);
    });
  }

  /**
   * 解析css规则
   * @private
   * @param {String} content 样式文件内容
   */
  parseStyleRules(content) {
    const tokenList = [];
    for (let i = 0, line = 0, column = 0, brackets = 0, token = ''; i < content.length; i++) {
      const pointer = content[i];
      switch (pointer) {
        case '{': {
          brackets++;
          column++;
          if (brackets === 1) {
            tokenList.push({ token, line, column });
            token = '';
          } else {
            token += pointer;
          }
          break;
        }
        case '}': {
          brackets--;
          if (brackets === 0) {
            tokenList.push({ token, line, column });
            token = '';
          } else {
            token += pointer;
          }
          column++;
          break;
        }
        case '\n': {
          token += pointer;
          column = 0;
          line++;
          break;
        }
        default: {
          token += pointer;
          column++;
        }
      }
    }

    const rules = [];
    for (let j = 0; j < tokenList.length; j += 2) {
      rules.push({
        selectorText: tokenList[j].token.trim(),
        cssText: `${tokenList[j].token}{${tokenList[j + 1].token}}`.trim(),
        range: {
          startLine: tokenList[j].line,
          startColumn: tokenList[j].column,
          endLine: tokenList[j + 1].line,
          endColumn: tokenList[j + 1].column,
        }
      });
    }

    return rules;
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
   * 获取指定DOM节点的匹配的样式
   * @public
   * @param {Object} params
   * @param {Number} params.nodeId DOM节点id
   */
  getMatchedStylesForNode({ nodeId }) {
    const matchedCSSRules = [];
    const node = nodes.getNodeById(nodeId);
    const styleSheets = Array.from(document.styleSheets);
    const pushMatchedCSSRules = (styleSheetId, rule) => {
      if (isMatches(node, rule.selectorText)) {
        const { index, cssRule } = CSS.formatCssRule(styleSheetId, rule, node);
        matchedCSSRules.push({ matchingSelectors: [index], rule: cssRule });
      }
    };
    styleSheets.forEach((style) => {
      const styleSheetId = style.styleSheetId;
      if (style.href && styleSheetId) {
        const rules = this.styleRules.get(styleSheetId);
        if (rules) {
          rules.forEach((rule) => pushMatchedCSSRules(styleSheetId, rule));
          return;
        }
      }
      try {
        // chrome不允许访问不同域名下的css规则，这里捕获下错误
        // https://stackoverflow.com/questions/49993633/uncaught-domexception-failed-to-read-the-cssrules-property
        Array.from(style.cssRules).forEach((rule) => pushMatchedCSSRules(styleSheetId, rule));
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
   * 设置css内容
   * @public
   * @param {Array} edits
   * @param {String} edits.styleSheetId
   * @param {String} edits.text
   * @param {Object} edits.range
   */
  setStyleTexts({ edits }) {
    const styles = edits.map((edit) => {
      const { styleSheetId, range } = edit;
      const text = edit.text.replace(/;+/g, ';');
      const nodeId = stylesheet.getInlineStyleNodeId(styleSheetId);
      if (nodeId) {
        const node = nodes.getNodeById(nodeId);
        node.setAttribute('style', text);
        return this.getInlineStylesForNode({ nodeId }).inlineStyle;
      }

      const styleSheet = stylesheet.getStyleSheetById(styleSheetId);
      const content = this.styles.get(styleSheetId);
      if (styleSheet && content) {
        const lines = content.split('\n');
        const newContent = [
          ...lines.slice(0, range.startLine),
          lines[range.startLine].substring(0, range.startColumn)
            + text + lines[range.endLine].substring(range.endColumn),
          ...lines.slice(range.endLine + 1),
        ].join('\n');

        this.styles.set(styleSheetId, newContent);
        this.styleRules.set(styleSheetId, this.parseStyleRules(newContent));

        const rules = this.styleRules.get(styleSheetId);
        if (rules) {
          const newRule = rules.find((rule) => rule.range.startLine === range.startLine && rule.range.startColumn === range.startColumn);

          if (newRule) {
            const cssText = /\{([\s\S]*)\}/.exec(newRule.cssText)[1];

            styleSheet.insertRule(newRule.cssText, 0);

            this.send({
              method: Event.styleSheetChanged,
              params: { styleSheetId },
            });

            return {
              styleSheetId,
              cssText,
              cssProperties: CSS.formatCssProperties(cssText, newRule.range),
              shorthandEntries: [],
              range: newRule.range,
            };
          }
        }
      }

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
          sourceURL: '',
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          title: '',
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
    this.styleRules.set(styleSheetId, this.parseStyleRules(ruleText));

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
