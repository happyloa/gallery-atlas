import {
  expect,
  expectNoHorizontalOverflow,
  gotoReady,
  test,
} from "./fixtures";

test("the More menu opens the rest of the site and closes on Escape", async ({
  page,
}) => {
  await gotoReady(page, "/en/about");
  const nav = page.getByRole("navigation", { name: "Primary" }).first();
  const more = nav.getByRole("button", { name: "More" });
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.keyboard.press("Escape");
  await expect(more).toHaveAttribute("aria-expanded", "false");

  await more.click();
  await nav.getByRole("link", { name: "Artists" }).click();
  await expect(page).toHaveURL(/\/en\/artists$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Artists" }),
  ).toBeVisible();
});

test("site search finds records of every kind and narrows by tab", async ({
  page,
}) => {
  await gotoReady(page, "/en");
  await page.getByRole("link", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/search$/);

  const box = page.getByRole("searchbox", {
    name: "Search the museum’s records",
  });
  await box.fill("monet");
  await box.press("Enter");
  await expect(page).toHaveURL(/q=monet/);

  await expect(
    page.getByRole("link", { name: /Claude Monet/ }),
  ).toHaveAttribute("href", "/en/artists/35809");
  await expect(
    page.getByRole("link", { name: /^Press release\s*Monet and Chicago/ }),
  ).toHaveAttribute("href", "/en/read/press-releases/291");
  await expect(
    page.getByRole("link", { name: "Search the collection for “monet”" }),
  ).toBeVisible();

  await page.getByRole("link", { name: /^Reading/ }).click();
  await expect(page).toHaveURL(/tab=reading/);
  await expect(page.getByRole("link", { name: /Claude Monet/ })).toHaveCount(0);

  await gotoReady(page, "/en/search?q=xqzzy");
  await expect(page.getByText("Nothing matches “xqzzy”.")).toBeVisible();
});

test("the artist index filters by type, and an artist links out", async ({
  page,
}) => {
  await gotoReady(page, "/en/artists");
  await expect(
    page.getByRole("link", { name: /^Georges Seurat/ }),
  ).toBeVisible();

  await gotoReady(page, "/en/artists?q=ancient");
  await expect(
    page.getByRole("link", { name: /^Ancient Greek/ }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /^Georges Seurat/ })).toHaveCount(
    0,
  );

  await gotoReady(page, "/en/artists/40810");
  await expect(page.getByText("Georges Pierre Seurat")).toBeVisible();
  await expect(page.getByRole("link", { name: /Getty ULAN/ })).toHaveAttribute(
    "href",
    "https://vocab.getty.edu/page/ulan/500008873",
  );
  await expect(page.getByRole("link", { name: /Wikidata/ })).toHaveAttribute(
    "href",
    "https://www.wikidata.org/wiki/Q34013",
  );
});

test("browsing leads from a facet to its public-domain works", async ({
  page,
}) => {
  await gotoReady(page, "/en/browse");
  await expect(
    page.getByRole("heading", { level: 2, name: "Materials" }),
  ).toBeVisible();

  await gotoReady(page, "/en/browse/styles");
  await page.getByRole("link", { name: /^Pointillism/ }).click();
  await expect(page).toHaveURL(/\/en\/browse\/styles\/TM-12045$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pointillism" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /A Sunday on La Grande Jatte/ }).first(),
  ).toBeVisible();

  await gotoReady(page, "/en/browse/places?q=fontainebleau");
  await expect(page.getByText("Fontainebleau")).toBeVisible();
  await expect(page.getByRole("link", { name: /Getty TGN/ })).toBeVisible();

  await gotoReady(page, "/en/browse/vocabulary");
  await expect(
    page.getByRole("heading", { level: 2, name: "Date qualifiers" }),
  ).toBeVisible();
  await expect(page.getByText("Place depicted")).toBeVisible();

  const missing = await page.goto("/en/browse/styles/TM-99999");
  expect(missing?.status()).toBe(404);
  const wrong = await page.goto("/en/browse/nonsense");
  expect(wrong?.status()).toBe(404);
});

