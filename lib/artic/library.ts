/**
 * The museum's writing: articles, highlights, scholarly catalogues and their entries,
 * digital and printed publications, educator resources, press releases and web pages.
 * All of it is © the Art Institute of Chicago, for noncommercial educational use with
 * credit, so every detail page cites its source.
 */
import { z } from "zod";
import { aicGet } from "./client";
import { museumArticleUrl } from "./config";
import { plainTitle } from "./museum";
import {
  articUrl,
  excerpt,
  intField,
  LIST_SIZE,
  listField,
  paramsPath,
  parseCatalogueEntry,
  parseCopy,
  readableSlug,
  readByIds,
  readRecord,
  searchParamsFor,
  searchRecords,
  textField,
  toRecordPage,
} from "./records";
import type { BodySection, RecordPage } from "./records";

export const LIBRARY_KINDS = [
  "articles",
  "highlights",
  "catalogues",
  "catalogue-entries",
  "digital-publications",
  "essays",
  "print-publications",
  "educator-resources",
  "press-releases",
  "pages",
  "landing-pages",
] as const;

export type LibraryKind = (typeof LIBRARY_KINDS)[number];

interface KindConfig {
  resource: string;
  fields: string;
  /** Text fields the keyword search looks in. */
  searchIn: string[];
  /** Whether list rows carry the opening lines of the text. */
  withExcerpt?: boolean;
}

const COPY_FIELDS = "id,title,web_url,copy";
const IN_COPY = ["title^4", "copy"];

const KINDS: Record<LibraryKind, KindConfig> = {
  articles: {
    resource: "articles",
    fields: "id,title,copy",
    searchIn: IN_COPY,
    withExcerpt: true,
  },
  highlights: {
    resource: "highlights",
    fields: "id,title,copy",
    searchIn: IN_COPY,
    withExcerpt: true,
  },
  catalogues: {
    resource: "publications",
    fields: "id,title,web_url,section_ids",
    searchIn: ["title"],
  },
  "catalogue-entries": {
    resource: "sections",
    fields:
      "id,title,web_url,content,artwork_id,publication_id,publication_title",
    searchIn: ["title^4", "publication_title", "content"],
  },
  "digital-publications": {
    resource: "digital-publications",
    fields: COPY_FIELDS,
    searchIn: IN_COPY,
    withExcerpt: true,
  },
  essays: {
    resource: "digital-publication-articles",
    fields: "id,title,web_url,copy,author_display,digital_publication_id",
    searchIn: ["title^4", "author_display", "copy"],
  },
  "print-publications": {
    resource: "printed-publications",
    fields: COPY_FIELDS,
    searchIn: IN_COPY,
    withExcerpt: true,
  },
  "educator-resources": {
    resource: "educator-resources",
    fields: COPY_FIELDS,
    searchIn: IN_COPY,
    withExcerpt: true,
  },
  "press-releases": {
    resource: "press-releases",
    fields: COPY_FIELDS,
    searchIn: IN_COPY,
  },
  pages: { resource: "generic-pages", fields: COPY_FIELDS, searchIn: IN_COPY },
  "landing-pages": {
    resource: "landing-pages",
    fields: COPY_FIELDS,
    searchIn: IN_COPY,
  },
};

/** Which library kind shows a record of this API resource. */
export const KIND_OF_RESOURCE: Record<string, LibraryKind> = Object.fromEntries(
  LIBRARY_KINDS.map((kind) => [KINDS[kind].resource, kind]),
);

export function isLibraryKind(value: string): value is LibraryKind {
  return (LIBRARY_KINDS as readonly string[]).includes(value);
}

const rawEntry = z.object({
  id: z.number().int().positive(),
  title: textField,
  copy: textField,
  content: textField,
  web_url: textField,
  author_display: textField,
  artwork_id: intField,
  publication_id: intField,
  publication_title: textField,
  digital_publication_id: intField,
  section_ids: listField,
});

type RawEntry = z.infer<typeof rawEntry>;

function titleOf(kind: LibraryKind, raw: RawEntry): string | null {
  const title = plainTitle(raw.title, 240);
  return title && kind === "highlights" ? readableSlug(title) : title;
}

function sourceOf(kind: LibraryKind, raw: RawEntry): string {
  if (kind === "articles") return museumArticleUrl(raw.id);
  if (kind === "highlights")
    return `https://www.artic.edu/highlights/${raw.id}`;
  return articUrl(raw.web_url) ?? "https://www.artic.edu";
}

export interface LibraryRow {
  id: number;
  title: string;
  excerpt: string | null;
  context: string | null;
}

export async function getLibraryList(
  kind: LibraryKind,
  { keyword, page }: { keyword: string; page: number },
): Promise<RecordPage<LibraryRow>> {
  const config = KINDS[kind];
  const fields = config.withExcerpt
    ? config.fields
    : config.fields.replace(/,(copy|content)\b/g, "");
  const result = await searchRecords(config.resource, rawEntry, {
    keyword,
    keywordFields: config.searchIn,
    // Newest first, unless a keyword asks for the closest matches.
    sort: keyword ? undefined : [{ id: "desc" }],
    fields,
    limit: LIST_SIZE,
    page,
  });
  return {
    ...result,
    items: result.items.flatMap((raw) => {
      const title = titleOf(kind, raw);
      if (!title) return [];
      return [
        {
          id: raw.id,
          title,
          excerpt: config.withExcerpt ? excerpt(parseCopy(raw.copy)) : null,
          context: plainTitle(raw.publication_title, 160),
        },
      ];
    }),
  };
}

export interface LibraryLink {
  kind: LibraryKind;
  id: number;
  title: string;
}

