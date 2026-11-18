/** Search across the museum's records, through the API's multi-resource endpoint. */
import { z } from "zod";
import { aicGet } from "./client";
import { REVALIDATE_SEARCH } from "./config";
import { isLibraryKind, KIND_OF_RESOURCE } from "./library";
import { plainTitle } from "./museum";
import {
  articUrl,
  cleanFileTitle,
  paramsPath,
  readableSlug,
  searchParamsFor,
  textField,
  toRecordPage,
  webUrl,
} from "./records";
import type { RecordPage } from "./records";
import { TOUR_INDEX } from "./tour-index";

const READING = [
  "articles",
  "highlights",
  "publications",
  "sections",
  "digital-publications",
  "digital-publication-articles",
  "printed-publications",
  "educator-resources",
  "press-releases",
  "generic-pages",
  "landing-pages",
];

export const SEARCH_TABS = {
  all: null,
  artists: ["agents"],
  exhibitions: ["exhibitions"],
  events: ["events"],
  reading: READING,
  media: ["sounds", "texts", "videos", "sites"],
  museum: ["galleries", "tours"],
} as const satisfies Record<string, readonly string[] | null>;

export type SearchTab = keyof typeof SEARCH_TABS;

export const SEARCH_TAB_NAMES = Object.keys(SEARCH_TABS) as SearchTab[];

const EVERY_RESOURCE = SEARCH_TAB_NAMES.flatMap(
  (tab) => SEARCH_TABS[tab] ?? [],
);

const KEYWORD_FIELDS = [
  "title^4",
  "alt_titles^2",
  "copy",
  "description",
  "short_description",
  "content",
];

const PAGE_SIZE = 20;

const rawHit = z.object({
  id: z.union([z.number(), z.string()]),
  api_model: z.string(),
  title: textField,
  display_title: textField,
  content: textField,
  web_url: textField,
});

export interface SearchHit {
  key: string;
  /** The API resource, used to label the row. */
  resource: string;
  title: string;
  href: string;
  external: boolean;
}

/** Where a hit opens: a page on this site, or the file or site it points to. */
export function toSearchHit(raw: z.infer<typeof rawHit>): SearchHit | null {
  const resource = raw.api_model;
  const name = plainTitle(raw.display_title, 200) ?? plainTitle(raw.title, 200);
  if (!name) return null;
  const hit = (href: string | null, external: boolean, title = name) =>
    href
      ? { key: `${resource}-${raw.id}`, resource, title, href, external }
      : null;

  const library = KIND_OF_RESOURCE[resource];
  if (library && isLibraryKind(library))
    return hit(
      `/read/${library}/${raw.id}`,
      false,
      resource === "highlights" ? readableSlug(name) : name,
    );
  switch (resource) {
    case "agents":
      return hit(`/artists/${raw.id}`, false);
    case "exhibitions":
      return hit(`/exhibitions/${raw.id}`, false);
    case "events":
      return hit(`/events/${raw.id}`, false);
    case "galleries":
      return hit(`/galleries/${raw.id}`, false);
    case "tours":
      // Tours retired from the museum's app are still in the search index.
      return TOUR_INDEX.tours.some((tour) => tour.id === raw.id)
        ? hit(`/tours/${raw.id}`, false)
        : null;
    case "sounds":
    case "texts":
    case "videos":
      return hit(articUrl(raw.content), true, cleanFileTitle(name));
    case "sites":
      return hit(webUrl(raw.web_url), true);
    default:
      return null;
  }
}

const countsSchema = z.object({
  kinds: z.object({
    buckets: z.array(
      z.object({ key: z.string(), doc_count: z.number().int() }),
    ),
  }),
});

export interface SiteSearchResult extends RecordPage<SearchHit> {
  /** Matches under each tab. */
  tabCounts: Record<SearchTab, number>;
}

export async function searchSite(
  keyword: string,
  tab: SearchTab,
  page: number,
): Promise<SiteSearchResult> {
  const base = { keyword, keywordFields: KEYWORD_FIELDS };
  const resources = (SEARCH_TABS[tab] ?? EVERY_RESOURCE).join(",");
  const [resultsJson, countsJson] = await Promise.all([
    aicGet(
      paramsPath("/search", {
        ...searchParamsFor({
          ...base,
          fields: "id,api_model,title,display_title,content,web_url",
          limit: PAGE_SIZE,
          page,
        }),
        resources,
      }),
      { revalidate: REVALIDATE_SEARCH },
    ),
    aicGet(
      paramsPath("/search", {
        ...searchParamsFor({
          ...base,
          limit: 0,
          aggs: { kinds: { terms: { field: "api_model", size: 30 } } },
        }),
        resources: EVERY_RESOURCE.join(","),
      }),
      { revalidate: REVALIDATE_SEARCH },
    ),
  ]);

  const results = toRecordPage(resultsJson, rawHit, PAGE_SIZE, page);
  const buckets =
    countsSchema.safeParse(
      toRecordPage(countsJson, z.unknown(), 0).aggregations,
    ).data?.kinds.buckets ?? [];
  const perResource = new Map(buckets.map((b) => [b.key, b.doc_count]));
  const countFor = (names: readonly string[]) =>
    names.reduce((sum, name) => sum + (perResource.get(name) ?? 0), 0);

  return {
    ...results,
    items: results.items.flatMap((raw) => {
      const hit = toSearchHit(raw);
      return hit ? [hit] : [];
    }),
    tabCounts: Object.fromEntries(
      SEARCH_TAB_NAMES.map((name) => [
        name,
        countFor(SEARCH_TABS[name] ?? EVERY_RESOURCE),
      ]),
    ) as Record<SearchTab, number>,
  };
}
