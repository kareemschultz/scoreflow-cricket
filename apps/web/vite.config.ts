import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  base: "/scoreflow-cricket/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/")

          if (normalizedId.includes("/node_modules/")) {
            if (/\/node_modules\/(react|react-dom|scheduler)\//.test(normalizedId)) {
              return "react-vendor"
            }
            if (/\/node_modules\/@tanstack\//.test(normalizedId)) {
              return "router-vendor"
            }
            if (/\/node_modules\/(dexie|dexie-react-hooks|zustand)\//.test(normalizedId)) {
              return "storage-vendor"
            }
            if (/\/node_modules\/framer-motion\//.test(normalizedId)) {
              return "motion-vendor"
            }
            if (
              /\/node_modules\/lucide-react\//.test(normalizedId) ||
              /\/node_modules\/@hugeicons\//.test(normalizedId)
            ) {
              return "icon-vendor"
            }
            if (/\/node_modules\/date-fns\//.test(normalizedId)) {
              return "date-vendor"
            }
            if (/\/node_modules\/html2canvas\//.test(normalizedId)) {
              return "capture-vendor"
            }
            return "vendor"
          }

          if (normalizedId.includes("/packages/ui/")) {
            return "ui-kit"
          }
        },
      },
    },
  },
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "icons/*.png"],
      manifest: {
        name: "ScoreFlow Cricket",
        short_name: "ScoreFlow",
        description: "Mobile-first cricket live scoring & statistics app",
        theme_color: "#3b5bdb",
        background_color: "#1a1a2e",
        display: "standalone",
        orientation: "portrait",
        start_url: "/scoreflow-cricket/",
        id: "/scoreflow-cricket/",
        scope: "/scoreflow-cricket/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        screenshots: [],
        categories: ["sports", "utilities"],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "lucide-react"],
  },
})
