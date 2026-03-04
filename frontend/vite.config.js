import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [
    react(),
    cesium(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks: {
          cesium: ['cesium'],
          resium: ['resium'],
          react:  ['react', 'react-dom'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['cesium', 'resium', 'react', 'react-dom', 'socket.io-client'],
  },
});
