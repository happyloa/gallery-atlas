import type { Page } from "@playwright/test";
import { expect, gotoReady, test } from "./fixtures";

/** A silent WAV, so recordings really play and end in the browser. */
function silence(seconds: number): Buffer {
  const rate = 8000;
  const size = rate * seconds;
  const body = Buffer.alloc(44 + size, 128);
  body.write("RIFF", 0);
  body.writeUInt32LE(36 + size, 4);
  body.write("WAVEfmt ", 8);
  body.writeUInt32LE(16, 16);
  body.writeUInt16LE(1, 20);
  body.writeUInt16LE(1, 22);
  body.writeUInt32LE(rate, 24);
  body.writeUInt32LE(rate, 28);
  body.writeUInt16LE(1, 32);
  body.writeUInt16LE(8, 34);
  body.write("data", 36);
  body.writeUInt32LE(size, 40);
  return body;
}

async function serveAudio(page: Page, seconds = 1) {
  const requested: string[] = [];
  await page.route("**/*.mp3", async (route) => {
    requested.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: silence(seconds),
    });
  });
  return requested;
}

const currentStop = (page: Page) =>
  page.locator('ol > li[aria-current="true"]');

test("the tour list leads to a tour from the main navigation", async ({
  page,
}) => {
  await gotoReady(page, "/en");
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Audio tours" })
    .click();
  await expect(page).toHaveURL(/\/en\/tours$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Audio tours" }),
  ).toBeVisible();

  const card = page
    .getByRole("article")
    .filter({ hasText: "The Essentials Tour" });
  await expect(
    card.getByText("34 min · 24 stops · Mandarin audio"),
  ).toBeVisible();
  await card.getByRole("link", { name: "The Essentials Tour" }).click();
  await expect(page).toHaveURL(/\/en\/tours\/2193$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "The Essentials Tour" }),
  ).toBeVisible();
});

test("a tour plays stop after stop, and remembers where you were", async ({
  page,
}) => {
  const requested = await serveAudio(page);
  await gotoReady(page, "/en/tours/2193");

  await page.getByRole("button", { name: "Start the tour" }).click();
  const player = page.getByRole("region", { name: "Audio tours" });
  await expect(player).toBeVisible();
  await expect(currentStop(page)).toContainText("Introduction");

  // The introduction ends by itself and the first stop follows.
  await expect(currentStop(page)).toContainText("Stop 1", { timeout: 15_000 });

  await player.getByRole("button", { name: "Next stop" }).click();
  await expect(currentStop(page)).toContainText("Stop 2");
  await player.getByRole("button", { name: "Previous stop" }).click();
  await expect(currentStop(page)).toContainText("Stop 1");
  await player.getByRole("button", { name: "Next stop" }).click();
  await expect(currentStop(page)).toContainText("Stop 2");
  await player.getByRole("button", { name: /^Playback speed/ }).click();
  await expect(
    player.getByRole("button", { name: "Playback speed: 1.25×" }),
  ).toBeVisible();
  expect(requested.length).toBeGreaterThan(2);

  await page.reload();
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  await expect(
    page.getByRole("button", { name: /^Continue from stop \d+/ }),
  ).toBeVisible();
});

test("the gallery view follows the tour and opens full screen", async ({
  page,
}) => {
  await serveAudio(page, 60);
  await gotoReady(page, "/en/tours/2193");
  const stage = page.getByRole("region", { name: "Gallery view" });
  await expect(stage).toBeVisible();

  await page.getByRole("button", { name: "Start the tour" }).click();
  await expect(stage.getByText("Introduction")).toBeVisible();

  const player = page.getByRole("region", { name: "Audio tours" });
  const workStop = currentStop(page).getByRole("link", {
    name: "View artwork",
  });
  // Walk on to the first stop that has a work to show.
  await expect(async () => {
    await player.getByRole("button", { name: "Next stop" }).click();
    await expect(workStop).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 20_000 });
  const href = await workStop.getAttribute("href");
  await expect(
    stage.getByRole("link", { name: "View artwork" }),
  ).toHaveAttribute("href", href ?? "");

  await stage.getByRole("button", { name: "Full screen" }).click();
  await expect(stage).toHaveCSS("position", "fixed");
  await expect(player.getByRole("button", { name: "Next stop" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(stage).not.toHaveCSS("position", "fixed");
});

test("a tour with no public-domain works has no gallery view", async ({
  page,
}) => {
  await gotoReady(page, "/en/tours/5470");
  await expect(
    page.getByRole("button", { name: "Start the tour" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Gallery view" })).toHaveCount(
    0,
  );
});

test("the Chinese site plays Mandarin audio with a Traditional Chinese transcript", async ({
  page,
}) => {
  // Long enough that the stop doesn't end while the transcript is being read.
  const requested = await serveAudio(page, 60);
  await page.route("**/tour-transcripts/*.json", (route) =>
    route.fulfill({ json: { paragraphs: ["解說員：", "這是中文逐字稿。"] } }),
  );
  await gotoReady(page, "/zh-tw/tours/2193");
  const languages = page.getByRole("group", { name: "語音語言" });
  await expect(languages.getByRole("button", { name: "中文" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "開始導覽" }).click();
  await expect(currentStop(page)).toBeVisible();
  await expect
    .poll(() => requested.at(-1) ?? "")
    .toContain("aic-mobile-tours.artic.edu");

  await currentStop(page).getByText("逐字稿", { exact: true }).click();
  await expect(currentStop(page).getByText("這是中文逐字稿。")).toBeVisible();

  await languages.getByRole("button", { name: "English" }).click();
  await expect
    .poll(() => requested.at(-1) ?? "")
    .toContain("www.artic.edu/mobile/audio");
  await expect(
    currentStop(page).getByText(/^Fixture transcript \d+\.$/),
  ).toBeVisible();
});

test("an artwork lists its recordings, transcript and tours", async ({
  page,
}) => {
  await gotoReady(page, "/en/artworks/27992");
  const listen = page.getByRole("region", { name: "Listen" });
  await expect(listen.locator("audio").first()).toHaveAttribute(
    "src",
    /\/mobile\/audio\/fixture-\d+\.mp3$/,
  );
  await listen.getByText("Transcript", { exact: true }).first().click();
  await expect(
    listen.getByText(/^Fixture transcript \d+\.$/).first(),
  ).toBeVisible();
  await listen.getByRole("link", { name: "The Essentials Tour" }).click();
  await expect(page).toHaveURL(/\/en\/tours\/2193$/);
});

test("an unknown tour is a 404", async ({ page }) => {
  const response = await page.goto("/en/tours/999999");
  expect(response?.status()).toBe(404);
});
