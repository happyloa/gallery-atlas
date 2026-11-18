// Audio tour data from the museum's public mobile-app feed, which is the only place that
// says which stops, works and recordings make up each tour.
//
//   node scripts/build-tours.mjs --index        writes lib/artic/tour-index.ts (committed):
//                                               ids, order and titles only
//   node scripts/build-tours.mjs --transcripts  writes public/tour-transcripts/ (not committed):
//                                               Chinese transcripts, © Art Institute of Chicago
//
// English audio and transcripts are read from the documented API at runtime. The feed's
// Chinese text is Simplified, so it is converted to Taiwan Traditional here.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import * as OpenCC from "opencc-js";

const FEED =
  "https://aic-mobile-tours.artic.edu/sites/default/files/appData-v3.json";
const MAX_COMMENTARY = 4;

const toTaiwan = OpenCC.Converter({ from: "cn", to: "twp" });
const hasChinese = (text) => /[一-鿿]/.test(text ?? "");
const tidy = (text) => (text ?? "").replace(/\s+/g, " ").trim();

async function loadFeed() {
  const response = await fetch(FEED, {
    headers: { "User-Agent": "GalleryAtlas/0.1" },
  });
  if (!response.ok) throw new Error(`Feed answered ${response.status}`);
  return response.json();
}

const chineseOf = (item) =>
  item?.translations?.find((t) => t.language === "zh-hant");

/** A readable English title, or null when the feed only has a production file name. */
function cleanTitle(raw) {
  const title = tidy(raw)
    .replace(/\.mp3$/i, "")
    .replace(/\s*\((?:[^()]*\b(?:tour|essentials)\b[^()]*)\)$/i, "")
    .replace(/^Essentials:\s*/i, "");
  if (!title || title.includes("_") || /^T\d+\b/.test(title)) return null;
  return title;
}

/** "Paris Street; Rainy Day (巴黎街道，雨天)" → the Chinese name; else the converted title. */
function chineseTitle(raw) {
  const title = tidy(raw).replace(/\s*\(Mandarin\)$/i, "");
  if (!hasChinese(title)) return null;
  const inBrackets = /[(（]([^()（）]*[一-鿿][^()（）]*)[)）]\s*$/.exec(title);
  return toTaiwan(inBrackets ? inBrackets[1] : title);
}

/** https address of a Chinese recording; the feed lists plain http. */
function chineseAudio(audio) {
  const url = chineseOf(audio)?.audio_file_url;
  return url ? url.replace(/^http:/, "https:") : null;
}

function buildIndex(app) {
  const audio = app.audio_files;
  const sounds = {};
  const remember = (id) => {
    const zh = chineseOf(audio[id]);
    const src = chineseAudio(audio[id]);
    if (zh && src)
      sounds[id] = {
        zhTitle: chineseTitle(zh.track_title ?? zh.title),
        zhSrc: src,
      };
  };

  const tours = app.tours.flatMap((tour) => {
    const stops = [...(tour.tour_stops ?? [])]
      .sort((a, b) => Number(a.sort) - Number(b.sort))
      .flatMap((stop) => {
        const file = audio[stop.audio_id];
        if (!file) return [];
        const object = app.objects[stop.object];
        remember(stop.audio_id);
        return [
          {
            sound: Number(stop.audio_id),
            artwork: object?.id ?? null,
            title:
              tidy(object?.title) ||
              cleanTitle(file.track_title) ||
              cleanTitle(file.title),
            code:
              object?.audio_commentary?.find((c) => c.audio === stop.audio_id)
                ?.object_selector_number ?? null,
          },
        ];
      });
    if (stops.length === 0) return [];
    const intro = audio[tour.tour_audio] ? Number(tour.tour_audio) : null;
    if (intro) remember(tour.tour_audio);
    const zh = chineseOf(tour);
    return [
      {
        id: Number(tour.nid),
        minutes: Number.parseInt(tour.tour_duration, 10) || null,
        intro,
        zhTitle: hasChinese(zh?.title) ? toTaiwan(tidy(zh.title)) : null,
        zhDescription: hasChinese(zh?.description)
          ? toTaiwan(tidy(zh.description))
          : null,
        stops,
      },
    ];
  });

  // Recordings per artwork, those that belong to a tour first.
  const inTours = new Set(tours.flatMap((t) => t.stops.map((s) => s.sound)));
  const commentary = {};
  for (const object of Object.values(app.objects)) {
    if (!object.id) continue;
    const entries = (object.audio_commentary ?? [])
      // Spanish and Mandarin copies have no visitor code and belong to no tour.
      .filter(
        (c) =>
          audio[c.audio] &&
          (c.object_selector_number || inTours.has(Number(c.audio))) &&
          !hasChinese(audio[c.audio].audio_transcript),
      )
      .sort(
        (a, b) =>
          Number(inTours.has(Number(b.audio))) -
          Number(inTours.has(Number(a.audio))),
      )
      .slice(0, MAX_COMMENTARY)
      .map((c) => {
        remember(c.audio);
        return {
          sound: Number(c.audio),
          code: c.object_selector_number ?? null,
          title:
            cleanTitle(audio[c.audio].track_title) ||
            cleanTitle(audio[c.audio].title),
        };
      });
    if (entries.length > 0) commentary[object.id] = entries;
  }
  return { tours, sounds, commentary };
}

function writeIndex(app) {
  const { tours, sounds, commentary } = buildIndex(app);
  writeFileSync(
    new URL("../lib/artic/tour-index.ts", import.meta.url),
    `// Generated by scripts/build-tours.mjs --index from the museum's mobile-app feed.
// Do not edit by hand.
import type { TourIndex } from "./tour-types";

export const TOUR_INDEX: TourIndex = ${JSON.stringify({ tours, sounds, commentary }, null, 1)};
`,
  );
  const stops = tours.reduce((sum, t) => sum + t.stops.length, 0);
  console.log(
    `tour-index.ts: ${tours.length} tours, ${stops} stops, ${Object.keys(sounds).length} Chinese recordings, ${Object.keys(commentary).length} works with audio`,
  );
}

function writeTranscripts(app) {
  const directory = new URL("../public/tour-transcripts/", import.meta.url);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  let written = 0;
  for (const [id, file] of Object.entries(app.audio_files)) {
    const transcript = chineseOf(file)?.audio_transcript;
    if (!hasChinese(transcript)) continue;
    const paragraphs = toTaiwan(transcript)
      .split(/\r?\n/)
      .map(tidy)
      .filter(Boolean);
    writeFileSync(
      new URL(`${id}.json`, directory),
      JSON.stringify({ paragraphs }),
    );
    written++;
  }
  console.log(`public/tour-transcripts: ${written} Chinese transcripts`);
}

const mode = process.argv[2];
try {
  const app = await loadFeed();
  if (mode === "--index") writeIndex(app);
  else if (mode === "--transcripts") writeTranscripts(app);
  else throw new Error("Pass --index or --transcripts");
} catch (error) {
  // A deploy should not fail over optional text: pages fall back to the English transcript.
  if (mode === "--transcripts") {
    console.warn(`Skipping Chinese transcripts: ${error.message}`);
  } else {
    throw error;
  }
}
