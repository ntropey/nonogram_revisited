import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// base './' lets the app be hosted under any path (/play/ on the website, or root in Capacitor native shells)
export default defineConfig({
  plugins: [react()],
  root: __dirname,
  base: './',
  worker: {
    format: 'es',
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  server: {
    port: 5173,
    open: false,
  },
});
