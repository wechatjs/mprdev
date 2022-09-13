import BaseDomain from './domain';
import { Event } from './protocol';

export default class DomStorage extends BaseDomain {
  namespace = 'DOMStorage';

  /**
   * 获取storage
   * @static
   * @param {Boolean} isLocalStorage 是否localStorage
   */
  static getStorage({ isLocalStorage }) {
    return isLocalStorage ? localStorage : sessionStorage;
  }

  /**
   * 获取DOMStorage
   * @public
   * @param {Object} params
   * @param {String} params.storageId storageId
   */
  getDOMStorageItems({ storageId }) {
    const storage = DomStorage.getStorage(storageId);
    return { entries: Object.entries(storage) };
  }

  /**
   * 删除指定的DOMStorage
   * @public
   * @param {Object} params
   * @param {String} params.key key
   * @param {String} params.storageId storageId
   */
  removeDOMStorageItem({ key, storageId }) {
    const storage = DomStorage.getStorage(storageId);
    storage.removeItem(key);

    this.send({
      method: Event.domStorageItemRemoved,
      params: { key, storageId }
    });
  }

  /**
   * 清除DOMStorage
   * @public
   * @param {Object} params
   * @param {String} params.storageId storageId
   */
  clear({ storageId }) {
    const storage = DomStorage.getStorage(storageId);
    storage.clear();

    this.send({
      method: Event.domStorageItemsCleared,
      params: { storageId },
    });
  }

  setDOMStorageItem({ storageId, key, value }) {
    const storage = DomStorage.getStorage(storageId);
    storage.setItem(key, value);
  }
}
