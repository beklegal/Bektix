import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: ["./client", "./shared", "index.html"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
  },
  plugins:
    mode === "test"
      ? [react()]
      : [
          react(),
          ...(process.env.SKIP_SERVER_ON_DEV === "1" ? [] : [expressPlugin()]),
        ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    async configureServer(server) {
      if (process.env.SKIP_SERVER_ON_DEV === "1") {
        server.config.logger.warn(
          "[express-plugin] SKIP_SERVER_ON_DEV=1, running frontend-only dev server.",
        );
        return;
      }

      try {
        const { createServer } = await import("./server");
        const app = await createServer();
        server.middlewares.use(app);
      } catch (error) {
        server.config.logger.warn(
          "[express-plugin] backend failed to start. Running frontend-only dev server.",
        );
        server.config.logger.warn(error instanceof Error ? error.message : String(error));
      }
    },
  };
}
