/**
 * GET /[lang]/random   sends the visitor to a random public-domain work the museum has
 * written about. Never cached: each visit should land somewhere new.
 */
import { getRandomArtworkId } from "@/lib/artic/museum";
import { isLocale } from "@/lib/i18n/config";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lang: string }> },
): Promise<Response> {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "en";
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now();
  let id: number | null = null;
  try {
    id = await getRandomArtworkId(seed);
  } catch {
    id = null;
  }
  const target = id ? `/${locale}/artworks/${id}` : `/${locale}#explore`;
  return new Response(null, {
    status: 307,
    headers: {
      Location: new URL(target, request.url).toString(),
      "Cache-Control": "no-store",
    },
  });
}
