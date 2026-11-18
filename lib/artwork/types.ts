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
  /** IIIF image information (info.json) for deep zoom, on the museum's own host. */
  tileSource: string | null;
  /** The museum's artist record, for the artist page. */
  artistId: number | null;
  /** Era filter the work's start date falls in. */
  era: EraSlug | null;
  /** Dominant colour, as CSS, and the colour filter it falls under (null when muted). */
  dominantColor: { css: string; slug: ColorSlug | null } | null;
  /** The museum's own tags, each usable as an exact search filter. */
  tags: Record<TagKind, string[]>;
  /** Hanging at the museum in Chicago right now, and where. */
  onView: { gallery: string | null; galleryId: number | null } | null;
  /** Recordings the museum links to this work (audio guide stops, talks). */
  soundIds: string[];
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

/** An audio recording from the museum (hotlinked from artic.edu). */
export interface Sound {
  id: string;
  title: string;
  /** The audio guide stop number, when the recording is one. */
  stop: number | null;
  src: string;
}

/** A gallery (room) in the museum's building in Chicago. */
export interface Gallery {
  id: number;
  name: string;
  number: string | null;
  floor: string | null;
  isClosed: boolean;
}

/** An exhibition the museum has held or plans to hold. */
export interface MuseumExhibition {
  id: number;
  title: string;
  summary: TextRun[][] | null;
  /** ISO dates (YYYY-MM-DD); either may be missing. */
  start: string | null;
  end: string | null;
  gallery: { id: number | null; name: string } | null;
  artworkIds: number[];
  sourceUrl: string;
}

/** An article or publication on artic.edu, linked as further reading. */
export interface ReadingItem {
  kind: "article" | "publication";
  title: string;
  url: string;
}

/** One recording of an audio tour, in English and sometimes in Mandarin. */
export interface TourRecording {
  /** mobile-sounds id. */
  soundId: number;
  title: string;
  src: string | null;
  zhSrc: string | null;
  zhTitle: string | null;
  transcript: TextRun[][] | null;
}

export interface TourStop extends TourRecording {
  number: number;
  /** The number visitors key in at the museum. */
  code: string | null;
  /** The work discussed, when it is public domain. */
  artwork: Artwork | null;
  /** Where the work hangs right now. */
  gallery: { id: number | null; name: string } | null;
}

export interface TourSummary {
  id: number;
  title: string;
  zhTitle: string | null;
  description: TextRun[][] | null;
  zhDescription: string | null;
  minutes: number | null;
  stopCount: number;
  hasChinese: boolean;
  cover: Artwork | null;
}

export interface Tour extends TourSummary {
  intro: TextRun[][] | null;
  introRecording: TourRecording | null;
  stops: TourStop[];
}
