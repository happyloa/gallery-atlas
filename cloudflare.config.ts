import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "gallery-atlas",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-18",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      // KV namespace for vinext's data cache (see vite.config.ts), so cached museum API
      // responses are shared across Worker isolates instead of living in one isolate's memory.
      VINEXT_KV_CACHE: bindings.kv(),
      // AIC_CONTACT_EMAIL and SITE_URL are Worker secrets, set with
      // `cf workers secrets update <NAME> --worker gallery-atlas`; they are not kept in the repo.
    },
  }),
});
