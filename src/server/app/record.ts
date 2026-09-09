import { mkdirSync, appendFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';

export interface RecordConfig {
  enabled: boolean;
  dir: string;
  flushMb: number;   // 单段 flush 阈值（MB）：内存攒到此值就 append 到文件并清空，防 OOM（数据不丢）
  auto: boolean;     // target 断开时自动 flush 剩余（--record 开启即默认 true）
  maxFiles: number;  // 落盘文件数上限：超过则删最旧的，防磁盘打爆
}

export interface RecordEvent {
  seq: number;        // 全局单调递增（跨 target，保证时间轴可对齐）
  ts: number;         // server 收包时刻 Date.now()
  dir: 'up' | 'down'; // up=target→devtool, down=devtool→target
  targetId: string;
  raw: string;         // 原始 CDP 消息（JSON 字符串）
}

export interface DumpResult {
  file: string;        // 单个累计追加文件路径
  count: number;        // 累计已写入事件数
  bytes: number;        // 累计已写入字节数
}

interface BufferEntry {
  events: RecordEvent[];  // 当前内存中未 flush 的事件
  startTs: number;         // 会话开始时间（文件名后缀）
  bytes: number;            // 当前内存段字节数
  filePath?: string;        // 落盘文件路径（首次 flush 时确定）
  totalCount: number;        // 累计已写入事件数（含已 flush 的）
  totalBytes: number;        // 累计已写入字节数
}

const META_OVERHEAD = 100; // 每条事件 metadata 估算字节数

class RecordBuffer {
  private config: RecordConfig | null = null;
  private buffers = new Map<string, BufferEntry>();
  private seq = 0;

  init(config?: RecordConfig): void {
    // 未配置或未启用：保持禁用态，append 是 no-op
    this.config = config && config.enabled ? config : null;
    if (this.config) {
      const dir = resolve(this.config.dir);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  isReady(): boolean {
    return !!this.config;
  }

  private getOrCreate(targetId: string): BufferEntry {
    let entry = this.buffers.get(targetId);
    if (!entry) {
      entry = { events: [], startTs: Date.now(), bytes: 0, totalCount: 0, totalBytes: 0 };
      this.buffers.set(targetId, entry);
    }
    return entry;
  }

  /**
   * Channel 转发时调用，写入内存缓冲
   * 达 flushMb 阈值则 append 到文件并清空内存（防 OOM，数据不丢）
   */
  append(targetId: string, dir: 'up' | 'down', raw: string): void {
    if (!this.config) return;
    const entry = this.getOrCreate(targetId);
    const event: RecordEvent = {
      seq: ++this.seq,
      ts: Date.now(),
      dir,
      targetId,
      raw,
    };
    entry.events.push(event);
    entry.bytes += raw.length + META_OVERHEAD;
    const threshold = this.config.flushMb * 1024 * 1024;
    if (entry.bytes >= threshold) {
      this.flushCurrent(targetId);
    }
  }

  /**
   * 把当前内存段 append 到磁盘文件并清空内存
   * 文件名 {targetId}_{会话startTs}.jsonl，整个会话持续追加同一文件
   */
  private flushCurrent(targetId: string): void {
    if (!this.config) return;
    const entry = this.buffers.get(targetId);
    if (!entry || entry.events.length === 0) return;
    if (!entry.filePath) {
      const dir = resolve(this.config.dir);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      entry.filePath = join(dir, `${targetId}_${entry.startTs}.jsonl`);
      // 新会话产生新文件，顺带清理超额旧文件（同文件追加不触发，避免频繁扫盘）
      this.pruneOldFiles();
    }
    const lines = entry.events.map(e => JSON.stringify(e));
    const content = lines.join('\n') + (lines.length ? '\n' : '');
    appendFileSync(entry.filePath, content, { encoding: 'utf8' });
    entry.totalCount += entry.events.length;
    entry.totalBytes += content.length;
    entry.events = [];
    entry.bytes = 0;
  }

  /**
   * 清理超额旧文件：按 mtime 排序，保留最近 maxFiles 个，删最旧的
   * 仅在新文件首次创建时调用一次
   */
  private pruneOldFiles(): void {
    if (!this.config) return;
    const dir = resolve(this.config.dir);
    if (!existsSync(dir)) return;
    let files: { file: string; mtime: number }[] = [];
    try {
      files = readdirSync(dir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => {
          const p = join(dir, f);
          return { file: p, mtime: statSync(p).mtimeMs };
        })
        .sort((a, b) => a.mtime - b.mtime); // 旧的在前
    } catch {
      return;
    }
    const excess = files.length - this.config.maxFiles;
    if (excess > 0) {
      files.slice(0, excess).forEach(f => {
        try { unlinkSync(f.file); } catch { /* 忽略删除失败 */ }
      });
    }
  }

  /**
   * 拉取当前内存中未 flush 的事件（不落盘）
   * 注意：已 flush 到磁盘的部分需读 dump 返回的文件
   */
  getBuffer(targetId: string, since?: number, limit?: number): RecordEvent[] {
    const entry = this.buffers.get(targetId);
    if (!entry) return [];
    let events: RecordEvent[] = entry.events;
    if (since !== undefined && !Number.isNaN(since)) {
      events = events.filter(e => e.seq > since);
    }
    if (limit !== undefined && !Number.isNaN(limit) && limit > 0) {
      events = events.slice(0, limit);
    }
    return events;
  }

  /**
   * flush 当前内存剩余到同一文件，返回累计文件信息
   * 业务侧拿到单个自包含 jsonl 文件
   */
  async dump(targetId: string): Promise<DumpResult> {
    if (!this.config) {
      return { file: '', count: 0, bytes: 0 };
    }
    const entry = this.buffers.get(targetId);
    if (!entry) {
      return { file: '', count: 0, bytes: 0 };
    }
    this.flushCurrent(targetId);
    return {
      file: entry.filePath || '',
      count: entry.totalCount,
      bytes: entry.totalBytes,
    };
  }

  /**
   * target 断开时调用，内部按 config.auto 决定是否 flush 剩余到文件
   * channel 不直接碰 config，只调此方法
   */
  autoDumpOnClose(targetId: string): void {
    if (this.config && this.config.auto) {
      this.flushCurrent(targetId);
    }
  }

  clear(targetId: string): void {
    this.buffers.delete(targetId);
  }

  listTargets(): string[] {
    return Array.from(this.buffers.keys());
  }

  destroy(): void {
    this.buffers.clear();
    this.config = null;
  }
}

export const recordBuffer = new RecordBuffer();
