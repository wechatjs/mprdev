#!/usr/bin/env node

const program = require('commander');
const serve = require('../dist/server/app').default;
const version = require('../package.json').version;

program.version(version);

program
  .option('-p, --port <port>', 'port to serve')
  .option('-h, --host <host>', 'host to serve')
  .option('-v, --verbose', 'verbose mode')
  .option('--record', 'enable recording ring buffer (auto dump on disconnect)')
  .option('--record-dir <path>', 'recording output dir', './recordings')
  .option('--record-flush-mb <mb>', 'flush threshold in MB (append to file & clear memory)', '10')
  .option('--record-max-files <n>', 'max recording files to keep (oldest pruned)', '100');

const args = process.argv;

program.parse(args);

const { port, host, verbose, record, recordDir, recordFlushMb, recordMaxFiles } = program.opts();

// --record 开启即默认：target 断开自动 flush + 完整保留日志（内存达 flushMb 阈值就 append 清空，不丢数据）
// maxFiles 兜底：落盘文件数超限删最旧，防磁盘打爆
serve({
  port, host, verbose,
  record: record ? {
    enabled: true,
    dir: recordDir,
    flushMb: parseInt(recordFlushMb, 10),
    auto: true,
    maxFiles: parseInt(recordMaxFiles, 100),
  } : undefined,
});

console.info(`Version: ${version}`);
console.info(`DevTools: http://${host}:${port}/remote_dev`);
console.info(`TestPage: http://${host}:${port}/remote_dev/test/index.html`);
console.info(`Server is running on ${host}:${port}`);
