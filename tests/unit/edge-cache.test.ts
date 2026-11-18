import { describe, expect, it, vi } from "vitest";
import { aicGet } from "@/lib/artic/client";
import { reportUpstreamFailure } from "@/lib/render-health";
import {
  canonicalSearch,
  createEdgeHandler,
  edgeTtl,
  isStaticFilePath,
  type EdgeApp,
  type EdgeStore,
} from "@/worker/edge-cache";

const ORIGIN = "https://atlas.test";

function memoryStore() {
  const entries = new Map<string, Response>();
  const store: EdgeStore = {
    match: async (key) => entries.get(String(key))?.clone(),
    put: async (key, response) => {
      entries.set(String(key), response.clone());
    },
  };
  return { store, entries };
}

interface SetupOptions {
  respond?: EdgeApp["fetch"];
  version?: string | null;
  files?: (request: Request) => Promise<Response>;
}

function setup({
  respond = () =>
    new Response("page", {
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "RSC, Next-Url",
      },
    }),
  version = "build-1",
  files,
}: SetupOptions = {}) {
  const { store, entries } = memoryStore();
  const app = { fetch: vi.fn(respond) };
  const handler = createEdgeHandler({
    app,
    store: () => store,
    files: files ? () => ({ fetch: files }) : undefined,
    version: version ?? undefined,
  });
  const pending: Promise<unknown>[] = [];
  const context = { waitUntil: (work: Promise<unknown>) => pending.push(work) };
  const send = async (path: string, init?: RequestInit) => {
    const response = await handler.fetch(
      new Request(ORIGIN + path, init),
      {},
      context,
    );
    await Promise.all(pending);
    return response;
  };
  /** The request the app received on its nth call. */
  const forwarded = (call = 0) => app.fetch.mock.calls[call]?.[0] as Request;
  return { send, app, entries, forwarded };
}

/** Headers the client router sends when it navigates from `from`. */
const navigationFrom = (from: string) => ({
  RSC: "1",
  "X-Vinext-Mounted-Layouts": "385de9f89eb5ca70",
  "X-Vinext-Rsc-State-Fingerprint": `fp-${from}`,
});

const prefetchFrom = (from: string, mode?: string) => ({
  RSC: "1",
  "Next-Router-Prefetch": "1",
  "Next-Router-Segment-Prefetch": "1",
  "Next-Router-State-Tree": encodeURIComponent(
    JSON.stringify({ pathAndSearch: from, routeId: "route" }),
  ),
  "Next-Url": from,
  "X-Vinext-Rsc-State-Fingerprint": `fp-${from}`,
  ...(mode ? { "X-Vinext-Rsc-Render-Mode": mode } : {}),
});

describe("edgeTtl", () => {
  it("keeps time-sensitive pages briefly and settled ones for a day", () => {
    expect(edgeTtl("/en/visit")).toBe(60);
    expect(edgeTtl("/zh-tw/events/12")).toBe(300);
    expect(edgeTtl("/en")).toBe(600);
    expect(edgeTtl("/en/exhibitions")).toBe(3600);
    expect(edgeTtl("/en/artworks/27992")).toBe(86400);
  });

  it("never caches the random work or paths without a language", () => {
    expect(edgeTtl("/en/random")).toBeNull();
    expect(edgeTtl("/")).toBeNull();
    expect(edgeTtl("/about")).toBeNull();
  });
});

describe("isStaticFilePath", () => {
  it("spots files and leaves pages and generated files alone", () => {
    expect(isStaticFilePath("/favicon.ico")).toBe(true);
    expect(isStaticFilePath("/wp-login.php")).toBe(true);
    expect(isStaticFilePath("/tour-transcripts/2179.json")).toBe(true);
    expect(isStaticFilePath("/robots.txt")).toBe(false);
    expect(isStaticFilePath("/en/about")).toBe(false);
    expect(isStaticFilePath("/en/read/articles/a.b")).toBe(false);
    expect(isStaticFilePath("/about")).toBe(false);
  });
});

describe("canonicalSearch", () => {
  const of = (path: string) => canonicalSearch(new URL(ORIGIN + path));

  it("orders the parameters a section reads", () => {
    expect(of("/en/search?tab=artists&q=monet")).toEqual({
      search: "q=monet&tab=artists",
      dropped: false,
    });
    expect(of("/en?type=Painting&era=1800s&page=2").search).toBe(
      "era=1800s&page=2&type=Painting",
    );
  });

  it("drops what the section does not read", () => {
    expect(of("/en/artworks/27992?fbclid=abc&utm_source=x")).toEqual({
      search: "",
      dropped: true,
    });
    expect(of("/en/shop?page=2&q=mug")).toEqual({
      search: "page=2",
      dropped: true,
    });
    expect(of("/en/search?q=a&q=b&tab=").search).toBe("q=a");
  });

  it("ignores the router's cache-busting parameter", () => {
    expect(of("/en/about?_rsc=abc")).toEqual({ search: "", dropped: false });
  });
});

