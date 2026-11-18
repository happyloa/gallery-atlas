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
        requested.push(route.request().url());
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
