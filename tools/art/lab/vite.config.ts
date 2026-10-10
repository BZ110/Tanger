import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('../../../', import.meta.url));
export default defineConfig({
  root,
  base: './',
  server: {
    port: 5180,
    strictPort: true,
    open: '/tools/art/lab/',
    fs: { strict: true, allow: [root] },
  },
  build: {
    outDir: 'art/.build/lab',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./index.html', import.meta.url)),
    },
  },
});
