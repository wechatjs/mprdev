
import { channelService } from './channel-service';
import { ChannelEventName } from './enum';
import { WebSocket, Data } from 'ws';
import { Channel } from './channel';
import * as Router from 'koa-router';

/**
 * websocket不可用的环境，留一个http轮询的接入接口
 */
const connections: Record<string, { socket: WebSocket, alive: number, messages: Data[] }> = {};
let cleanerIntervalId: NodeJS.Timer = null;

const initCleaner = () => {
  if (cleanerIntervalId === null) {
    // 定期清理过期连接
    cleanerIntervalId = setInterval(() => {
      const keepAlive = Date.now() - 5000;
      Object.keys(connections).forEach((id) => {
        if (connections[id].alive < keepAlive) {
          connections[id].socket.close();
          delete connections[id];
        }
      });
      if (!Object.keys(connections).length) {
        clearInterval(cleanerIntervalId);
        cleanerIntervalId = null;
      }
    }, 5000);
  }
};

export function listenHttpSocket(router: Router) {
  router.post('/target/:id', async ctx => {
    const id = ctx.params.id;
    const data = ctx.request.body as string[];
    // 初始化连接，记得干掉之前的连接
    if (data[0] === 'connect') {
      if (connections[id]) {
        connections[id].socket.terminate();
        await new Promise(resolve => {
          const callback = (eventName: ChannelEventName, channel: Channel) => {
            if (eventName === ChannelEventName.TARGET_REMOVE && channel.id === id) {
              channelService.unsubscribeChannelChange(callback);
              resolve(null);
            }
          };
          channelService.subscribeChannelChange(callback);
        });
      }
      connections[id] = {
        socket: new WebSocket(`ws://0.0.0.0:${ctx.socket.localPort}${ctx.url}`),
        alive: Date.now(),
        messages: [],
      };
      connections[id].socket.onmessage = ({ data }) => connections[id].messages.push(data);
      initCleaner();
      await new Promise(resolve => {
        connections[id].socket.onopen = () => {
          setTimeout(() => {
            console.log('open');
            resolve(null);
          });
        };
      });
    }
    // 处理消息
    const { socket, messages } = connections[id];
    connections[id].alive = Date.now();
    connections[id].messages = [];
    data.forEach((message) => socket.send(message));
    // 返回缓存的消息
    ctx.body = JSON.stringify(messages);
  });
}
