import { Context } from 'koa';
import * as Router from 'koa-router';
import { createStatic } from './utils';
import { channelService } from '../websocket/channel-service';
import { BASE_URL } from '../constants';
import { WebSocket, Data } from 'ws';

export const router = new Router();

router.get(`${BASE_URL ? BASE_URL : '/'}`, async (ctx: Context) => {
  const query = ctx.querystring ? `?${ctx.querystring}` : '';
  ctx.redirect(`${BASE_URL}/panel/index.html${query}`);
});

/**
 * 返回当前活跃的连接
 */
router.get(`${BASE_URL}/get_targets`, async ctx => {
  const isCorrect = true;
  if (isCorrect) {
    const targets = channelService.getTargets();
    ctx.body = JSON.stringify(targets);
  } else {
    ctx.response.body = 'Invalid signature';
    ctx.response.status = 401;
  }
});

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
router.post('/target/:id', async ctx => {
  const id = ctx.params.id;
  const data = ctx.request.body as string[];
  // 干掉连接
  if (data[0] === 'close') {
    if (connections[id]) {
      connections[id].socket.close();
      delete connections[id];
    }
    return;
  }
  // 如果没有连接，新建
  if (!connections[id]) {
    connections[id] = {
      socket: new WebSocket(`ws://0.0.0.0:${ctx.socket.localPort}${ctx.url}`),
      alive: Date.now(),
      messages: [],
    };
    connections[id].socket.onmessage = ({ data }) => connections[id].messages.push(data);
    initCleaner();
  }
  // 处理消息
  const { socket, messages } = connections[id];
  connections[id].messages = [];
  connections[id].alive = Date.now();
  data.forEach((message) => socket.send(message));
  // 返回缓存的消息
  ctx.body = JSON.stringify(messages);
});

// 开发者调试工具页面
createStatic(router, `${BASE_URL}/front_end`, '/server/public/devtools-frontend');
// panel
createStatic(router, `${BASE_URL}/panel`, '/server/public/devtools-panel');
// test
createStatic(router, `${BASE_URL}/test`, '/server/public/test-page');
// dist
createStatic(router, `${BASE_URL}/sdk`, '/sdk');
