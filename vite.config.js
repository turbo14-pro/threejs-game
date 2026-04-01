import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all addresses, including LAN and public addresses
    open: true, // Automatically open the app in the browser on server start
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  },
});
