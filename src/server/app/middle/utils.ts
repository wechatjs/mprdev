import * as path from 'path';
import * as Router from 'koa-router';
import * as send from 'koa-send';

const MAX_AGE = 7200000;

/**
 *  静态页面生成
 */
export const createStatic = (router: Router, hash: string, folder: string) => {
  const sendOption = {
    root: path.resolve(__dirname, `../../..${folder}`),
    maxAge: MAX_AGE,
  };
  router.get(`${hash}/(.*)`, async ctx => {
    await send(ctx, ctx.path.slice(hash.length), sendOption);
  });
};
