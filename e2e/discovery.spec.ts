import { expect, gotoReady, test } from "./fixtures";

const JATTE = "A Sunday on La Grande Jatte — 1884";

test("the homepage offers ways in by movement, century and colour", async ({
  page,
}) => {
  await gotoReady(page, "/en");
  const ways = page.getByRole("region", { name: "Start somewhere" });
  await expect(ways).toBeVisible();
  await expect(
    ways.getByRole("link", { name: /Impressionism/ }).first(),
  ).toBeVisible();

  // A century bar opens Explore with that era set.
  await ways.getByRole("link", { name: /1800s/ }).click();
  await expect(page).toHaveURL(/\/en\?era=1800s#explore$/);
  const explore = page.locator("#explore");
  await expect(
    explore.getByRole("link", { name: "1800s", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    explore.getByRole("status").filter({ hasText: "· 1800s" }),
  ).toBeVisible();
});

test("colour and era filters narrow the wall and can be cleared", async ({
  page,
}) => {
  await gotoReady(page, "/en");
  const explore = page.locator("#explore");
  await explore.getByRole("link", { name: "Blue", exact: true }).click();
  await expect(page).toHaveURL(/\/en\?color=blue#explore$/);
  // In the fixtures only Water Lilies and the Hokusai print are a vivid blue.
  await expect(explore.getByRole("article")).toHaveCount(2);
  await expect(
    explore.getByRole("link", { name: "Water Lilies" }),
  ).toBeVisible();

  // Filters combine; the keyword box keeps them when searching.
  await explore.getByRole("link", { name: "1900 on", exact: true }).click();
  await expect(page).toHaveURL(/\/en\?era=1900s&color=blue#explore$/);
  await expect(explore.getByRole("article")).toHaveCount(1);

  await explore.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/en#explore$/);
  await expect(explore.getByRole("article")).not.toHaveCount(1);
});

test("a work leads to its artist, its tags and more by the same hand", async ({
  page,
}) => {
  await gotoReady(page, "/en/artworks/27992");
  await expect(
    page.getByText(/On view at the Art Institute of Chicago, Gallery 240/),
  ).toBeVisible();

  // The object record is folded away until opened.
  const record = page.getByRole("region", { name: "Object record" });
  await record.getByText("Inscriptions").click();
  await expect(record.getByText("Inscribed lower right: Seurat")).toBeVisible();

  // A style tag opens Explore filtered by it, with a chip to remove it.
  await page
    .getByRole("region", { name: "Look further" })
    .getByRole("link", { name: "Pointillism" })
    .click();
  await expect(page).toHaveURL(/\/en\?style=Pointillism#explore$/);
  const explore = page.locator("#explore");
  await expect(explore.getByRole("link", { name: JATTE })).toBeVisible();
  await expect(explore.getByRole("article")).toHaveCount(1);
  await expect(
    explore.getByRole("link", { name: "Remove filter: Style: Pointillism" }),
  ).toBeVisible();

  // The artist's name on the work opens their page.
  await gotoReady(page, "/en/artworks/28560");
  await expect(
    page.getByRole("region", { name: "More by Vincent van Gogh" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Vincent van Gogh", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/artists\/40610$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Vincent van Gogh" }),
  ).toBeVisible();
  await expect(page.getByText("1853–1890")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Public-domain works" })
      .getByRole("article"),
  ).toHaveCount(2);
});

test("an artist page shows the biography and its credit", async ({ page }) => {
  await gotoReady(page, "/zh-tw/artists/40810");
  await expect(
    page.getByRole("heading", { level: 1, name: "Georges Seurat" }),
  ).toBeVisible();
  await expect(page.getByText(/Fixture biography for/)).toBeVisible();
  await expect(page.getByText("介紹：芝加哥藝術博物館，CC BY 4.0。")).toBeVisible();
  await expect(page.getByRole("link", { name: JATTE })).toBeVisible();

  const missing = await page.goto("/en/artists/999999");
  expect(missing?.status()).toBe(404);
});
