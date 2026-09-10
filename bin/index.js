#!/usr/bin/env node

const program = require('commander');
const serve = require('../dist/server/app').default;
const version = require('../package.json').version;

program.version(version);

program
  .option('-p, --port <port>', 'port to serve')
  .option('-h, --host <host>', 'host to serve')
  .option('-v, --verbose', 'verbose mode')
  .option('--record', 'enable recording (auto dump on disconnect, console+network only)')
  .option('--record-dir <path>', 'recording output dir', './recordings')
  .option('--record-max-files <n>', 'max recording files to keep (oldest pruned)', '100');

const args = process.argv;

program.parse(args);

const { port, host, verbose, record, recordDir, recordMaxFiles } = program.opts();

// --record 开启即默认：target 断开自动 flush + 异步流式写盘（不阻塞消息转发）
// 只录 Runtime(console)+Network(请求)，不录 DOM/Page（避免 MutationObserver 导致页面卡顿）
// maxFiles 兜底：落盘文件数超限删最旧，防磁盘打爆
serve({
  port, host, verbose,
  record: record ? {
    enabled: true,
    dir: recordDir,
    auto: true,
    maxFiles: parseInt(recordMaxFiles, 10),
  } : undefined,
});

console.info(`Version: ${version}`);
console.info(`DevTools: http://${host}:${port}/remote_dev`);
console.info(`TestPage: http://${host}:${port}/remote_dev/test/index.html`);
console.info(`Server is running on ${host}:${port}`);
