/**
 * GET /api/artworks
 *   ?q=&type=&page=   search (same rules as Explore)
 *   ?ids=1,2,3        batch read for saved works (max 200 ids)
 *
 * Only displayable public-domain works are returned. Ids from the browser are re-checked
 * here; nothing stored on the client is trusted.
 */
import { getArtworksByIds, searchArtworks } from "@/lib/artic/artworks";
import { REVALIDATE_ARTWORK, REVALIDATE_SEARCH } from "@/lib/artic/config";
import { jsonError, jsonOk, upstreamErrorResponse } from "@/lib/artic/http";
import { parseArtworkId, parseSearchQuery } from "@/lib/artic/queries";

const MAX_IDS = 200;

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;

  const rawIds = params.get("ids");
  if (rawIds !== null) {
    const parts = rawIds.split(",").filter(Boolean);
    if (parts.length === 0 || parts.length > MAX_IDS) {
      return jsonError(
        400,
        "invalid_ids",
        `Pass between 1 and ${MAX_IDS} comma-separated artwork ids.`,
      );
    }
    const ids = parts.map(parseArtworkId);
    if (ids.some((id) => id === null))
      return jsonError(
        400,
        "invalid_ids",
        "Artwork ids must be positive integers.",
      );
    try {
      return jsonOk(
        await getArtworksByIds(ids as number[]),
        REVALIDATE_ARTWORK,
      );
    } catch (error) {
      return upstreamErrorResponse(error);
    }
  }

  const parsed = parseSearchQuery(params);
  if (!parsed.ok)
    return jsonError(400, parsed.error.code, parsed.error.message);
  try {
    return jsonOk(await searchArtworks(parsed.query), REVALIDATE_SEARCH);
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}
