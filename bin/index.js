#!/usr/bin/env node

const program = require('commander');
const serve = require('../dist/server/app').default;
const version = require('../package.json').version;

program.version(version);

program
  .option('-p, --port <port>', 'port to serve')
  .option('-h, --host <host>', 'host to serve')
  .option('-v, --verbose', 'verbose mode');

const args = process.argv;

program.parse(args);

const { port, host, verbose } = program.opts();

serve({ port, host, verbose });

console.info(`Version: ${version}`);
console.info(`DevTools: http://${host}:${port}/remote_dev`);
console.info(`TestPage: http://${host}:${port}/remote_dev/test/index.html`);
console.info(`Server is running on ${host}:${port}`);
