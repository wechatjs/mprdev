import nodes from '../common/nodes';
import JDB from '../common/jdb';
import BaseDomain from './domain';
import { docReady } from '../common/utils';

const wrapper = document.createElement('div');
const contentBox = document.createElement('div');
const marginBox = document.createElement('div');
const tooltipsBox = document.createElement('div');
const debugClsName = 'devtools-overlay';

[marginBox, contentBox, tooltipsBox].forEach((item) => {
  item.className = debugClsName;
  wrapper.appendChild(item);
});
wrapper.style.cssText = 'display:none;position:fixed;z-index:99999999;pointer-events:none;font-family:Arial';
wrapper.className = debugClsName;
wrapper.id = debugClsName;
docReady(() => document.body.appendChild(wrapper));

export default class Overlay extends BaseDomain {
  namespace = 'Overlay';

  static inspectMode = 'none';
  static highlightConfig = { // 默认高亮配置
    contentColor: { r: 111, g: 168, b: 220, a: 0.66 },
    paddingColor: { r: 147, g: 196, b: 125, a: 0.55 },
    marginColor: { r: 246, g: 178, b: 107, a: 0.66 },
  };

  /**
   * 格式化css
   * @static
   * @param {Object} styles style对象 eg: {color: red, position: absolute}
   */
  static formatCssText(styles) {
    return Object.entries(styles).map((item) => `${item[0]}:${item[1]}`)
      .join(';');
  }

  /**
   * 从style中提取属性值
   * @static
   */
  static getStylePropertyValue(properties, styles) {
    if (Array.isArray(properties)) {
      return properties.map((key) => Number(styles[key].replace('px', '')));
    }

    return Number(styles[properties].replace('px', ''));
  }

  /**
   * rgba颜色
   * @static
   */
  static rgba({ r, g, b, a } = {}) {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  /**
   * 设置高亮样式
   * @static
   * @param {Object} params
   * @param {Node} params.node 节点元素
   * @param {Object} params.highlightConfig 高亮配置
   */
  static highlight(node, highlightConfig) {
    if (
      !node
      || [3, 8, 10, 11].includes(node.nodeType)
      || ['link', 'script', 'head', '::before', '::after'].includes(node.nodeName?.toLowerCase())
    ) return;

    const styles = window.getComputedStyle(node);
    const margin = Overlay.getStylePropertyValue(['margin-top', 'margin-right', 'margin-bottom', 'margin-left'], styles);
    const padding = Overlay.getStylePropertyValue(['padding-top', 'padding-right', 'padding-bottom', 'padding-left'], styles);
    const border = Overlay.getStylePropertyValue(['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'], styles);
    const width = Overlay.getStylePropertyValue('width', styles);
    const height = Overlay.getStylePropertyValue('height', styles);
    const isBorderBox = window.getComputedStyle(node)['box-sizing'] === 'border-box';
    const { left, top } = node.getBoundingClientRect();

    const { contentColor, paddingColor, marginColor } = highlightConfig || Overlay.highlightConfig;
    wrapper.style.display = 'block';

    const commonStyle = {
      padding: 0,
      margin: 0,
      position: 'fixed',
      'border-sizing': 'border-box',
    };

    const contentWidth = (isBorderBox ? width - padding[1] - padding[3] : width + border[1] + border[3]) || 0;
    const contentHeight = (isBorderBox ? height - padding[0] - padding[2] : height + border[0] + border[2]) || 0;
    const marginWidth = (isBorderBox ? width : width + padding[1] + padding[3] + border[1] + border[3]) || 0;
    const marginHeight = (isBorderBox ? height : height + padding[0] + padding[2] + border[0] + border[2]) || 0;

    contentBox.style.cssText = Overlay.formatCssText({
      ...commonStyle,
      left: `${left}px`,
      top: `${top}px`,
      width: `${contentWidth}px`,
      height: `${contentHeight}px`,
      background: Overlay.rgba(contentColor),
      'border-top': `${padding[0]}px solid ${Overlay.rgba(paddingColor)}`,
      'border-right': `${padding[1]}px solid ${Overlay.rgba(paddingColor)}`,
      'border-bottom': `${padding[2]}px solid ${Overlay.rgba(paddingColor)}`,
      'border-left': `${padding[3]}px solid ${Overlay.rgba(paddingColor)}`,
    });

    marginBox.style.cssText = Overlay.formatCssText({
      ...commonStyle,
      left: `${left - margin[3]}px`,
      top: `${top - margin[0]}px`,
      width: `${marginWidth}px`,
      height: `${marginHeight}px`,
      'border-top': `${margin[0]}px solid ${Overlay.rgba(marginColor)}`,
      'border-right': `${margin[1]}px solid ${Overlay.rgba(marginColor)}`,
      'border-bottom': `${margin[2]}px solid ${Overlay.rgba(marginColor)}`,
      'border-left': `${margin[3]}px solid ${Overlay.rgba(marginColor)}`,
    });

    const currentClassName = node.getAttribute('class');
    tooltipsBox.innerHTML = `
      <span class="${debugClsName}" style="color:#973090;font-weight:bold">${node.nodeName.toLowerCase()}</span>
      <span class="${debugClsName}" style="color:#3434B0;font-weight:bold">${currentClassName ? `.${currentClassName}` : ''}</span>
      ${contentWidth} x ${contentHeight}
    `;
    tooltipsBox.style.cssText = Overlay.formatCssText({
      ...commonStyle,
      background: '#fff',
      left: `${left - margin[3]}px`,
      top: top - margin[0] > 25 ? `${top - margin[0] - 25}px` : `${top + marginHeight + 25}px`,
      'box-shadow': '0 0 4px 1px #c3bebe',
      'border-radius': '2px',
      'font-size': '12px',
      padding: '2px 4px',
      color: '#8d8d8d'
    });
  }

  /**
   * 隐藏高亮
   * @static
   */
  static unhighlight() {
    wrapper.style.display = 'none';
  }

  /**
   * 启用Overlay域
   * @public
   */
  enable() {
    const highlightForSearch = (e) => {
      if (Overlay.inspectMode !== 'searchForNode') return;
      e.stopPropagation();
      e.preventDefault();

      let { target } = e;

      if (e.touches) {
        const touch = e.touches[0];
        target = document.elementFromPoint(touch.clientX, touch.clientY);
      }

      Overlay.highlight(target);
    };

    document.addEventListener('mousemove', highlightForSearch, true);
    document.addEventListener('touchmove', highlightForSearch, { passive: false });
  }

  /**
   * 高亮node节点
   * @public
   * @param {Object} params
   * @param {String} params.nodeId 节点id
   * @param {Object} params.highlightConfig 高亮配置
   */
  highlightNode({ nodeId, highlightConfig }) {
    Overlay.highlight(nodes.getNodeById(nodeId), highlightConfig);
  }

  /**
   * 隐藏dom高亮
   * @public
   */
  hideHighlight() {
    Overlay.unhighlight();
  }

  /**
   * 设置dom审查模式
   * @public
   * @param {Object} params
   * @param {String} params.mode 审查模式
   * @param {Object} params.highlightConfig 高亮配置
   */
  setInspectMode({ mode, highlightConfig }) {
    Overlay.inspectMode = mode;
    Overlay.highlightConfig = highlightConfig;
  }

  /**
   * 显示中断蒙层
   * @param {String} params.message 调试信息
   */
  setPausedInDebuggerMessage({ message }) {
    JDB.setOverlay(message);
  }
}
