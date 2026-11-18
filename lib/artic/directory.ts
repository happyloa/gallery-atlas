/**
 * Indexes of the collection: artists, and the museum's classification system (departments,
 * object types, materials, techniques, styles, subjects, themes, places, vocabularies).
 */
import { z } from "zod";
import { aicGet } from "./client";
import { PLACE_FIELD, REVALIDATE_REFERENCE } from "./config";
import { DISPLAYABLE } from "./filters";
import { plainTitle } from "./museum";
import {
  LIST_SIZE,
  paramsPath,
  readByIds,
  readRecord,
  searchParamsFor,
  searchRecords,
  textField,
  toRecordPage,
} from "./records";
import type { RecordPage } from "./records";

const bucketsOf = (aggregations: Record<string, unknown>, name: string) => {
  const parsed = z
    .object({
      buckets: z.array(
        z.object({
          key: z.union([z.string(), z.number()]),
          doc_count: z.number().int(),
        }),
      ),
    })
    .safeParse(aggregations[name]);
  return parsed.success ? parsed.data.buckets : [];
};

/** Counts over the displayable works, for one or several fields in one request. */
async function countWorks(
  fields: Record<string, { field: string; size: number }>,
): Promise<Record<string, unknown>> {
  const aggs = Object.fromEntries(
    Object.entries(fields).map(([name, terms]) => [name, { terms }]),
  );
  const json = await aicGet(
    paramsPath(
      "/artworks/search",
      searchParamsFor({ filter: DISPLAYABLE, limit: 0, aggs }),
    ),
    { revalidate: REVALIDATE_REFERENCE },
  );
  return toRecordPage(json, z.unknown(), 0).aggregations;
}

/* Artists -------------------------------------------------------------------------------- */

const ARTIST_ROW_FIELDS = "id,title,birth_date,death_date,agent_type_title";

const rawArtistRow = z.object({
  id: z.number().int().positive(),
  title: textField,
  birth_date: z.number().int().nullish().catch(null),
  death_date: z.number().int().nullish().catch(null),
  agent_type_title: textField,
});

export interface ArtistRow {
  id: number;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  type: string | null;
  /** Public-domain works on this site; known only on the default list. */
  works: number | null;
}

const lifeYear = (value: number | null | undefined) =>
  typeof value === "number" && value > -10000 && value < 3000 ? value : null;

function toArtistRow(
  raw: z.infer<typeof rawArtistRow>,
  works: number | null,
): ArtistRow | null {
  const name = plainTitle(raw.title, 160);
  if (!name) return null;
  return {
    id: raw.id,
    name,
    birthYear: lifeYear(raw.birth_date),
    deathYear: lifeYear(raw.death_date),
    type: plainTitle(raw.agent_type_title, 60),
    works,
  };
}

/** How far the default list reaches: artists by number of public-domain works. */
const RANKED_ARTISTS = 480;

export async function getArtistIndex({
  keyword,
  type,
  page,
}: {
  keyword: string;
  type: number | null;
  page: number;
}): Promise<RecordPage<ArtistRow>> {
  if (keyword || type !== null) {
    const result = await searchRecords("agents", rawArtistRow, {
      keyword,
      keywordFields: ["title^3", "alt_titles"],
      filter: [
        { term: { is_artist: true } },
        ...(type !== null ? [{ term: { agent_type_id: type } }] : []),
      ],
      fields: ARTIST_ROW_FIELDS,
      limit: LIST_SIZE,
      page,
    });
    return {
      ...result,
      items: result.items.flatMap((raw) => {
        const row = toArtistRow(raw, null);
        return row ? [row] : [];
      }),
    };
  }

  const aggregations = await countWorks({
    artists: { field: "artist_id", size: RANKED_ARTISTS },
  });
  const ranked = bucketsOf(aggregations, "artists").filter(
    (bucket) => typeof bucket.key === "number",
  );
  const slice = ranked.slice((page - 1) * LIST_SIZE, page * LIST_SIZE);
  const records = await readByIds(
    "agents",
    slice.map((bucket) => bucket.key),
    rawArtistRow,
    ARTIST_ROW_FIELDS,
  );
  const works = new Map(slice.map((b) => [b.key, b.doc_count]));
  return {
    items: records.flatMap((raw) => {
      const row = toArtistRow(raw, works.get(raw.id) ?? null);
      return row ? [row] : [];
    }),
    total: ranked.length,
    page,
    totalPages: Math.ceil(ranked.length / LIST_SIZE),
    aggregations: {},
  };
}

