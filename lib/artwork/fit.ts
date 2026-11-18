/**
 * Sizing for an artwork inside a box of `boxRatio` (width / height), from the work's known
 * aspect ratio rather than the loaded file's pixel size: wider works fill the width, taller
 * ones the height. The image keeps its proportions whichever srcset width the browser picked.
 *
 * A plain module (not "use client") so server components can call it too.
 */
export function fitClass(imageRatio: number, boxRatio: number): string {
  return imageRatio >= boxRatio ? "h-auto w-full max-h-full" : "h-full w-auto max-w-full";
}
