import * as EventEmitter from 'events';
import { WebSocket } from 'ws';
import { Channel } from './channel';
import { Target } from './target';
import { Devtool } from './devtool';
import { ChannelEventName } from './enum';
import { TargetInfo, DevtoolInfo, IChannelService } from './interface';
import { enumKeys } from './utils';

class ChannelService implements IChannelService {
  private channelPool = new Map<string, Channel>();
  private eventEmitter = new EventEmitter();

  /**
   * 调试目标连接处理
   */
  public handleTargetConnection(ws: WebSocket, info: TargetInfo) {
    // 频道不存在就初始化一个
    const { targetId } = info;
    if (!this.channelPool.get(targetId)) {
      this.channelPool.set(targetId, new Channel());
    }
    const channel = this.channelPool.get(targetId);
    channel.addTarget(new Target(ws, info));
  }

  /**
   * 开发端连接处理
   */
  public handleDevtoolConnection(ws: WebSocket, info: DevtoolInfo) {
    // 频道不存在就关闭当前 devtool 的连接，直接退出
    const { targetId } = info;
    if (!this.channelPool.get(targetId)) {
      return ws.close();
    }
    const channel = this.channelPool.get(targetId);
    channel.addDevtool(new Devtool(ws, info));
  }

  /**
   * 频道移除
   */
  public removeChannel(id: string) {
    this.channelPool.delete(id);
  }

  /**
   * 订阅频道变化，供 websocket 和 httpsocket 服务器调用
   */
  public subscribeChannelChange(
    cb: (...args: any[]) => void
  ) {
    (cb as any).__listeners__ = {};
    for (const key of enumKeys(ChannelEventName)) {
      const eventName = ChannelEventName[key];
      (cb as any).__listeners__[eventName] = (channel: Channel) => cb(eventName, channel);
      this.eventEmitter.on(eventName, (cb as any).__listeners__[eventName]);
    }
  }

  /**
   * 取消订阅频道变化，供 httpsocket 服务器调用
   */
  public unsubscribeChannelChange(
    cb: (...args: any[]) => void
  ) {
    if ((cb as any).__listeners__) {
      for (const key of enumKeys(ChannelEventName)) {
        const eventName = ChannelEventName[key];
        this.eventEmitter.off(eventName, (cb as any).__listeners__[eventName]);
      }
    }
  }

  /**
   * 触发频道变化，供频道调用
   */
  public fireChannelChange(eventName: ChannelEventName, channel: Channel) {
    this.eventEmitter.emit(eventName, channel);
  }

  /**
   * 获取链接
   */
  public getTargets() {
    let res: Record<string, TargetInfo> = {};
    for (const [key, channel] of this.channelPool) {
      const info = channel.targets[0]?.info;
      if (info) {
        const devtoolNum = channel.devtools.length;
        res[key] = Object.assign({ devtoolNum }, info);
      }
    }
    return res;
  }
}

export const channelService = new ChannelService();