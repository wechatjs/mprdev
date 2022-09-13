import { Context, Next } from 'koa';

export const interceptor = async (ctx: Context, next: Next) => {
  try {
    await next();
    const status = ctx.status || 404;
    if (status === 404) ctx.throw(404);
  } catch (err) {
    ctx.status = err.status || 500;
    if (ctx.status === 404) {
      //Your 404.jade
      ctx.body = '<p>Remote-DevTools: Page Not Found 404</p>';
    } else {
      //other_error jade
      ctx.body = `<p>Internal server error!</p><br/><p>${err}</p>`;
    }
  }
};
