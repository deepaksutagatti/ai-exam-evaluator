import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const port = Number(process.env.PORT || process.env.FRONTEND_PORT || 5173);
const basePath = process.env.BASE_PATH || '/ai-examiner-walkthrough/';

export default defineConfig({
  base: basePath,
  plugins: [react()],
  root: path.resolve(import.meta.dirname),
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: { outDir: path.resolve(import.meta.dirname, 'dist/public'), emptyOutDir: true },
  server: { port, host: '0.0.0.0', strictPort: true, allowedHosts: true },
  preview: { port, host: '0.0.0.0', allowedHosts: true },
});