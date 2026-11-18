/**
 * Answers repeat requests from Cloudflare's edge cache. The site's pages depend only on their
 * URL, and rendering one costs far more CPU than the Workers free plan allows per request.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { isLocale } from "@/lib/i18n/config";
import { onUpstreamFailure } from "@/lib/render-health";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Files the app generates. Every other path that ends in an extension is a static file. */
const SITE_FILES = new Set(["icon.svg", "robots.txt", "sitemap.xml"]);

/** Sections whose content changes only when the museum edits a record. */
const SETTLED = new Set([
  "about",
  "artists",
  "artworks",
  "browse",
  "map",
  "media",
  "read",
  "tours",
]);

const NOT_FOUND_TTL = 10 * MINUTE;

const EXPLORE_PARAMS = [
  "q",
  "type",
  "era",
  "color",
  "style",
  "subject",
  "theme",
  "place",
  "sort",
  "page",
];

/** The query parameters each section reads. Anything else cannot change the page. */
const SECTION_PARAMS: Record<string, readonly string[]> = {
  "": EXPLORE_PARAMS,
  api: [...EXPLORE_PARAMS, "ids"],
  artists: EXPLORE_PARAMS,
  browse: ["q", "page"],
  collection: ["title", "ids"],
  events: ["page", "program"],
  exhibitions: EXPLORE_PARAMS,
  galleries: EXPLORE_PARAMS,
  media: ["q", "page", "kind"],
  read: ["q", "page"],
  search: ["q", "page", "tab"],
  shop: ["page"],
};

/** vinext's cache-busting parameter on client navigations; it selects nothing by itself. */
const RSC_PARAM = "_rsc";

/**
 * What the client router sends about the page it is leaving. A plain navigation gets the same
 * full payload whatever these say, so they are dropped before the request reaches the app;
 * otherwise every pair of pages would be rendered and cached separately.
 */
const SOURCE_PAGE_HEADERS = [
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "next-router-state-tree",
  "next-url",
  "x-vinext-mounted-layouts",
  "x-vinext-rsc-state-fingerprint",
];

/** Headers that ask for a payload shaped by the page the visitor is on. */
const CONTEXT_HEADERS = [
  "x-vinext-interception-context",
  "x-vinext-interception-id",
  "x-vinext-mounted-slots",
];

const RENDER_MODE_HEADER = "x-vinext-rsc-render-mode";
const SHELL_MODES = new Set([
  "prefetch-empty",
  "prefetch-dynamic-shell",
  "prefetch-loading-shell",
]);

const SAFE_VARY = new Set([
  "accept-encoding",
  "rsc",
  RENDER_MODE_HEADER,
  ...SOURCE_PAGE_HEADERS,
  ...CONTEXT_HEADERS,
]);

const STATUS_HEADER = "X-Edge-Cache";
const SAVED_CACHE_CONTROL = "X-Edge-Saved-Cache-Control";
const SAVED_VARY = "X-Edge-Saved-Vary";

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
};

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
      return SETTLED.has(second) ? DAY : HOUR;
  }
}

/** A request for a file in public/ or the build output, never for a page. */
export function isStaticFilePath(pathname: string): boolean {
  const [, first = ""] = pathname.split("/");
  if (isLocale(first) || first === "api" || SITE_FILES.has(first)) return false;
  return /\.[a-z0-9]+$/i.test(pathname);
}

/**
 * The query reduced to what the page reads: known parameters only, the first value of each,
 * in a fixed order. `dropped` says the address carried something else, such as the tracking
 * parameters ad and social platforms append.
 */
export function canonicalSearch(url: URL): {
  search: string;
  dropped: boolean;
} {
  const [, first = "", second = ""] = url.pathname.split("/");
  const allowed = SECTION_PARAMS[first === "api" ? "api" : second] ?? [];
  const kept = new Map<string, string>();
  let dropped = false;
  for (const [name, value] of url.searchParams) {
    if (name === RSC_PARAM) continue;
    if (value === "" || kept.has(name) || !allowed.includes(name))
      dropped = true;
    else kept.set(name, value);
  }
  const sorted = [...kept].sort(([a], [b]) => (a < b ? -1 : 1));
  return { search: new URLSearchParams(sorted).toString(), dropped };
}

