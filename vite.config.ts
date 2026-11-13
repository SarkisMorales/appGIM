import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Lector de etiquetas (OCR, Tesseract.js): servimos el worker, el motor WebAssembly y el idioma español
 * desde la propia app (sin CDNs de terceros). Solo se descargan cuando alguien usa "Leer la etiqueta".
 */
function ocrAssets(): Plugin {
  const req = createRequire(import.meta.url);
  const core = dirname(req.resolve('tesseract.js-core/package.json'));
  const tjs = dirname(req.resolve('tesseract.js/package.json'));
  const spa = dirname(req.resolve('@tesseract.js-data/spa/package.json'));
  const files: Record<string, string> = {
    'ocr/worker.min.js': join(tjs, 'dist/worker.min.js'),
    'ocr/tesseract-core-lstm.wasm.js': join(core, 'tesseract-core-lstm.wasm.js'),
    'ocr/tesseract-core-simd-lstm.wasm.js': join(core, 'tesseract-core-simd-lstm.wasm.js'),
    'ocr/tesseract-core-relaxedsimd-lstm.wasm.js': join(core, 'tesseract-core-relaxedsimd-lstm.wasm.js'),
    'ocr/lang/spa.traineddata.gz': join(spa, '4.0.0_best_int/spa.traineddata.gz'),
  };
  return {
    name: 'ocr-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0].replace(/^\/+/, '');
        const file = files[path];
        if (!file) return next();
        res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      for (const [fileName, file] of Object.entries(files)) this.emitFile({ type: 'asset', fileName, source: readFileSync(file) });
    },
  };
}

// base relativa: funciona en GitHub Pages (https://usuario.github.io/appGIM/) y en cualquier subcarpeta.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    ocrAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'appGIM · Comida + Entrenamiento',
        short_name: 'appGIM',
        description: 'Registrá tu comida y tus entrenamientos. Todo conectado, gratis y offline.',
        lang: 'es',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0D12',
        theme_color: '#0B0D12',
        categories: ['health', 'fitness', 'food'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['ocr/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: { cacheName: 'wasm', expiration: { maxEntries: 4 } },
          },
          {
            // Lector de etiquetas: se guarda la primera vez que se usa y después funciona sin conexión.
            urlPattern: ({ url }) => url.pathname.includes('/ocr/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr', expiration: { maxEntries: 8 } },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('openfoodfacts.org') && url.pathname.includes('/images/'),
            handler: 'CacheFirst',
            options: { cacheName: 'off-images', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
