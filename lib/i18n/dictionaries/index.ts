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
