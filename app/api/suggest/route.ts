/**
 * GET /api/suggest?q=mon   titles and artist names that start like the text, for the
 * search box. Always answers 200 with a (possibly empty) list; suggestions are optional.
 */
import { REVALIDATE_REFERENCE } from "@/lib/artic/config";
import { jsonOk } from "@/lib/artic/http";
import { getSuggestions } from "@/lib/artic/museum";
import { normalizeKeyword } from "@/lib/artic/queries";

export async function GET(request: Request): Promise<Response> {
  const q = normalizeKeyword(new URL(request.url).searchParams.get("q") ?? "", 60);
  return jsonOk({ suggestions: await getSuggestions(q) }, REVALIDATE_REFERENCE);
}