describe("createEdgeHandler", () => {
  it("answers a repeat request without rendering again", async () => {
    const { send, app } = setup();
    const first = await send("/en/about");
    expect(first.headers.get("X-Edge-Cache")).toBe("MISS");
    expect(await first.text()).toBe("page");

    const second = await send("/en/about");
    expect(second.headers.get("X-Edge-Cache")).toBe("HIT");
    expect(await second.text()).toBe("page");
    expect(app.fetch).toHaveBeenCalledTimes(1);
  });

  it("gives browsers the app's own cache headers on a hit", async () => {
    const { send, entries } = setup();
    await send("/en/search?q=monet");
    const [stored] = [...entries.values()];
    expect(stored?.headers.get("Cache-Control")).toBe("public, max-age=3600");

    const hit = await send("/en/search?q=monet");
    expect(hit.headers.get("Cache-Control")).toBe("private, no-store");
    expect(hit.headers.get("Vary")).toBe("RSC, Next-Url");
    expect(hit.headers.has("X-Edge-Saved-Vary")).toBe(false);
  });

  it("adds security headers to every response", async () => {
    const { send } = setup();
    for (const path of ["/en/about", "/en/about", "/en/random"]) {
      const response = await send(path);
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
    }
  });

  it("treats query strings as different pages", async () => {
    const { send, app } = setup();
    await send("/en/search?q=monet");
    await send("/en/search?q=degas");
    expect(app.fetch).toHaveBeenCalledTimes(2);
  });

  it("shares one copy between differently ordered queries", async () => {
    const { send, app } = setup();
    await send("/en/search?q=monet&tab=artists");
    const second = await send("/en/search?tab=artists&q=monet");
    expect(second.headers.get("X-Edge-Cache")).toBe("HIT");
    expect(app.fetch).toHaveBeenCalledTimes(1);
  });

  it("redirects away parameters the page does not read", async () => {
    const { send, app } = setup();
    const tracked = await send("/en/artworks/27992?fbclid=abc");
    expect(tracked.status).toBe(302);
    expect(tracked.headers.get("Location")).toBe("/en/artworks/27992");

    const mixed = await send("/zh-tw/search?utm_source=x&q=monet");
    expect(mixed.headers.get("Location")).toBe("/zh-tw/search?q=monet");
    expect(app.fetch).not.toHaveBeenCalled();
  });

  it("serves a navigation from the same copy whatever page it came from", async () => {
    const { send, app, forwarded } = setup();
    await send("/en/about");
    const first = await send("/en/about?_rsc=one", {
      headers: navigationFrom("/en"),
    });
    expect(first.headers.get("X-Edge-Cache")).toBe("MISS");

    const second = await send("/en/about?_rsc=two", {
      headers: navigationFrom("/en/tours"),
    });
    expect(second.headers.get("X-Edge-Cache")).toBe("HIT");
    expect(app.fetch).toHaveBeenCalledTimes(2);

    const request = forwarded(1);
    expect(new URL(request.url).search).toBe("?_rsc");
    expect(request.headers.get("RSC")).toBe("1");
    expect(request.headers.has("X-Vinext-Mounted-Layouts")).toBe(false);
    expect(request.headers.has("X-Vinext-Rsc-State-Fingerprint")).toBe(false);
  });

  it("answers a full prefetch with the navigation copy", async () => {
    const { send, app } = setup();
    await send("/en/search?q=monet&_rsc=one", {
      headers: navigationFrom("/en"),
    });
    const prefetch = await send("/en/search?q=monet&_rsc=two", {
      headers: prefetchFrom("/en/tours"),
    });
    expect(prefetch.headers.get("X-Edge-Cache")).toBe("HIT");
    expect(app.fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps shell prefetches apart from navigations and passes them on untouched", async () => {
    const { send, app, forwarded } = setup();
    await send("/en/tours/2193?_rsc=nav", { headers: navigationFrom("/en") });
    const shell = await send("/en/tours/2193?_rsc=shell", {
      headers: prefetchFrom("/en/tours", "prefetch-loading-shell"),
    });
    expect(shell.headers.get("X-Edge-Cache")).toBe("MISS");
    expect(new URL(forwarded(1).url).search).toBe("?_rsc=shell");
    expect(forwarded(1).headers.get("Next-Url")).toBe("/en/tours");

    const again = await send("/en/tours/2193?_rsc=other", {
      headers: prefetchFrom("/en", "prefetch-loading-shell"),
    });
    expect(again.headers.get("X-Edge-Cache")).toBe("HIT");
    expect(app.fetch).toHaveBeenCalledTimes(2);
  });

  it("does not let a request without RSC share a navigation's copy", async () => {
    const { send, app } = setup();
    await send("/en/about?_rsc=one", { headers: navigationFrom("/en") });
    const page = await send("/en/about", { headers: { "Next-Url": "1" } });
    expect(page.headers.get("X-Edge-Cache")).toBe("MISS");
    expect(app.fetch).toHaveBeenCalledTimes(2);
  });

  it("answers HEAD from the cache without a body and never stores one", async () => {
    const { send, app, entries } = setup();
    await send("/en/about", { method: "HEAD" });
    expect(entries.size).toBe(0);

    await send("/en/about");
    const head = await send("/en/about", { method: "HEAD" });
    expect(head.headers.get("X-Edge-Cache")).toBe("HIT");
    expect(await head.text()).toBe("");
    expect(app.fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps a missing page for ten minutes", async () => {
    const { send, app, entries } = setup({
      respond: () => new Response("gone", { status: 404 }),
    });
    await send("/en/artworks/999999999");
    const [stored] = [...entries.values()];
    expect(stored?.headers.get("Cache-Control")).toBe("public, max-age=600");

    const again = await send("/en/artworks/999999999");
    expect(again.status).toBe(404);
    expect(again.headers.get("X-Edge-Cache")).toBe("HIT");
    expect(app.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not keep a page rendered from incomplete data", async () => {
    const { send, app, entries } = setup({
      respond: async () => {
        await Promise.resolve();
        reportUpstreamFailure();
        return new Response("partial");
      },
    });
    await send("/en/about");
    expect(entries.size).toBe(0);
    await send("/en/about");
    expect(app.fetch).toHaveBeenCalledTimes(2);
  });

  it("notices a failure that happens while the page streams", async () => {
    const { send, entries } = setup({
      respond: () =>
        new Response(
          new ReadableStream({
            async start(controller) {
              controller.enqueue(new TextEncoder().encode("start"));
              await Promise.resolve();
              reportUpstreamFailure();
              controller.close();
            },
          }),
        ),
    });
    await (await send("/en/about")).text();
    expect(entries.size).toBe(0);
  });

  it.each([
    ["a server error", () => new Response("down", { status: 500 })],
    ["a redirect", () => new Response(null, { status: 307 })],
    ["a cookie", () => new Response("x", { headers: { "Set-Cookie": "a=1" } })],
    [
      "an unknown Vary",
      () => new Response("x", { headers: { Vary: "Cookie" } }),
    ],
  ])("does not keep a response with %s", async (_name, respond) => {
    const { send, entries } = setup({ respond });
    await send("/en/about");
    expect(entries.size).toBe(0);
  });

  it("passes other methods and uncached paths straight through", async () => {
    const { send, entries } = setup();
    await send("/en/about", { method: "POST" });
    await send("/en/random");
    expect(entries.size).toBe(0);
  });

  it("caches nothing without a build version", async () => {
    const { send, entries } = setup({ version: null });
    const response = await send("/en/about");
    expect(response.headers.has("X-Edge-Cache")).toBe(false);
    expect(entries.size).toBe(0);
  });
});

describe("static file requests", () => {
  const files = async (request: Request) =>
    new URL(request.url).pathname === "/tour-transcripts/2179.json"
      ? new Response("{}", { headers: { "Content-Type": "application/json" } })
      : new Response(null, { status: 404 });

  it("serves a deployed file without the app", async () => {
    const { send, app } = setup({ files });
    const response = await send("/tour-transcripts/2179.json");
    expect(await response.text()).toBe("{}");
    expect(app.fetch).not.toHaveBeenCalled();
  });

  it("answers a missing file with a plain 404 instead of a page", async () => {
    const { send, app } = setup({ files });
    const response = await send("/wp-login.php");
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
    expect(app.fetch).not.toHaveBeenCalled();
  });

  it("falls back to the app when the files cannot be read", async () => {
    const { send, app } = setup();
    await send("/favicon.ico");
    expect(app.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("aicGet failure reports", () => {
  const failingWith = (status: number) => async () =>
    new Response("{}", { status });

  it("flags the render when the museum API fails", async () => {
    const { send, entries } = setup({
      respond: async () => {
        await aicGet("/artworks/1", {
          retries: 0,
          fetchImpl: failingWith(500),
        }).catch(() => null);
        return new Response("partial");
      },
    });
    await send("/en/about");
    expect(entries.size).toBe(0);
  });

  it("does not flag a record that does not exist", async () => {
    const { send, entries } = setup({
      respond: async () => {
        await aicGet("/artworks/1", {
          retries: 0,
          fetchImpl: failingWith(404),
        }).catch(() => null);
        return new Response("not there");
      },
    });
    await send("/en/about");
    expect(entries.size).toBe(1);
  });
});
