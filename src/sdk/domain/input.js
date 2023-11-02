import BaseDomain from './domain';

export default class Input extends BaseDomain {
  namespace = 'Input';

  emulateTouchBaseX = 0;
  emulateTouchBaseY = 0;
  emulateTouching = false;
  emulateClickPrevented = false;
  emulateScrollPrevented = false;
  currentScrollView = null;

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
      case 'mouseMoved': this.emitTargetTouchMove(target, x, y); break;
      case 'mouseReleased': this.emitTargetTouchEnd(target, x, y); break;
      case 'mouseWheel': this.scrollTarget(target, deltaX, deltaY); break;
    }
  }

  /**
   * 触发touchstart事件
   * @private
   */
  emitTargetTouchStart(target, x, y) {
    const prevent = this.emitTouchEvent('touchstart', target, x, y);
    this.emulateTouchBaseX = prevent ? 0 : x;
    this.emulateTouchBaseY = prevent ? 0 : y;
    this.emulateScrollPrevented = prevent;
    this.emulateClickPrevented = prevent;
    this.emulateTouching = true;

    if (this.currentScrollView) {
      delete this.currentScrollView.$$emulateBaseScrollLeft;
      delete this.currentScrollView.$$emulateBaseScrollTop;
      this.currentScrollView = null;
    }
  }

  /**
   * 触发touchmove事件
   * @private
   */
  emitTargetTouchMove(target, x, y) {
    const prevent = this.emitTouchEvent('touchmove', target, x, y);
    this.emulateClickPrevented = true;
    if (prevent) {
      this.emulateScrollPrevented = true;
    } else if (!this.emulateScrollPrevented) {
      const deltaX = x - this.emulateTouchBaseX;
      const deltaY = y - this.emulateTouchBaseY;
      const scrollView = this.findScrollView(target, deltaX, deltaY);
      const scrollLeft = scrollView.$$emulateBaseScrollLeft || (scrollView.$$emulateBaseScrollLeft = scrollView.scrollLeft);
      const scrollTop = scrollView.$$emulateBaseScrollTop || (scrollView.$$emulateBaseScrollTop = scrollView.scrollTop);
      scrollView.scrollLeft = scrollLeft - deltaX;
      scrollView.scrollTop = scrollTop - deltaY;
      this.currentScrollView = scrollView;
    }
  }

  /**
   * 触发touchend事件
   * @private
   */
  emitTargetTouchEnd(target, x, y) {
    if (this.emulateTouching) {
      this.emitTouchEvent('touchend', target, x, y);
      if (!this.emulateClickPrevented) {
        this.emitClickEvent(target);
      }
    }

    this.emulateTouchBaseX = 0;
    this.emulateTouchBaseY = 0;
    this.emulateScrollPrevented = false;
    this.emulateClickPrevented = false;
    this.emulateTouching = false;

    if (this.currentScrollView) {
      delete this.currentScrollView.$$emulateBaseScrollLeft;
      delete this.currentScrollView.$$emulateBaseScrollTop;
      this.currentScrollView = null;
    }
  }

  /**
   * 滚动特定节点
   * @private
   */
  scrollTarget(target, deltaX, deltaY) {
    const scrollView = this.findScrollView(target, deltaX, deltaY);
    const scrollLeft = scrollView.$$emulateBaseScrollLeft || (scrollView.$$emulateBaseScrollLeft = scrollView.scrollLeft);
    const scrollTop = scrollView.$$emulateBaseScrollTop || (scrollView.$$emulateBaseScrollTop = scrollView.scrollTop);
    scrollView.scrollLeft = scrollLeft - deltaX;
    scrollView.scrollTop = scrollTop - deltaY;
    this.currentScrollView = scrollView;

    if (scrollView.$$emulateBaseScrollClearTimer) {
      clearTimeout(scrollView.$$emulateBaseScrollClearTimer);
    }
    scrollView.$$emulateBaseScrollClearTimer = setTimeout(() => {
      delete scrollView.$$emulateBaseScrollClearTimer;
      delete scrollView.$$emulateBaseScrollLeft;
      delete scrollView.$$emulateBaseScrollTop;
      this.currentScrollView = null;
    }, 150);
  }

  /**
   * 获取最近的scrollview
   * @private
   */
  findScrollView(target, deltaX, deltaY) {
    if (this.currentScrollView) {
      return this.currentScrollView;
    }
    let scrollView = target;
    while (scrollView) {
      const computedStyle = window.getComputedStyle(scrollView);
      const scrollableY = !!deltaY && (scrollView.scrollHeight > scrollView.clientHeight) && (computedStyle.overflowY === 'auto' || computedStyle.overflowY === 'scroll');
      const scrollableX = !!deltaX && (scrollView.scrollWidth > scrollView.clientWidth) && (computedStyle.overflowX === 'auto' || computedStyle.overflowX === 'scroll');
      if (scrollableY || scrollableX) {
        break;
      }
      scrollView = scrollView.parentElement;
    }
    return scrollView || document.documentElement;
  }

  /**
   * 触发touch相关事件
   * @private
   */
  emitTouchEvent(type, target, x, y) {
    const touch = new Touch({
      identifier: 1,
      target: target,
      clientX: x,
      clientY: y,
    });
    const event = new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      changedTouches: [touch],
      targetTouches: [touch],
      touches: [touch],
    });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }

  /**
   * 触发click事件
   * @private
   */
  emitClickEvent(target) {
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }
}
