/** GET /api/artworks/:id — one displayable public-domain work, or a 404 with a reason. */
import { getArtwork } from "@/lib/artic/artworks";
import { RESPONSE_MAX_AGE_ARTWORK } from "@/lib/artic/config";
import { jsonError, jsonOk, upstreamErrorResponse } from "@/lib/artic/http";
import { parseArtworkId } from "@/lib/artic/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const id = parseArtworkId((await params).id);
  if (id === null)
    return jsonError(400, "invalid_id", "Artwork ids are positive integers.");
  try {
    const result = await getArtwork(id);
    if (result.status === "not_found")
      return jsonError(404, "not_found", "No artwork with that id.");
    if (result.status === "restricted") {
      return jsonError(
        404,
        "restricted",
        "This work is not public domain or has no image, so it is not shown here.",
      );
    }
    return jsonOk(result.artwork, RESPONSE_MAX_AGE_ARTWORK);
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}