const namedRecord = z.object({
  id: z.union([z.number(), z.string()]),
  title: textField,
});

export interface ArtistType {
  id: number;
  title: string;
  count: number;
}

/** Kinds of artist record (individual, culture, collective…) that have artists in them. */
export async function getArtistTypes(): Promise<ArtistType[]> {
  const [types, counts] = await Promise.all([
    aicGet("/agent-types?limit=50&fields=id,title", {
      revalidate: REVALIDATE_REFERENCE,
    }),
    searchRecords("agents", z.unknown(), {
      filter: [{ term: { is_artist: true } }],
      limit: 0,
      aggs: { types: { terms: { field: "agent_type_id", size: 40 } } },
    }),
  ]);
  const count = new Map(
    bucketsOf(counts.aggregations, "types").map((b) => [b.key, b.doc_count]),
  );
  return toRecordPage(types, namedRecord, 50)
    .items.flatMap((raw) => {
      const title = plainTitle(raw.title, 60);
      const artists = count.get(raw.id) ?? 0;
      return title && typeof raw.id === "number" && artists >= 10
        ? [{ id: raw.id, title, count: artists }]
        : [];
    })
    .sort((a, b) => b.count - a.count);
}

/* Classification ------------------------------------------------------------------------- */

export const TERM_FACETS = {
  departments: { subtype: "department", field: "department_id" },
  classifications: { subtype: "classification", field: "classification_ids" },
  materials: { subtype: "material", field: "material_ids" },
  techniques: { subtype: "technique", field: "technique_ids" },
  styles: { subtype: "style", field: "style_ids" },
  subjects: { subtype: "subject", field: "subject_ids" },
  themes: { subtype: "theme", field: "category_ids" },
} as const;

export type TermFacet = keyof typeof TERM_FACETS;

export const WORK_FACETS = ["types", ...Object.keys(TERM_FACETS)] as (
  TermFacet | "types"
)[];
export type WorkFacet = (typeof WORK_FACETS)[number];

export const BROWSE_FACETS = [...WORK_FACETS, "places", "vocabulary"] as const;
export type BrowseFacet = WorkFacet | "places" | "vocabulary";

export function isBrowseFacet(value: string): value is BrowseFacet {
  return (BROWSE_FACETS as readonly string[]).includes(value);
}

export function isWorkFacet(value: string): value is WorkFacet {
  return (WORK_FACETS as readonly string[]).includes(value);
}

const isTermFacet = (facet: WorkFacet): facet is TermFacet => facet !== "types";

export interface FacetTerm {
  id: string;
  title: string;
  /** Public-domain works; unknown on keyword results. */
  works: number | null;
}

const rawTerm = z.object({
  id: z.union([z.string(), z.number()]),
  title: textField,
  subtype: textField,
});

const TERM_ID = /^(TM|PC)-\d{1,7}$/;

/** A valid id for this facet, as it appears in a URL. */
export function parseFacetId(facet: WorkFacet, value: string): string | null {
  if (facet === "types") return /^\d{1,4}$/.test(value) ? value : null;
  return TERM_ID.test(value) ? value : null;
}

/** The API returns at most 100 records per request. */
const FACET_TERMS = 100;

/** Titles for ranked ids, keeping the ranking. */
async function titledTerms(
  buckets: { key: string | number; doc_count: number }[],
): Promise<FacetTerm[]> {
  const titled = await readByIds(
    "category-terms",
    buckets.map((b) => b.key),
    rawTerm,
    "id,title,subtype",
  );
  const titles = new Map(
    titled.map((t) => [String(t.id), plainTitle(t.title, 100)]),
  );
  return buckets.flatMap((bucket) => {
    const title = titles.get(String(bucket.key));
    return title
      ? [{ id: String(bucket.key), title, works: bucket.doc_count }]
      : [];
  });
}

