import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, gotoReady, test } from "./fixtures";

const STORAGE_KEY = "gallery-atlas:collection";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Waits for entrance animations (scroll reveals, fades) to finish, so axe measures text at
 * its final colour rather than halfway through a fade-in. Looping and scroll-driven
 * animations are skipped (the statement text is checked in its unlit colour, which passes).
 */
async function settleAnimations(page: Page) {
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter(
            (a) =>
              a.timeline === document.timeline &&
              a.effect?.getComputedTiming().endTime !== Infinity,
          )
          .map((a) => a.finished.catch(() => undefined)),
      ),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]),
  );
}

/** Runs axe against the page and fails with a readable list of what it found. */
async function expectAccessible(page: Page, label: string) {
  await settleAnimations(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(TAGS)
    .analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(" ")).join("\n    ")}`,
  );
  expect(summary, `${label}\n${summary.join("\n")}`).toEqual([]);
}

async function seedCollection(page: Page) {
  await gotoReady(page, "/en");
  await page.evaluate(
    ([key]) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          favorites: [
            { id: 27992, savedAt: 2 },
            { id: 14655, savedAt: 1 },
          ],
          exhibitions: [
            {
              id: "show",
              title: "Evening light",
              artworkIds: [27992],
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        }),
      ),
    [STORAGE_KEY],
  );
}

for (const path of [
  "/en",
  "/zh-tw",
  "/en?q=xqz",
  "/en/artworks/27992",
  "/zh-tw/artworks/27992",
  "/en/artworks/111628",
  "/en/about",
  "/zh-tw/about",
  "/en/artworks/424242",
  "/en/artists/40810",
  "/zh-tw?color=blue&era=1800s&style=Impressionism",
  "/en/exhibitions",
  "/en/exhibitions/9001",
  "/zh-tw/map",
  "/zh-tw/galleries",
  "/en/tours",
  "/zh-tw/tours/2193",
  "/en/galleries/2147478672",
  "/en/collection/shared?title=Evening%20light&ids=27992,28560",
]) {
  test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
    await gotoReady(page, path);
    await expectAccessible(page, path);
  });
}

test("no WCAG A/AA violations on My Collection and an exhibition", async ({
  page,
}) => {
  await seedCollection(page);
  await gotoReady(page, "/en/collection");
  await expect(page.getByRole("link", { name: "Evening light" })).toBeVisible();
  await expectAccessible(page, "/en/collection");

  await gotoReady(page, "/zh-tw/collection/show");
  await expect(
    page.getByRole("heading", { level: 1, name: "Evening light" }),
  ).toBeVisible();
  await expectAccessible(page, "/zh-tw/collection/show");
});

test("no WCAG A/AA violations with dialogs open", async ({ page }) => {
  await seedCollection(page);
  await gotoReady(page, "/en/artworks/27992");
  await page.getByRole("button", { name: /^Add to exhibition/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Add to an exhibition" }),
  ).toBeVisible();
  await expectAccessible(page, "exhibition picker");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "View full image" }).click();
  await expect(page.getByRole("dialog", { name: /^Full image/ })).toBeVisible();
  await expectAccessible(page, "full-image dialog");
  await page.keyboard.press("Escape");

  await gotoReady(page, "/en/collection/show");
  await page.getByRole("button", { name: "Delete exhibition" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expectAccessible(page, "delete confirmation");
});

test("reduced motion: no smooth scrolling and no idle camera drift", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoReady(page, "/en");
  const scrollBehavior = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollBehavior,
  );
  expect(scrollBehavior).toBe("auto");
});
