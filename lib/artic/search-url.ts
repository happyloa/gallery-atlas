/**
 * The Explore URL shape, shared by server and client code. Kept free of Zod and upstream
 * details so client components can import it without pulling either into the bundle.
 */
import type { ArtworkTypeSlug } from "./config";

export interface SearchQuery {
  q: string;
  type: ArtworkTypeSlug | null;
  page: number;
}

/** Query string for links within the site. Defaults are omitted to keep URLs short. */
export function toSearchParams(query: Partial<SearchQuery>): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.type) params.set("type", query.type);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return params;
}

/** A link to Explore with these settings, landing on the results. */
export function searchHref(
  query: Partial<SearchQuery>,
  hash = "explore",
): string {
  const search = toSearchParams(query).toString();
  return `/${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}