async function digest(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash.subarray(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

interface Plan {
  /** Keeps responses of different kinds for one address apart in the cache. */
  slot: string;
  /** What the app is asked to render. */
  forward: Request;
}

/** Decides how a request for a page is rendered and which cached response answers it. */
async function plan(request: Request, url: URL, search: string): Promise<Plan> {
  if (request.headers.get("rsc") !== "1") {
    return { slot: "page", forward: request };
  }

  const target = new URL(url);
  const busting = url.searchParams.get(RSC_PARAM);
  const withBusting = (value: string | null) => {
    const pair =
      value === null
        ? ""
        : value === ""
          ? RSC_PARAM
          : `${RSC_PARAM}=${encodeURIComponent(value)}`;
    target.search = [search, pair].filter(Boolean).join("&");
    return target;
  };

  const { headers } = request;
  const mode = headers.get(RENDER_MODE_HEADER);
  const contextual =
    CONTEXT_HEADERS.some((name) => headers.has(name)) ||
    (mode !== null && !SHELL_MODES.has(mode)) ||
    // A prefetch the server may answer with a shell that depends on the current page.
    (mode === null &&
      headers.has("next-router-prefetch") &&
      !headers.has("next-router-segment-prefetch"));

  if (contextual) {
    const values = [
      RENDER_MODE_HEADER,
      ...SOURCE_PAGE_HEADERS,
      ...CONTEXT_HEADERS,
    ];
    const variant = JSON.stringify(values.map((name) => headers.get(name)));
    return {
      slot: `rsc-${await digest(variant)}`,
      forward: new Request(withBusting(busting), request),
    };
  }

  // A shell prefetch: the mode picks the payload, so the address and mode identify it.
  if (mode !== null) {
    return {
      slot: `rsc-${mode}`,
      forward: new Request(withBusting(busting), request),
    };
  }

  // A navigation. vinext checks the cache-busting value against the headers it still sees;
  // with none of them left the expected value is empty.
  const forward = new Request(withBusting(""), request);
  for (const name of SOURCE_PAGE_HEADERS) forward.headers.delete(name);
  return { slot: "rsc", forward };
}

function isStorable(response: Response): boolean {
  if (response.status !== 200 && response.status !== 404) return false;
  if (response.headers.has("Set-Cookie")) return false;
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
function fromStored(stored: Response, withBody: boolean): Response {
  const response = new Response(withBody ? stored.body : null, stored);
  restoreHeader(response.headers, "Cache-Control", SAVED_CACHE_CONTROL);
  restoreHeader(response.headers, "Vary", SAVED_VARY);
  response.headers.set(STATUS_HEADER, "HIT");
  return response;
}

function secured(response: Response): Response {
  // A response straight from fetch() or the cache has read-only headers.
  const copy = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS))
    if (!copy.headers.has(name)) copy.headers.set(name, value);
  return copy;
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

export interface StaticFiles {
  fetch(request: Request): Promise<Response>;
}

export interface EdgeHandlerOptions {
  app: EdgeApp;
  store: () => EdgeStore;
  /** The static files deployed with the Worker, when the platform exposes them. */
  files?: (env: unknown) => StaticFiles | undefined;
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
  app,
  store,
  files,
  version,
}: EdgeHandlerOptions) {
  async function respond(
    request: Request,
    env: unknown,
    context: WorkerContext,
  ): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD")
      return app.fetch(request, env, context);

    const url = new URL(request.url);

    // Probes for /favicon.ico, /wp-login.php and the like must not cost a page render.
    if (version !== undefined && isStaticFilePath(url.pathname)) {
      const file = await files?.(env)
        ?.fetch(request)
        .catch(() => null);
      if (file && file.status !== 404) return file;
      if (file)
        return new Response("Not found", {
          status: 404,
          headers: {
            "Cache-Control": "public, max-age=60",
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      return app.fetch(request, env, context);
    }

    const ttl = edgeTtl(url.pathname);
    if (ttl === null) return app.fetch(request, env, context);

    const { search, dropped } = canonicalSearch(url);
    if (dropped && request.headers.get("rsc") !== "1") {
      const location = search ? `${url.pathname}?${search}` : url.pathname;
      return new Response(null, {
        status: 302,
        headers: { Location: location },
      });
    }

    const { slot, forward } = await plan(request, url, search);
    if (version === undefined) return app.fetch(forward, env, context);

    const cache = store();
    const query = search ? `?${search}` : "";
    const key = `${url.origin}/__edge/${version}/${slot}${url.pathname}${query}`;
    const hit = await cache.match(key);
    if (hit) return fromStored(hit, request.method === "GET");
    if (request.method === "HEAD") return app.fetch(forward, env, context);

    const render: Render = { failed: false };
    const response = await renders.run(render, () =>
      app.fetch(forward, env, context),
    );
    if (!isStorable(response)) return response;

    const keep = response.status === 404 ? Math.min(ttl, NOT_FOUND_TTL) : ttl;
    context.waitUntil(remember(cache, key, response.clone(), keep, render));
    const served = new Response(response.body, response);
    served.headers.set(STATUS_HEADER, "MISS");
    return served;
  }

  return {
    async fetch(
      request: Request,
      env: unknown,
      context: WorkerContext,
    ): Promise<Response> {
      return secured(await respond(request, env, context));
    },
  };
}
