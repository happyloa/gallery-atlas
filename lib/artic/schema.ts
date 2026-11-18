/**
 * Zod schemas for the parts of AIC API responses this site reads. Upstream data is not
 * trusted: every field is optional or nullable here, and records are validated one by one
 * so a single malformed work cannot take down a whole page.
 */
import { z } from "zod";

const text = z.string().nullish();

export const rawThumbnailSchema = z
  .object({
    width: z.number().nullish(),
    height: z.number().nullish(),
    alt_text: text,
    lqip: text,
  })
  .nullish();

export const rawArtworkSchema = z.object({
  id: z.number().int().positive(),
  title: text,
  artist_title: text,
  artist_display: text,
  date_display: text,
  artwork_type_title: text,
  medium_display: text,
  dimensions: text,
  place_of_origin: text,
  image_id: text,
  is_public_domain: z.boolean().nullish(),
  thumbnail: rawThumbnailSchema,
  credit_line: text,
  description: text,
});

export type RawArtwork = z.infer<typeof rawArtworkSchema>;

/** Optional extras on a detail record. A malformed field becomes null on its own. */
const lenient = <T extends z.ZodType>(schema: T) => schema.nullish().catch(null);
const tagList = lenient(z.array(z.unknown()));

export const rawArtworkExtrasSchema = z.object({
  artist_id: lenient(z.number().int().positive()),
  date_start: lenient(z.number().int()),
  color: lenient(
    z.object({
      h: z.number().min(0).max(360),
      s: z.number().min(0).max(100),
      l: z.number().min(0).max(100),
    }),
  ),
  style_titles: tagList,
  subject_titles: tagList,
  theme_titles: tagList,
  is_on_view: lenient(z.boolean()),
  gallery_title: lenient(z.string()),
  inscriptions: lenient(z.string()),
  provenance_text: lenient(z.string()),
  exhibition_history: lenient(z.string()),
  publication_history: lenient(z.string()),
  gallery_id: lenient(z.number().int()),
  sound_ids: tagList,
});

export const rawArtistSchema = z.object({
  id: z.number().int().positive(),
  title: text,
  birth_date: lenient(z.number().int()),
  death_date: lenient(z.number().int()),
  description: text,
});

const countBucket = z.object({ doc_count: z.number().int().nonnegative() });

/** Aggregation answers for the homepage overview (see overviewPath and huesPath). */
export const overviewResponseSchema = z.object({
  pagination: z.object({ total: z.number().int().nonnegative() }),
  aggregations: z.object({
    entrances: z.object({ buckets: z.record(z.string(), countBucket) }),
    eras: z.object({
      buckets: z.array(countBucket.extend({ key: z.string() })),
    }),
  }),
});

export const huesResponseSchema = z.object({
  aggregations: z.object({
    hues: z.object({
      buckets: z.array(countBucket.extend({ key: z.number() })),
    }),
  }),
});

export const rawConfigSchema = z
  .object({
    iiif_url: text,
    website_url: text,
  })
  .nullish();

export const paginationSchema = z.object({
  total: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  current_page: z.number().int().positive(),
  total_pages: z.number().int().nonnegative(),
});

/** Records stay `unknown` until each is validated on its own by the mapper. */
export const searchResponseSchema = z.object({
  pagination: paginationSchema,
  data: z.array(z.unknown()),
  config: rawConfigSchema,
});

export const listResponseSchema = z.object({
  data: z.array(z.unknown()),
  config: rawConfigSchema,
});

export const detailResponseSchema = z.object({
  data: z.unknown(),
  config: rawConfigSchema,
});
