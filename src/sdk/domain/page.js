import BaseDomain from './domain';
import { Event } from './protocol';
import html2canvas from 'html2canvas';
import { requestSource } from '../common/utils';

export default class Page extends BaseDomain {
  namespace = 'Page';

  frame = new Map();
  curScreenshot = null;

  static MAINFRAME_ID = 1;

  /**
   * 启用page域
   * @public
   */
  enable() {
    this.fetchPageHTML();

    document.addEventListener('visibilitychange', this.sendVisibilityResult.bind(this));
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
   * 单次截图（CDP Page.captureScreenshot）
   * 优先使用 JSAPI 截图，不可用时回退到 html2canvas
   * @public
   * @param {Object} params
   * @param {String} [params.format="png"] 图片格式：jpeg | png | webp
   * @param {Number} [params.quality] jpeg 质量 0-100（仅 jpeg 有效，未传则用 Canvas 默认）
   * @param {Object} [params.clip] 裁剪区域 { x, y, width, height, scale }
   * @param {Boolean} [params.captureBeyondViewport] 是否截取视口外内容，默认 false（仅视口）
   */
  async captureScreenshot(params = {}) {
    const { format = 'png', clip, captureBeyondViewport = false } = params;
    let base64;

    // clip 或全页截图需走 html2canvas，JSAPI 不支持
    if (!clip && !captureBeyondViewport) {
      base64 = await this.takeScreenshotByJsapi();
    }

    if (base64 == null) {
      base64 = await this.takeScreenshotByHTML2Canvas(!captureBeyondViewport ? true : false, clip);
    }

    // 格式转换：加载图片 → Canvas → 目标格式
    const needConvert = format !== 'jpeg' || (format === 'jpeg' && params.quality !== undefined);
    if (needConvert) {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + base64;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image for format conversion'));
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const q = (format === 'jpeg' && params.quality !== undefined) ? params.quality / 100 : undefined;
      const dataUrl = canvas.toDataURL(`image/${format}`, q);
      base64 = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
    }

    return { data: base64 };
  }

  /**
   * 开始截屏
   * @public
   */
  startScreencast() {
    this.stopScreencast();
    this.sendScreenshot();
    this.sendVisibilityResult();
    this.intervalTimer = setInterval(this.sendScreenshot.bind(this), this.checkIfTakeScreenshotByJsapi() ? 500 : 2000);
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
   * 拉取主文档
   * @private
   */
  fetchPageHTML() {
    if (!this.frame.has(location.href)) {
      const onload = (xhr) => {
        this.frame.set(location.href, xhr.responseText);
      };
      const onerror = () => {
        this.frame.set(location.href, document.documentElement.outerHTML);
      };
      requestSource(location.href, 'Document', onload, onerror);
    }
  }

  /**
   * 获取页面是否可见
   * @private
   */
  sendVisibilityResult() {
    this.send({
      method: Event.screencastVisibilityChanged,
      params: {
        visible: !document.hidden
      }
    });
  }

  /**
   * 检查是否可以使用jsapi截图
   * @private
   */
  checkIfTakeScreenshotByJsapi() {
    return 'WeixinJSBridge' in window && !this.forceTakeScreenshotByHTML2Canvas;
  }

  /**
   * 发送屏幕截图
   * @private
   */
  sendScreenshot() {
    if (document.hidden) {
      this.sendScreenshotEvent(null, -window.scrollY);
      return;
    }
    const promise = this.checkIfTakeScreenshotByJsapi()
      ? this.takeScreenshotByJsapi()
      : this.takeScreenshotByHTML2Canvas(true);

    promise.then((screenshot) => {
      if (screenshot != null) {
        this.sendScreenshotEvent(screenshot, 0);
      }
    }).catch(() => {
      // JSAPI 失败回退：forceTakeScreenshotByHTML2Canvas 已置 true
      this.sendScreenshot();
      if (this.intervalTimer) {
        clearInterval(this.intervalTimer);
        this.intervalTimer = setInterval(this.sendScreenshot.bind(this), 2000);
      }
    });
  }

  /**
   * 发送缓存的截图
   * @private
   */
  sendScreenshotEvent(screenshot, offsetTop = 0) {
    this.curScreenshot = screenshot || this.curScreenshot || 'R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
    this.send({
      method: Event.screencastFrame,
      params: {
        data: this.curScreenshot,
        sessionId: 1,
        metadata: {
          deviceHeight: window.innerHeight,
          deviceWidth: window.innerWidth,
          pageScaleFactor: 1,
          offsetTop,
          scrollOffsetX: 0,
          scrollOffsetY: 0,
          timestamp: Date.now()
        }
      }
    });
  }

  /**
   * 通过JSAPI截图（返回 Promise<base64|null>）
   * @private
   * @returns {Promise<String|null>} base64 jpeg 数据，失败返回 null
   */
  takeScreenshotByJsapi() {
    return new Promise((resolve) => {
      if (!this.checkIfTakeScreenshotByJsapi()) {
        resolve(null);
        return;
      }
      window.WeixinJSBridge.invoke('handleMPPageAction', {
        action: 'takeSnapshot',
      }, (res) => {
        if (!res || !res.err_msg || res.err_msg.indexOf('ok') === -1) {
          // 只有微信的可调试版本中极少部分网页才有JSAPI权限，所以调用失败回退到html2canvas
          this.forceTakeScreenshotByHTML2Canvas = true;
          // screencast 调用方通过 catch 感知回退，captureScreenshot 通过 null 感知
          resolve(null);
          return;
        }
        const img = new Image();
        img.$$ignoreHandle = true;
        img.crossOrigin = 'anonymous';
        img.src = 'data:image/jpeg;base64,' + res.data;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const ratio = window.innerHeight / window.innerWidth;
          const iWidth = img.naturalWidth / 3;
          const iHeight = img.naturalHeight / 3;
          const cWidth = iWidth;
          const cHeight = iWidth * ratio;
          canvas.width = cWidth;
          canvas.height = cHeight;
          ctx.drawImage(img, 0, cHeight - iHeight, iWidth, iHeight);
          const screenshot = canvas.toDataURL('image/jpeg', 0.8);
          resolve(screenshot.replace(/^data:image\/jpeg;base64,/, ''));
        };
        img.onerror = () => {
          this.forceTakeScreenshotByHTML2Canvas = true;
          resolve(null);
        };
      });
    });
  }

  /**
   * 通过html2canvas截图（返回 Promise<base64|null>）
   * @private
   * @param {Boolean} viewportOnly 是否只截取当前视口，默认 false（截全页）
   * @param {Object} [clip] 裁剪区域 { x, y, width, height, scale }
   * @returns {Promise<String|null>} base64 jpeg 数据，失败返回 null
   */
  takeScreenshotByHTML2Canvas(viewportOnly = false, clip) {
    const opts = {
      useCORS: true,
      allowTaint: true,
      imageTimeout: 10000,
      scale: clip?.scale || 1,
      logging: false,
      // 传入窗口尺寸，使 html2canvas 按实际视口计算 CSS 布局（vw/vh/百分比等）
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      ignoreElements: (element) => {
        if (!element?.style) return false;
        const { display, opacity, visibility } = element.style;
        return display === 'none' || opacity === 0 || visibility === 'hidden';
      }
    };

    if (clip) {
      opts.x = clip.x;
      opts.y = clip.y;
      opts.width = clip.width;
      opts.height = clip.height;
    } else if (viewportOnly) {
      opts.x = 0;
      opts.y = window.scrollY;
      opts.width = window.innerWidth;
      opts.height = window.innerHeight;
    }

    return html2canvas(document.body, opts)
      .then((canvas) => canvas.toDataURL('image/jpeg'))
      .then((dataUrl) => dataUrl.replace(/^data:image\/jpeg;base64,/, ''))
      .catch(() => {
        console.warn('[RemoteDev][Inspect]', 'Failed to take screenshot by html2canvas');
        return null;
      });
  }
}
