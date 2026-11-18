/**
 * Share links for personal exhibitions: /[lang]/collection/shared?title=…&ids=1,2,3.
 * The link carries everything; nothing is stored on the server.
 */
import { MAX_SHARED_WORKS } from "@/lib/artic/config";
import { parseId } from "@/lib/artic/queries";
import { cleanTitle } from "./schema";

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function first(params: Params, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** The title and works carried in a share link, or null when it holds neither. */
export function parseSharedExhibition(
  params: Params,
): { title: string; ids: number[] } | null {
  const title = cleanTitle(first(params, "title") ?? "");
  const ids = [
    ...new Set(
      (first(params, "ids") ?? "")
        .split(",")
        .slice(0, MAX_SHARED_WORKS)
        .map((part) => parseId(part.trim()))
        .filter((id): id is number => id !== null),
    ),
  ];
  return title && ids.length > 0 ? { title, ids } : null;
}
