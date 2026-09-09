import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import { router, interceptor } from './middle';
import { ServeOptions } from './websocket/interface';
import WebSocketServer from './websocket/websocket-server';
import { recordBuffer } from './record';

const PORT = 8090;
const app = new Koa();

export function start(options: ServeOptions) {
  const { port = PORT, host = '0.0.0.0', verbose = false, record } = options;
  // 初始化录制缓冲（未配置则禁用，append 为 no-op）
  recordBuffer.init(record);
  const server = app
    .use(interceptor)
    .use(bodyParser({ jsonLimit: '50mb' }))
    .use(router.routes())
    .listen(port, host);
  const wss = new WebSocketServer(verbose);
  wss.init(server);
}

export default start;
