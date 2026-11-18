/**
 * JSON for an inline <script type="application/ld+json">. Characters that could end the
 * script element or confuse old parsers ("<", ">", "&", U+2028, U+2029) are written as
 * \uXXXX escapes, which is still valid JSON with the same value.
 */
const UNSAFE = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, "g");
const BACKSLASH = String.fromCharCode(92);

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(
    UNSAFE,
    (char) => `${BACKSLASH}u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}
