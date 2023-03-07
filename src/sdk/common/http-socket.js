const oriFetch = window.fetch;

export default class HttpSocket {
  constructor(url) {
    this.url = url;
    this.messages = [];
    this.listeners = {};
    this.pollingMessages();
  }
  send(data) {
    this.messages.push(data);
  }
  addEventListener(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }
  pollingMessages() {
    const body = JSON.stringify(this.messages);
    this.messages = [];
    return oriFetch(this.url, {
      method: 'POST',
      body,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })
      .then((resp) => resp.json())
      .then((messages) => {
        if (this.listeners.message) {
          for (const data of messages) {
            for (const callback of this.listeners.message) {
              callback({ data });
            }
          }
        }
      })
      .catch(console.error)
      .finally(() => {
        setTimeout(() => {
          this.pollingMessages();
        }, 500);
      });
  }
}
