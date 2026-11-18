import { describe, expect, it, vi } from "vitest";
import { GET as getArtworkRoute } from "@/app/api/artworks/[id]/route";
import { GET as searchRoute } from "@/app/api/artworks/route";
import {
  detailResponse,
  jsonResponse,
  listResponse,
  rawArtwork,
  restrictedArtwork,
  searchResponse,
} from "../fixtures/aic";

const request = (path: string) => new Request(`http://localhost${path}`);
const params = (id: string) => ({ params: Promise.resolve({ id }) });

interface ApiBody {
  artworks: Array<{ id: number }>;
  unavailable: number[];
  error: { code: string };
}
const readJson = async (response: Response): Promise<ApiBody> =>
  (await response.json()) as ApiBody;

describe("GET /api/artworks", () => {
  it("answers bad pages with 400 and never calls upstream", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const page of ["84", "abc", "0"]) {
      const response = await searchRoute(request(`/api/artworks?page=${page}`));
      expect(response.status).toBe(400);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("validates batch ids before calling upstream", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect((await searchRoute(request("/api/artworks?ids=1,abc"))).status).toBe(
      400,
    );
    expect((await searchRoute(request("/api/artworks?ids="))).status).toBe(400);
    const tooMany = Array.from({ length: 201 }, (_, i) => i + 1).join(",");
    expect(
      (await searchRoute(request(`/api/artworks?ids=${tooMany}`))).status,
    ).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns search results with cache headers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(searchResponse([rawArtwork()]))),
    );
    const response = await searchRoute(request("/api/artworks?q=seurat"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=");
    const body = await readJson(response);
    expect(body.artworks[0].id).toBe(27992);
  });

  it("maps upstream rate limiting to 429 with Retry-After", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 429 })),
    );
    const response = await searchRoute(request("/api/artworks"));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect((await readJson(response)).error.code).toBe("rate_limited");
  });

  it("returns batch reads without restricted works", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(listResponse([rawArtwork(), restrictedArtwork()])),
      ),
    );
    const body = await readJson(
      await searchRoute(request("/api/artworks?ids=27992,111628")),
    );
    expect(body.artworks.map((a: { id: number }) => a.id)).toEqual([27992]);
    expect(body.unavailable).toEqual([111628]);
  });
});

describe("GET /api/artworks/:id", () => {
  it("rejects non-numeric ids", async () => {
    expect(
      (await getArtworkRoute(request("/api/artworks/abc"), params("abc")))
        .status,
    ).toBe(400);
  });

  it("returns 404 restricted for a work that is not public domain", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(detailResponse(restrictedArtwork()))),
    );
    const response = await getArtworkRoute(
      request("/api/artworks/111628"),
      params("111628"),
    );
    expect(response.status).toBe(404);
    expect((await readJson(response)).error.code).toBe("restricted");
  });

  it("returns 404 not_found for an unknown id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 404 })),
    );
    const response = await getArtworkRoute(
      request("/api/artworks/999"),
      params("999"),
    );
    expect((await readJson(response)).error.code).toBe("not_found");
  });
});
