import html2canvas from 'html2canvas';
import BaseDomain from './domain';
import { Event } from './protocol';
import { isMatches } from '../common/utils';

export default class Page extends BaseDomain {
  namespace = 'Page';

  frame = new Map();

  static MAINFRAME_ID = 1;

  /**
   * 启用page域
   * @public
   */
  enable() {
    this.frame.set(location.href, document.documentElement.outerHTML);
  }

  /**
   * 获取root frame
   * @public
   */
  getResourceTree() {
    return {
      frameTree: {
        frame: {
          id: Page.MAINFRAME_ID,
          mimeType: 'text/html',
          securityOrigin: location.origin,
          url: location.href,
        },
        resources: [],
      },
    };
  }

  /**
   * 获取frame(页面)的源html
   * @public
   * @param {Object} params
   * @param {String} params.url frame(页面)的url
   */
  getResourceContent({ url }) {
    return {
      content: this.frame.get(url),
    };
  }

  /**
   * 获取当前导航信息
   * @public
   */
  getNavigationHistory() {
    return {
      currentIndex: 0,
      entries: [{
        id: 0,
        url: location.href,
        userTypedURL: location.href,
        title: document.title,
        transitionType: 'link',
      }],
    };
  }

  /**
   * 刷新页面
   * @public
   */
  reload() {
    location.reload(true);
  }

  /**
   * 跳转页面
   * @public
   * @param {Object} params
   * @param {String} params.url 跳转frame(页面)的url
   */
  navigate({ url }) {
    location.href = url;
  }

  /**
   * 开始截屏
   * @public
   */
  startScreencast() {
    this.stopScreencast();
    this.sendScreenshot();
    this.intervalTimer = setInterval(this.sendScreenshot.bind(this), 2000);
  }

  /**
   * 结束截屏
   * @public
   */
  stopScreencast() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  /**
   * 发送屏幕截图
   * @private
   */
  sendScreenshot() {
    if (document.hidden) return;
    if ('WeixinJSBridge' in window && !this.forceTakeScreenshotByHTML2Canvas) {
      this.takeScreenshotByJsapi();
    } else {
      this.takeScreenshotByHTML2Canvas();
    }
  }

  /**
   * 通过JSAPI截图
   * @private
   */
  takeScreenshotByJsapi() {
    window.WeixinJSBridge.invoke('handleMPPageAction', {
      action: 'takeSnapshot',
    }, (res) => {
      if (res.err_msg.indexOf('ok') === -1) {
        this.forceTakeScreenshotByHTML2Canvas = true;
        this.takeScreenshotByHTML2Canvas();
      }
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.src = 'data:image/jpeg;base64,' + res.data;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const ratio = window.innerHeight / window.innerWidth;
        const iWidth = img.naturalWidth / 3;
        const iHeight = img.naturalHeight / 3
        const cWidth = iWidth;
        const cHeight = iWidth * ratio;
        canvas.width = cWidth;
        canvas.height = cHeight;
        ctx.drawImage(img, 0, cHeight - iHeight, iWidth, iHeight);
        const screenshot = canvas.toDataURL('image/jpeg', 0.8);
        this.send({
          method: Event.screencastFrame,
          params: {
            data: screenshot.replace(/^data:image\/jpeg;base64,/, ''),
            sessionId: 1,
            metadata: {
              deviceHeight: window.innerHeight,
              deviceWidth: window.innerWidth,
              pageScaleFactor: 1,
              offsetTop: 0,
              scrollOffsetX: 0,
              scrollOffsetY: 0,
              timestamp: Date.now()
            }
          }
        });
      }
    });
  }

  /**
   * 通过html2canvas截图
   * @private
   */
  takeScreenshotByHTML2Canvas() {
    const curOffsetTop = -window.scrollY;
    html2canvas(document.body, {
      useCORS: true,
      allowTaint: true,
      imageTimeout: 10000,
      scale: 1,
      ignoreElements: (element) => {
        if (!element?.style) return false;
        const { display, opacity, visibility } = element.style;
        return isMatches(element, '.devtools-overlay') ||
          display === 'none' ||
          opacity === 0 ||
          visibility === 'hidden';
      }
    }).then(canvas => canvas.toDataURL('image/jpeg')).then((screenshot) => {
      this.send({
        method: Event.screencastFrame,
        params: {
          data: screenshot.replace(/^data:image\/jpeg;base64,/, ''),
          sessionId: 1,
          metadata: {
            deviceHeight: window.innerHeight,
            deviceWidth: window.innerWidth,
            pageScaleFactor: 1,
            offsetTop: curOffsetTop,
            scrollOffsetX: 0,
            scrollOffsetY: 0,
            timestamp: Date.now()
          }
        }
      });
    });
  }
}