test("the reading room shows full texts with their source", async ({
  page,
}) => {
  await gotoReady(page, "/en/read");
  await page
    .getByRole("link", { name: /^Articles/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/read\/articles$/);

  await page.getByRole("link", { name: /Caillebotte and Seurat/ }).click();
  await expect(page).toHaveURL(/\/en\/read\/articles\/826$/);
  await expect(
    page.getByText("The second paragraph of a fixture article."),
  ).toBeVisible();
  await expect(
    page.getByText("© Art Institute of Chicago. Shown for noncommercial"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Read at the museum/ }),
  ).toHaveAttribute("href", "https://www.artic.edu/articles/826");

  await gotoReady(page, "/en/read/highlights/10");
  await expect(
    page.getByRole("heading", { level: 1, name: "Visions of America" }),
  ).toBeVisible();

  await gotoReady(page, "/en/read/catalogues/135466");
  await page.getByRole("link", { name: /Cat\. 44/ }).click();
  await expect(page).toHaveURL(/catalogue-entries\/36744351949$/);
  await expect(page.getByText("The fixture catalogue essay.")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Provenance" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View the artwork" }),
  ).toHaveAttribute("href", "/en/artworks/16568");

  await gotoReady(page, "/en/read/digital-publications/34");
  await page.getByRole("link", { name: /The Complete Painter/ }).click();
  await expect(page.getByText("By Allison Langley")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Malangatana: Mozambique Modern" }),
  ).toBeVisible();

  const missing = await page.goto("/en/read/articles/424242");
  expect(missing?.status()).toBe(404);
});

test("events are listed by day, and private events stay hidden", async ({
  page,
}) => {
  await gotoReady(page, "/en/events");
  await expect(page.getByText("All times are Chicago time.")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: /^Today/ }),
  ).toBeVisible();

  const programs = page.getByRole("navigation", { name: "Program" });
  await programs.getByRole("link", { name: "Spotlight Talk" }).click();
  await expect(page).toHaveURL(/program=106/);

  await page
    .getByRole("link", { name: "Spotlight Talk: Seurat" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/events\/6504$/);
  await expect(page.getByText("A fixture event description.")).toBeVisible();
  await expect(page.getByText("Registration required")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Tickets and registration/ }),
  ).toHaveAttribute("href", "https://sales.artic.edu/events/6504");

  const hidden = await page.goto("/en/events/6000");
  expect(hidden?.status()).toBe(404);
});

test("the visit page gives hours and today's events", async ({ page }) => {
  await gotoReady(page, "/zh-tw/visit");
  await expect(
    page.getByRole("heading", { level: 1, name: "參觀資訊" }),
  ).toBeVisible();
  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(7);
  await expect(
    table.getByRole("row", { name: /星期二/ }).getByText("休館"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Spotlight Talk: Seurat" }),
  ).toBeVisible();
});

test("the shop sends buyers to the museum", async ({ page }) => {
  await gotoReady(page, "/en/shop");
  await page.getByRole("link", { name: "Seurat Monograph" }).click();
  await expect(page).toHaveURL(/\/en\/shop\/292551$/);
  await expect(page.getByText(/^\$30/)).toBeVisible();
  await expect(page.locator("main s")).toHaveText("$40");
  await expect(
    page.getByRole("link", { name: /Buy at the museum shop/ }),
  ).toHaveAttribute("href", "https://shop.artic.edu/products/292551");
  await expect(
    page.getByRole("heading", { level: 2, name: "Related works" }),
  ).toBeVisible();
});

test("the media library plays recordings and links documents", async ({
  page,
}) => {
  await gotoReady(page, "/en/media");
  await expect(
    page.getByRole("heading", { name: "The Essentials Tour: La Grande Jatte" }),
  ).toBeVisible();
  await expect(page.locator("main audio")).toHaveAttribute(
    "src",
    /\/assets\/94944845/,
  );

  await page.getByRole("link", { name: "Documents" }).click();
  await expect(page).toHaveURL(/kind=documents/);
  await expect(
    page.getByRole("heading", {
      name: "Garfield Park Exhibition of Sculpture",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Open document/ })).toBeVisible();
});

test("a work shows its other views, catalogue entries and record links", async ({
  page,
}) => {
  await gotoReady(page, "/en/artworks/27992");
  await expect(page.getByText("1926.224")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Painting and Sculpture of Europe" }),
  ).toHaveAttribute("href", "/en/browse/departments/PC-10");
  await expect(
    page.getByRole("link", { name: /IIIF manifest/ }),
  ).toHaveAttribute(
    "href",
    "https://api.artic.edu/api/v1/artworks/27992/manifest.json",
  );
  await expect(
    page.getByRole("region", { name: "More views" }).getByRole("img"),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole("region", { name: "Catalogue entries" })
      .getByRole("link", { name: /Cat\. 44/ }),
  ).toHaveAttribute("href", "/en/read/catalogue-entries/36744351949");
  await expect(
    page.getByRole("region", { name: "Video" }).locator("video"),
  ).toHaveCount(1);
});

test("the new pages fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/zh-tw/search?q=monet",
    "/en/artists",
    "/zh-tw/browse",
    "/en/browse/places",
    "/zh-tw/read/articles/826",
    "/en/events",
    "/zh-tw/visit",
    "/en/shop",
    "/en/media",
  ]) {
    await gotoReady(page, path);
    await expectNoHorizontalOverflow(page);
  }
});
