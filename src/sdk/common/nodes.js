const debugClsList = ['devtools-overlay', 'devtools-debugger', 'html2canvas-container'];

class Nodes {
  // DOM节点id集合
  nodeIds = new Map();

  // DOM节点id集合
  nodes = new Map();

  // DOM节点id计数
  currentId = 1;

  /**
   * 是否为node节点
   * @static
   * @param {HTMLElement} node DOM
   */
  static isNode(node) {
    if (!node) return false;
    // 忽略调试用的dom节点
    if (node.getAttribute && debugClsList.indexOf(node.getAttribute('class')) !== -1) return false;
    // 非文本节点
    if (node.nodeType !== 3) return true;
    // 非空的文本节点
    if (node.nodeType === 3 && (node.nodeValue || '').trim() !== '') return true;
    return false;
  }

  create(nodeId, node) {
    this.nodeIds.set(node, nodeId);
    this.nodes.set(nodeId, node);
  }

  hasNode(node) {
    return this.nodeIds.has(node);
  }

  /**
   * 根据id获取到对应的真是dom节点
   * @public
   * @param {Number} nodeId DOM的唯一id
   */
  getNodeById(nodeId) {
    return this.nodes.get(nodeId);
  }

  /**
   * 获取到指定dom的唯一id
   * @public
   * @param {HTMLElement} node DOM
   */
  getIdByNode(node) {
    let nodeId = this.nodeIds.get(node);
    if (nodeId) return nodeId;

    // eslint-disable-next-line
    nodeId = this.currentId++;
    this.create(nodeId, node);

    return nodeId;
  }

  /**
   * 收集子节点
   * @public
   * @param {Element} node dom节点
   * @param {Number} depth 子节点深度
   */
  collectNodes(node, depth = 2) {
    const nodeId = this.getIdByNode(node);
    const { nodeType, nodeName, localName, nodeValue, parentNode, attributes, childNodes } = node;
    const res = {
      nodeId,
      nodeType,
      nodeName,
      localName,
      nodeValue,
      backendNodeId: nodeId,
      childNodeCount: childNodes.length
    };

    if (attributes) {
      res.attributes = Array.from(attributes).reduce((pre, curr) => pre.concat(curr.name, curr.value), []);
    }

    if (parentNode) {
      res.parentId = this.getIdByNode(parentNode);
    }

    if (depth > 0) {
      res.children = this.getChildNodes(node, depth);
    }

    return res;
  }

  /**
   * 收集指定dom的子元素
   * @public
   * @param {HTMLElement} node DOM
   * @param {Number} depth 深度
   */
  getChildNodes(node, depth = 1) {
    return Array.from(node.childNodes)
      .filter(Nodes.isNode)
      .map(childNode => this.collectNodes(childNode, depth - 1));
  }

  /**
   * 获取指定dom的前兄弟节点
   * @public
   * @param {HTMLElement} node DOM
   */
  getPreviousNode(node) {
    let previousNode = node.previousSibling;
    if (!previousNode) return;

    while (!Nodes.isNode(previousNode) && previousNode.previousSibling) {
      previousNode = previousNode.previousSibling;
    }

    return previousNode;
  }
}

export default new Nodes();
