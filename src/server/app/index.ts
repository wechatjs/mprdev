import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import { router, interceptor } from './middle';
import { ServeOptions } from './websocket/interface';
import WebSocketServer from './websocket/websocket-server';

const PORT = 8090;
const app = new Koa();

export function start(options: ServeOptions) {
  const { port = PORT, host = '0.0.0.0', verbose = false } = options;
  const server = app.use(interceptor).use(bodyParser()).use(router.routes()).listen(port, host);
  const wss = new WebSocketServer(verbose);
  wss.init(server);
}

export default start;
