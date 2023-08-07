import { WebSocket, Data } from 'ws';
import { PassThrough } from 'stream';
import * as Router from 'koa-router';

/**
 * websocket不可用的环境，留一个http轮询的接入接口
 */
const connections: Record<string, { socket: WebSocket, stream: PassThrough, alive: number, messages: Data[] }> = {};
let cleanerIntervalId: NodeJS.Timer = null;

const initCleaner = () => {
  if (cleanerIntervalId === null) {
    // 定期清理过期连接
    cleanerIntervalId = setInterval(() => {
      const keepAlive = Date.now() - 5000;
      Object.keys(connections).forEach((id) => {
        if (connections[id].alive < keepAlive && !connections[id].stream) {
          // 清理长轮询的连接
          connections[id].socket.close();
          delete connections[id];
        }
      });
      if (!Object.keys(connections).length) {
        clearInterval(cleanerIntervalId);
        cleanerIntervalId = null;
      }
    }, 30000);
  }
};

export function listenHttpSocket(router: Router) {
  router.get('/target/:id', async ctx => {
    // 使用SSE来推送服务端数据
    ctx.request.socket.setTimeout(0);
    ctx.req.socket.setNoDelay(true);
    ctx.req.socket.setKeepAlive(true);
    ctx.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    const id = ctx.params.id;
    if (connections[id]) {
      ctx.body = connections[id].stream = new PassThrough();
      connections[id].stream.write('data: connected\n\n');
      connections[id].stream.addListener('close', () => {
        // 清理SSE的连接
        connections[id].socket.close();
        delete connections[id];
      });
    }
  });
  router.post('/target/:id', async ctx => {
    const id = ctx.params.id;
    const data = ctx.request.body as string[];
    // 初始化连接，记得干掉之前的连接
    if (data[0] === 'connect') {
      if (connections[id]) {
        connections[id].socket.terminate();
        await new Promise(resolve => {
          // 延迟一下，防止收到上个页面的调试消息
          connections[id].socket.onclose = () => setTimeout(resolve, 1000);
        });
      }
      connections[id] = {
        socket: new WebSocket(`ws://0.0.0.0:${ctx.socket.localPort}${ctx.url}`),
        stream: null,
        alive: Date.now(),
        messages: [],
      };
      connections[id].socket.onmessage = ({ data }) => {
        connections[id].messages.push(data);
        if (connections[id].stream) { // 如果支持SSE，直接推送
          const { stream, messages } = connections[id];
          connections[id].messages = [];
          stream.write(`data: ${JSON.stringify(messages)}\n\n`);
        }
      };
      initCleaner();
      await new Promise(resolve => connections[id].socket.onopen = resolve);
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