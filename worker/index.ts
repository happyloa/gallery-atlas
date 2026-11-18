import { createEdgeHandler, type EdgeApp } from "./edge-cache";

export default createEdgeHandler({
  // Imported on demand, so a cache hit never pays to load the whole site.
  loadApp: async () =>
    (await import("vinext/server/fetch-handler")).default as EdgeApp,
  store: () => (caches as unknown as { default: Cache }).default,
  version: process.env.EDGE_CACHE_VERSION,
});
