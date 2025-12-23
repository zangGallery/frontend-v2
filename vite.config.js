import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
    plugins: [
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
    },
    publicDir: "public",
    server: {
        port: 8000,
    },
    optimizeDeps: {
        exclude: [
            '@base-org/account',
            '@gemini-wallet/core',
            '@metamask/sdk',
            '@safe-global/safe-apps-sdk',
            '@safe-global/safe-apps-provider',
        ],
    },
});
