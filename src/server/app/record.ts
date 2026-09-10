import { mkdirSync, existsSync, createWriteStream, WriteStream } from 'fs';
import { promises as fsp } from 'fs';
import { join, resolve } from 'path';

export interface RecordConfig {
  enabled: boolean;
  dir: string;
  auto: boolean;     // target 断开时自动关闭流（确保写完）
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
  file: string;
  count: number;
  bytes: number;
}

interface BufferEntry {
  startTs: number;
  filePath?: string;
  stream?: WriteStream | null;
  totalCount: number;
  totalBytes: number;
  recent: RecordEvent[];  // 内存 ring，保留最近 N 条供 getBuffer 轻量查询（完整数据在文件）
}

const META_OVERHEAD = 100;
const RECENT_SIZE = 100; // getBuffer 返回最近 N 条，完整数据读 dump 文件

class RecordBuffer {
  private config: RecordConfig | null = null;
  private buffers = new Map<string, BufferEntry>();
  private seq = 0;

  init(config?: RecordConfig): void {
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
      entry = { startTs: Date.now(), stream: null, totalCount: 0, totalBytes: 0, recent: [] };
      this.buffers.set(targetId, entry);
    }
    return entry;
  }

  /**
   * Channel 转发时调用，异步写流（不阻塞消息转发路径）
   */
  append(targetId: string, dir: 'up' | 'down', raw: string): void {
    if (!this.config) return;
    const entry = this.getOrCreate(targetId);
    const event: RecordEvent = { seq: ++this.seq, ts: Date.now(), dir, targetId, raw };
    this.ensureStream(entry, targetId);
    // 异步写流，write 立即返回，由 WriteStream 内部缓冲 + 背压处理
    if (entry.stream) {
      entry.stream.write(JSON.stringify(event) + '\n');
    }
    entry.totalCount++;
    entry.totalBytes += raw.length + META_OVERHEAD;
    // 内存 ring，供 getBuffer 轻量查询
    entry.recent.push(event);
    if (entry.recent.length > RECENT_SIZE) {
      entry.recent.shift();
    }
  }

  /**
   * 确保 target 有可写的流（懒创建 + 断后续建）
   */
  private ensureStream(entry: BufferEntry, targetId: string): void {
    if (entry.stream && !entry.stream.destroyed) return;
    const dir = resolve(this.config!.dir);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const isFirst = !entry.filePath;
    if (isFirst) {
      entry.filePath = join(dir, `${targetId}_${entry.startTs}.jsonl`);
    }
    entry.stream = createWriteStream(entry.filePath!, { flags: 'a' });
    entry.stream.on('error', () => {
      // 写盘失败（如磁盘满）仅吞掉，不影响主流程；下次 append 会重建流
    });
    if (isFirst) {
      // 新文件产生，异步清理超额旧文件（不阻塞 append）
      this.pruneOldFiles();
    }
  }

  /**
   * 拉取最近写入的事件（内存 ring，最多 RECENT_SIZE 条）
   * 完整数据需读 dump 返回的文件
   */
  getBuffer(targetId: string, since?: number, limit?: number): RecordEvent[] {
    const entry = this.buffers.get(targetId);
    if (!entry) return [];
    let events: RecordEvent[] = entry.recent;
    if (since !== undefined && !Number.isNaN(since)) {
      events = events.filter(e => e.seq > since);
    }
    if (limit !== undefined && !Number.isNaN(limit) && limit > 0) {
      events = events.slice(0, limit);
    }
    return events;
  }

  /**
   * 等待流写完并返回累计文件信息
   */
  async dump(targetId: string): Promise<DumpResult> {
    if (!this.config) {
      return { file: '', count: 0, bytes: 0 };
    }
    const entry = this.buffers.get(targetId);
    if (!entry) {
      return { file: '', count: 0, bytes: 0 };
    }
    await this.closeStream(entry);
    return {
      file: entry.filePath || '',
      count: entry.totalCount,
      bytes: entry.totalBytes,
    };
  }

  private closeStream(entry: BufferEntry): Promise<void> {
    if (!entry.stream || entry.stream.destroyed) {
      entry.stream = null;
      return Promise.resolve();
    }
    const s = entry.stream;
    return new Promise<void>((resolve) => {
      s.once('finish', () => resolve());
      s.once('error', () => resolve());
      s.end();
    }).then(() => { entry.stream = null; });
  }

  /**
   * target 断开时调用，确保流写完关闭（不 await，不阻塞 channel 清理）
   */
  autoDumpOnClose(targetId: string): void {
    if (!this.config || !this.config.auto) return;
    const entry = this.buffers.get(targetId);
    if (entry) {
      this.closeStream(entry);
    }
  }

  clear(targetId: string): void {
    const entry = this.buffers.get(targetId);
    if (entry) {
      this.closeStream(entry);
    }
    this.buffers.delete(targetId);
  }

  listTargets(): string[] {
    return Array.from(this.buffers.keys());
  }

  /**
   * 异步清理超额旧文件：按 mtime 排序，保留最近 maxFiles 个
   */
  private async pruneOldFiles(): Promise<void> {
    if (!this.config) return;
    const dir = resolve(this.config.dir);
    try {
      const names = await fsp.readdir(dir);
      const jsonlNames = names.filter(n => n.endsWith('.jsonl'));
      if (jsonlNames.length <= this.config.maxFiles) return;
      const statted = await Promise.all(
        jsonlNames.map(async n => {
          const p = join(dir, n);
          const st = await fsp.stat(p);
          return { file: p, mtime: st.mtimeMs };
        })
      );
      statted.sort((a, b) => a.mtime - b.mtime);
      const excess = statted.length - this.config.maxFiles;
      await Promise.all(
        statted.slice(0, excess).map(item => fsp.unlink(item.file).catch(() => {}))
      );
    } catch {
      // 扫盘失败仅吞掉，不影响录制主流程
    }
  }

  destroy(): void {
    this.buffers.forEach(entry => { this.closeStream(entry); });
    this.buffers.clear();
    this.config = null;
  }
}

export const recordBuffer = new RecordBuffer();
