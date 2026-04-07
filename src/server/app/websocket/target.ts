import { WebSocket } from 'ws';
import { TargetInfo } from './interface';

const HEARTBEAT_INTERVAL = 15000; // ping 间隔 15s
const HEARTBEAT_TIMEOUT = 10000;  // pong 超时 10s

export class Target {
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private timeoutTimer: NodeJS.Timeout | null = null;

  constructor(
    public ws: WebSocket,
    public info: TargetInfo,
  ) {
    ws.send('connected');
    ws.on('pong', () => this.onPong());
    this.startHeartbeat();
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws.readyState !== WebSocket.OPEN) {
        return this.destroy();
      }
      this.ws.ping();
      this.timeoutTimer = setTimeout(() => {
        // 超时未收到 pong，主动终止
        this.ws.terminate();
      }, HEARTBEAT_TIMEOUT);
    }, HEARTBEAT_INTERVAL);
  }

  private onPong() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  public destroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
}