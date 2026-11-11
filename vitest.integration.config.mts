import path from "node:path";
import { defineConfig } from "vitest/config";

// Live Supabase tests only. `npm test` excludes these (see vitest.config.mts).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: { include: ["tests/**/*.integration.test.ts"], environment: "node" },
});
