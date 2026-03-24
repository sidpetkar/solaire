import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

function lutManifestPlugin(): Plugin {
  function scanLuts(dir: string, base: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanLuts(full, base));
      } else if (entry.name.endsWith('.cube')) {
        const rel = '/' + path.relative(base, full).replace(/\\/g, '/');
        const encoded = rel.split('/').map(seg => encodeURIComponent(seg)).join('/');
        results.push(encoded);
      }
    }
    return results;
  }

  function generate(publicDir: string) {
    const lutsDir = path.join(publicDir, 'luts');
    if (!fs.existsSync(lutsDir)) {
      fs.mkdirSync(lutsDir, { recursive: true });
    }

    // If build-lut-binaries.mjs already generated a binary manifest, don't overwrite
    const outPath = path.join(lutsDir, 'manifest.json');
    const bundlePath = path.join(lutsDir, 'thumb-bundle.bin');
    if (fs.existsSync(bundlePath) && fs.existsSync(outPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
        if (Array.isArray(existing) && existing.length > 0 && typeof existing[0] === 'object') {
          return existing.length;
        }
      } catch { /* regenerate */ }
    }

    const files = scanLuts(lutsDir, publicDir);
    const manifest = JSON.stringify(files);
    fs.writeFileSync(outPath, manifest, 'utf-8');
    return files.length;
  }

  return {
    name: 'lut-manifest',
    configResolved(config) {
      const count = generate(config.publicDir);
      console.log(`[lut-manifest] Found ${count} .cube files`);
    },
    configureServer(server) {
      const publicDir = server.config.publicDir;
      server.watcher.on('add', (p: string) => {
        if (p.endsWith('.cube')) generate(publicDir);
      });
      server.watcher.on('unlink', (p: string) => {
        if (p.endsWith('.cube')) generate(publicDir);
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    lutManifestPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/**/*', 'solaire-logo.png', 'apple-touch-icon.png', 'favicon-32.png'],
      manifest: {
        name: 'Solaire',
        short_name: 'Solaire',
        description: 'LUT-based photo editor & camera',
        theme_color: '#212421',
        background_color: '#212421',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/solaire-logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /\/luts\/thumb-bundle\.bin$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lut-thumb-bundle-v2',
              expiration: { maxEntries: 2 },
            },
          },
          {
            urlPattern: /\/luts\/bin\/.*\.bin$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lut-bin-cache-v2',
              expiration: { maxEntries: 500 },
            },
          },
          {
            urlPattern: /r2\.dev\/luts\/bin\/.*\.bin$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lut-bin-cache-r2-v2',
              expiration: { maxEntries: 500 },
            },
          },
          {
            urlPattern: /r2\.dev\/luts\/thumb-bundle\.bin$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lut-thumb-bundle-r2-v2',
              expiration: { maxEntries: 2 },
            },
          },
          {
            urlPattern: /\/luts\/.*\.cube$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lut-cache-v2',
              expiration: { maxEntries: 200 },
            },
          },
          {
            urlPattern: /r2\.dev\/luts\/.*\.cube$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lut-cache-r2-v2',
              expiration: { maxEntries: 200 },
            },
          },
        ],
      },
    }),
  ],
});
