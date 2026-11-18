import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit and integration tests. Deterministic: upstream calls are mocked. Tests that reach
 * the real museum API live in tests/smoke and run only via `npm run test:smoke`.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/smoke/**", "node_modules/**"],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
