import BaseDomain from './domain';

export default class Input extends BaseDomain {
  namespace = 'Input';

  /**
   * 鼠标模拟touch操作
   * @public
   * @param {Object} params
   * @param {String} type 操作类型
   * @param {Number} x 屏幕坐标
   * @param {Number} y 屏幕坐标
   * @param {Number} deltaX 鼠标滚轮偏移
   * @param {Number} deltaY 鼠标滚轮偏移
   */
  emulateTouchFromMouseEvent({ type, x, y, deltaX, deltaY }) {
    const target = document.elementFromPoint(x, y) || document.documentElement;

    switch (type) {
      case 'mousePressed': break;
      case 'mouseReleased': break;
      case 'mouseMoved': break;
      case 'mouseWheel': this.scrollTarget(target, deltaX, deltaY); break;
    }
  }

  /**
   * 滚动特定节点
   * @private
   */
  scrollTarget(target, deltaX, deltaY) {
    const scrollView = this.findScrollView(target);
    const scrollLeft = scrollView.$$emulateBaseScrollLeft || (scrollView.$$emulateBaseScrollLeft = scrollView.scrollLeft);
    const scrollTop = scrollView.$$emulateBaseScrollTop || (scrollView.$$emulateBaseScrollTop = scrollView.scrollTop);
    scrollView.scrollLeft = scrollLeft - deltaX;
    scrollView.scrollTop = scrollTop - deltaY;
    if (scrollView.$$emulateBaseScrollClearTimer) {
      clearTimeout(scrollView.$$emulateBaseScrollClearTimer);
    }
    scrollView.$$emulateBaseScrollClearTimer = setTimeout(() => {
      delete scrollView.$$emulateBaseScrollClearTimer;
      delete scrollView.$$emulateBaseScrollLeft;
      delete scrollView.$$emulateBaseScrollTop;
    }, 150);
  }

  /**
   * 获取最近的scrollview
   * @private
   */
  findScrollView(target) {
    let scrollView = target;
    while (scrollView) {
      const scrollableY = scrollView.scrollHeight > scrollView.clientHeight;
      const scrollableX = scrollView.scrollWidth > scrollView.clientWidth;
      if (scrollableY || scrollableX) {
        break;
      }
      scrollView = scrollView.parentElement;
    }
    return scrollView;
  }
}
