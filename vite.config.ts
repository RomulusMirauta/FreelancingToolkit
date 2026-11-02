import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served from GitHub Pages at /FreelancingToolkit/.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      // Precache the bundled font too, not only JS/CSS/HTML.
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      manifest: {
        name: 'FreelancingToolkit',
        short_name: 'Freelancing',
        description: 'Convertor de tarif și calculator de taxe 2026 pentru freelancerii din România.',
        lang: 'ro',
        theme_color: '#1f6f5c',
        background_color: '#f7f7f4',
        display: 'standalone',
        // A fixed identity, so the installed app stays the same app even if start_url changes.
        id: './',
        start_url: './',
        scope: './',
        // PNGs for installing on Android and desktop; the maskable one fills the whole shape Android crops it to.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
