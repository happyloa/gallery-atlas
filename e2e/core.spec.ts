import { expect, gotoReady, test } from "./fixtures";

const JATTE = "A Sunday on La Grande Jatte — 1884";

test("search, open a work, save it, and find it again after a reload", async ({
  page,
  iiif,
}) => {
  await gotoReady(page, "/en");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Art is worth lingering over.",
    }),
  ).toBeVisible();

  // Search updates the URL (debounced), and the results follow it.
  const search = page.getByRole("combobox", { name: "Search artworks" });
  await search.fill("jatte");
  await expect(page).toHaveURL(/\/en\?q=jatte/);
  const results = page.locator("#explore");
  await expect(
    results.getByRole("status").filter({ hasText: "matching “jatte”" }),
  ).toBeVisible();
  await expect(results.getByRole("article")).toHaveCount(1);

  // Open the detail page from the card.
  await results.getByRole("link", { name: JATTE }).click();
  await expect(page).toHaveURL(/\/en\/artworks\/27992$/);
  await expect(
    page.getByRole("heading", { level: 1, name: JATTE }),
  ).toBeVisible();
  await expect(
    page.getByText("Georges Seurat", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /crowded park/ }).first(),
  ).toBeVisible();
  expect(
    iiif.some((url) => url.includes("2d484387-2509-5e8e-2c43-22f9981972eb")),
  ).toBe(true);
  // The CC BY description is shown with its credit.
  await expect(page.getByText("Fixture description for")).toBeVisible();
  await expect(
    page.getByText("Description: Art Institute of Chicago, CC BY 4.0."),
  ).toBeVisible();

  // Save it.
  const save = page.getByRole("button", { name: /^Save/ });
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await save.click();
  await expect(page.getByRole("button", { name: /^Saved/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Still saved after a reload.
  await page.reload();
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  await expect(page.getByRole("button", { name: /^Saved/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // And listed in My Collection.
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "My Collection" })
    .click();
  await expect(page).toHaveURL(/\/en\/collection$/);
  await expect(page.getByRole("link", { name: JATTE })).toBeVisible();
  await expect(page.getByText("1 saved work")).toBeVisible();

  // Removing it from the collection page empties the wall.
  await page
    .getByRole("button", { name: `Remove “${JATTE}” from your collection` })
    .click();
  await expect(page.getByText("Your walls are still bare.")).toBeVisible();
});

test("search state lives in the URL: direct links, filters and the back button", async ({
  page,
}) => {
  await gotoReady(page, "/en?q=monet&type=painting");
  const explore = page.locator("#explore");
  await expect(
    page.getByRole("combobox", { name: "Search artworks" }),
  ).toHaveValue("monet");
  await expect(explore.getByRole("link", { name: "Painting" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(
    explore
      .getByRole("status")
      .filter({ hasText: "painting works matching “monet”" }),
  ).toBeVisible();

  await explore.getByRole("link", { name: "All", exact: true }).click();
  await expect(page).toHaveURL(/\/en\?q=monet#explore$/);
  await page.goBack();
  await expect(page).toHaveURL(/type=painting/);
  await expect(explore.getByRole("link", { name: "Painting" })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("pages beyond the search window are refused without an upstream call", async ({
  page,
}) => {
  await gotoReady(page, "/en?page=84");
  await expect(
    page.getByRole("heading", { name: "Search stops at page 83." }),
  ).toBeVisible();
});

test("works that are not public domain, and unknown ids, are never shown", async ({
  page,
  iiif,
}) => {
  await gotoReady(page, "/en/artworks/111628");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "This work can’t be shown here.",
    }),
  ).toBeVisible();
  expect(iiif.some((url) => url.includes("831a05de"))).toBe(false);

  const missing = await page.goto("/en/artworks/424242");
  expect(missing?.status()).toBe(404);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "There’s nothing hanging here.",
    }),
  ).toBeVisible();
});

test("the full-image dialog works from the keyboard", async ({ page }) => {
  await gotoReady(page, "/en/artworks/27992");
  const open = page.getByRole("button", { name: "View full image" });
  await open.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: `Full image: ${JATTE}` });
  await expect(dialog).toBeVisible();
  // Deep zoom opens on the IIIF tiles, and the zoom buttons drive it.
  const zoomIn = dialog.getByRole("button", { name: "Zoom in" });
  await expect(zoomIn).toBeEnabled();
  await expect(dialog.locator("canvas")).toHaveCount(1);
  await zoomIn.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});

test("the full-image dialog falls back to one large image without tiles", async ({
  page,
}) => {
  await page.route("**/info.json", (route) => route.fulfill({ status: 404 }));
  await gotoReady(page, "/en/artworks/27992");
  await page.getByRole("button", { name: "View full image" }).click();
  const dialog = page.getByRole("dialog", { name: `Full image: ${JATTE}` });
  await expect(dialog.locator("img")).toHaveAttribute(
    "src",
    /\/full\/1686,\/0\/default\.jpg$/,
  );
  await dialog.getByRole("button", { name: "Zoom in" }).click();
  await expect(dialog.getByRole("button", { name: "Zoom out" })).toBeEnabled();
});

test("switching language keeps the page and the search", async ({ page }) => {
  await gotoReady(page, "/en?q=monet");
  await page
    .getByRole("link", { name: "Switch to Traditional Chinese" })
    .click();
  await expect(page).toHaveURL(/\/zh-tw\?q=monet/);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant-TW");
  await expect(
    page.getByRole("heading", { level: 2, name: "探索館藏" }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "搜尋作品" })).toHaveValue(
    "monet",
  );

  // The choice is remembered for unprefixed URLs.
  await gotoReady(page, "/");
  await expect(page).toHaveURL(/\/zh-tw$/);
});
