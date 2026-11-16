import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {VitePWA} from "vite-plugin-pwa";
import {resolve} from "path";

export default defineConfig({
    base: "./",
    resolve: {
        // The aliased glass-surface sources live outside this project and would otherwise
        // resolve `react` from their own node_modules (a second React copy). Two Reacts means
        // the renderer sets hooks on one instance while the component reads from another,
        // producing "Cannot read properties of null (reading 'useId')".
        dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
        alias: {
            // Local (junctioned) glass-surface packages — source entry points.
            "@imsvidskiy/glass-surface-react": resolve(import.meta.dirname, "src/lib/glass-surface-react/index.ts"),
            "@imsvidskiy/glass-surface": resolve(import.meta.dirname, "src/lib/glass-surface-core/index.ts"),
        },
    },
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
            manifest: {
                id: "/",
                name: "Food Frenzy",
                short_name: "Food Frenzy",
                description: "A 3D multiplayer food fight game",
                theme_color: "#0a0a0f",
                background_color: "#0a0a0f",
                display: "standalone",
                orientation: "landscape",
                start_url: "/",
                scope: "/",
                categories: ["games", "entertainment"],
                // Manifest icon srcs resolve relative to the manifest URL, so keep them
                // relative: absolute "/icons/..." 404s when the game is served from a subdirectory.
                icons: [
                    {
                        src: "./icons/icon-192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "./icons/icon-512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any",
                    },
                    {
                        src: "./icons/icon-maskable-512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
            },
            workbox: {
                maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
                globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2,glb,gltf}"],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "google-fonts-cache",
                            expiration: {maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365},
                        },
                    },
                    {
                        urlPattern: /\.(glb|gltf|hdr|bin)$/,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "3d-assets-cache",
                            expiration: {maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30},
                        },
                    },
                ],
            },
        }),
    ],
    server: {
        host: true,
        open: true,
        // Allow serving the junctioned glass-surface sources that live outside the project root.
        fs: {allow: [resolve(import.meta.dirname, "..")]},
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
        sourcemap: true,
        chunkSizeWarningLimit: 2500,
    },
});
