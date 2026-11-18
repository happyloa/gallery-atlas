import { EMPTY_QUERY } from "@/lib/artic/search-url";
import { describe, expect, it, vi } from "vitest";
import {
  getArtwork,
  getArtworksByIds,
  searchArtworks,
} from "@/lib/artic/artworks";
import { MAX_PAGE, REVALIDATE_LISTING } from "@/lib/artic/config";
import { getFeaturedArtworks } from "@/lib/artic/featured";
import {
  detailResponse,
  fastRetry,
  jsonResponse,
  listResponse,
  rawArtwork,
  restrictedArtwork,
  searchResponse,
} from "../fixtures/aic";

const query = { ...EMPTY_QUERY, q: "", type: null, page: 1 };

describe("searchArtworks", () => {
  it("returns only displayable works and caps pages at the search window", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        searchResponse(
          [
            rawArtwork(),
            restrictedArtwork(),
            rawArtwork({ id: 14655, image_id: null }),
          ],
          {
            total: 59120,
            total_pages: 4927,
          },
        ),
      ),
    );
    const result = await searchArtworks(query, { fetchImpl, ...fastRetry });
    expect(result.artworks.map((a) => a.id)).toEqual([27992]);
    expect(result.total).toBe(59120);
    expect(result.totalPages).toBe(MAX_PAGE);
    expect(result.limited).toBe(true);
  });

  it("reports an exact page count for small result sets", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(searchResponse([rawArtwork()], { total: 33 })),
    );
    const result = await searchArtworks(
      { ...EMPTY_QUERY, q: "monet", type: "painting", page: 1 },
      { fetchImpl, ...fastRetry },
    );
    expect(result).toMatchObject({ total: 33, totalPages: 3, limited: false });
  });

  it("rejects responses with an untrusted IIIF base instead of showing broken images", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        searchResponse(
          [rawArtwork()],
          {},
          { iiif_url: "https://evil.example/iiif/2" },
        ),
      ),
    );
    await expect(
      searchArtworks(query, { fetchImpl, ...fastRetry }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("rejects malformed search payloads", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: "nope" }));
    await expect(
      searchArtworks(query, { fetchImpl, ...fastRetry }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("getArtwork", () => {
  it("returns a displayable work", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(detailResponse(rawArtwork())),
    );
    const result = await getArtwork(27992, { fetchImpl, ...fastRetry });
    expect(result.status).toBe("ok");
  });

  it("marks a work that is not public domain as restricted", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(detailResponse(restrictedArtwork())),
    );
    expect(await getArtwork(111628, { fetchImpl, ...fastRetry })).toEqual({
      status: "restricted",
    });
  });

  it("marks a public-domain work without an image as restricted", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(detailResponse(rawArtwork({ image_id: null }))),
    );
    expect(await getArtwork(27992, { fetchImpl, ...fastRetry })).toEqual({
      status: "restricted",
    });
  });

  it("turns an upstream 404 into not_found", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 404 }));
    expect(await getArtwork(999999999, { fetchImpl, ...fastRetry })).toEqual({
      status: "not_found",
    });
  });

  it("lets other failures through for the caller to show", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 429 }));
    await expect(
      getArtwork(1, { fetchImpl, ...fastRetry }),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });
});

describe("getArtworksByIds", () => {
  it("keeps the requested order, de-duplicates, and lists unavailable ids", async () => {
    // The API returns records in its own order and silently skips unknown ids.
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        listResponse([
          rawArtwork({ id: 14655 }),
          restrictedArtwork(),
          rawArtwork(),
        ]),
      ),
    );
    const result = await getArtworksByIds([27992, 111628, 999, 14655, 27992], {
      fetchImpl,
      ...fastRetry,
    });
    expect(result.artworks.map((a) => a.id)).toEqual([27992, 14655]);
    expect(result.unavailable).toEqual([111628, 999]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("splits large requests into chunks of 50", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(listResponse([])));
    const ids = Array.from({ length: 120 }, (_, i) => i + 1);
    const result = await getArtworksByIds(ids, { fetchImpl, ...fastRetry });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.unavailable).toHaveLength(120);
  });
});

describe("pages past the search window", () => {
  it("refuses them without asking the API, which would answer 403", async () => {
    const fetchImpl = vi.fn();
    await expect(
      searchArtworks({ ...EMPTY_QUERY, page: MAX_PAGE + 1 }, { fetchImpl }),
    ).rejects.toMatchObject({ code: "bad_request", retryable: false });
    // Four to a page reaches further than twelve to a page.
    await expect(
      searchArtworks(
        { ...EMPTY_QUERY, page: 251 },
        { fetchImpl },
        { artistId: 1, limit: 4 },
      ),
    ).rejects.toMatchObject({ code: "bad_request" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("still serves the last page inside it", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(searchResponse([rawArtwork()], { total: 5000 })),
    );
    const result = await searchArtworks(
      { ...EMPTY_QUERY, page: MAX_PAGE },
      { fetchImpl, ...fastRetry },
    );
    expect(result.page).toBe(MAX_PAGE);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("what is kept in the data cache", () => {
  /** The `revalidate` each request carried; undefined means "not kept". */
  const revalidates = (fetchImpl: { mock: { calls: unknown[][] } }) =>
    fetchImpl.mock.calls.map(
      (call) =>
        (call[1] as { next?: { revalidate?: number } } | undefined)?.next
          ?.revalidate,
    );

  it("keeps Explore's first page and no other search", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(searchResponse([rawArtwork()])),
    );
    const options = { fetchImpl, ...fastRetry };
    await searchArtworks(EMPTY_QUERY, options);
    await searchArtworks({ ...EMPTY_QUERY, q: "monet" }, options);
    await searchArtworks({ ...EMPTY_QUERY, type: "painting" }, options);
    await searchArtworks({ ...EMPTY_QUERY, sort: "oldest" }, options);
    await searchArtworks({ ...EMPTY_QUERY, page: 2 }, options);
    await searchArtworks(EMPTY_QUERY, options, { artistId: 40810 });
    expect(revalidates(fetchImpl)).toEqual([
      REVALIDATE_LISTING,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("keeps works read by id only for a list the caller says is fixed", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) =>
      jsonResponse(
        String(url).includes("ids=")
          ? listResponse([rawArtwork()])
          : detailResponse(rawArtwork()),
      ),
    );
    const options = { fetchImpl, ...fastRetry };
    await getArtwork(27992, options);
    await getArtworksByIds([27992], options);
    await getArtworksByIds([27992], {
      ...options,
      revalidate: REVALIDATE_LISTING,
    });
    expect(revalidates(fetchImpl)).toEqual([
      undefined,
      undefined,
      REVALIDATE_LISTING,
    ]);
  });
});

describe("getFeaturedArtworks", () => {
  it("falls back to the dated snapshot when the API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 })),
    );
    const featured = await getFeaturedArtworks();
    expect(featured.source).toBe("snapshot");
    expect(featured.snapshotDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(featured.artworks.length).toBeGreaterThanOrEqual(3);
  });
});
