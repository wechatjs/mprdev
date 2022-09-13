import { createVuePlugin } from 'vite-plugin-vue2';
import { defineConfig } from 'vite';

const BASE_URL = '/remote_dev';

export default defineConfig({
  base: `${BASE_URL}/panel/`,
  build: {
    outDir: '../../../dist/server/public/devtools-panel/',
    emptyOutDir: true,
  },
  esbuild: { target: 'es6' },
  plugins: [createVuePlugin()],
});
