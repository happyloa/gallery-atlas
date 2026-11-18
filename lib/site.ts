/**
 * The public origin of the deployed site, from the server-only SITE_URL variable (e.g.
 * https://gallery-atlas.example.workers.dev). Used for absolute URLs in metadata, the
 * sitemap and robots.txt. Null when unset (local development).
 */
export function siteUrl(): URL | null {
  const raw =
    typeof process !== "undefined" ? process.env?.SITE_URL?.trim() : undefined;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return new URL(url.origin);
  } catch {
    return null;
  }
}

/** Absolute URL for a site path when SITE_URL is known, else the path itself. */
export function absoluteUrl(path: string): string {
  const base = siteUrl();
  return base ? new URL(path, base).toString() : path;
}
