import type { Locale } from "../config";
import { en } from "./en";
import type { Dictionary } from "./en";
import { zhTw } from "./zh-tw";

export type { Dictionary } from "./en";

const DICTIONARIES: Record<Locale, Dictionary> = { en, "zh-tw": zhTw };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
