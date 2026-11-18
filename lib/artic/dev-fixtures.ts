/**
 * Offline stand-in for the AIC API, used ONLY when AIC_FIXTURES=1 outside production
 * (end-to-end tests, offline development). It answers the same paths aicGet builds, from
 * the dated snapshot in lib/fixtures, plus one non-public-domain record for the
 * "restricted" path. Production builds never enable it (see isFixtureMode in
 * fixture-mode.ts), and the client imports this file only once that says yes.
 *
 * Searches understand the clauses this site sends (terms, ranges, nested bools) and the
 * three aggregation kinds it asks for, so filters and homepage counts work offline too.
 */
import { previewArtworks } from "@/lib/fixtures/preview-artworks";
import { ARTWORK_TYPES, PLACE_FIELD } from "./config";
import { TOUR_INDEX } from "./tour-index";

const IIIF_URL = "https://www.artic.edu/iiif/2";

type Raw = Record<string, unknown> & {
  id: number;
  title: string;
  artist_title: string | null;
  artwork_type_title: string | null;
};

/** Tags, dates and colours copied from the live records (2026-11-18), trimmed. */
const EXTRAS: Record<number, Record<string, unknown>> = {
  27992: {
    artist_id: 40810,
    date_start: 1884,
    color: { h: 59, s: 12, l: 52 },
    style_titles: [
      "Pointillism",
      "19th century",
      "Post-Impressionism",
      "Impressionism",
    ],
    subject_titles: ["leisure", "landscape", "dogs"],
    theme_titles: ["Art Institute Icons", "Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 240",
    gallery_id: 2147478672,
    sound_ids: ["d9683532-66fd-67c3-5588-021527d115af"],
    alt_titles: ["La Grande Jatte"],
    main_reference_number: "1926.224",
    department_id: "PC-10",
    department_title: "Painting and Sculpture of Europe",
    category_ids: ["PC-10", "PC-831"],
    classification_ids: ["TM-66"],
    material_ids: ["TM-2451"],
    technique_ids: ["TM-4273"],
    style_ids: ["TM-12045"],
    subject_ids: ["TM-10094"],
    alt_image_ids: ["6782523e-056b-ba22-69f9-b5f1b59efcb6"],
    video_ids: ["fae3fdc2-7a52-5fc4-c634-c2033f9b2a46"],
    text_ids: ["291ea679-3a7f-4281-2a1b-101299c77407"],
    section_ids: [36744351949],
    site_ids: [22],
    inscriptions: "Inscribed lower right: Seurat",
    provenance_text:
      "The artist; given to his mother, Paris, 1891.\nSold to Lucie Cousturier, Paris, 1900.",
    exhibition_history: "Paris, Société des Artistes Indépendants, 1886.",
    publication_history: "Jules Christophe, Georges Seurat (Paris, 1890).",
  },
  20684: {
    artist_id: 3829,
    date_start: 1877,
    color: { h: 205, s: 14, l: 51 },
    style_titles: ["Impressionism", "19th century"],
    subject_titles: ["urban life"],
    theme_titles: ["Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 201",
  },
  28560: {
    artist_id: 40610,
    date_start: 1889,
    color: { h: 40, s: 65, l: 34 },
    style_titles: ["Post-Impressionism", "19th century"],
    subject_titles: ["interiors"],
    theme_titles: ["Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 241",
  },
  16568: {
    artist_id: 35809,
    date_start: 1906,
    color: { h: 197, s: 41, l: 37 },
    style_titles: ["Impressionism", "20th Century"],
    subject_titles: ["landscapes"],
    theme_titles: ["Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 243",
  },
  64818: {
    artist_id: 35809,
    date_start: 1890,
    color: { h: 52, s: 47, l: 38 },
    style_titles: ["Impressionism", "19th century"],
    subject_titles: ["seasons"],
    theme_titles: ["Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 243",
  },
  14655: {
    artist_id: 36351,
    date_start: 1881,
    color: { h: 2, s: 55, l: 52 },
    style_titles: ["Impressionism", "19th century"],
    subject_titles: ["sisters"],
    theme_titles: ["Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 201",
  },
  111436: {
    artist_id: 40482,
    date_start: 1887,
    color: { h: 94, s: 4, l: 55 },
    style_titles: ["Post-Impressionism", "19th century"],
    subject_titles: ["still life"],
    theme_titles: ["Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 248",
  },
  80607: {
    artist_id: 40610,
    date_start: 1887,
    color: { h: 40, s: 16, l: 30 },
    style_titles: ["Post-Impressionism", "19th century"],
    subject_titles: ["portraits"],
    theme_titles: ["Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 241",
  },
  24645: {
    artist_id: 31492,
    date_start: 1826,
    color: { h: 235, s: 47, l: 50 },
    style_titles: ["Japanese (culture or style)", "19th century"],
    subject_titles: ["waves"],
    theme_titles: ["Essentials"],
    is_on_view: false,
  },
  16571: {
    artist_id: 35809,
    date_start: 1877,
    color: { h: 6, s: 53, l: 34 },
    style_titles: ["Impressionism", "19th century"],
    subject_titles: ["trains"],
    theme_titles: [],
    is_on_view: false,
  },
};

const SOUNDS = [
  {
    id: "d9683532-66fd-67c3-5588-021527d115af",
    title: "Audio stop 781.mp3",
    content:
      "https://www.artic.edu/assets/d9683532-66fd-67c3-5588-021527d115af",
  },
];

const GALLERIES: Record<number, Record<string, unknown>> = {
  2147478672: {
    id: 2147478672,
    title: "Gallery 240",
    number: "240",
    floor: "2",
    is_closed: false,
  },
  25084: {
    id: 25084,
    title: "Gallery 125",
    number: "125",
    floor: "1",
    is_closed: true,
  },
};

const EXHIBITIONS = [
  {
    id: 9001,
    title: "Seurat and His Circle",
    short_description:
      "<p>A fixture exhibition about <em>pointillism</em>.</p>",
    web_url: "https://www.artic.edu/exhibitions/9001/seurat-and-his-circle",
    aic_start_at: "2026-10-01T00:00:00-05:00",
    aic_end_at: "2099-01-10T00:00:00-06:00",
    gallery_id: 2147478672,
    gallery_title: "Gallery 240",
    artwork_ids: [27992, 28560, 111628],
  },
  {
    id: 9002,
    title: "Monet Water Garden",
    short_description: null,
    web_url: "https://www.artic.edu/exhibitions/9002/monet",
    aic_start_at: "2001-02-01T00:00:00-06:00",
    aic_end_at: "2001-05-01T00:00:00-05:00",
    gallery_id: null,
    gallery_title: null,
    artwork_ids: [16568, 64818],
  },
];

const ARTICLES = [
  {
    id: 826,
    title: "Caillebotte and Seurat: Setting the Stage for Masterworks",
  },
];

const AGENTS: Record<number, Record<string, unknown>> = {
  40810: {
    id: 40810,
    title: "Georges Seurat",
    birth_date: 1859,
    death_date: 1891,
    description:
      "<p>Fixture biography for <em>Georges Seurat</em>.</p><p>Second paragraph.</p>",
    alt_titles: ["Georges Pierre Seurat"],
    agent_type_id: 7,
    agent_type_title: "Individual",
    is_artist: true,
    ulan_id: 500008873,
    wikidata_id: "Q34013",
  },
  40610: {
    id: 40610,
    title: "Vincent van Gogh",
    birth_date: 1853,
    death_date: 1890,
    description: null,
    agent_type_id: 7,
    agent_type_title: "Individual",
    is_artist: true,
  },
  35809: {
    id: 35809,
    title: "Claude Monet",
    birth_date: 1840,
    death_date: 1926,
    description: null,
    agent_type_id: 7,
    agent_type_title: "Individual",
    is_artist: true,
  },
  2601: {
    id: 2601,
    title: "Ancient Greek",
    birth_date: null,
    death_date: null,
    description: null,
    agent_type_id: 2,
    agent_type_title: "Culture",
    is_artist: true,
  },
};

type FixtureRecord = Record<string, unknown>;

/**
 * A session starting this instant, so the museum's "today" always has something on it. An
 * hour ahead would land on tomorrow during the last hour of the day in Chicago.
 */
const soonOccurrence = (): FixtureRecord => ({
  id: "7fd63c7d-8353-55d2-af90-c832f2cf33d8",
  title: "Spotlight Talk: Seurat",
  title_display: "Spotlight Talk: <i>Seurat</i>",
  event_id: 6504,
  short_description: "A short talk in the galleries.",
  image_url:
    "https://artic-web.imgix.net/fixture/talk.jpg?rect=0%2C0%2C100%2C56&w=1200&h=675",
  start_at: new Date().toISOString(),
  end_at: new Date(Date.now() + 1_800_000).toISOString(),
  location: "Gallery 240",
  is_private: false,
});

/** The museum's other records, by API resource. */
const MUSEUM_RECORDS: Record<string, FixtureRecord[]> = {
  articles: [
    {
      id: 826,
      title: "Caillebotte and Seurat: Setting the Stage for Masterworks",
      copy: " The opening paragraph of a fixture article.   The second paragraph of a fixture article.",
    },
  ],
  highlights: [
    {
      id: 10,
      title: "visions-of-america",
      copy: " A fixture highlight about early American art.",
    },
  ],
  publications: [
    {
      id: 135466,
      title: "Monet Paintings and Drawings at the Art Institute of Chicago",
      web_url:
        "https://publications.artic.edu/monet/reader/paintingsanddrawings",
      section_ids: [36744351949],
    },
  ],
  sections: [
    {
      id: 36744351949,
      title: "Cat. 44  Water Lilies, 1906",
      web_url:
        "https://publications.artic.edu/monet/reader/paintingsanddrawings/section/135621",
      artwork_id: 16568,
      publication_id: 135466,
      publication_title:
        "Monet Paintings and Drawings at the Art Institute of Chicago",
      content:
        '<section class="osci-tk-epub-section tombstone" id="tombstone">Water Lilies  \n1906\n\n</section><section class="osci-tk-epub-section curatorial_entry" id="curatorial_entry">The fixture catalogue essay.\n\nIts second paragraph.</section><section class="osci-tk-epub-section provenance" id="provenance">Sold to the museum, 1933.</section><section id="figures"></section>',
    },
  ],
  "digital-publications": [
    {
      id: 34,
      title: "Malangatana: Mozambique Modern",
      web_url: "https://www.artic.edu/digital-publications/34/malangatana",
      copy: "<h1>Malangatana</h1><p>A fixture digital publication.</p>",
    },
  ],
  "digital-publication-articles": [
    {
      id: 9,
      title: "The Complete Painter",
      web_url: "https://www.artic.edu/digital-publications/34/malangatana/9",
      copy: " A fixture essay.",
      author_display: "Allison Langley",
      digital_publication_id: 34,
    },
  ],
  "printed-publications": [
    {
      id: 67,
      title: "Italian Paintings before 1600",
      web_url: "https://www.artic.edu/print-publications/67/italian-paintings",
      copy: " A fixture catalogue in print.",
    },
  ],
  "educator-resources": [
    {
      id: 177,
      title: "Color Your World: Get Creative",
      web_url: "https://www.artic.edu/educator-resources/177/color-your-world",
      copy: " A fixture teaching resource.",
    },
  ],
  "press-releases": [
    {
      id: 291,
      title: "Monet and Chicago",
      web_url:
        "https://www.artic.edu/press/press-releases/291/monet-and-chicago",
      copy: " A fixture press release about Monet.",
    },
  ],
  "generic-pages": [
    {
      id: 434,
      title: "Art-Making Activities",
      web_url: "https://www.artic.edu/art-making-activities",
      copy: " A fixture museum page.",
    },
  ],
  "landing-pages": [
    {
      id: 13,
      title: "Research Center",
      web_url: null,
      copy: " A fixture landing page.",
    },
  ],
  "static-pages": [{ id: 11, title: "Articles", web_url: "/articles" }],
  agents: Object.values(AGENTS),
  "agent-types": [
    { id: 7, title: "Individual" },
    { id: 2, title: "Culture" },
  ],
  "agent-roles": [{ id: 570, title: "Creator" }],
  "artwork-date-qualifiers": [{ id: 65, title: "Created" }],
  "artwork-place-qualifiers": [{ id: 50, title: "Place depicted:" }],
  "artwork-types": ARTWORK_TYPES.map(({ id, label }) => ({ id, title: label })),
  "category-terms": [
    {
      id: "PC-10",
      title: "Painting and Sculpture of Europe",
      subtype: "department",
    },
    { id: "TM-66", title: "oil on canvas", subtype: "classification" },
    { id: "TM-2451", title: "oil paint", subtype: "material" },
    { id: "TM-4273", title: "pointillism technique", subtype: "technique" },
    { id: "TM-12045", title: "Pointillism", subtype: "style" },
    { id: "TM-10094", title: "leisure", subtype: "subject" },
    { id: "PC-831", title: "Essentials", subtype: "theme" },
  ],
  places: [
    { id: 1, title: "France", tgn_id: 1000070 },
    { id: 2, title: "Fontainebleau", tgn_id: 7008038 },
  ],
  events: [
    {
      id: 6504,
      title: "Spotlight Talk: Seurat",
      title_display: "Spotlight Talk: <i>Seurat</i>",
      image_url:
        "https://artic-web.imgix.net/fixture/talk.jpg?rect=0%2C0%2C100%2C56&w=1200&h=675",
      short_description: "<p>A short talk in the galleries.</p>",
      description:
        "<p>A fixture event description.</p><p>Its second paragraph.</p>",
      location: "Gallery 240",
      program_ids: [106],
      program_titles: ["Spotlight Talk"],
      rsvp_link: "https://sales.artic.edu/events/6504",
      is_free: true,
      is_registration_required: true,
      is_private: false,
      date_display: "Daily, 12:00",
      start_date: "2026-01-01T12:00:00-06:00",
      end_date: "2099-01-10T13:00:00-06:00",
    },
    {
      id: 6000,
      title: "Members' Evening",
      is_private: true,
      start_date: "2099-01-01T12:00:00-06:00",
      end_date: "2099-01-01T13:00:00-06:00",
    },
  ],
  "event-programs": [{ id: 106, title: "Spotlight Talk" }],
  hours: [
    {
      id: 39,
      monday_is_closed: false,
      monday_member_open: "PT10H00M",
      monday_public_open: "PT11H00M",
      monday_public_close: "PT17H00M",
      tuesday_is_closed: true,
      wednesday_is_closed: false,
      wednesday_member_open: "PT10H00M",
      wednesday_public_open: "PT11H00M",
      wednesday_public_close: "PT17H00M",
      thursday_is_closed: false,
      thursday_member_open: "PT10H00M",
      thursday_public_open: "PT11H00M",
      thursday_public_close: "PT20H00M",
      friday_is_closed: false,
      friday_member_open: "PT10H00M",
      friday_public_open: "PT11H00M",
      friday_public_close: "PT17H00M",
      saturday_is_closed: false,
      saturday_member_open: "PT10H00M",
      saturday_public_open: "PT11H00M",
      saturday_public_close: "PT17H00M",
      sunday_is_closed: false,
      sunday_member_open: "PT10H00M",
      sunday_public_open: "PT11H00M",
      sunday_public_close: "PT17H00M",
      additional_text: "The first hour of every day is reserved for members.",
    },
  ],
  products: [
    {
      id: 292551,
      title: "Seurat Monograph",
      image_url: "https://shop-images.imgix.net/292551_2.jpg",
      web_url: "https://shop.artic.edu/products/292551",
      description: "<p>A fixture book.</p><ul><li>Format: Hardcover</li></ul>",
      min_current_price: 30,
      max_current_price: 30,
      min_compare_at_price: 40,
      artwork_ids: [27992],
    },
  ],
  sounds: [
    {
      id: "94944845-143c-ace8-0517-79276f3c10a1",
      title: "T99 Grande Jatte 27992",
      display_title: "The Essentials Tour: La Grande Jatte",
      content:
        "https://www.artic.edu/assets/94944845-143c-ace8-0517-79276f3c10a1",
      artwork_ids: [27992],
      artwork_titles: ["A Sunday on La Grande Jatte — 1884"],
    },
  ],
  texts: [
    {
      id: "291ea679-3a7f-4281-2a1b-101299c77407",
      title: "Garfield_Park_Exhibition_of_Sculpture_[5706]",
      content:
        "https://www.artic.edu/assets/291ea679-3a7f-4281-2a1b-101299c77407",
      artwork_ids: [],
      artwork_titles: [],
    },
  ],
  videos: [
    {
      id: "fae3fdc2-7a52-5fc4-c634-c2033f9b2a46",
      title: "Fruit_Piece_Essentials",
      content:
        "https://www.artic.edu/assets/fae3fdc2-7a52-5fc4-c634-c2033f9b2a46",
      artwork_ids: [],
      artwork_titles: [],
    },
  ],
  sites: [
    {
      id: 22,
      title: "Seurat and the Making of La Grande Jatte",
      description: "A fixture microsite.",
      web_url: "http://archive.artic.edu/seurat/",
      artwork_ids: [27992],
      artwork_titles: ["A Sunday on La Grande Jatte — 1884"],
    },
  ],
  images: [
    { id: "6782523e-056b-ba22-69f9-b5f1b59efcb6", width: 1000, height: 700 },
  ],
};

function museumRecords(resource: string): FixtureRecord[] {
  if (resource === "event-occurrences")
    return [
      soonOccurrence(),
      {
        ...soonOccurrence(),
        id: "9b1f8f52-1111-4a3c-9d3e-000000000001",
        start_at: "2099-01-10T12:00:00-06:00",
        end_at: "2099-01-10T13:00:00-06:00",
      },
    ];
  if (resource === "galleries") return Object.values(GALLERIES);
  if (resource === "exhibitions") return EXHIBITIONS;
  return (MUSEUM_RECORDS[resource] ?? []).map((record) => ({
    ...record,
    api_model: resource,
  }));
}

const FEATURED_IDS = new Set([27992, 28560, 16568]);

const RECORDS: Raw[] = [
  ...previewArtworks.map((artwork): Raw => {
    const imageId = /\/iiif\/2\/([^/]+)\//.exec(artwork.image.src)?.[1] ?? null;
    return {
      id: artwork.id,
      title: artwork.title,
      artist_title: artwork.artist,
      artist_display: artwork.artist,
      date_display: artwork.dateDisplay,
      artwork_type_title: artwork.type,
      medium_display: artwork.medium,
      dimensions: artwork.dimensions,
      place_of_origin: artwork.origin,
      image_id: imageId,
      is_public_domain: true,
      // The museum's highlights, which the work of the day is picked from.
      is_boosted: FEATURED_IDS.has(artwork.id),
      thumbnail: {
        width: Math.round(artwork.image.aspectRatio * 1000),
        height: 1000,
        alt_text: artwork.image.alt,
      },
      credit_line: artwork.creditLine,
      description:
        artwork.id === 27992
          ? "<p>Fixture description for <em>A Sunday on La Grande Jatte</em>.</p><p>Second paragraph.</p>"
          : null,
      ...EXTRAS[artwork.id],
    };
  }),
  {
    id: 111628,
    title: "Nighthawks",
    artist_title: "Edward Hopper",
    artwork_type_title: "Painting",
    image_id: "831a05de-d3f6-f4fa-a460-23008dd58dda",
    is_public_domain: false,
  },
];

const CONFIG = { iiif_url: IIIF_URL, website_url: "https://www.artic.edu" };

class FixtureNotFound extends Error {}

function fixtureTour(id: number) {
  return {
    id,
    title: id === 2193 ? "The Essentials Tour" : `Fixture tour ${id}`,
    description: "<p>A fixture tour description.</p>",
    intro: "<p>A fixture tour introduction.</p>",
  };
}

function select(record: Raw, fields: string[] | null): Record<string, unknown> {
  if (!fields) return record;
  return Object.fromEntries(
    fields.map((field) => [field, record[field] ?? null]),
  );
}

function fieldsOf(url: URL): string[] | null {
  return url.searchParams.get("fields")?.split(",") ?? null;
}

/** A record's value for a query field: "color.h", "style_titles.keyword", "artist_id"… */
function valueOf(record: Raw, field: string): unknown {
  const name = field.replace(/\.keyword$/, "");
  if (name.startsWith("color.")) {
    const color = record.color as Record<string, number> | undefined;
    return color?.[name.slice("color.".length)];
  }
  if (name === "artwork_type_id") {
    return ARTWORK_TYPES.find((t) => t.label === record.artwork_type_title)?.id;
  }
  return record[name];
}

type Clause = Record<string, unknown>;

/** Evaluates one query clause against a record, for the clause shapes this site sends. */
function matches(record: Raw, clause: Clause): boolean {
  if ("term" in clause) {
    const [field, expected] = Object.entries(clause.term as Clause)[0] ?? [];
    if (field === undefined) return true;
    const actual = valueOf(record, field);
    return Array.isArray(actual)
      ? actual.includes(expected)
      : actual === expected;
  }
  if ("terms" in clause) {
    const [field, expected] = Object.entries(clause.terms as Clause)[0] ?? [];
    return (
      field !== undefined &&
      (expected as unknown[]).includes(valueOf(record, field))
    );
  }
  if ("exists" in clause) {
    const field = (clause.exists as { field: string }).field;
    return valueOf(record, field) != null;
  }
  if ("range" in clause) {
    const [field, bounds] = Object.entries(clause.range as Clause)[0] ?? [];
    if (field === undefined) return true;
    const raw = valueOf(record, field);
    // Dates compare as instants; the site sends them as YYYY-MM-DD.
    const toNumber = (v: unknown) =>
      typeof v === "string" ? Date.parse(v) : (v as number | undefined);
    const value = toNumber(raw);
    if (typeof value !== "number" || Number.isNaN(value)) return false;
    const given = bounds as Record<"gte" | "gt" | "lt" | "lte", unknown>;
    const b = {
      gte: toNumber(given.gte),
      gt: toNumber(given.gt),
      lt: toNumber(given.lt),
      lte: toNumber(given.lte),
    };
    return (
      (b.gte === undefined || value >= b.gte) &&
      (b.gt === undefined || value > b.gt) &&
      (b.lt === undefined || value < b.lt) &&
      (b.lte === undefined || value <= b.lte)
    );
  }
  if ("bool" in clause) {
    const bool = clause.bool as {
      filter?: Clause[];
      must?: Clause[];
      should?: Clause[];
      must_not?: Clause[];
    };
    return (
      (bool.filter ?? []).every((c) => matches(record, c)) &&
      (bool.must_not ?? []).every((c) => !matches(record, c)) &&
      (!bool.should?.length || bool.should.some((c) => matches(record, c)))
    );
  }
  return true;
}

interface SearchParams {
  query?: {
    function_score?: {
      query?: SearchParams["query"];
      random_score?: { seed?: number };
    };
    bool?: {
      must?: Array<{ multi_match?: { query?: string } }>;
      filter?: Clause[];
      must_not?: Clause[];
    };
  };
  aggs?: Record<string, Clause>;
  sort?: Array<Record<string, "asc" | "desc">>;
  fields?: string;
  limit?: number;
  page?: number;
}

function aggregate(records: Raw[], aggs: Record<string, Clause>) {
  const result: Record<string, unknown> = {};
  for (const [name, agg] of Object.entries(aggs)) {
    if ("filters" in agg) {
      const filters = (agg.filters as { filters: Record<string, Clause> })
        .filters;
      result[name] = {
        buckets: Object.fromEntries(
          Object.entries(filters).map(([key, clause]) => [
            key,
            { doc_count: records.filter((r) => matches(r, clause)).length },
          ]),
        ),
      };
    } else if ("range" in agg) {
      const { field, ranges } = agg.range as {
        field: string;
        ranges: { key: string; from?: number; to?: number }[];
      };
      result[name] = {
        buckets: ranges.map((range) => ({
          key: range.key,
          doc_count: records.filter((r) =>
            matches(r, {
              range: { [field]: { gte: range.from, lt: range.to } },
            }),
          ).length,
        })),
      };
    } else if ("terms" in agg) {
      const { field, size } = agg.terms as { field: string; size?: number };
      const counts = new Map<string | number, number>();
      for (const record of records) {
        const value = valueOf(record, field);
        for (const item of Array.isArray(value) ? value : [value]) {
          if (typeof item !== "string" && typeof item !== "number") continue;
          // Places are matched in lower case; ids and resource names keep theirs.
          const key = field === PLACE_FIELD ? String(item).toLowerCase() : item;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      result[name] = {
        buckets: [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, size ?? 10)
          .map(([key, doc_count]) => ({ key, doc_count })),
      };
    } else if ("histogram" in agg) {
      const { field, interval } = agg.histogram as {
        field: string;
        interval: number;
      };
      const counts = new Map<number, number>();
      for (const record of records) {
        const value = valueOf(record, field);
        if (typeof value !== "number") continue;
        const key = Math.floor(value / interval) * interval;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      result[name] = {
        buckets: [...counts.entries()]
          .sort(([a], [b]) => a - b)
          .map(([key, doc_count]) => ({ key, doc_count })),
      };
    }
  }
  return result;
}

function search(url: URL): unknown {
  const params = JSON.parse(
    url.searchParams.get("params") ?? "{}",
  ) as SearchParams;
  const random = params.query?.function_score;
  const bool = (random?.query ?? params.query)?.bool;
  const keyword =
    bool?.must?.[0]?.multi_match?.query
      ?.toLowerCase()
      .split(/\s+/)
      .filter(Boolean) ?? [];

  const found = RECORDS.filter((record) => {
    if (
      !matches(record, {
        bool: { filter: bool?.filter, must_not: bool?.must_not },
      })
    )
      return false;
    const haystack =
      `${record.title} ${record.artist_title ?? ""}`.toLowerCase();
    return keyword.every((word) => haystack.includes(word));
  });

  const sortBy = params.sort?.[0];
  if (sortBy) {
    const [field, order] = Object.entries(sortBy)[0] ?? [];
    if (field)
      found.sort((a, b) => {
        const delta =
          Number(valueOf(a, field) ?? 0) - Number(valueOf(b, field) ?? 0);
        return order === "desc" ? -delta : delta;
      });
  }
  // A random pick is the seed's position in the matches, so tests can rely on it.
  if (random && found.length > 0) {
    const index = Math.abs(random.random_score?.seed ?? 0) % found.length;
    found.unshift(...found.splice(index, 1));
  }

  const limit = params.limit ?? 12;
  const page = params.page ?? 1;
  const fields = params.fields?.split(",") ?? null;
  return {
    pagination: {
      total: found.length,
      limit,
      offset: (page - 1) * limit,
      total_pages: limit > 0 ? Math.ceil(found.length / limit) : 0,
      current_page: page,
    },
    data:
      limit > 0
        ? found
            .slice((page - 1) * limit, page * limit)
            .map((record) => select(record, fields))
        : [],
    ...(params.aggs ? { aggregations: aggregate(found, params.aggs) } : {}),
    config: CONFIG,
  };
}

/** Search over the museum's other records, for the clauses this site sends. */
function searchMuseum(records: FixtureRecord[], params: SearchParams): unknown {
  const bool = params.query?.bool;
  const words =
    bool?.must?.[0]?.multi_match?.query
      ?.toLowerCase()
      .split(/\s+/)
      .filter(Boolean) ?? [];
  const found = records.filter((record) => {
    if (!matches(record as Raw, { bool: { filter: bool?.filter } }))
      return false;
    const haystack = Object.values(record)
      .filter((value) => typeof value === "string")
      .join(" ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  const sortBy = params.sort?.[0];
  const [sortField, order] = sortBy ? (Object.entries(sortBy)[0] ?? []) : [];
  if (sortField)
    found.sort((a, b) => {
      const value = (r: FixtureRecord) => {
        const v = r[sortField];
        return typeof v === "string" ? Date.parse(v) : Number(v ?? 0);
      };
      return order === "desc" ? value(b) - value(a) : value(a) - value(b);
    });
  const limit = params.limit ?? 12;
  const page = params.page ?? 1;
  const fields = params.fields?.split(",") ?? null;
  return {
    pagination: {
      total: found.length,
      limit,
      offset: (page - 1) * limit,
      total_pages: limit > 0 ? Math.ceil(found.length / limit) : 0,
      current_page: page,
    },
    data: found
      .slice((page - 1) * limit, page * limit)
      .map((record) => select(record as Raw, fields)),
    ...(params.aggs
      ? { aggregations: aggregate(found as Raw[], params.aggs) }
      : {}),
    config: CONFIG,
  };
}

/** Lists, searches and single records for every resource without its own handler. */
function museumResponse(url: URL): unknown {
  const params = JSON.parse(
    url.searchParams.get("params") ?? "{}",
  ) as SearchParams & { resources?: string };
  if (url.pathname === "/search")
    return searchMuseum(
      (params.resources ?? "").split(",").flatMap(museumRecords),
      params,
    );
  const [, resource, rest] = url.pathname.split("/");
  if (!resource) throw new FixtureNotFound();
  const records = museumRecords(resource);
  if (rest === "search") return searchMuseum(records, params);
  if (rest) {
    const record = records.find((r) => String(r.id) === rest);
    if (!record) throw new FixtureNotFound();
    return { data: select(record as Raw, fieldsOf(url)), config: CONFIG };
  }
  const ids = url.searchParams.get("ids")?.split(",");
  const limit = Number(url.searchParams.get("limit") ?? 12);
  const page = Number(url.searchParams.get("page") ?? 1);
  const listed = ids
    ? records.filter((r) => ids.includes(String(r.id)))
    : records.slice((page - 1) * limit, page * limit);
  return {
    pagination: { total: ids ? listed.length : records.length, limit },
    data: listed.map((record) => select(record as Raw, fieldsOf(url))),
    config: CONFIG,
  };
}

/** Answers a path under the API base, the way the real API would. */
export function fixtureResponse(path: string): unknown {
  const url = new URL(path, "https://fixtures.invalid/");
  if (url.pathname === "/artworks/search") return search(url);

  if (url.pathname === "/artworks") {
    const ids = (url.searchParams.get("ids") ?? "").split(",").map(Number);
    const data = RECORDS.filter((record) => ids.includes(record.id)).map(
      (record) => select(record, fieldsOf(url)),
    );
    return {
      pagination: { total: data.length, limit: data.length },
      data,
      config: CONFIG,
    };
  }

  const detail = /^\/artworks\/(\d+)$/.exec(url.pathname);
  if (detail) {
    const record = RECORDS.find((r) => r.id === Number(detail[1]));
    if (!record) throw new FixtureNotFound();
    return { data: select(record, fieldsOf(url)), config: CONFIG };
  }

  if (url.pathname === "/sounds") {
    const ids = (url.searchParams.get("ids") ?? "").split(",");
    return {
      data: SOUNDS.filter((sound) => ids.includes(sound.id)),
      config: CONFIG,
    };
  }

  if (url.pathname === "/galleries") {
    const page = Number(url.searchParams.get("page") ?? 1);
    const all = Object.values(GALLERIES);
    return {
      pagination: { total: all.length },
      data: page === 1 ? all : [],
      config: CONFIG,
    };
  }

  if (url.pathname === "/tours") {
    return {
      pagination: { total: TOUR_INDEX.tours.length },
      data: TOUR_INDEX.tours.map((tour) => fixtureTour(tour.id)),
      config: CONFIG,
    };
  }
  const tour = /^\/tours\/(\d+)$/.exec(url.pathname);
  if (tour) {
    if (!TOUR_INDEX.tours.some((t) => t.id === Number(tour[1])))
      throw new FixtureNotFound();
    return { data: fixtureTour(Number(tour[1])), config: CONFIG };
  }
  if (url.pathname === "/mobile-sounds") {
    const ids = (url.searchParams.get("ids") ?? "").split(",").map(Number);
    return {
      data: ids.map((id) => ({
        id,
        title: `Recording ${id}`,
        web_url: `https://www.artic.edu/mobile/audio/fixture-${id}.mp3`,
        transcript: `<p>Fixture transcript ${id}.</p>`,
      })),
      config: CONFIG,
    };
  }

  const gallery = /^\/galleries\/(\d+)$/.exec(url.pathname);
  if (gallery) {
    const record = GALLERIES[Number(gallery[1])];
    if (!record) throw new FixtureNotFound();
    return { data: record, config: CONFIG };
  }

  if (url.pathname === "/exhibitions/search") {
    return {
      pagination: { total: EXHIBITIONS.length, limit: 12, current_page: 1 },
      data: EXHIBITIONS,
      config: CONFIG,
    };
  }
  const exhibition = /^\/exhibitions\/(\d+)$/.exec(url.pathname);
  if (exhibition) {
    const record = EXHIBITIONS.find((e) => e.id === Number(exhibition[1]));
    if (!record) throw new FixtureNotFound();
    return { data: record, config: CONFIG };
  }

  if (url.pathname === "/articles/search" && url.searchParams.has("q")) {
    return {
      pagination: { total: ARTICLES.length },
      data: ARTICLES,
      config: CONFIG,
    };
  }
  if (
    url.pathname === "/digital-publications/search" &&
    url.searchParams.has("q")
  ) {
    return { pagination: { total: 0 }, data: [], config: CONFIG };
  }
  if (url.pathname === "/autocomplete") {
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    return [
      "Georges Seurat",
      "Claude Monet",
      "A Sunday on La Grande Jatte — 1884",
    ].filter((title) => title.toLowerCase().includes(q));
  }

  const agent = /^\/agents\/(\d+)$/.exec(url.pathname);
  if (agent) {
    const record = AGENTS[Number(agent[1])];
    if (!record) throw new FixtureNotFound();
    return { data: record, config: CONFIG };
  }
  return museumResponse(url);
}

export function isFixtureNotFound(error: unknown): boolean {
  return error instanceof FixtureNotFound;
}
