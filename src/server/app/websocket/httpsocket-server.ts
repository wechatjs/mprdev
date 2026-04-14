import * as Router from 'koa-router';

import { Data, WebSocket } from 'ws';

import { PassThrough } from 'stream';

/**
 * websocket不可用的环境，留一个http轮询的接入接口
 */
const connections: Record<string, { socket: WebSocket, stream: PassThrough, expiry: number, messages: Data[] }> = {};
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

// devtool WebSocket 缓存池
const devtoolSocketExpiry = 30000; // 空闲30s后销毁
const devtoolSockets: Record<string, {
  socket: WebSocket;
  timer: NodeJS.Timer;
  onResponse: ((msg: Data) => void) | null;
}> = {};

// 获取或创建 devtool 的缓存连接
const getDevtoolSocket = (port: number, mode: string, id: string): Promise<WebSocket> => {
  const key = `${mode}_${id}`;
  const cached = devtoolSockets[key];
  if (cached && cached.socket.readyState === WebSocket.OPEN) {
    // 刷新过期定时器
    clearTimeout(cached.timer);
    cached.timer = setTimeout(() => {
      cached.socket.close();
      delete devtoolSockets[key];
    }, devtoolSocketExpiry);
    return Promise.resolve(cached.socket);
  }
  // 清理旧连接
  if (cached) {
    clearTimeout(cached.timer);
    cached.socket.terminate();
    delete devtoolSockets[key];
  }
  // 创建新连接
  const socket = new WebSocket(`ws://0.0.0.0:${port}/devtool?mode=${mode}&targetId=${id}`);
  const entry = {
    socket,
    timer: setTimeout(() => {
      socket.close();
      delete devtoolSockets[key];
    }, devtoolSocketExpiry),
    onResponse: null as ((msg: Data) => void) | null,
  };
  devtoolSockets[key] = entry;
  socket.onmessage = ({ data: msg }) => {
    entry.onResponse?.(msg);
  };
  socket.onclose = () => {
    clearTimeout(entry.timer);
    delete devtoolSockets[key];
  };
  return new Promise<WebSocket>((resolve, reject) => {
    socket.onopen = () => resolve(socket);
    socket.onerror = (err) => reject(err);
  });
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
      const { stream, messages } = connections[id];
      connections[id].expiry = Date.now() + cleanerInterval;
      connections[id].messages = [];
      stream.write(`data: ${JSON.stringify(messages)}\n\n`);
      stream.addListener('close', () => {
        // 清空SSE流，以便定期清理
        if (connections[id]) {
          connections[id].expiry = Date.now() + cleanerInterval;
          connections[id].stream = null;
        }
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
        expiry: 0,
        messages: [],
      };
      connections[id].socket.onmessage = ({ data }) => {
        if (connections[id]) {
          connections[id].messages.push(data);
          if (connections[id].stream) { // 如果支持SSE，直接推送
            const { stream, messages } = connections[id];
            connections[id].expiry = Date.now() + cleanerInterval;
            connections[id].messages = [];
            stream.write(`data: ${JSON.stringify(messages)}\n\n`);
          }
        }
      };
      initCleaner();
      await new Promise(resolve => connections[id].socket.onopen = resolve);
    }
    // 处理消息
    const { socket, messages } = connections[id];
    connections[id].expiry = Date.now() + cleanerInterval * 3;
    connections[id].messages = [];
    data.forEach((message) => socket.send(message));
    // 返回缓存的消息
    ctx.body = JSON.stringify(messages);
  });
  // devtool HTTP接口，复用缓存的WebSocket连接
  router.post('/devtool/:id', async ctx => {
    const id = ctx.params.id;
    const data = ctx.request.body as string[];
    const mode = ctx.query.mode as string;
    const timeout = 10000; // 超时兜底10s

    // 无命令时直接返回空数组，避免不必要的连接开销
    if (!Array.isArray(data) || data.length === 0) {
      ctx.body = JSON.stringify([]);
      return;
    }

    try {
      const socket = await getDevtoolSocket(ctx.socket.localPort, mode, id);
      const key = `${mode}_${id}`;
      const messages: Data[] = [];

      // 解析出所有命令的 id，用于匹配响应
      const pendingIds = new Set<number>();
      data.forEach((message) => {
        try {
          const parsed = JSON.parse(message);
          if (parsed.id != null) pendingIds.add(parsed.id);
        } catch {}
      });

      // 发送所有CDP命令
      data.forEach((message) => socket.send(message));

      // 等待收集响应：按命令 id 匹配，事件也一并收集但不占名额
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, timeout);
        devtoolSockets[key].onResponse = (msg) => {
          messages.push(msg);
          // 检查是否是命令响应（有 id），从待匹配集合中移除
          try {
            const parsed = JSON.parse(typeof msg === 'string' ? msg : msg.toString());
            if (parsed.id != null) pendingIds.delete(parsed.id);
          } catch {}
          // 所有命令响应都收到了才 resolve
          if (pendingIds.size === 0) {
            clearTimeout(timer);
            resolve();
          }
        };
        if (pendingIds.size === 0) {
          clearTimeout(timer);
          resolve();
        }
        socket.addEventListener('close', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });

      // 清空响应回调
      if (devtoolSockets[key]) {
        devtoolSockets[key].onResponse = null;
      }

      ctx.body = JSON.stringify(messages);
    } catch {
      ctx.body = JSON.stringify([]);
    }
  });
}