import type { ColorSlug, EraSlug, TagKind } from "@/lib/artic/config";

/**
 * Domain model used by the UI. Components never read the raw Art Institute of
 * Chicago API shape; the server maps and validates upstream data into these types.
 */

/** IIIF widths the AIC image server allows. 1200 and 1686 are public-domain only. */
export type IiifWidth = 200 | 400 | 600 | 843 | 1200 | 1686;

export interface ArtworkImage {
  /** Default display URL (843px wide, the size AIC recommends). */
  src: string;
  /** Width-descriptor srcset built only from allowed IIIF widths. */
  srcSet: string;
  /** Intrinsic width / height. Falls back to 4 / 5 when the API omits dimensions. */
  aspectRatio: number;
  alt: string;
  /** Tiny base64 preview from the API (`thumbnail.lqip`), shown while the image loads. */
  placeholder?: string | null;
}

export interface Artwork {
  id: number;
  title: string;
  /** "Artist unknown" when the API has no artist. */
  artist: string;
  dateDisplay: string | null;
  type: string | null;
  medium: string | null;
  dimensions: string | null;
  origin: string | null;
  creditLine: string | null;
  image: ArtworkImage;
  /** Canonical page on artic.edu, built from the numeric id only. */
  sourceUrl: string;
  isPublicDomain: true;
}

/** A run of description text; `italic` marks titles and foreign words (<em> upstream). */
export interface TextRun {
  text: string;
  italic: boolean;
}

/** What the detail page shows beyond a card. */
export interface ArtworkDetail extends Artwork {
  /** Artist with nationality and dates, e.g. "Georges Seurat (French, 1859–1891)". May hold line breaks. */
  artistDisplay: string | null;
  /** The museum's description as plain paragraphs (CC BY 4.0; credit it wherever shown). */
  description: TextRun[][] | null;
  /** The largest image the museum allows for public-domain works (1686px wide). */
  zoomSrc: string | null;
  /** The museum's artist record, for the artist page. */
  artistId: number | null;
  /** Era filter the work's start date falls in. */
  era: EraSlug | null;
  /** Dominant colour, as CSS, and the colour filter it falls under (null when muted). */
  dominantColor: { css: string; slug: ColorSlug | null } | null;
  /** The museum's own tags, each usable as an exact search filter. */
  tags: Record<TagKind, string[]>;
  /** Hanging at the museum in Chicago right now, and where. */
  onView: { gallery: string | null } | null;
  /** The object record, as paragraphs of plain text (CC0 metadata). */
  record: {
    inscriptions: string[] | null;
    provenance: string[] | null;
    exhibitions: string[] | null;
    publications: string[] | null;
  };
}

/** An artist (AIC agent) with a public page on this site. */
export interface Artist {
  id: number;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  /** The museum's biography (CC BY 4.0; credit it wherever shown). */
  description: TextRun[][] | null;
  /** The artist's page on artic.edu. */
  sourceUrl: string;
}
