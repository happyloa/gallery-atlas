/**
 * Fills `{name}` placeholders. Dictionaries hold plain strings (not functions) so they can
 * be passed from server components to client components.
 */
/** "1 work" or "{count} works", from a dictionary pair. */
export function formatCount(
  one: string,
  other: string,
  count: number,
  formatted: string = String(count),
): string {
  return count === 1 ? one : format(other, { count: formatted });
}

export function format(
  template: string,
  values: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
