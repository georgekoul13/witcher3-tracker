import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // relative paths so the build works on any static host, subfolder or not
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "maps/*.svg"],
      manifest: {
        name: "Witcher 3 — 100% Tracker",
        short_name: "W3 Tracker",
        description: "Quest order, collectibles and completion tracking for The Witcher 3.",
        theme_color: "#131313",
        background_color: "#131313",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // the whole app is static and small enough to cache outright
        globPatterns: ["**/*.{js,css,html,svg,png,json}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // Manrope is loaded from Google Fonts; without these the installed
            // app falls back to a system face as soon as it is offline
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "w3-font-css" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "w3-font-files",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // map tiles are someone else's server: cache what we view so the
            // app works offline and we stop re-requesting the same tiles
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/psychodracon\/witcher3map.*\.jpg$/,
            handler: "CacheFirst",
            options: {
              cacheName: "w3-map-tiles",
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 60 },
              // the tiles carry no CORS header, so responses are opaque (status 0)
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, host: true },
});
