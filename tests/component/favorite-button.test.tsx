// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FavoriteButton } from "@/components/collections/favorite-button";
import { MAX_FAVORITES, STORAGE_KEY } from "@/lib/collections/schema";
import { resetStoreCache } from "@/lib/collections/store";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/lib/i18n/provider";

function renderButton(
  variant: "icon" | "full" = "full",
  locale: "en" | "zh-tw" = "en",
) {
  return render(
    <I18nProvider locale={locale} dict={getDictionary(locale)}>
      <FavoriteButton
        artworkId={27992}
        title="La Grande Jatte"
        variant={variant}
      />
    </I18nProvider>,
  );
}

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");

beforeEach(() => {
  localStorage.clear();
  resetStoreCache();
});
afterEach(cleanup);

describe("FavoriteButton", () => {
  it("toggles with a mouse and persists to localStorage", async () => {
    const user = userEvent.setup();
    renderButton();
    const button = screen.getByRole("button", { pressed: false });
    expect(button).toHaveProperty(
      "textContent",
      expect.stringContaining("Save"),
    );

    await user.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.textContent).toContain("Saved");
    expect(saved().favorites.map((f: { id: number }) => f.id)).toEqual([27992]);
    expect(screen.getByRole("status").textContent).toBe(
      "Saved to your collection.",
    );

    await user.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(saved().favorites).toEqual([]);
    expect(screen.getByRole("status").textContent).toBe(
      "Removed from your collection.",
    );
  });

  it("works from the keyboard (Tab, Enter, Space)", async () => {
    const user = userEvent.setup();
    renderButton();
    await user.tab();
    const button = screen.getByRole("button");
    expect(document.activeElement).toBe(button);
    await user.keyboard("{Enter}");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    await user.keyboard(" ");
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("names the icon button by what it will do, in the page language", async () => {
    const user = userEvent.setup();
    renderButton("icon", "zh-tw");
    const button = screen.getByRole("button", {
      name: "將「La Grande Jatte」加入收藏",
    });
    await user.click(button);
    expect(
      screen.getByRole("button", { name: "將「La Grande Jatte」移出收藏" }),
    ).toBeTruthy();
  });

  it("shows the saved state already stored", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        favorites: [{ id: 27992, savedAt: 1 }],
        exhibitions: [],
      }),
    );
    renderButton();
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("follows changes made in another tab", () => {
    renderButton();
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    act(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          favorites: [{ id: 27992, savedAt: 1 }],
          exhibitions: [],
        }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("survives corrupt stored data", async () => {
    localStorage.setItem(STORAGE_KEY, "{broken");
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button"));
    expect(saved().favorites.map((f: { id: number }) => f.id)).toEqual([27992]);
  });

  it("explains a full collection instead of failing silently", async () => {
    const favorites = Array.from({ length: MAX_FAVORITES }, (_, i) => ({
      id: 100_000 + i,
      savedAt: 1,
    }));
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, favorites, exhibitions: [] }),
    );
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("alert").textContent).toContain(
      String(MAX_FAVORITES),
    );
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe(
      "false",
    );
  });
});
