import nodes from '../common/nodes';
import * as stylesheet from '../common/stylesheet';
import { escapeRegString, getAbsoultPath, getUrlWithRandomNum, isMatches, requestSource } from '../common/utils';
import { calculate, compare } from 'specificity';
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
    let specificityArray = [0, 0, 0, 0];

    const selectors = rule.selectorText.replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((item, i) => {
      const text = item.trim();
      if (node instanceof Element && isMatches(node, text)) {
        specificityArray = calculate(text)[0].specificityArray;
        index = i;
      } else if (['::before', '::after'].includes(node.nodeName?.toLowerCase())) {
        // 这里以1个冒号进行split，因为1个冒号和2个冒号的写法都合法，这样能都匹配上，最后去掉空值
        const [selectorText, pseudoType] = text.split(':').filter(Boolean);
        if (pseudoType && node.nodeName.toLowerCase() === `::${pseudoType}` && isMatches(node.parentNode, selectorText)) {
          specificityArray = calculate(text)[0].specificityArray;
          index = i;
        }
      }
      return { text };
    });

    const cssText = /\{([\s\S]*)\}/.exec(rule.cssText)[1];

    return {
      index,
      specificityArray,
      cssRule: {
        styleSheetId,
        media: rule.media || [],
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
   * @param {Object} cssRange css文本范围，eg: {startLine,startColumn,endLine,endColumn}
   */
  static formatCssProperties(cssText = '', cssRange) {
    const splitProps = (text) => text.split(';').map((v, i, a) => i < a.length - 1 ? `${v};` : v);
    const splited = cssText.split(/\/\*/)
      .map((text) => text.split(/\*\//))
      .map((item) => {
        if (item.length === 1) return item;
        if (item[0].split('\n').length > 1) return [item[1]];
        return item;
      })
      .reduce((pre, cur) => {
        if (cur.length === 1) return pre.concat(splitProps(cur[0]));
        return pre.concat(`/*${cur[0]}*/`, splitProps(cur[1]));
      }, []);

    return splited.map((style) => {
      const [name, ...values] = style.replace(/^\/\*|;?\s*\*\/$|;$/g, '').split(':');
      const value = values.join(':');
      if (value) {
        let range;
        if (cssRange) {
          const match = cssText.match(new RegExp(`(^|[{/;\\s\n])${style.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')}`));
          const index = (match?.index + match?.[1].length) || 0;
          const leftExcludes = cssText.substring(0, index).split('\n');
          const leftIncludes = (leftExcludes.join('\n') + style).split('\n');
          range = {
            startLine: cssRange.startLine + leftExcludes.length - 1,
            startColumn: (leftExcludes.length === 1 ? cssRange.startColumn : 0) + leftExcludes[leftExcludes.length - 1].length,
            endLine: cssRange.startLine + leftIncludes.length - 1,
            endColumn: (leftIncludes.length === 1 ? cssRange.startColumn : 0) + leftIncludes[leftIncludes.length - 1].length,
          };
        }
        return {
          name: name.trim(),
          value: value.trim(),
          text: style,
          important: value.includes('important'),
          disabled: style.startsWith('/*'),
          implicit: false,
          shorthandEntries: [],
          range,
        };
      }
    }).filter(Boolean);
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
      const sourceURL = getAbsoultPath(style.href || location.href);
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
            });
          });
        } else if (style.ownerNode?.innerHTML) {
          const content = style.ownerNode?.innerHTML;
          this.styles.set(styleSheetId, content);
          this.styleRules.set(styleSheetId, this.parseStyleRules(content));
          const htmlContent = document.documentElement.outerHTML;
          const index = htmlContent.indexOf(content);
          const leftExcludes = htmlContent.substring(0, index).split('\n');
          const leftIncludes = (leftExcludes.join('\n') + content).split('\n');
          this.send({
            method: Event.styleSheetAdded,
            params: {
              header: {
                frameId: Page.MAINFRAME_ID,
                styleSheetId,
                sourceURL: location.href,
                origin: 'regular',
                disabled: false,
                isConstructed: false,
                isInline: true,
                isMutable: false,
                length: content.length,
                startLine: leftExcludes.length - 1,
                startColumn: leftExcludes[leftExcludes.length - 1].length,
                endLine: leftIncludes.length - 1,
                endColumn: leftIncludes[leftIncludes.length - 1].length,
                title: style.title,
              }
            }
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
    for (let i = 0, line = 0, column = 0, brackets = 0, media = '', token = ''; i < content.length; i++) {
      const pointer = content[i];
      switch (pointer) {
        case '{': {
          brackets++;
          column++;
          if (!media && brackets === 1 || media && brackets === 2) {
            tokenList.push({ token, media, line, column });
            token = '';
          } else if (media && brackets === 1) {
            // nothing to do
          } else {
            token += pointer;
          }
          break;
        }
        case '}': {
          brackets--;
          if (!media && brackets === 0 || media && brackets === 1) {
            tokenList.push({ token, media, line, column });
            token = '';
          } else if (media && brackets === 0) {
            media = '';
          } else {
            token += pointer;
          }
          column++;
          break;
        }
        case '@': {
          if (content.substring(i, i + 7) === '@media ') {
            media += token + pointer;
            token = '';
          } else {
            token += pointer;
          }
          column++;
          break;
        }
        case '\n': {
          if (media && brackets === 0) {
            media += pointer
          } else {
            token += pointer;
          }
          column = 0;
          line++;
          break;
        }
        default: {
          if (media && brackets === 0) {
            media += pointer
          } else {
            token += pointer;
          }
          column++;
        }
      }
    }

    const rules = [];
    for (let j = 0; j < tokenList.length; j += 2) {
      const rule = {
        selectorText: tokenList[j].token.trim(),
        cssText: `${tokenList[j].token}{${tokenList[j + 1].token}}`.trim(),
        range: {
          startLine: tokenList[j].line,
          startColumn: tokenList[j].column,
          endLine: tokenList[j + 1].line,
          endColumn: tokenList[j + 1].column,
        },
      };
      if (tokenList[j].media) {
        rule.media = [{
          source: 'mediaRule',
          text: tokenList[j].media.substring(tokenList[j].media.indexOf(' ')).trim(),
        }];
      }
      rules.push(rule);
    }

    return rules;
  }

  /**
   * 修改样式表
   * @private
   * @param {Object} styleSheet 样式表
   * @param {String} styleContent 修改后的完整内容
   */
  modifyStyleSheetRule(styleSheet, styleContent) {
    if (styleSheet.ownerNode?.parentNode) {
      if (!styleSheet.devToolsOverrideStyle) {
        styleSheet.disabled = true; // 禁用原来的样式，用新的样式表代替
        styleSheet.devToolsOverrideStyle = document.createElement('style');
        styleSheet.devToolsOverrideStyle.className = 'devtools-stylesheet'; // 声明不用显示在devtools中
        styleSheet.ownerNode.parentNode.insertBefore(styleSheet.devToolsOverrideStyle, styleSheet.ownerNode.nextSibling);
      }
      styleSheet.devToolsOverrideStyle.innerHTML = styleContent;
    }
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
    const node = nodes.getNodeById(nodeId);
    if (!(node instanceof Element) && !(['::before', '::after'].includes(node.nodeName?.toLowerCase()))) return;

    const matchedCSSRules = [];
    const styleSheets = Array.from(document.styleSheets);
    const pushMatchedCSSRules = (styleSheetId, rule) => {
      if (rule.media && rule.media.length && !rule.media.find((query) => window.matchMedia(query.text).matches)) return;
      if (
        (node instanceof Element && isMatches(node, rule.selectorText))
        // 这里的判断:before和:after，因为1个冒号和2个冒号的写法都合法，这样能都匹配上
        || (node.nodeName?.toLowerCase() === '::before' && rule.selectorText.includes(':before'))
        || (node.nodeName?.toLowerCase() === '::after' && rule.selectorText.includes(':after'))
      ) {
        const { index, specificityArray, cssRule } = CSS.formatCssRule(styleSheetId, rule, node);
        matchedCSSRules.push({ matchingSelectors: [index], rule: cssRule, specificityArray });
      }
    };

    styleSheets.forEach((style) => {
      const styleSheetId = style.styleSheetId;
      if (!styleSheetId) return;

      const rules = this.styleRules.get(styleSheetId);
      if (rules) {
        rules.forEach((rule) => pushMatchedCSSRules(styleSheetId, rule));
      }
    });

    return {
      matchedCSSRules: matchedCSSRules.sort((a, b) => compare(a.specificityArray, b.specificityArray)),
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
    if (!(node instanceof Element) && !(['::before', '::after'].includes(node.nodeName?.toLowerCase()))) return;

    let computedStyle = node instanceof Element ? window.getComputedStyle(node) : window.getComputedStyle(node.parentNode, node.nodeName);
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
          const newRule = rules.find((rule) => rule.range.startLine === range.startLine
            && rule.range.startColumn === range.startColumn);

          if (newRule) {
            this.modifyStyleSheetRule(styleSheet, newContent);
            this.send({
              method: Event.styleSheetChanged,
              params: { styleSheetId },
            });

            const cssText = /\{([\s\S]*)\}/.exec(newRule.cssText)[1];
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
    const styleSheet = stylesheet.getStyleSheetById(styleSheetId);
    const content = this.styles.get(styleSheetId);
    if (styleSheet && content) {
      const lines = content.split('\n');
      const newContent = [
        ...lines.slice(0, location.startLine),
        lines[location.startLine].substring(0, location.startColumn)
          + ruleText + lines[location.endLine].substring(location.endColumn),
        ...lines.slice(location.endLine + 1),
      ].join('\n');

      this.styles.set(styleSheetId, newContent);
      this.styleRules.set(styleSheetId, this.parseStyleRules(newContent));

      const rules = this.styleRules.get(styleSheetId);
      if (rules) {
        const selectorText = ruleText.slice(0, ruleText.indexOf('{'));
        const selectorLines = selectorText.split('\n');
        const newRule = rules.find((rule) => selectorLines.length === 1
          ? rule.range.startLine === location.startLine
            && rule.range.startColumn === location.startColumn - selectorText.length
          : rule.range.startLine === location.startLine + selectorLines.length - 1
            && rule.range.startColumn === selectorLines[selectorLines.length - 1].length + 1
        );

        if (newRule) {
          this.modifyStyleSheetRule(styleSheet, newContent);
          this.send({
            method: Event.styleSheetChanged,
            params: { styleSheetId },
          });

          const cssText = /\{([\s\S]*)\}/.exec(newRule.cssText)[1];
          return {
            rule: {
              styleSheetId,
              style: {
                styleSheetId,
                cssText,
                cssProperties: CSS.formatCssProperties(cssText, newRule.range),
                shorthandEntries: [],
                range: newRule.range,
              },
              selectorList: {
                selectors: selectorText.split(',').map((item) => ({ text: item.trim() })),
                text: newRule.selectorText.trim(),
              },
            },
          };
        }
      }
    }
  }
}
