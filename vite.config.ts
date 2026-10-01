import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Base path: VITE_BASE env overrides; default '/david/' for build and preview, '/' for dev.
export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, '.', '');
  const base = env.VITE_BASE || (command === 'build' || isPreview ? '/david/' : '/');

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'דוד מדבר',
          short_name: 'דוד',
          description: 'משחק תרגול מילים לדוד',
          lang: 'he',
          dir: 'rtl',
          display: 'fullscreen',
          orientation: 'any',
          background_color: '#fff8ef',
          theme_color: '#f4a261',
          start_url: base,
          scope: base,
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          ],
        },
        // 'development' skips terser on the generated SW (it hangs under recent Node versions).
        mode: 'development',
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,json}'],
          navigateFallback: 'index.html',
        },
      }),
    ],
  };
});
