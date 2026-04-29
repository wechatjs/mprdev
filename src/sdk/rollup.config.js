import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import fs from 'fs';
import gzip from 'rollup-plugin-gzip';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import path from 'path';
import terser from '@rollup/plugin-terser';

const isWatch = process.env.ROLLUP_WATCH;
const outputFile = 'dist/sdk/index.js';
let plugins = [
  nodeResolve(),
  commonjs(),
  json(),
];

if (isWatch) {
  const gzPath = path.resolve(__dirname, `../../${outputFile}.gz`);
  if (fs.existsSync(gzPath)) {
    fs.unlinkSync(gzPath);
  }
} else {
  plugins = plugins.concat([
    terser(),
    gzip(),
    babel({
      babelHelpers: 'runtime',
      configFile: path.resolve(__dirname, './.babelrc'),
    }),
  ]);
}

export default {
  input: 'src/sdk/index.js',
  output: {
    file: outputFile,
    name: 'RemoteDevSdk',
    exports: 'named',
    format: 'umd',
  },
  plugins,
}