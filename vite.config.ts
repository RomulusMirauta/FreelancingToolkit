import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

// Served from GitHub Pages at /FreelancingToolkit/.
export default defineConfig({
  base: './',
  // The app's version, for the "updated to vX" toast.
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      // Precache the bundled font too, not only JS/CSS/HTML.
      // The manifest screenshots are only for the install dialog, so they stay out of the offline cache.
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], globIgnores: ['screenshots/**'] },
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
        // Chrome's richer install dialog: "wide" ones on desktop, the others on phones (dark theme, top of each page).
        screenshots: [
          { src: 'screenshots/converter-wide.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'Convertorul de tarif: un tarif pe oră în orice perioadă și valută' },
          { src: 'screenshots/taxes-wide.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'Taxe în România 2026: CIM, PFA și SRL, unul lângă altul' },
          { src: 'screenshots/converter-narrow.png', sizes: '824x1784', type: 'image/png', form_factor: 'narrow', label: 'Convertorul de tarif pe telefon' },
          { src: 'screenshots/taxes-narrow.png', sizes: '824x1784', type: 'image/png', form_factor: 'narrow', label: 'Taxe în România 2026 pe telefon' },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
