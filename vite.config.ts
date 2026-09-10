import { defineConfig } from "vite";

export default defineConfig({ server: { hmr: process.env.OPENGTA_E2E === "1" ? false : undefined } });
