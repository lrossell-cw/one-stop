import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The shared workspace is plain ESM outside web/, so point Vite at it
      // directly rather than relying on node_modules resolution.
      '@one-stop/shared': path.join(REPO, 'shared', 'src'),
    },
  },
  server: {
    port: 5173,
    // Same-origin API in dev, so the client needs no CORS handling and
    // VITE_API_BASE can stay empty.
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:5174',
        changeOrigin: true,
      },
    },
  },
});
