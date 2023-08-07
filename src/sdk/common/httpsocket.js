const supportSSE = typeof window.EventSource === 'function';
const oriEventSource = window.EventSource;
const oriFetch = window.fetch;

export default class HttpSocket {
  constructor(url) {
    this.url = url;
    this.messages = [];
    this.listeners = {};
    this.sseSocket = null;
    this.sseSendTimeout = null;
    this.initConnection();
  }
  send(data) {
    this.messages.push(data);
    if (this.sseSocket && !this.sseSendTimeout) {
      this.sseSendTimeout = setTimeout(() => {
        this.sseSendTimeout = null;
        this.batchSendMessages();
      }, 50);
    }
  }
  addEventListener(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }
  initConnection() {
    oriFetch(this.url, {
      method: 'POST',
      body: JSON.stringify(['connect']),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    }).then(() => {
      if (supportSSE) {
        // 如果支持SSE，用SSE
        this.initEventSource();
      } else {
        // 否则回退成长轮询
        this.pollingMessages();
      }
    }).catch((err) => {
      console.error('[RemoteDev][Connection]', err.toString());
    });
  }
  initEventSource() {
    const socket = new oriEventSource(this.url);
    socket.onopen = () => {
      this.sseSocket = socket;
      this.batchSendMessages();
    };
    socket.onmessage = (e) => {
      if (e.data === 'connected') {
        return;
      }
      let messages = [];
      try {
        messages = JSON.parse(e.data);
      } catch (err) {
        console.error('[RemoteDev][Connection]', err.toString());
      }
      this.callbackData(messages);
    };
    socket.onerror = () => {
      this.sseSocket = null;
      console.error('[RemoteDev][Connection]', 'Failed to open a Server-Send Event connection and fallback to polling');
    };
  }
  pollingMessages() {
    this.batchSendMessages().finally(() => {
      if (this.messages.length) {
        this.pollingMessages();
      } else {
        setTimeout(() => {
          this.pollingMessages();
        }, 2000);
      }
    });
  }
  batchSendMessages() {
    const body = JSON.stringify(this.messages);
    this.messages = [];
    return oriFetch(this.url, {
      method: 'POST',
      body,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    }).then((resp) => resp.json()).then((messages) => {
      this.callbackData(messages);
    }).catch((err) => {
      console.error('[RemoteDev][Connection]', err.toString());
    });
  }
  callbackData(messages) {
    if (this.listeners.message) {
      for (const data of messages) {
        for (const callback of this.listeners.message) {
          callback({ data });
        }
      }
    }
  }
}
