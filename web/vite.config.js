import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['Bupo_compass_icon.png'],
      manifest: {
        name: 'BupoCompass',
        short_name: 'BupoCompass',
        description: 'Game Completion Tracker',
        theme_color: '#10b981',
        background_color: '#0f0f14',
        display: 'standalone',
        icons: [
          { src: '/Bupo_compass_icon.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
  },
});
