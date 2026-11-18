import { expect, gotoReady, test } from "./fixtures";

const JATTE = "A Sunday on La Grande Jatte — 1884";
const STORAGE_KEY = "gallery-atlas:collection";

test("museum exhibitions lead to their works and the gallery they hang in", async ({
  page,
}) => {
  await gotoReady(page, "/en/exhibitions");
  await expect(
    page.getByRole("heading", { level: 1, name: "Exhibitions" }),
  ).toBeVisible();
  const card = page
    .getByRole("article")
    .filter({ hasText: "Seurat and His Circle" });
  await expect(card.getByText("On now")).toBeVisible();
  await expect(card.getByText("3 works listed")).toBeVisible();
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Monet Water Garden" })
      .getByText("Past"),
  ).toBeVisible();

  await card.getByRole("link", { name: "Seurat and His Circle" }).click();
  await expect(page).toHaveURL(/\/en\/exhibitions\/9001$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Seurat and His Circle" }),
  ).toBeVisible();
  // Of the three listed works, the restricted one is left out.
  const works = page.getByRole("region", {
    name: "Public-domain works in this exhibition",
  });
  await expect(works.getByRole("article")).toHaveCount(2);
  await expect(works.getByRole("link", { name: JATTE })).toBeVisible();

  await page.getByRole("link", { name: "Gallery 240" }).click();
  await expect(page).toHaveURL(/\/en\/galleries\/2147478672$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Gallery 240" }),
  ).toBeVisible();
  await expect(page.getByText("Floor 2")).toBeVisible();
  await expect(page.getByText("1 work", { exact: true })).toBeVisible();
});

test("a work offers its audio guide, further reading and its place of origin", async ({
  page,
}) => {
  await gotoReady(page, "/en/artworks/27992");
  const listen = page.getByRole("region", { name: "Listen" });
  await expect(listen.getByText("Audio guide, stop 781")).toBeVisible();
  await expect(listen.locator("audio")).toHaveAttribute(
    "src",
    "https://www.artic.edu/assets/d9683532-66fd-67c3-5588-021527d115af",
  );
  await expect(
    page.getByRole("region", { name: "Further reading" }).getByRole("link", {
      name: /Caillebotte and Seurat/,
    }),
  ).toHaveAttribute("href", "https://www.artic.edu/articles/826");

  await page.getByRole("link", { name: "More from France" }).click();
  await expect(page).toHaveURL(/\/en\?place=France#explore$/);
  await expect(
    page.getByRole("link", { name: "Remove filter: Origin: France" }),
  ).toBeVisible();
});

test("the map lists every place and links each to Explore", async ({
  page,
}) => {
  await gotoReady(page, "/zh-tw/map");
  await expect(
    page.getByRole("heading", { level: 1, name: "作品從哪裡來" }),
  ).toBeVisible();
  const places = page.getByRole("region", { name: "所有產地" });
  await places.getByRole("link", { name: /法國/ }).click();
  await expect(page).toHaveURL(/\/zh-tw\?place=france#explore$/);
  await expect(
    page.getByRole("link", { name: "移除篩選：產地：法國" }),
  ).toBeVisible();
});

test("today's work, a random work, ordering and suggestions", async ({
  page,
}) => {
  await gotoReady(page, "/en");
  const ways = page.getByRole("region", { name: "Start somewhere" });
  await expect(ways.getByText("Today’s work")).toBeVisible();
  await expect(ways.getByRole("link", { name: "Look closer" })).toBeVisible();

  // Ordering is a link like any filter, and the keyword box offers suggestions.
  const explore = page.locator("#explore");
  await explore.getByRole("link", { name: "Oldest first" }).click();
  await expect(page).toHaveURL(/\/en\?sort=oldest#explore$/);
  await expect(
    explore.getByRole("link", { name: "Oldest first" }),
  ).toHaveAttribute("aria-current", "true");
  await page.getByRole("combobox", { name: "Search artworks" }).fill("seu");
  await expect(
    page.locator("#explore-suggestions option[value='Georges Seurat']"),
  ).toHaveCount(1);

  const response = await page.goto("/en/random");
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/en\/artworks\/\d+$/);
});

test("a personal exhibition can be shared by link and saved by someone else", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await gotoReady(page, "/en");
  await page.evaluate(
    ([key]) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          favorites: [],
          exhibitions: [
            {
              id: "show",
              title: "Evening light",
              artworkIds: [27992, 28560],
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        }),
      ),
    [STORAGE_KEY],
  );
  await gotoReady(page, "/en/collection/show");
  await page.getByRole("button", { name: "Share link" }).click();
  await expect(
    page.getByRole("button", { name: "Link copied." }),
  ).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(
    /\/en\/collection\/shared\?title=Evening\+light&ids=27992%2C28560$/,
  );

  // Someone else opens it with an empty collection.
  await page.evaluate(([key]) => localStorage.removeItem(key), [STORAGE_KEY]);
  await gotoReady(page, new URL(link).pathname + new URL(link).search);
  await expect(
    page.getByRole("heading", { level: 1, name: "Evening light" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: JATTE })).toBeVisible();
  await page.getByRole("button", { name: "Save to My Exhibitions" }).click();
  await expect(page.getByText("Saved as “Evening light”.")).toBeVisible();
  await page.getByRole("link", { name: "Open it" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Evening light" }),
  ).toBeVisible();
  await expect(page.getByText("2 works")).toBeVisible();
});

test("a broken share link says so", async ({ page }) => {
  await gotoReady(page, "/en/collection/shared?title=&ids=");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "This link doesn’t hold an exhibition.",
    }),
  ).toBeVisible();
});
