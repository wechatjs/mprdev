import { nodeResolve } from '@rollup/plugin-node-resolve';
import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import path from 'path';

export default {
  input: 'src/sdk/index.js',
  output: {
    file: 'dist/sdk/index.js',
    name: 'RemoteDevSdk',
    exports: 'named',
    format: 'umd',
  },
  plugins: [
    nodeResolve(),
    commonjs(),
    babel({
      babelHelpers: 'runtime',
      configFile: path.resolve(__dirname, './.babelrc'),
    }),
    json(),
  ],
}