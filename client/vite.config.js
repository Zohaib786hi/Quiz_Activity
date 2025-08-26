import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    allowedHosts: [
      'https://mit-oriental-phenomenon-bahamas.trycloudflare.com',
      'https://quiz-activity.onrender.com'
    ]
  }
});
