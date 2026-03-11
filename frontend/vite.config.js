import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    cesium(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'LiveWar3D',
        short_name: 'LiveWar3D',
        description: 'Real-time military aircraft, warships and conflict zones on a live interactive 3D globe.',
        theme_color: '#050810',
        background_color: '#050810',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['news', 'navigation'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // Cache Cesium assets and tiles aggressively
        runtimeCaching: [
          {
            // Tile basemaps (CartoDB, OSM, etc.)
            urlPattern: /^https:\/\/(tiles|[a-c])\.(basemaps\.cartocdn|tile\.openstreetmap|gibs\.earthdata\.nasa|tiles\.maps\.eox)\..*\.(png|jpg|jpeg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 7, maxEntries: 500 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Backend API (short-lived)
            urlPattern: /\/api\//i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxAgeSeconds: 60 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Don't precache Cesium's huge static tree — it's loaded dynamically
        globIgnores: [
          '**/cesium/**',
          '**/Cesium/**',
          '**/*.wasm',
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
      },
    }),
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
        // Split large deps into separate chunks so the browser loads them in
        // parallel and the main bundle (React app code) parses faster → lower TBT
        manualChunks(id) {
          // Cesium + Resium are ~4 MB — must be in their own chunk
          if (id.includes('node_modules/cesium') || id.includes('node_modules/resium')) return 'cesium';
          // Socket.io-client adds ~200 KB; separate from app code
          if (
            id.includes('node_modules/socket.io-client') ||
            id.includes('node_modules/engine.io-client') ||
            id.includes('node_modules/@socket.io')
          ) return 'socketio';
          // Split react-dom (large) from react (tiny) so react can be parsed first
          if (id.includes('node_modules/react-dom')) return 'react-dom';
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-is')) return 'react';
        },
      },
    },
  },
  optimizeDeps: {
    include: ['cesium', 'resium', 'react', 'react-dom', 'socket.io-client'],
  },
});
