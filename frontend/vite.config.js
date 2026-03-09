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
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['cesium', 'resium', 'react', 'react-dom', 'socket.io-client'],
  },
});
