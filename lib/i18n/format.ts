/**
 * Fills `{name}` placeholders. Dictionaries hold plain strings (not functions) so they can
 * be passed from server components to client components.
 */
export function format(
  template: string,
  values: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
