import { Server } from 'http';
import { Socket } from 'net';
import { WebSocket, Server as WSS } from 'ws';
import { Channel } from './channel';
import { channelService } from './channel-service';
import { ChannelEventName } from './enum';
import { IChannelService } from './interface';

enum ConnectionType {
  Target = 'target',
  Devtool = 'devtool',
};

export default class WebSocketServer {
  public wss: WSS;
  private verbose: boolean;
  private channelService: IChannelService;
  constructor(verbose: boolean = false) {
    this.wss = new WebSocket.Server({ noServer: true });
    this.channelService = channelService;
    this.verbose = verbose;
  }

  init(server: Server) {
    const { wss } = this;
    server.on('upgrade', (request, socket, head) => {
      const urlParse = new URL(request.url, 'http://0.0.0.0');
      const pathname = urlParse.pathname;
      const [, type, targetId] = pathname.split('/');
      const { searchParams } = urlParse;
      const pageUrl = searchParams.get('url');
      // console.log('deanti test', pathname, type, targetId, pageUrl);
      if (type !== ConnectionType.Target && type !== ConnectionType.Devtool) {
        return socket.destroy();
      }

      wss.handleUpgrade(request, socket as Socket, head, (ws: WebSocket) => {
        // 初始化1个新的 target 频道
        if (type === ConnectionType.Target) {
          const info = {
            targetId,
            pageUrl,
            ua: searchParams.get('ua'),
            uin: searchParams.get('uin'),
            time: searchParams.get('time') || `${new Date().toLocaleString()}`,
            title: searchParams.get('title'),
            favicon: searchParams.get('favicon'),
          };
          this.channelService.handleTargetConnection(ws, info);
        } else {
          const info = {
            mode: searchParams.get('mode'),
            targetId: searchParams.get('targetId'),
          };
          // 初始化1个新的 devtool 频道
          this.channelService.handleDevtoolConnection(ws, info);
        }
      });
    });
    // 订阅频道事件变化
    this.channelService.subscribeChannelChange(this.handleChannelChange.bind(this));
  }

  // TODO: 优化一下
  private handleChannelChange(eventName: ChannelEventName, channel: Channel) {
    switch (eventName) {
      case ChannelEventName.CHANNEL_BUILT:
        if (this.verbose) console.log(`频道: ${channel.id} 已被建立.`);
        break;
      case ChannelEventName.CHANNEL_EMPTY:
        channelService.removeChannel(channel.id);
        if (this.verbose) console.log(`频道: ${channel.id} 已被移除.`);
        break;
      case ChannelEventName.TARGET_ADD:
        if (this.verbose) {
          console.log(`${channel.id} - 调试目标已新增,  当前数量为 ${channel.targets.length}`);
          console.log('调试目标信息:');
          console.log(channel.targets.slice(-1)[0]?.info);
        }
        break;
      case ChannelEventName.TARGET_REMOVE:
        if (this.verbose) {
          console.log(`${channel.id} - 调试目标已移除, 当前数量为 ${channel.targets.length}`);
        }
        break;
      case ChannelEventName.DEVTOOL_ADD:
        if (this.verbose) {
          console.log(`${channel.id} - 开发端已新增,  当前数量为 ${channel.devtools.length}`);
          console.log('开发端信息:');
          console.log(channel.targets.slice(-1)[0]?.info);
        }
        break;
      case ChannelEventName.DEVTOOL_REMOVE:
        if (this.verbose) console.log(`${channel.id} - 开发端已移除,  当前数量为 ${channel.devtools.length}`);
        break;
    }
  }
}