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
      case 'mousePressed': this.emitTargetTouchStart(target, x, y); break;
      case 'mouseReleased': this.emitTargetTouchEnd(target, x, y); break;
      case 'mouseMoved': this.emitTargetTouchMove(target, x, y); break;
      case 'mouseWheel': this.scrollTarget(target, deltaX, deltaY); break;
    }
  }

  /**
   * 触发touchstart事件
   * @private
   */
  emitTargetTouchStart(target, x, y) {
    this.emitTouchEvent('touchstart', target, x, y);
    target.$$emulateBaseTouchX = x;
    target.$$emulateBaseTouchY = y;
  }

  /**
   * 触发touchend事件
   * @private
   */
  emitTargetTouchEnd(target, x, y) {
    this.emitTouchEvent('touchend', target, x, y);
    if (typeof target.$$emulateBaseTouchX === 'number' && typeof target.$$emulateBaseTouchY === 'number') {
      this.emitClickEvent(target);
    }
    delete target.$$emulateBaseTouchX;
    delete target.$$emulateBaseTouchY;
  }

  /**
   * 触发touchmove事件
   * @private
   */
  emitTargetTouchMove(target, x, y) {
    this.emitTouchEvent('touchmove', target, x, y);
    delete target.$$emulateBaseTouchX;
    delete target.$$emulateBaseTouchY;
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

  /**
   * 触发touch相关事件
   * @private
   */
  emitTouchEvent(type, target, x, y) {
    target.dispatchEvent(new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: [new Touch({
        identifier: 1,
        target: target,
        clientX: x,
        clientY: y,
      })],
    }));
  }

  /**
   * 触发click事件
   * @private
   */
  emitClickEvent(target) {
    target.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    }));
  }
}
