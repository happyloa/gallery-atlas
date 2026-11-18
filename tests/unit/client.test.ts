import { describe, expect, it, vi } from "vitest";
import {
  aicGet,
  AicError,
  aicUserAgent,
  invalidResponse,
  isAicError,
  isStableFailure,
  parseRetryAfter,
  pastSearchWindow,
  USER_AGENT,
} from "@/lib/artic/client";
import { onUpstreamFailure } from "@/lib/render-health";
import { fastRetry, jsonResponse } from "../fixtures/aic";

function fetchSequence(...responses: Array<Response | Error>) {
  const queue = [...responses];
  return vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("fetch called more times than expected");
    if (next instanceof Error) throw next;
    return next;
  });
}

async function caught(promise: Promise<unknown>): Promise<AicError> {
  try {
    await promise;
  } catch (error) {
    if (isAicError(error)) return error;
    throw error;
  }
  throw new Error("expected the request to fail");
}

describe("aicGet", () => {
  it("returns parsed JSON and sends both user-agent headers", async () => {
    const fetchImpl = fetchSequence(jsonResponse({ ok: true }));
    await expect(
      aicGet("/artworks/1", { fetchImpl, ...fastRetry }),
    ).resolves.toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.artic.edu/api/v1/artworks/1");
    const headers = init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(USER_AGENT);
    expect(headers["AIC-User-Agent"]).toMatch(/^Gallery Atlas \(/);
  });

  it("passes the revalidate hint to the fetch cache", async () => {
    const fetchImpl = fetchSequence(jsonResponse({}));
    await aicGet("/artworks/1", { fetchImpl, revalidate: 600, ...fastRetry });
    const init = fetchImpl.mock.calls[0][1 as never] as {
      next?: { revalidate: number };
    };
    expect(init.next).toEqual({ revalidate: 600 });
  });

  it("refuses absolute or protocol-relative paths", async () => {
    const fetchImpl = vi.fn();
    for (const path of [
      "https://evil.example/x",
      "//evil.example/x",
      "artworks",
    ]) {
      const error = await caught(aicGet(path, { fetchImpl }));
      expect(error.code).toBe("bad_request");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retries a 500 and succeeds", async () => {
    const fetchImpl = fetchSequence(
      new Response("oops", { status: 500 }),
      jsonResponse({ ok: 1 }),
    );
    await expect(aicGet("/x", { fetchImpl, ...fastRetry })).resolves.toEqual({
      ok: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gives up after a bounded number of retries on repeated 5xx", async () => {
    const fetchImpl = fetchSequence(
      new Response("", { status: 502 }),
      new Response("", { status: 503 }),
      new Response("", { status: 500 }),
    );
    const error = await caught(
      aicGet("/x", { fetchImpl, retries: 2, ...fastRetry }),
    );
    expect(error.code).toBe("upstream");
    expect(error.status).toBe(500);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("backs off exponentially between retries", async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = fetchSequence(
      new Response("", { status: 503 }),
      new Response("", { status: 503 }),
      new Response("", { status: 503 }),
    );
    await caught(
      aicGet("/x", { fetchImpl, retries: 2, sleep, random: () => 1 }),
    );
    expect(sleep.mock.calls.map((call) => (call as unknown[])[0])).toEqual([
      300, 600,
    ]);
  });

  it("does not retry a 404", async () => {
    const fetchImpl = fetchSequence(new Response("{}", { status: 404 }));
    const error = await caught(aicGet("/x", { fetchImpl, ...fastRetry }));
    expect(error.code).toBe("not_found");
    expect(error.retryable).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 400, and treats a 403 as the museum refusing us", async () => {
    const bad = await caught(
      aicGet("/x", {
        fetchImpl: fetchSequence(new Response("", { status: 400 })),
        ...fastRetry,
      }),
    );
    expect(bad.code).toBe("bad_request");
    const refused = fetchSequence(new Response("", { status: 403 }));
    const error = await caught(
      aicGet("/x", { fetchImpl: refused, ...fastRetry }),
    );
    expect(error.code).toBe("upstream");
    expect(refused).toHaveBeenCalledTimes(1);
  });

  it("honours a short Retry-After on 429, then succeeds", async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = fetchSequence(
      new Response("", { status: 429, headers: { "Retry-After": "2" } }),
      jsonResponse({ ok: true }),
    );
    await expect(aicGet("/x", { fetchImpl, sleep })).resolves.toEqual({
      ok: true,
    });
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("stops on 429 without Retry-After or with a long one", async () => {
    const noHeader = fetchSequence(new Response("", { status: 429 }));
    expect(
      (await caught(aicGet("/x", { fetchImpl: noHeader, ...fastRetry }))).code,
    ).toBe("rate_limited");
    expect(noHeader).toHaveBeenCalledTimes(1);

    const longWait = fetchSequence(
      new Response("", { status: 429, headers: { "Retry-After": "120" } }),
    );
    expect(
      (await caught(aicGet("/x", { fetchImpl: longWait, ...fastRetry }))).code,
    ).toBe("rate_limited");
    expect(longWait).toHaveBeenCalledTimes(1);
  });

  it("times out, retries once, then reports a timeout", async () => {
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const error = await caught(
      aicGet("/x", { fetchImpl, timeoutMs: 20, retries: 1, ...fastRetry }),
    );
    expect(error.code).toBe("timeout");
    expect(error.retryable).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reports a network failure after retrying", async () => {
    const fetchImpl = fetchSequence(
      new TypeError("fetch failed"),
      new TypeError("fetch failed"),
    );
    const error = await caught(
      aicGet("/x", { fetchImpl, retries: 1, ...fastRetry }),
    );
    expect(error.code).toBe("network");
  });

  it("does not retry invalid JSON", async () => {
    const fetchImpl = fetchSequence(
      new Response("<html>not json</html>", { status: 200 }),
    );
    const error = await caught(aicGet("/x", { fetchImpl, ...fastRetry }));
    expect(error.code).toBe("invalid_response");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("reporting a failed render", () => {
  /** How often the Worker was told the page is incomplete while `request` ran. */
  async function reports(request: () => Promise<unknown>): Promise<number> {
    const listener = vi.fn();
    onUpstreamFailure(listener);
    await request().catch(() => null);
    return listener.mock.calls.length;
  }
  const answering = (status: number) =>
    aicGet("/x", {
      fetchImpl: fetchSequence(new Response("{}", { status })),
      retries: 0,
      ...fastRetry,
    });

  it("reports failures that may be gone on the next try", async () => {
    for (const status of [500, 503, 429, 403])
      expect(await reports(() => answering(status)), String(status)).toBe(1);
    expect(
      await reports(() =>
        aicGet("/x", {
          fetchImpl: fetchSequence(new TypeError("fetch failed")),
          retries: 0,
          ...fastRetry,
        }),
      ),
    ).toBe(1);
  });

  it("does not report an answer that would be the same next time", async () => {
    // A missing record, and a request the API refuses as malformed.
    for (const status of [404, 400, 422])
      expect(await reports(() => answering(status)), String(status)).toBe(0);
    expect(await reports(() => aicGet("//evil.example/x"))).toBe(0);
    expect(isStableFailure(new AicError("bad_request", "x"))).toBe(true);
    expect(isStableFailure(new AicError("upstream", "x", 403))).toBe(false);
    expect(isStableFailure(new Error("x"))).toBe(false);
  });

  it("reports a response that arrived but cannot be used", async () => {
    expect(
      await reports(async () => {
        throw invalidResponse("search");
      }),
    ).toBe(1);
    expect(invalidResponse("search")).toMatchObject({
      code: "invalid_response",
      retryable: true,
    });
    // Asking past the search window is the caller's mistake, not the museum's.
    expect(await reports(async () => Promise.reject(pastSearchWindow()))).toBe(
      0,
    );
  });
});

describe("helpers", () => {
  it("parses Retry-After seconds and dates", () => {
    expect(parseRetryAfter("3")).toBe(3000);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
    expect(parseRetryAfter("soon")).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });

  it("only puts a valid contact address in AIC-User-Agent", () => {
    expect(aicUserAgent("someone@example.org")).toBe(
      "Gallery Atlas (someone@example.org)",
    );
    expect(aicUserAgent(null)).toBe("Gallery Atlas (independent project)");
  });

  it("recognises AicError copies by name and code", () => {
    const copy = Object.assign(new Error("x"), {
      name: "AicError",
      code: "timeout",
    });
    expect(isAicError(copy)).toBe(true);
    expect(isAicError(new Error("x"))).toBe(false);
  });
});