export interface LibraryEntry {
  kind: LibraryKind;
  id: number;
  title: string;
  author: string | null;
  body: BodySection[];
  sourceUrl: string;
  artworkId: number | null;
  /** The publication this text belongs to. */
  parent: LibraryLink | null;
  /** The texts inside this publication, in reading order. */
  contents: LibraryLink[];
}

const linkRow = z.object({ id: z.number().int().positive(), title: textField });

/** A catalogue's table of contents. Requests stay short enough for the museum's CDN. */
const CONTENT_CHUNK = 60;
const MAX_CONTENTS = 480;

async function catalogueContents(
  ids: readonly unknown[],
): Promise<LibraryLink[]> {
  const valid = ids
    .filter(
      (id): id is number => Number.isSafeInteger(id) && (id as number) > 0,
    )
    .slice(0, MAX_CONTENTS);
  const links: LibraryLink[] = [];
  for (let start = 0; start < valid.length; start += CONTENT_CHUNK) {
    const rows = await readByIds(
      "sections",
      valid.slice(start, start + CONTENT_CHUNK),
      linkRow,
      "id,title",
    );
    for (const row of rows) {
      const title = plainTitle(row.title, 200);
      if (title) links.push({ kind: "catalogue-entries", id: row.id, title });
    }
  }
  return links;
}

async function publicationEssays(id: number): Promise<LibraryLink[]> {
  const result = await searchRecords("digital-publication-articles", linkRow, {
    filter: [{ term: { digital_publication_id: id } }],
    sort: [{ id: "asc" }],
    fields: "id,title",
    limit: 100,
  }).catch(() => null);
  return (result?.items ?? []).flatMap((row) => {
    const title = plainTitle(row.title, 200);
    return title ? [{ kind: "essays" as const, id: row.id, title }] : [];
  });
}

async function parentOf(
  kind: LibraryKind,
  raw: RawEntry,
): Promise<LibraryLink | null> {
  if (kind === "catalogue-entries" && raw.publication_id) {
    const title = plainTitle(raw.publication_title, 200);
    return title ? { kind: "catalogues", id: raw.publication_id, title } : null;
  }
  if (kind === "essays" && raw.digital_publication_id) {
    const parent = await readRecord(
      `/digital-publications/${raw.digital_publication_id}?fields=id,title`,
      linkRow,
    ).catch(() => null);
    const title = plainTitle(parent?.title, 200);
    return title
      ? { kind: "digital-publications", id: raw.digital_publication_id, title }
      : null;
  }
  return null;
}

export async function getLibraryEntry(
  kind: LibraryKind,
  id: number,
): Promise<LibraryEntry | null> {
  const config = KINDS[kind];
  const raw = await readRecord(
    `/${config.resource}/${id}?fields=${config.fields}`,
    rawEntry,
  );
  const title = raw ? titleOf(kind, raw) : null;
  if (!raw || !title) return null;

  const paragraphs = parseCopy(raw.copy);
  const body =
    kind === "catalogue-entries"
      ? parseCatalogueEntry(raw.content)
      : paragraphs
        ? [{ heading: null, paragraphs }]
        : [];
  const [parent, contents] = await Promise.all([
    parentOf(kind, raw),
    kind === "catalogues"
      ? catalogueContents(raw.section_ids ?? [])
      : kind === "digital-publications"
        ? publicationEssays(id)
        : Promise.resolve([]),
  ]);
  return {
    kind,
    id,
    title,
    author: plainTitle(raw.author_display, 200),
    body,
    sourceUrl: sourceOf(kind, raw),
    artworkId: raw.artwork_id && raw.artwork_id > 0 ? raw.artwork_id : null,
    parent,
    contents,
  };
}

const staticPage = z.object({
  id: z.number().int(),
  title: textField,
  web_url: textField,
});

const kindCounts = z.object({
  kinds: z.object({
    buckets: z.array(
      z.object({ key: z.string(), doc_count: z.number().int() }),
    ),
  }),
});

export interface LibraryOverview {
  counts: Partial<Record<LibraryKind, number>>;
  /** The museum's own section pages, which hold no text of their own. */
  sections: { id: number; title: string; url: string }[];
}

/** Record counts for every kind in one request, and the museum's section pages. */
export async function getLibraryOverview(): Promise<LibraryOverview> {
  const resources = LIBRARY_KINDS.map((kind) => KINDS[kind].resource).join(",");
  const params = {
    ...searchParamsFor({
      limit: 0,
      aggs: { kinds: { terms: { field: "api_model", size: 20 } } },
    }),
    resources,
  };
  const [countsJson, pagesJson] = await Promise.all([
    aicGet(paramsPath("/search", params), { revalidate: 86_400 }),
    aicGet("/static-pages?limit=20&fields=id,title,web_url", {
      revalidate: 86_400,
    }),
  ]);
  const buckets =
    kindCounts.safeParse(toRecordPage(countsJson, z.unknown(), 0).aggregations)
      .data?.kinds.buckets ?? [];
  const counts: LibraryOverview["counts"] = {};
  for (const bucket of buckets) {
    const kind = KIND_OF_RESOURCE[bucket.key];
    if (kind) counts[kind] = bucket.doc_count;
  }
  const sections = toRecordPage(pagesJson, staticPage, 20).items.flatMap(
    (raw) => {
      const title = plainTitle(raw.title, 120);
      const url = articUrl(
        raw.web_url?.startsWith("/")
          ? `https://www.artic.edu${raw.web_url}`
          : raw.web_url,
      );
      return title && url ? [{ id: raw.id, title, url }] : [];
    },
  );
  return { counts, sections };
}
