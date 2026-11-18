// Imported up front: the site's modules are then evaluated while the Worker starts, which is
// not charged to a request's CPU allowance the way an import inside the handler would be.
import app from "vinext/server/fetch-handler";
import {
  createEdgeHandler,
  type EdgeApp,
  type StaticFiles,
} from "./edge-cache";

export default createEdgeHandler({
  app: app as EdgeApp,
  store: () => (caches as unknown as { default: Cache }).default,
  files: (env) => (env as { ASSETS?: StaticFiles }).ASSETS,
  version: process.env.EDGE_CACHE_VERSION,
});
