import { defineConfig } from 'vite';

// Relative base => the built site works whether served from a domain root
// (Cloudflare Pages) or a sub-path, with zero config changes.
export default defineConfig({
  base: './',
  server: { port: 2912, host: true },
  build: { target: 'es2020', outDir: 'dist', sourcemap: true },
});
