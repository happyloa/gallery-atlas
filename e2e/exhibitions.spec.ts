import { expect, gotoReady, test } from "./fixtures";

const STORAGE_KEY = "gallery-atlas:collection";
const JATTE = "A Sunday on La Grande Jatte — 1884";
const SISTERS = "Two Sisters (On the Terrace)";

test("create an exhibition, fill it, rename it, and delete it", async ({
  page,
}) => {
  // Start one from an artwork page.
  await gotoReady(page, "/en/artworks/27992");
  await page.getByRole("button", { name: /^Add to exhibition/ }).click();
  const picker = page.getByRole("dialog", { name: "Add to an exhibition" });
  await expect(picker).toBeVisible();
  await expect(
    picker.getByText("You don’t have any exhibitions yet."),
  ).toBeVisible();
  await picker.getByLabel("New exhibition name").fill("Night scenes");
  await picker.getByRole("button", { name: "Create and add" }).click();
  await expect(
    picker.getByRole("checkbox", { name: /Night scenes/ }),
  ).toBeChecked();
  await expect(picker.getByRole("status")).toHaveText(
    "Added to “Night scenes”.",
  );
  await picker.getByRole("button", { name: "Done" }).last().click();
  await expect(picker).toBeHidden();

  // Add a second work to the existing exhibition.
  await gotoReady(page, "/en/artworks/14655");
  await page.getByRole("button", { name: /^Add to exhibition/ }).click();
  await page.getByRole("checkbox", { name: /Night scenes/ }).check();
  await expect(
    page.getByRole("checkbox", { name: /Night scenes/ }),
  ).toBeChecked();
  await page.keyboard.press("Escape");

  // It shows on My Collection, with both works.
  await gotoReady(page, "/en/collection");
  const section = page.getByRole("region", { name: "My Exhibitions" });
  await expect(
    section.getByRole("link", { name: "Night scenes" }),
  ).toBeVisible();
  await expect(section.getByText("2 works")).toBeVisible();

  await section.getByRole("link", { name: "Night scenes" }).click();
  await expect(page).toHaveURL(/\/en\/collection\/[\w-]+$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Night scenes" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: JATTE })).toBeVisible();
  await expect(page.getByRole("link", { name: SISTERS })).toBeVisible();

  // Remove one work; the change survives a reload.
  await page
    .getByRole("button", { name: `Remove “${SISTERS}” from this exhibition` })
    .click();
  await expect(page.getByRole("link", { name: SISTERS })).toBeHidden();
  await page.reload();
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  await expect(page.getByText(/^1 work/)).toBeVisible();
  await expect(page.getByRole("link", { name: JATTE })).toBeVisible();

  // Rename.
  await page.getByRole("button", { name: "Rename" }).click();
  const name = page.getByLabel("Exhibition name");
  await expect(name).toBeFocused();
  await name.fill("Nocturnes");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { level: 1, name: "Nocturnes" }),
  ).toBeVisible();

  // Delete asks first; Escape keeps it.
  const remove = page.getByRole("button", { name: "Delete exhibition" });
  await remove.click();
  const confirm = page.getByRole("alertdialog", {
    name: "Delete “Nocturnes”?",
  });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(
    page.getByRole("heading", { level: 1, name: "Nocturnes" }),
  ).toBeVisible();

  // Confirming deletes it and returns to My Collection.
  await remove.click();
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/en\/collection$/);
  await expect(page.getByText("No exhibitions yet.")).toBeVisible();
});

test("a work can be added to an exhibition straight from the favorites wall", async ({
  page,
}) => {
  await gotoReady(page, "/en");
  await page.evaluate(
    ([key]) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          favorites: [{ id: 27992, savedAt: 1 }],
          exhibitions: [
            {
              id: "e1",
              title: "Saturday",
              artworkIds: [],
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        }),
      ),
    [STORAGE_KEY],
  );
  await gotoReady(page, "/en/collection");
  await page
    .getByRole("button", { name: `Add “${JATTE}” to an exhibition` })
    .click();
  await page.getByRole("checkbox", { name: /Saturday/ }).check();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("region", { name: "My Exhibitions" }).getByText("1 work"),
  ).toBeVisible();
});

test("limits are explained instead of failing silently", async ({ page }) => {
  await gotoReady(page, "/en");
  await page.evaluate(
    ([key]) => {
      const exhibitions = Array.from({ length: 10 }, (_, i) => ({
        id: `e${i}`,
        title: `Show ${i}`,
        artworkIds: [],
        createdAt: 1,
        updatedAt: 1,
      }));
      localStorage.setItem(
        key,
        JSON.stringify({ version: 1, favorites: [], exhibitions }),
      );
    },
    [STORAGE_KEY],
  );
  await gotoReady(page, "/en/collection");
  await page.getByLabel("New exhibition name").fill("Eleventh");
  await page.getByRole("button", { name: "Create exhibition" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "You can have up to 10 exhibitions. Delete one to make room.",
  );

  await page.getByLabel("New exhibition name").fill("   ");
  await page.getByRole("button", { name: "Create exhibition" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Give the exhibition a name.",
  );
});

test("corrupt stored data and unknown exhibitions don't break the page", async ({
  page,
}) => {
  await gotoReady(page, "/en");
  await page.evaluate(
    ([key]) => localStorage.setItem(key, "{definitely not json"),
    [STORAGE_KEY],
  );
  await gotoReady(page, "/en/collection");
  await expect(page.getByText("Your walls are still bare.")).toBeVisible();
  await expect(page.getByText("No exhibitions yet.")).toBeVisible();
  // The bad value was replaced with a clean, versioned one.
  const stored = await page.evaluate(
    ([key]) => localStorage.getItem(key),
    [STORAGE_KEY],
  );
  expect(JSON.parse(stored ?? "null")).toMatchObject({
    version: 1,
    favorites: [],
    exhibitions: [],
  });

  await gotoReady(page, "/en/collection/does-not-exist");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "This exhibition isn’t in this browser.",
    }),
  ).toBeVisible();
});
