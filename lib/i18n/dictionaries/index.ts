import type { Locale } from "../config";
import { en } from "./en";
import type { Dictionary as CoreDictionary } from "./en";
import { museumEn, museumZhTw } from "./museum";
import type { MuseumDictionary } from "./museum";
import { zhTw } from "./zh-tw";

export type Dictionary = CoreDictionary & MuseumDictionary;

const DICTIONARIES: Record<Locale, Dictionary> = {
  en: { ...en, ...museumEn },
  "zh-tw": { ...zhTw, ...museumZhTw },
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/**
 * The sections client components read through useI18n(). Only these are sent to the
 * browser with each page; everything else is rendered on the server and stays there.
 * A client component that needs another section has to add it here first: reaching
 * for one that is not listed fails the type check.
 */
export const CLIENT_SECTIONS = [
  "site",
  "nav",
  "hero",
  "explore",
  "types",
  "eras",
  "colors",
  "tours",
  "zoom",
  "favorite",
  "artwork",
  "errors",
  "collection",
  "exhibitions",
  "share",
] as const satisfies readonly (keyof Dictionary)[];

export type ClientDictionary = Pick<
  Dictionary,
  (typeof CLIENT_SECTIONS)[number]
>;

function pickClientSections(dict: Dictionary): ClientDictionary {
  return Object.fromEntries(
    CLIENT_SECTIONS.map((section) => [section, dict[section]]),
  ) as ClientDictionary;
}

const CLIENT_DICTIONARIES: Record<Locale, ClientDictionary> = {
  en: pickClientSections(DICTIONARIES.en),
  "zh-tw": pickClientSections(DICTIONARIES["zh-tw"]),
};

export function getClientDictionary(locale: Locale): ClientDictionary {
  return CLIENT_DICTIONARIES[locale];
}