async function typeTerms(): Promise<FacetTerm[]> {
  const [types, aggregations] = await Promise.all([
    aicGet("/artwork-types?limit=60&fields=id,title", {
      revalidate: REVALIDATE_REFERENCE,
    }),
    countWorks({ types: { field: "artwork_type_id", size: 60 } }),
  ]);
  const works = new Map(
    bucketsOf(aggregations, "types").map((b) => [b.key, b.doc_count]),
  );
  return toRecordPage(types, namedRecord, 60)
    .items.flatMap((raw) => {
      const title = plainTitle(raw.title, 100);
      const count = works.get(raw.id) ?? 0;
      return title && count > 0
        ? [{ id: String(raw.id), title, works: count }]
        : [];
    })
    .sort((a, b) => (b.works ?? 0) - (a.works ?? 0));
}

async function themeTerms(): Promise<FacetTerm[]> {
  const [themes, aggregations] = await Promise.all([
    searchRecords("category-terms", rawTerm, {
      filter: [{ term: { subtype: "theme" } }],
      fields: "id,title,subtype",
      limit: 40,
    }),
    countWorks({ categories: { field: "category_ids", size: 400 } }),
  ]);
  const works = new Map(
    bucketsOf(aggregations, "categories").map((b) => [b.key, b.doc_count]),
  );
  return themes.items
    .flatMap((raw) => {
      const title = plainTitle(raw.title, 100);
      const count = works.get(raw.id) ?? 0;
      return title && count > 0
        ? [{ id: String(raw.id), title, works: count }]
        : [];
    })
    .sort((a, b) => (b.works ?? 0) - (a.works ?? 0));
}

/** The terms of a facet with the most public-domain works, or those matching a keyword. */
export async function getFacetTerms(
  facet: WorkFacet,
  keyword: string,
): Promise<FacetTerm[]> {
  if (facet === "types") {
    const terms = await typeTerms();
    const needle = keyword.toLowerCase();
    return needle
      ? terms.filter((term) => term.title.toLowerCase().includes(needle))
      : terms;
  }
  if (keyword) {
    const found = await searchRecords("category-terms", rawTerm, {
      keyword,
      filter: [{ term: { subtype: TERM_FACETS[facet].subtype } }],
      fields: "id,title,subtype",
      limit: 60,
    });
    return found.items.flatMap((raw) => {
      const title = plainTitle(raw.title, 100);
      return title ? [{ id: String(raw.id), title, works: null }] : [];
    });
  }
  if (facet === "themes") return themeTerms();
  const aggregations = await countWorks({
    terms: { field: TERM_FACETS[facet].field, size: FACET_TERMS },
  });
  return titledTerms(bucketsOf(aggregations, "terms"));
}

/** One term's name and the filter that finds its works, or null when it doesn't exist. */
export async function getFacetTerm(
  facet: WorkFacet,
  id: string,
): Promise<{
  title: string;
  term: { field: string; value: string | number };
} | null> {
  if (!isTermFacet(facet)) {
    const raw = await readRecord(
      `/artwork-types/${id}?fields=id,title`,
      namedRecord,
    );
    const title = plainTitle(raw?.title, 100);
    return title
      ? { title, term: { field: "artwork_type_id", value: Number(id) } }
      : null;
  }
  const raw = await readRecord(
    `/category-terms/${id}?fields=id,title,subtype`,
    rawTerm,
  );
  const title = plainTitle(raw?.title, 100);
  if (!title || raw?.subtype !== TERM_FACETS[facet].subtype) return null;
  // Works carry a whole department tree in category_ids, sub-departments included.
  const field =
    facet === "departments" ? "category_ids" : TERM_FACETS[facet].field;
  return { title, term: { field, value: id } };
}

export interface BrowseOverview {
  samples: Partial<Record<WorkFacet, FacetTerm[]>>;
}

const SAMPLE_SIZE = 7;

