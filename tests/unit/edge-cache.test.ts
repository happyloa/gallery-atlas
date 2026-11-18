import { describe, expect, it, vi } from "vitest";
import { aicGet } from "@/lib/artic/client";
import { reportUpstreamFailure } from "@/lib/render-health";
import {
  createEdgeHandler,
  edgeTtl,
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

function setup(
  respond: EdgeApp["fetch"] = () =>
    new Response("page", {
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "RSC, Next-Url",
      },
    }),
  version: string | null = "build-1",
) {
  const { store, entries } = memoryStore();
  const app = { fetch: vi.fn(respond) };
  const loadApp = vi.fn(async () => app);
  const handler = createEdgeHandler({
    loadApp,
    store: () => store,
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
  return { send, app, loadApp, entries };
}

describe("edgeTtl", () => {
  it("keeps time-sensitive pages briefly", () => {
    expect(edgeTtl("/en/visit")).toBe(60);
    expect(edgeTtl("/zh-tw/events/12")).toBe(300);
    expect(edgeTtl("/en")).toBe(600);
    expect(edgeTtl("/en/artworks/27992")).toBe(3600);
  });

  it("never caches the random work or paths without a language", () => {
    expect(edgeTtl("/en/random")).toBeNull();
    expect(edgeTtl("/")).toBeNull();
    expect(edgeTtl("/about")).toBeNull();
  });
});

describe("createEdgeHandler", () => {
  it("answers a repeat request without loading the app", async () => {
    const { send, loadApp } = setup();
    const first = await send("/en/about");
    expect(first.headers.get("X-Edge-Cache")).toBe("MISS");
    expect(await first.text()).toBe("page");

    const second = await send("/en/about");
    expect(second.headers.get("X-Edge-Cache")).toBe("HIT");
    expect(await second.text()).toBe("page");
    expect(loadApp).toHaveBeenCalledTimes(1);
  });

  it("gives browsers the app's own cache headers on a hit", async () => {
    const { send, entries } = setup();
    await send("/en/about");
    const [stored] = [...entries.values()];
    expect(stored?.headers.get("Cache-Control")).toBe("public, max-age=3600");

    const hit = await send("/en/about");
    expect(hit.headers.get("Cache-Control")).toBe("private, no-store");
    expect(hit.headers.get("Vary")).toBe("RSC, Next-Url");
    expect(hit.headers.has("X-Edge-Saved-Vary")).toBe(false);
  });

  it("keeps page and client-navigation responses apart", async () => {
    const { send, app } = setup();
    await send("/en/about");
    await send("/en/about", { headers: { RSC: "1" } });
    expect(app.fetch).toHaveBeenCalledTimes(2);

    const navigation = await send("/en/about", { headers: { RSC: "1" } });
    expect(navigation.headers.get("X-Edge-Cache")).toBe("HIT");
    expect(app.fetch).toHaveBeenCalledTimes(2);
  });

  it("treats query strings as different pages", async () => {
    const { send, app } = setup();
    await send("/en/search?q=monet");
    await send("/en/search?q=degas");
    expect(app.fetch).toHaveBeenCalledTimes(2);
  });

  it("does not keep a page rendered from incomplete data", async () => {
    const { send, app, entries } = setup(async () => {
      await Promise.resolve();
      reportUpstreamFailure();
      return new Response("partial");
    });
    await send("/en/about");
    expect(entries.size).toBe(0);
    await send("/en/about");
    expect(app.fetch).toHaveBeenCalledTimes(2);
  });

  it("notices a failure that happens while the page streams", async () => {
    const { send, entries } = setup(
      () =>
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
    );
    await (await send("/en/about")).text();
    expect(entries.size).toBe(0);
  });

  it.each([
    ["an error", () => new Response("gone", { status: 404 })],
    ["a redirect", () => new Response(null, { status: 307 })],
    ["a cookie", () => new Response("x", { headers: { "Set-Cookie": "a=1" } })],
    [
      "an unknown Vary",
      () => new Response("x", { headers: { Vary: "Cookie" } }),
    ],
  ])("does not keep a response with %s", async (_name, respond) => {
    const { send, entries } = setup(respond);
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
    const { send, entries } = setup(undefined, null);
    const response = await send("/en/about");
    expect(response.headers.has("X-Edge-Cache")).toBe(false);
    expect(entries.size).toBe(0);
  });
});

describe("aicGet failure reports", () => {
  const failingWith = (status: number) => async () =>
    new Response("{}", { status });

  it("flags the render when the museum API fails", async () => {
    const { send, entries } = setup(async () => {
      await aicGet("/artworks/1", {
        retries: 0,
        fetchImpl: failingWith(500),
      }).catch(() => null);
      return new Response("partial");
    });
    await send("/en/about");
    expect(entries.size).toBe(0);
  });

  it("does not flag a record that does not exist", async () => {
    const { send, entries } = setup(async () => {
      await aicGet("/artworks/1", {
        retries: 0,
        fetchImpl: failingWith(404),
      }).catch(() => null);
      return new Response("not there");
    });
    await send("/en/about");
    expect(entries.size).toBe(1);
  });
});
