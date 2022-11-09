import { getObjectById, objectFormat } from '../common/remote-obj';
import { Event } from './protocol';
import nodes from '../common/nodes';
import BaseDomain from './domain';
import JDB from '../common/jdb';
import Overlay from './overlay';
import Page from './page';

const debugClsList = ['devtools-overlay', 'devtools-debugger', 'html2canvas-container'];

export default class Dom extends BaseDomain {
  namespace = 'DOM';

  observer = null;
  isEnabled = false;
  childListSetNodeIds = new Set();
  searchResults = new Map();
  searchId = 1;

  constructor(options) {
    super(options);
    this.initNodeObserver();
    this.hookAttachShadow();
  }

  /**
   * 设置$相关的函数方法
   * @static
   */
  static set$Function() {
    if (typeof window.$ !== 'function') {
      window.$ = function (selector) {
        return document.querySelector(selector);
      };
    }

    if (typeof window.$$ !== 'function') {
      window.$$ = function (selector) {
        return document.querySelectorAll(selector);
      };
    }
  }

  /**
   * 通过关键词查找元素
   * @param {string} keyword
   * @static
   */
  static getNodesByKeyword(keyword) {
    const ret = [];
    const whatToShow = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT;
    const treeWalker = document.createTreeWalker(document.documentElement, whatToShow);
    for (let node = treeWalker.currentNode; node; node = treeWalker.nextNode()) {
      switch (node.nodeType) {
        case Node.ELEMENT_NODE: {
          if (node.nodeName.toLowerCase().indexOf(keyword) !== -1) {
            ret.push(node);
            break;
          }
          for (let i = 0; i < node.attributes.length; i++) {
            const a = node.attributes[i];
            if (a.name.indexOf(keyword) !== -1 || a.value.indexOf(keyword) !== -1) {
              ret.push(node);
              break;
            }
          }
          break;
        }
        default: {
          if (node.nodeValue.indexOf(keyword) !== -1) {
            ret.push(node);
          }
        }
      }
    }
    return ret;
  }

