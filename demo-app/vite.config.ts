import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      "@hugo-ui/mui": path.resolve(__dirname, "src/hugo-ui-preview.tsx")
    }
  },
  server: {
    fs: {
      allow: [repoRoot]
    }
  },
  build: {
    outDir: path.resolve(repoRoot, "dist/demo-app"),
    emptyOutDir: true
  }
});
