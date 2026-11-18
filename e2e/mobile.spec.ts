import { expect, expectNoHorizontalOverflow, gotoReady, test } from "./fixtures";

test("on a phone: no sideways scroll, and the menu and CTA work", async ({
  page,
}) => {
  for (const path of [
    "/en",
    "/zh-tw",
    "/en/artworks/27992",
    "/en/about",
    "/en/collection",
  ]) {
    await gotoReady(page, path);
    await expect(page.locator("main")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await gotoReady(page, "/en");
  const menu = page.getByRole("button", { name: "Open menu" });
  await menu.click();
  await expect(
    page.getByRole("button", { name: "Close menu" }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );

  await page.getByRole("link", { name: "Explore the collection" }).click();
  await expect(page).toHaveURL(/#explore$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Explore the collection" }),
  ).toBeInViewport();
});
