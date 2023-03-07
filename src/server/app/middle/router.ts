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
    cleanerIntervalId = setInterval(() => {
      const keepAlive = Date.now() - 5000;
      Object.keys(connections).forEach((url) => {
        if (connections[url].alive < keepAlive) {
          connections[url].socket.close();
          delete connections[url];
        }
      });
      if (!Object.keys(connections).length) {
        clearInterval(cleanerIntervalId);
        cleanerIntervalId = null;
      }
    }, 5000);
  }
};
router.post('/target/:info', async ctx => {
  if (!connections[ctx.url]) {
    connections[ctx.url] = {
      socket: new WebSocket(`ws://0.0.0.0:${ctx.socket.localPort}${ctx.url}`),
      alive: Date.now(),
      messages: [],
    };
    connections[ctx.url].socket.onmessage = ({ data }) => {
      connections[ctx.url].messages.push(data);
    };
    initCleaner();
  }
  const { socket, messages } = connections[ctx.url];
  connections[ctx.url].messages = [];
  connections[ctx.url].alive = Date.now();
  (ctx.request.body as string[]).forEach((message) => {
    socket.send(message);
  });
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
