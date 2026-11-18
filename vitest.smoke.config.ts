import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Live checks against api.artic.edu. Needs network; not part of `npm test` or CI's main gate.
 * Standalone rather than merged with vitest.config.ts: mergeConfig concatenates arrays, so the
 * base config's exclusion of tests/smoke would carry over.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/smoke/**/*.test.ts"],
    testTimeout: 30_000,
    // One file at a time: together they exceed the API's 60 requests a minute.
    fileParallelism: false,
  },
});
