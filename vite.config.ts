/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    legacy(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sensores App',
        short_name: 'Sensores',
        description: 'Aplicativo de sensores',
        theme_color: '#3880ff',
        icons: [
          {
            "src": "assets/icon/icon-72x72.png",
            "sizes": "72x72",
            "type": "image/png"
          },
          {
            "src": "assets/icon/icon-96x96.png",
            "sizes": "96x96",
            "type": "image/png"
          },
          {
            "src": "assets/icon/icon-144x144.png",
            "sizes": "144x144",
            "type": "image/png"
          },
          {
            "src": "assets/icon/icon-192x192.png",
            "sizes": "192x192",
            "type": "image/png"
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
})
