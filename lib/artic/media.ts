/**
 * The museum's media library (recordings, documents, videos, microsites) and the media
 * linked to a single work. Files stay on the museum's servers.
 */
import { z } from "zod";
import type { ArtworkDetail, ArtworkImage } from "@/lib/artwork/types";
import { aicGet } from "./client";
import { REVALIDATE_REFERENCE } from "./config";
import {
  aspectRatioFrom,
  buildArtworkImage,
  resolveIiifBase,
  safePlaceholder,
} from "./images";
import { plainTitle } from "./museum";
import {
  articUrl,
  cleanFileTitle,
  excerpt,
  intField,
  LIST_SIZE,
  listField,
  parseCopy,
  readByIds,
  searchRecords,
  textField,
  toRecordPage,
  webUrl,
} from "./records";
import type { RecordPage } from "./records";

export const MEDIA_KINDS = ["sounds", "documents", "videos", "sites"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export function isMediaKind(value: string): value is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(value);
}

const RESOURCES: Record<MediaKind, string> = {
  sounds: "sounds",
  documents: "texts",
  videos: "videos",
  sites: "sites",
};

const rawMedia = z.object({
  id: z.union([z.string(), z.number()]),
  title: textField,
  display_title: textField,
  content: textField,
  web_url: textField,
  description: textField,
  credit_line: textField,
  artwork_ids: listField,
  artwork_titles: listField,
});

const FIELDS: Record<MediaKind, string> = {
  sounds: "id,title,display_title,content,artwork_ids,artwork_titles",
  documents: "id,title,display_title,content,artwork_ids,artwork_titles",
  videos:
    "id,title,display_title,content,credit_line,artwork_ids,artwork_titles",
  sites: "id,title,description,web_url,artwork_ids,artwork_titles",
};

export interface MediaItem {
  id: string;
  title: string;
  description: string | null;
  url: string;
  artworks: { id: number; title: string }[];
}

export function toMediaItem(
  kind: MediaKind,
  raw: z.infer<typeof rawMedia>,
): MediaItem | null {
  const name = plainTitle(raw.display_title, 200) ?? plainTitle(raw.title, 200);
  const url = kind === "sites" ? webUrl(raw.web_url) : articUrl(raw.content);
  if (!name || !url) return null;
  const titles = raw.artwork_titles ?? [];
  return {
    id: String(raw.id),
    title: kind === "sites" ? name : cleanFileTitle(name),
    description: excerpt(parseCopy(raw.description), 240),
    url,
    artworks: (raw.artwork_ids ?? []).slice(0, 4).flatMap((id, index) => {
      const title = titles[index];
      return Number.isInteger(id) && typeof title === "string"
        ? [{ id: id as number, title: plainTitle(title, 120) ?? "" }]
        : [];
    }),
  };
}

export async function getMedia(
  kind: MediaKind,
  { keyword, page }: { keyword: string; page: number },
): Promise<RecordPage<MediaItem>> {
  const result = await searchRecords(RESOURCES[kind], rawMedia, {
    keyword,
    keywordFields: ["title^2", "display_title^2", "description"],
    fields: FIELDS[kind],
    limit: LIST_SIZE,
    page,
  });
  return {
    ...result,
    items: result.items.flatMap((raw) => {
      const item = toMediaItem(kind, raw);
      return item ? [item] : [];
    }),
  };
}

/* One work's related material ------------------------------------------------------------ */

const rawImage = z.object({
  id: z.string(),
  alt_text: textField,
  width: intField,
  height: intField,
  lqip: textField,
});

const rawSection = z.object({
  id: z.number().int().positive(),
  title: textField,
  publication_title: textField,
});

const MAX_VIEWS = 8;
const MAX_LINKED = 6;

export interface ArtworkResources {
  views: ArtworkImage[];
  catalogue: { id: number; title: string; publication: string | null }[];
  documents: MediaItem[];
  videos: MediaItem[];
  sites: MediaItem[];
}

/** Other photographs of a public-domain work. The caller has checked its status. */
async function alternateViews(artwork: ArtworkDetail): Promise<ArtworkImage[]> {
  const ids = artwork.related.imageIds.slice(0, MAX_VIEWS);
  if (ids.length === 0) return [];
  try {
    const json = await aicGet(
      `/images?ids=${ids.join(",")}&limit=${ids.length}&fields=id,alt_text,width,height,lqip`,
      { revalidate: REVALIDATE_REFERENCE, timeoutMs: 5000, retries: 1 },
    );
    const page = toRecordPage(json, rawImage, ids.length);
    const base = resolveIiifBase("https://www.artic.edu/iiif/2");
    if (!base) return [];
    return page.items.flatMap((raw) => {
      const image = buildArtworkImage({
        base,
        imageId: raw.id,
        aspectRatio: aspectRatioFrom(raw.width, raw.height),
        alt: plainTitle(raw.alt_text, 300) ?? artwork.image.alt,
        placeholder: safePlaceholder(raw.lqip),
      });
      return image ? [image] : [];
    });
  } catch {
    return [];
  }
}

export async function getArtworkResources(
  artwork: ArtworkDetail,
): Promise<ArtworkResources> {
  const linked = async (kind: MediaKind, ids: readonly (string | number)[]) =>
    (
      await readByIds(
        RESOURCES[kind],
        ids.slice(0, MAX_LINKED),
        rawMedia,
        FIELDS[kind],
      )
    ).flatMap((raw) => {
      const item = toMediaItem(kind, raw);
      return item ? [item] : [];
    });
  const { related } = artwork;
  const [views, sections, documents, videos, sites] = await Promise.all([
    alternateViews(artwork),
    readByIds(
      "sections",
      related.sectionIds.slice(0, MAX_LINKED),
      rawSection,
      "id,title,publication_title",
    ),
    linked("documents", related.textIds),
    linked("videos", related.videoIds),
    linked("sites", related.siteIds),
  ]);
  return {
    views,
    catalogue: sections.flatMap((raw) => {
      const title = plainTitle(raw.title, 200);
      return title
        ? [
            {
              id: raw.id,
              title,
              publication: plainTitle(raw.publication_title, 200),
            },
          ]
        : [];
    }),
    documents,
    videos,
    sites,
  };
}
