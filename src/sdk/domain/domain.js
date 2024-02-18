export default class BaseDomain {
  constructor(options) {
    this.options = options;
  }

  enable() {}

  send(data) {
    this.options.socket.send(JSON.stringify(data));
  }
}
