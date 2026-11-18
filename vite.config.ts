import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      id: 'carteirinha-funcionarios', name: 'Carteirinha Digital — Funcionários',
      short_name: 'Funcionários', lang: 'pt-BR', start_url: '/', scope: '/',
      theme_color: '#005C6D', background_color: '#f3f6f8', display: 'standalone',
      icons: [
        { src: '/pwa-192x192-end.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512-end.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/api(?:\/|$)/],
      cleanupOutdatedCaches: true,
    },
  })],
});
