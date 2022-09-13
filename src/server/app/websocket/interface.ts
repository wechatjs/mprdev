import { WebSocket } from 'ws';
import { Channel } from './channel';
import { ChannelEventName } from './enum';

export interface TargetInfo {
  targetId: string;
  pageUrl: string;
  ua: string;
  uin?: string;
  time?: string;
  title: string;
  favicon: string;
}

export interface DevtoolInfo {
  // 保留字段
  mode: string;
  targetId: string;
}

export interface IChannelService {
  handleTargetConnection: (ws: WebSocket, info: TargetInfo) => void;
  handleDevtoolConnection: (ws: WebSocket, info: DevtoolInfo) => void;
  fireChannelChange: (eventName: ChannelEventName, channel: Channel) => void;
  subscribeChannelChange: (cb: (...args: any[]) => void) => void;
  removeChannel: (id: string) => void;
}

export interface ServeOptions {
  port: number;
  host: string;
  verbose: boolean;
}