  /**
   * 通过选择器查找元素
   * @param {string} selector
   * @static
   */
  static getNodesBySelector(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  /**
   * 通过XPath查找元素
   * @param {string} xpath
   * @static
   */
  static getNodesByXPath(xpath) {
    const ret = [];
    const nodesSnapshot = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    for (let i = 0; i < nodesSnapshot.snapshotLength; i++) {
      ret.push(nodesSnapshot.snapshotItem(i));
    }
    return ret;
  }

  /**
   * 启用Dom域
   * @public
   */
  enable() {
    this.resetDocument();
    if (!this.isEnabled) {
      this.isEnabled = true;
      this.observeNode(document.documentElement);
      this.setDomInspect();
      Dom.set$Function();
    }
  }

  /**
   * 获取root的文档
   * @public
   */
  getDocument() {
    return {
      root: nodes.collectNodes(document),
    };
  }

  /**
   * 请求获取孩子节点
   * @public
   * @param {Object} params
   * @param {Number} nodeId dom节点的id
   */
  requestChildNodes({ nodeId }) {
    if (!this.childListSetNodeIds.has(nodeId)) {
      this.childListSetNodeIds.add(nodeId);
      this.send({
        method: Event.setChildNodes,
        params: {
          parentId: nodeId,
          nodes: nodes.getChildNodes(nodes.getNodeById(nodeId))
        }
      });
    }
  }

  /**
   * 获取节点的外层html
   * @public
   * @param {Object} params
   * @param {Number} nodeId dom节点的id
   */
  getOuterHTML({ nodeId }) {
    return {
      outerHTML: nodes.getNodeById(nodeId).outerHTML
    };
  }

  /**
   * 设置节点的外层html
   * @public
   * @param {Object} params
   * @param {Number} nodeId dom节点的id
   * @param {String} outerHTML 外层的html
   */
  setOuterHTML({ nodeId, outerHTML }) {
    nodes.getNodeById(nodeId).outerHTML = outerHTML;
  }

  /**
   * 设置节点的单个属性
   * @public
   * @param {Object} params
   * @param {Number} nodeId dom节点的id
   * @param {String} name 属性名称
   * @param {String} value 属性值
   */
  setAttributeValue({ nodeId, name, value }) {
    const node = nodes.getNodeById(nodeId);
    node.setAttribute(name, value);
  }

  /**
   * 设置节点的属性
   * @public
   * @param {Object} params
   * @param {Number} nodeId dom节点的id
   * @param {String} text 属性文本，eg: class="test" style="color:red;" data-index="1"
   * @param {String} name 移除的属性名
   */
  setAttributesAsText({ nodeId, text, name }) {
    const node = nodes.getNodeById(nodeId);

    if (name) {
      node.removeAttribute(name);
    }

    if (text) {
      text.replace(/\n/g, '')
        .replace(/\s*=\s*/g, '=')
        .replace(/['"].*?['"]/g, (m) => m.replace(/\s/g, '&'))
        .split(' ').filter(item => item)
        .forEach((item) => {
          const [name, value] = item.split('=');
          node.setAttribute(name, value.replace(/\&/g, ' ').replace(/["']/g, ''));
        });
    } else {
      Array.from(node.attributes).forEach((attr) => node.removeAttribute(attr.name));
    }
  }

  /**
   * 请求指定的node节点
   * @public
   * @param {Object} params
   * @param {Number} objectId remoteObject的id
   */
  requestNode({ objectId }) {
    const node = getObjectById(objectId);
    const nodeId = nodes.getIdByNode(node);
    return { nodeId };
  }

  /**
   * 设置节点值
   * @public
   * @param {Object} params
   * @param {Number} nodeId dom节点的id
   * @param {String} value
   */
  setNodeValue({ nodeId, value }) {
    const node = nodes.getNodeById(nodeId);
    node.nodeValue = value
  }

  /**
   * 设置当前选中的节点
   * @public
   * @param {Object} params
   * @param {Number} nodeId dom节点的id
   */
  setInspectedNode({ nodeId }) {
    window.$0 = nodes.getNodeById(nodeId);
  }

  /**
   * 删除节点
   * @public
   * @param {Object} params
   * @param {Number} nodeId dom节点的id
   */
  removeNode({ nodeId }) {
    const node = nodes.getNodeById(nodeId);
    node?.parentNode?.removeChild(node);
  }

  /**
   * @public
   */
  pushNodesByBackendIdsToFrontend({ backendNodeIds }) {
    return {
      nodeIds: backendNodeIds
    };
  }

  /**
   * 获取dom节点id
   * @public
   */
  getNodeId({ node }) {
    return {
      nodeId: nodes.getIdByNode(node)
    }
  }

  /**
   * 复制节点
   * @public
   * @param {Object} params
   * @param {Object} nodeId 需要复制的dom节点id
   * @param {Object} targetNodeId 复制位置的dom节点id
   */
  copyTo({ nodeId, targetNodeId, insertBeforeNodeId }) {
    const node = nodes.getNodeById(nodeId);
    const targetNode = nodes.getNodeById(targetNodeId);
    const cloneNode = node.cloneNode(true);
    if (insertBeforeNodeId) {
      const insertBeforeNode = nodes.getNodeById(insertBeforeNodeId);
      targetNode.insertBefore(cloneNode, insertBeforeNode);
    } else {
      targetNode.appendChild(cloneNode);
    }
  }

  /**
   * 移动节点
   * @public
   * @param {Object} params
   * @param {Object} nodeId 需要移动的dom节点id
   * @param {Object} targetNodeId 移动位置的dom节点id
   */
  moveTo({ nodeId, targetNodeId, insertBeforeNodeId }) {
    const node = nodes.getNodeById(nodeId);
    const targetNode = nodes.getNodeById(targetNodeId);
    if (insertBeforeNodeId) {
      const insertBeforeNode = nodes.getNodeById(insertBeforeNodeId);
      targetNode.insertBefore(node, insertBeforeNode);
    } else {
      targetNode.appendChild(node);
    }
  }

  /**
   * 搜索
   * @public
   * @param {Object} params
   * @param {Object} query 搜索关键词
   */
  performSearch({ query }) {
    let result = [];

    try {
      result = result.concat(Dom.getNodesByKeyword(query));
    } catch (e) { /* empty */ }
    if (!result.length) {
      try {
        result = result.concat(Dom.getNodesBySelector(query));
      } catch (e) { /* empty */ }
    }
    if (!result.length) {
      try {
        result = result.concat(Dom.getNodesByXPath(query));
      } catch (e) { /* empty */ }
    }

    result = result.filter((node) => debugClsList.indexOf(node?.getAttribute?.('class')) === -1);

    const searchId = this.searchId++;
    this.searchResults.set(searchId, result);

    return {
      searchId: searchId,
      resultCount: result.length,
    };
  }

  /**
   * 获取搜索结果
   * @public
   * @param {Object} params
   * @param {Number} searchId 搜索id
   * @param {String} fromIndex 开始索引
   * @param {String} toIndex 结束索引
   */
  getSearchResults({ searchId, fromIndex, toIndex }) {
    const searchResult = this.searchResults.get(searchId);
    const result = searchResult.slice(fromIndex, toIndex);

    const nodeIds = result.map((node) => {
      // 在devtools中展开
      this.expandParentNodes(node);
      return nodes.getIdByNode(node);
    });

    return {
      nodeIds,
    };
  }

  /**
   * 取消搜索
   * @public
   * @param {Object} params
   * @param {Number} searchId 搜索id
   */
  discardSearchResults({ searchId }) {
    this.searchResults.delete(searchId);
  }

  /**
   * 转换dom节点
   * @public
   * @param {Object} params
   * @param {Object} nodeId 转换dom节点成对象
   */
  resolveNode({ nodeId }) {
    const node = nodes.getNodeById(nodeId);
    return {
      object: objectFormat(node),
    };
  }

  /**
   * 通过inspect截图选取节点
   * @public
   * @param {Object} params
   * @param {Number} x 距离屏幕左上角的横向距离
   * @param {Number} y 距离屏幕左上角的纵向距离
   */
  getNodeForLocation({ x, y }) {
    const node = document.elementFromPoint(window.scrollX + x, window.scrollY + y);
    if (node) {
      // 在devtools中展开
      this.expandParentNodes(node);
      const nodeId = nodes.getIdByNode(node);
      return {
        frameId: Page.MAINFRAME_ID,
        backendNodeId: nodeId,
        nodeId,
      };
    }
  }

  /**
   * 监听shadow root插入
   * @private
   */
  hookAttachShadow() {
    const self = this;
    const elAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function attachShadow(init) {
      const shadowRoot = elAttachShadow.apply(this, arguments);
      this.$$shadow = { root: shadowRoot, init };
      self.observeNode(shadowRoot);
      Promise.resolve().then(() => {
        return JDB.runInNativeEnv(() => {
          if (!self.isEnabled) return;
          self.send({
            method: Event.shadowRootPushed,
            params: {
              hostId: nodes.getIdByNode(this),
              root: nodes.collectNodes(shadowRoot, { depth: 0, shadowRootType: init?.mode || 'open' })
            }
          });
        });
      });
      return shadowRoot;
    };
  }

  /**
   * 高亮选中dom
   * @private
   */
  setDomInspect() {
    document.addEventListener('click', (e) => {
      if (Overlay.inspectMode !== 'searchForNode') return;

      e.stopPropagation();
      e.preventDefault();

      // 在devtools中展开
      this.expandParentNodes(e.target);

      // 在devtools视图中高亮选中的节点
      const currentNodeId = nodes.getIdByNode(e.target);
      this.send({
        method: Event.nodeHighlightRequested,
        params: {
          nodeId: currentNodeId
        }
      });
      this.send({
        method: Event.inspectNodeRequested,
        params: {
          backendNodeId: currentNodeId
        }
      });

      document.getElementById('devtools-overlay').style.display = 'none';
    }, true);
  }

  /**
   * 初始化节点变化的监听
   * @private
   */
  initNodeObserver() {
    this.observer = new MutationObserver((mutationList) => {
      return JDB.runInNativeEnv(() => {
        if (!this.isEnabled) return;

        mutationList.forEach((mutation) => {
          const { attributeName, target, type, addedNodes, removedNodes } = mutation;
  
          // 忽略devtool相关的dom变化
          if (debugClsList.indexOf(target.getAttribute?.('class')) !== -1) return;
          if (debugClsList.indexOf(addedNodes[0]?.getAttribute?.('class')) !== -1) return;
          if (debugClsList.indexOf(removedNodes[0]?.getAttribute?.('class')) !== -1) return;
  
          const parentNodeId = nodes.getIdByNode(target);
  
          const updateChildNodeCount = () => {
            this.send({
              method: Event.childNodeCountUpdated,
              params: {
                nodeId: parentNodeId,
                childNodeCount: nodes.getChildNodes(target).length,
              }
            });
          };
  
          switch (type) {
            case 'childList':
              addedNodes.forEach((node) => {
                updateChildNodeCount();
                this.send({
                  method: Event.childNodeInserted,
                  params: {
                    node: nodes.collectNodes(node, { depth: 0 }),
                    parentNodeId,
                    previousNodeId: nodes.getIdByNode(nodes.getPreviousNode(node))
                  }
                });
              });
  
              removedNodes.forEach((node) => {
                updateChildNodeCount();
                const nodeId = nodes.getIdByNode(node);
                this.send({
                  method: Event.childNodeRemoved,
                  params: {
                    nodeId,
                    parentNodeId,
                  }
                });
              });
  
              break;
            case 'attributes':
              // eslint-disable-next-line
              const value = target.getAttribute(attributeName);
              this.send({
                method: value ? Event.attributeModified : Event.attributeRemoved,
                params: {
                  nodeId: parentNodeId,
                  value: value || undefined,
                  name: attributeName,
                }
              });
              break;
  
            case 'characterData':
              this.send({
                method: Event.characterDataModified,
                params: {
                  nodeId: parentNodeId,
                  characterData: target.nodeValue
                }
              });
              break;
          }
        });
      });
    });
  }

  /**
   * 监听节点变化
   * @private
   */
  observeNode(node) {
    this.observer.observe(node, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }

  /**
   * 清理文档
   * @private
   */
  resetDocument() {
    this.childListSetNodeIds = new Set();
    this.send({ method: Event.documentUpdated });
  }

  /**
   * 展开所有父节点
   * @private
   */
  expandParentNodes(node) {
    let parent = node;
    const nodeIds = [];
    while (parent = parent.parentNode) {
      nodeIds.unshift(nodes.getIdByNode(parent));
    }
    nodeIds.forEach((nodeId) => this.requestChildNodes({ nodeId }));
  }
}
