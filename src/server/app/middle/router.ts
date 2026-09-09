import { Context } from 'koa';
import * as Router from 'koa-router';
import { createStatic } from './utils';
import { channelService } from '../websocket/channel-service';
import { listenHttpSocket } from '../websocket/httpsocket-server';
import { BASE_URL } from '../constants';
import { recordBuffer } from '../record';

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

// === 录制数据出口 API（中立管道：只懂 seq/ts/dir/raw，不碰业务语义）===

// 列出当前有 buffer 的 targetId
router.get(`${BASE_URL}/api/record/targets`, async ctx => {
  ctx.body = JSON.stringify(recordBuffer.listTargets());
});

// 拉取 buffer（不落盘），since/limit 可选分页
router.get(`${BASE_URL}/api/record/buffer`, async ctx => {
  const { id, since, limit } = ctx.query;
  if (!id) {
    ctx.status = 400;
    ctx.body = '{"error":"missing id"}';
    return;
  }
  const events = recordBuffer.getBuffer(
    String(id),
    since !== undefined ? Number(since) : undefined,
    limit !== undefined ? Number(limit) : undefined,
  );
  ctx.body = JSON.stringify(events);
});

// dump：flush 当前内存剩余到累计文件，返回单文件路径（自包含 jsonl）
router.post(`${BASE_URL}/api/record/dump`, async ctx => {
  const { id } = ctx.query;
  if (!id) {
    ctx.status = 400;
    ctx.body = '{"error":"missing id"}';
    return;
  }
  const result = await recordBuffer.dump(String(id));
  ctx.body = JSON.stringify(result);
});

// 清空某 target 的 buffer
router.post(`${BASE_URL}/api/record/clear`, async ctx => {
  const { id } = ctx.query;
  if (!id) {
    ctx.status = 400;
    ctx.body = '{"error":"missing id"}';
    return;
  }
  recordBuffer.clear(String(id));
  ctx.body = '{"ok":true}';
});

// 开发者调试工具页面
createStatic(router, `${BASE_URL}/front_end`, '/server/public/devtools-frontend');
// panel
createStatic(router, `${BASE_URL}/panel`, '/server/public/devtools-panel');
// test
createStatic(router, `${BASE_URL}/test`, '/server/public/test-page');
// dist
createStatic(router, `${BASE_URL}/sdk`, '/sdk');
