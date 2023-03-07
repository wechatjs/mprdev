import { Context } from 'koa';
import * as Router from 'koa-router';
import { createStatic } from './utils';
import { channelService } from '../websocket/channel-service';
import { listenHttpSocket } from '../websocket/httpsocket-server';
import { BASE_URL } from '../constants';

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
listenHttpSocket(router);

// 开发者调试工具页面
createStatic(router, `${BASE_URL}/front_end`, '/server/public/devtools-frontend');
// panel
createStatic(router, `${BASE_URL}/panel`, '/server/public/devtools-panel');
// test
createStatic(router, `${BASE_URL}/test`, '/server/public/test-page');
// dist
createStatic(router, `${BASE_URL}/sdk`, '/sdk');
