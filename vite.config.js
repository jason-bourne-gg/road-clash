import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base => the built site works whether served from a domain root
// (Vercel / Cloudflare) or a sub-path, with zero config changes.
export default defineConfig({
  base: './',
  server: { port: 2912, host: true },
  build: { target: 'es2020', outDir: 'dist', sourcemap: true },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',         // users get new deploys automatically
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'race.png', 'title.png'],
      manifest: {
        name: 'Road Clash',
        short_name: 'Road Clash',
        description: 'A pseudo-3D Road Rash-style combat racer — solo or online, with seasons, nitro, cops and voice chat.',
        theme_color: '#0b0714',
        background_color: '#0b0714',
        display: 'standalone',
        orientation: 'landscape',
        start_url: './',
        scope: './',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Precache the built app shell so it loads offline. Multiplayer still
        // needs the network, but solo play works fully offline once installed.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
