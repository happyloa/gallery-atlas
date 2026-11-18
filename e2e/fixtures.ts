import { test as base, expect } from "@playwright/test";

/** A 2×2 PNG, so image elements and WebGL textures load without the museum's server. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGPYv3+/xn8GBgYGBgYGAEbHBhXvHN8yAAAAAElFTkSuQmCC",
  "base64",
);

/** Every test starts with an empty collection and intercepted IIIF images. */
export const test = base.extend<{ iiif: string[] }>({
  iiif: [
    async ({ page }, use) => {
      const requested: string[] = [];
      await page.route("https://www.artic.edu/iiif/**", async (route) => {
        const url = route.request().url();
        requested.push(url);
        // Deep zoom asks for the IIIF description first; answer with a small tiled image.
        if (url.endsWith("/info.json")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({
              "@context": "http://iiif.io/api/image/2/context.json",
              "@id": url.slice(0, -"/info.json".length),
              protocol: "http://iiif.io/api/image",
              width: 2000,
              height: 1340,
              tiles: [{ width: 512, scaleFactors: [1, 2, 4] }],
              profile: ["http://iiif.io/api/image/2/level2.json"],
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "image/png",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: PNG,
        });
      });
      await use(requested);
    },
    { auto: true },
  ],
});

export { expect };

/** Fails when the page scrolls sideways. */
export async function expectNoHorizontalOverflow(
  page: import("@playwright/test").Page,
) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Navigates and waits until React has hydrated the page (see I18nProvider). */
export async function gotoReady(page: import("@playwright/test").Page, path: string) {
  const response = await page.goto(path);
  await page.locator("html[data-hydrated]").waitFor({ state: "attached", timeout: 60_000 });
  return response;
}
