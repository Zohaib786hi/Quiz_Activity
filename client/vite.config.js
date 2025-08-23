import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'https://mit-oriental-phenomenon-bahamas.trycloudflare.com'
    ]
  }
});
