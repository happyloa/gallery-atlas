/** Joins class names, skipping falsy values. */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

/** Rel value for links that leave the site. */
export const EXTERNAL_REL = "noopener noreferrer";
