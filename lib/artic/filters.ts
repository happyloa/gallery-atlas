/**
 * Upstream filter clauses for eras, colours and tags, and the reverse lookups (which era or
 * colour a single work belongs to). Pure functions, shared by search, artist and overview
 * requests so every part of the site files a work the same way.
 */
import { COLORS, ERAS, TAG_FIELDS, VIVID } from "./config";
import type { ColorSlug, EraSlug, TagKind } from "./config";

type Clause = Record<string, unknown>;

/** Works shown anywhere on the site: public domain, with an image. */
export const DISPLAYABLE: Clause[] = [
  { term: { is_public_domain: true } },
  { exists: { field: "image_id" } },
];

export function eraClause(slug: EraSlug): Clause {
  const era = ERAS.find((e) => e.slug === slug);
  const range: Record<string, number> = {};
  if (era?.from != null) range.gte = era.from;
  if (era?.to != null) range.lt = era.to;
  return { range: { date_start: range } };
}

/** Only colours vivid enough to name: excludes greys, near-blacks and paper whites. */
export const VIVID_CLAUSES: Clause[] = [
  { range: { "color.s": { gte: VIVID.minSaturation } } },
  {
    range: {
      "color.l": { gte: VIVID.minLightness, lte: VIVID.maxLightness },
    },
  },
];

export function colorClauses(slug: ColorSlug): Clause[] {
  const color = COLORS.find((c) => c.slug === slug);
  if (!color) return [];
  // Hue 360 is the same as 0; `lt: 361` keeps it in the red range that ends there.
  const hues = color.hues.map(([from, to]) => ({
    range: { "color.h": { gte: from, lt: to === 360 ? 361 : to } },
  }));
  const hue =
    hues.length === 1
      ? hues[0]
      : { bool: { should: hues, minimum_should_match: 1 } };
  return [hue, ...VIVID_CLAUSES];
}

export function tagClause(kind: TagKind, value: string): Clause {
  return { term: { [TAG_FIELDS[kind]]: value } };
}

/** The era a work begun in `year` belongs to. */
export function eraForYear(year: number | null | undefined): EraSlug | null {
  if (typeof year !== "number" || !Number.isFinite(year)) return null;
  const era = ERAS.find(
    (e) => (e.from == null || year >= e.from) && (e.to == null || year < e.to),
  );
  return era?.slug ?? null;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** The colour filter a dominant colour falls under, or null when it is too muted to name. */
export function colorForHsl(hsl: Hsl | null | undefined): ColorSlug | null {
  if (!hsl) return null;
  const { h, s, l } = hsl;
  if (
    s < VIVID.minSaturation ||
    l < VIVID.minLightness ||
    l > VIVID.maxLightness
  )
    return null;
  const hue = ((h % 360) + 360) % 360;
  const color = COLORS.find((c) =>
    c.hues.some(
      ([from, to]) => hue >= from && (to === 360 ? hue <= 360 : hue < to),
    ),
  );
  return color?.slug ?? null;
}

/** Sums 5° hue histogram buckets into colour totals. */
export function colorCountsFromHues(
  buckets: readonly { key: number; doc_count: number }[],
): Record<ColorSlug, number> {
  const counts = Object.fromEntries(COLORS.map((c) => [c.slug, 0])) as Record<
    ColorSlug,
    number
  >;
  for (const bucket of buckets) {
    const slug = colorForHsl({
      h: bucket.key,
      s: VIVID.minSaturation,
      l: VIVID.minLightness,
    });
    if (slug) counts[slug] += bucket.doc_count;
  }
  return counts;
}
