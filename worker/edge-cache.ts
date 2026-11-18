/**
 * Answers repeat requests from Cloudflare's edge cache. The site's pages depend only on their
 * URL, and rendering one costs far more CPU than the Workers free plan allows per request.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { isLocale } from "@/lib/i18n/config";
import { onUpstreamFailure } from "@/lib/render-health";

const MINUTE = 60;
const HOUR = 60 * MINUTE;

/** Request headers the app's responses vary on. Each combination is cached separately. */
const VARIES_ON = [
  "rsc",
  "next-router-state-tree",
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "next-url",
  "x-vinext-interception-context",
  "x-vinext-interception-id",
  "x-vinext-mounted-slots",
  "x-vinext-rsc-render-mode",
  "x-vinext-rsc-state-fingerprint",
];
const SAFE_VARY = new Set([...VARIES_ON, "accept-encoding"]);

const SITE_FILES = new Set(["icon.svg", "robots.txt", "sitemap.xml"]);

const STATUS_HEADER = "X-Edge-Cache";
const SAVED_CACHE_CONTROL = "X-Edge-Saved-Cache-Control";
const SAVED_VARY = "X-Edge-Saved-Vary";

/** Seconds a path may be served from the edge, or null when it must always be rendered. */
export function edgeTtl(pathname: string): number | null {
  const [, first = "", second = ""] = pathname.split("/");
  if (first === "api") return HOUR;
  if (SITE_FILES.has(first)) return HOUR;
  if (!isLocale(first)) return null;
  switch (second) {
    case "random":
      return null;
    // Says whether the museum is open right now.
    case "visit":
      return MINUTE;
    case "events":
      return 5 * MINUTE;
    // Carries the work of the day.
    case "":
      return 10 * MINUTE;
    default:
      return HOUR;
  }
}

async function digest(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash.subarray(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** The version keeps a new deploy from serving pages that point at removed assets. */
async function cacheKey(request: Request, version: string): Promise<string> {
  const url = new URL(request.url);
  const variant = VARIES_ON.map((name) => request.headers.get(name) ?? "")
    .join("\n")
    .trim();
  const slot = variant ? await digest(variant) : "page";
  return `${url.origin}/__edge/${version}/${slot}${url.pathname}${url.search}`;
}

function isStorable(response: Response): boolean {
  if (response.status !== 200 || response.headers.has("Set-Cookie"))
    return false;
  const vary = response.headers.get("Vary");
  if (!vary) return true;
  return vary
    .split(",")
    .every((name) => SAFE_VARY.has(name.trim().toLowerCase()));
}

function toStored(response: Response, ttl: number): Response {
  const stored = new Response(response.body, response);
  const { headers } = stored;
  headers.set(SAVED_CACHE_CONTROL, headers.get("Cache-Control") ?? "");
  headers.set(SAVED_VARY, headers.get("Vary") ?? "");
  headers.set("Cache-Control", `public, max-age=${ttl}`);
  headers.delete("Vary");
  return stored;
}

function restoreHeader(headers: Headers, name: string, saved: string): void {
  const value = headers.get(saved);
  headers.delete(saved);
  if (value) headers.set(name, value);
  else headers.delete(name);
}

/** Browsers get the headers the app sent; only the edge copy has the longer lifetime. */
function fromStored(stored: Response): Response {
  const response = new Response(stored.body, stored);
  restoreHeader(response.headers, "Cache-Control", SAVED_CACHE_CONTROL);
  restoreHeader(response.headers, "Vary", SAVED_VARY);
  response.headers.set(STATUS_HEADER, "HIT");
  return response;
}

interface Render {
  failed: boolean;
}

const renders = new AsyncLocalStorage<Render>();

onUpstreamFailure(() => {
  const render = renders.getStore();
  if (render) render.failed = true;
});

export interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface EdgeApp {
  fetch(
    request: Request,
    env: unknown,
    context: WorkerContext,
  ): Response | Promise<Response>;
}

export type EdgeStore = Pick<Cache, "match" | "put">;

export interface EdgeHandlerOptions {
  loadApp: () => Promise<EdgeApp>;
  store: () => EdgeStore;
  /** Identifies the build. Without one (the dev server) nothing is cached. */
  version: string | undefined;
}

/** Waits for the whole page, because a section can fail after the response has started. */
async function remember(
  store: EdgeStore,
  key: string,
  copy: Response,
  ttl: number,
  render: Render,
): Promise<void> {
  try {
    const body = await copy.arrayBuffer();
    if (render.failed) return;
    await store.put(key, toStored(new Response(body, copy), ttl));
  } catch {
    // The visitor already has the page; it just is not kept.
  }
}

export function createEdgeHandler({
  loadApp,
  store,
  version,
}: EdgeHandlerOptions) {
  return {
    async fetch(
      request: Request,
      env: unknown,
      context: WorkerContext,
    ): Promise<Response> {
      const ttl =
        version !== undefined && request.method === "GET"
          ? edgeTtl(new URL(request.url).pathname)
          : null;
      if (ttl === null || version === undefined) {
        const app = await loadApp();
        return app.fetch(request, env, context);
      }

      const cache = store();
      const key = await cacheKey(request, version);
      const hit = await cache.match(key);
      if (hit) return fromStored(hit);

      const app = await loadApp();
      const render: Render = { failed: false };
      const response = await renders.run(render, () =>
        app.fetch(request, env, context),
      );
      if (!isStorable(response)) return response;

      context.waitUntil(remember(cache, key, response.clone(), ttl, render));
      const served = new Response(response.body, response);
      served.headers.set(STATUS_HEADER, "MISS");
      return served;
    },
  };
}
