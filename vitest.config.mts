import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: { include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"], exclude: ["tests/**/*.integration.test.ts", "node_modules/**"], environment: "node" },
});
