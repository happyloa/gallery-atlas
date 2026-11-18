import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Unit and integration tests. Deterministic: upstream calls are mocked. Tests that reach
 * the real museum API live in tests/smoke and run only via `npm run test:smoke`.
 */
export default defineConfig({
  // tsconfig keeps JSX as-is for vinext; tests need it compiled.
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/smoke/**", "node_modules/**"],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
