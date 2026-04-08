import { WebSocket, Data } from 'ws';
import { PassThrough } from 'stream';
import * as Router from 'koa-router';

/**
 * websocket不可用的环境，留一个http轮询的接入接口
 */
type ConnectionEntry = { socket: WebSocket, stream: PassThrough, expiry: number, messages: Data[] };
const connections: Record<string, ConnectionEntry> = {};
const cleanerInterval = 10000; // 清理间隔10s
let cleanerIntervalId: NodeJS.Timer = null;

const initCleaner = () => {
  if (cleanerIntervalId === null) {
    // 定期清理过期连接
    cleanerIntervalId = setInterval(() => {
      const current = Date.now();
      Object.keys(connections).forEach((id) => {
        if (connections[id].expiry < current && !connections[id].stream) {
          connections[id].socket.close();
          delete connections[id];
        }
      });
      if (!Object.keys(connections).length) {
        clearInterval(cleanerIntervalId);
        cleanerIntervalId = null;
      }
    }, cleanerInterval);
  }
};

// ─── SDK 端降级接口（SSE + POST 轮询）─────────────────────────────────────────

function listenTargetHttpSocket(router: Router) {
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
    const key = ctx.params.id;
    if (connections[key]) {
      ctx.body = connections[key].stream = new PassThrough();
      const { stream, messages } = connections[key];
      connections[key].expiry = Date.now() + cleanerInterval;
      connections[key].messages = [];
      stream.write(`data: ${JSON.stringify(messages)}\n\n`);
      stream.addListener('close', () => {
        if (connections[key]) {
          connections[key].stream = null;
          // SSE 断开说明页面已关闭，立即关闭内部 WS，触发 channel 清理
          connections[key].socket.close();
          delete connections[key];
        }
      });
    }
  });

  router.post('/target/:id', async ctx => {
    const { id } = ctx.params;
    const data = ctx.request.body as string[];
    // 初始化连接，记得干掉之前的连接
    if (data[0] === 'connect') {
      if (connections[id]) {
        connections[id].socket.terminate();
        await new Promise(resolve => {
          connections[id].socket.once('close', () => setTimeout(resolve, 1000));
        });
      }
      connections[id] = {
        socket: new WebSocket(`ws://0.0.0.0:${ctx.socket.localPort}/target/${id}`),
        stream: null,
        expiry: 0,
        messages: [],
      };
      connections[id].socket.on('message', (data) => {
        if (connections[id]) {
          connections[id].messages.push(data);
          if (connections[id].stream) { // 如果支持SSE，直接推送
            const { stream, messages } = connections[id];
            connections[id].expiry = Date.now() + cleanerInterval;
            connections[id].messages = [];
            stream.write(`data: ${JSON.stringify(messages)}\n\n`);
          }
        }
      });
      initCleaner();
      await new Promise(resolve => connections[id].socket.once('open', resolve));
    }
    // 处理消息（connect 为内部指令，不转发）
    const { socket, messages } = connections[id];
    connections[id].expiry = Date.now() + cleanerInterval * 3;
    connections[id].messages = [];
    data.filter(msg => msg !== 'connect').forEach((message) => socket.send(message));
    // 返回缓存的消息
    ctx.body = JSON.stringify(messages);
  });
}

// ─── 控制端降级接口（请求-响应模式）──────────────────────────────────────────

type PendingRequest = { resolve: (value: any) => void, timer: NodeJS.Timeout };
type DevtoolEntry = { socket: WebSocket, cmdId: number, pending: Map<number, PendingRequest> };
const devtoolConnections: Record<string, DevtoolEntry> = {};

function listenDevtoolHttpSocket(router: Router) {
  // POST /devtool/:id — 建立连接或发送 CDP 命令，等待响应后返回
  router.post('/devtool/:id', async ctx => {
    const { id } = ctx.params;
    const { method, params, timeout = 30000 } = ctx.request.body as {
      method: string, params?: Record<string, any>, timeout?: number,
    };

    // 初始化到 devtool WS 的连接
    if (!devtoolConnections[id]) {
      const socket = new WebSocket(`ws://0.0.0.0:${ctx.socket.localPort}/devtool?targetId=${id}`);
      const entry: DevtoolEntry = { socket, cmdId: 0, pending: new Map() };
      devtoolConnections[id] = entry;

      socket.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          const req = entry.pending.get(msg.id);
          if (req) {
            clearTimeout(req.timer);
            entry.pending.delete(msg.id);
            req.resolve(msg);
          }
        } catch { /* 忽略非 JSON 消息 */ }
      });

      socket.on('close', () => {
        // 连接断开时，清理所有 pending 请求
        entry.pending.forEach(({ resolve, timer }) => {
          clearTimeout(timer);
          resolve({ error: 'connection closed' });
        });
        entry.pending.clear();
        delete devtoolConnections[id];
      });

      await new Promise<void>((resolve, reject) => {
        socket.once('open', () => resolve());
        socket.once('error', (e) => reject(e));
      });
    }

    if (!method) {
      ctx.status = 400;
      ctx.body = { error: 'Missing method' };
      return;
    }

    const entry = devtoolConnections[id];
    const cmdId = ++entry.cmdId;

    try {
      const result = await new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => {
          entry.pending.delete(cmdId);
          reject(new Error('timeout'));
        }, timeout);
        entry.pending.set(cmdId, { resolve, timer });
        entry.socket.send(JSON.stringify({ id: cmdId, method, params: params || {} }));
      });
      ctx.body = { success: true, ...result };
    } catch (err) {
      ctx.status = 504;
      ctx.body = { success: false, error: err.message };
    }
  });
}

export function listenHttpSocket(router: Router) {
  listenTargetHttpSocket(router);
  listenDevtoolHttpSocket(router);
}