/** A few leading terms per facet, for the browse landing page. */
export async function getBrowseOverview(): Promise<BrowseOverview> {
  const facets = (Object.keys(TERM_FACETS) as TermFacet[]).filter(
    (facet) => facet !== "themes",
  );
  const [aggregations, types, themes] = await Promise.all([
    countWorks(
      Object.fromEntries(
        facets.map((facet) => [
          facet,
          { field: TERM_FACETS[facet].field, size: SAMPLE_SIZE },
        ]),
      ),
    ),
    typeTerms(),
    themeTerms(),
  ]);
  const buckets = facets.map((facet) => ({
    facet,
    buckets: bucketsOf(aggregations, facet),
  }));
  const terms = await titledTerms(buckets.flatMap((entry) => entry.buckets));
  const byId = new Map(terms.map((term) => [term.id, term]));
  const samples: BrowseOverview["samples"] = {
    types: types.slice(0, SAMPLE_SIZE),
    themes: themes.slice(0, SAMPLE_SIZE),
  };
  for (const entry of buckets)
    samples[entry.facet] = entry.buckets.flatMap((bucket) => {
      const term = byId.get(String(bucket.key));
      return term ? [term] : [];
    });
  return { samples };
}

/* Places --------------------------------------------------------------------------------- */

const rawPlace = z.object({
  id: z.number().int(),
  title: textField,
  tgn_id: z.number().int().nullish().catch(null),
});

export interface PlaceRow {
  /** The name as filed on works, used for the collection filter. */
  key: string;
  title: string;
  works: number;
  /** Getty Thesaurus of Geographic Names record. */
  tgnUrl: string | null;
}

const titleCase = (value: string) =>
  value.replace(
    /(^|[\s,(-])(\p{L})/gu,
    (_, gap: string, letter: string) => `${gap}${letter.toUpperCase()}`,
  );

/** Places of origin with works on this site, or the museum's place records for a keyword. */
export async function getPlaceRows(keyword: string): Promise<PlaceRow[]> {
  const aggregations = await countWorks({
    places: { field: PLACE_FIELD, size: 300 },
  });
  const works = new Map(
    bucketsOf(aggregations, "places").map((b) => [
      String(b.key).toLowerCase(),
      b.doc_count,
    ]),
  );
  if (!keyword)
    return [...works.entries()].map(([key, count]) => ({
      key,
      title: titleCase(key),
      works: count,
      tgnUrl: null,
    }));
  const found = await searchRecords("places", rawPlace, {
    keyword,
    fields: "id,title,tgn_id",
    limit: 60,
  });
  const seen = new Set<string>();
  return found.items.flatMap((raw) => {
    const title = plainTitle(raw.title, 120);
    const key = title?.toLowerCase();
    if (!title || !key || seen.has(key)) return [];
    seen.add(key);
    return [
      {
        key,
        title,
        works: works.get(key) ?? 0,
        tgnUrl: raw.tgn_id
          ? `https://vocab.getty.edu/page/tgn/${raw.tgn_id}`
          : null,
      },
    ];
  });
}

/* Vocabularies --------------------------------------------------------------------------- */

export interface Vocabulary {
  name: "agentTypes" | "agentRoles" | "dateQualifiers" | "placeQualifiers";
  terms: string[];
}

const VOCABULARIES = [
  ["agentTypes", "agent-types"],
  ["agentRoles", "agent-roles"],
  ["dateQualifiers", "artwork-date-qualifiers"],
  ["placeQualifiers", "artwork-place-qualifiers"],
] as const;

/** The museum's controlled word lists, alphabetically. */
export async function getVocabularies(): Promise<Vocabulary[]> {
  return Promise.all(
    VOCABULARIES.map(async ([name, resource]) => {
      const pages = await Promise.all(
        [1, 2].map((page) =>
          aicGet(`/${resource}?limit=100&page=${page}&fields=id,title`, {
            revalidate: REVALIDATE_REFERENCE,
          }),
        ),
      );
      const terms = new Set(
        pages.flatMap((json) =>
          toRecordPage(json, namedRecord, 100).items.flatMap((raw) => {
            const title = plainTitle(raw.title, 80)?.replace(/:$/, "");
            return title ? [title] : [];
          }),
        ),
      );
      return {
        name,
        terms: [...terms].sort((a, b) => a.localeCompare(b, "en")),
      };
    }),
  );
}
