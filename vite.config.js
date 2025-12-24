import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { viteCommonjs } from "@originjs/vite-plugin-commonjs";

export default defineConfig({
    plugins: [
        viteCommonjs(),
        react(),
        nodePolyfills({
            include: ["buffer", "crypto", "stream", "util", "process"],
            globals: {
                Buffer: true,
                process: true,
            },
        }),
    ],
    build: {
        outDir: "dist",
        sourcemap: false,
        chunkSizeWarningLimit: 1500, // md-editor alone is 1.3MB
        rollupOptions: {
            output: {
                manualChunks: {
                    // React core
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    // Web3 core
                    'web3-core': ['viem', 'wagmi', '@tanstack/react-query'],
                    // RainbowKit (includes connectors)
                    'rainbowkit': ['@rainbow-me/rainbowkit'],
                    // Markdown editor (large)
                    'md-editor': ['@uiw/react-md-editor'],
                    // UI libraries
                    'ui-vendor': ['react-loading-skeleton', 'recoil'],
                },
            },
        },
    },
    publicDir: "public",
    server: {
        port: 8000,
        proxy: {
            "/api": "http://localhost:3000",
            "/socket.io": {
                target: "http://localhost:3000",
                ws: true,
            },
        },
    },
    optimizeDeps: {
        exclude: [
            '@safe-global/safe-apps-sdk',
            '@safe-global/safe-apps-provider',
        ],
    },
});
