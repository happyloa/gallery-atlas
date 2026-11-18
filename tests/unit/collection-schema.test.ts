import { describe, expect, it } from "vitest";
import {
  addFavorite,
  EMPTY_COLLECTION,
  MAX_EXHIBITION_ITEMS,
  MAX_FAVORITES,
  parseCollection,
  removeFavorite,
  removeFavorites,
  serializeCollection,
  STORAGE_VERSION,
} from "@/lib/collections/schema";

const stored = (value: unknown) => JSON.stringify(value);

describe("parseCollection", () => {
  it("treats a missing value as an empty collection", () => {
    expect(parseCollection(null)).toEqual({
      state: EMPTY_COLLECTION,
      outcome: "empty",
    });
    expect(parseCollection("")).toEqual({
      state: EMPTY_COLLECTION,
      outcome: "empty",
    });
  });

  it("starts fresh when the stored JSON is corrupt", () => {
    expect(parseCollection("{not json")).toEqual({
      state: EMPTY_COLLECTION,
      outcome: "reset",
    });
    expect(parseCollection("null").outcome).toBe("reset");
    expect(parseCollection('"a string"').outcome).toBe("reset");
  });

  it("starts fresh on an unknown future version rather than guessing", () => {
    expect(
      parseCollection(stored({ version: 99, favorites: [] })).outcome,
    ).toBe("reset");
    expect(parseCollection(stored({ version: 0, favorites: [] })).outcome).toBe(
      "reset",
    );
  });

  it("migrates the pre-versioning shape (a bare array of ids)", () => {
    const { state, outcome } = parseCollection(
      stored([27992, "x", 27992, -1, 14655]),
      1000,
    );
    expect(outcome).toBe("migrated");
    expect(state.version).toBe(STORAGE_VERSION);
    expect(state.favorites).toEqual([
      { id: 27992, savedAt: 1000 },
      { id: 14655, savedAt: 1000 },
    ]);
  });

  it("keeps valid data untouched", () => {
    const value = {
      version: 1,
      favorites: [{ id: 1, savedAt: 5 }],
      exhibitions: [],
    };
    expect(parseCollection(stored(value))).toEqual({
      state: value,
      outcome: "ok",
    });
  });

  it("repairs invalid entries and duplicate ids instead of failing", () => {
    const { state, outcome } = parseCollection(
      stored({
        version: 1,
        favorites: [
          { id: 1, savedAt: 5 },
          { id: 1, savedAt: 9 },
          { id: "2", savedAt: 5 },
          { id: 3 },
          null,
          { id: 4, savedAt: 6, extra: "ignored" },
        ],
      }),
    );
    expect(outcome).toBe("repaired");
    expect(state.favorites).toEqual([
      { id: 1, savedAt: 5 },
      { id: 4, savedAt: 6 },
    ]);
  });

  it("caps oversized lists", () => {
    const favorites = Array.from({ length: MAX_FAVORITES + 50 }, (_, i) => ({
      id: i + 1,
      savedAt: 1,
    }));
    const exhibition = {
      id: "x",
      title: "  Night   scenes  ",
      artworkIds: Array.from(
        { length: MAX_EXHIBITION_ITEMS + 20 },
        (_, i) => i + 1,
      ),
      createdAt: 1,
      updatedAt: 1,
    };
    const { state, outcome } = parseCollection(
      stored({ version: 1, favorites, exhibitions: [exhibition] }),
    );
    expect(outcome).toBe("repaired");
    expect(state.favorites).toHaveLength(MAX_FAVORITES);
    expect(state.exhibitions[0].artworkIds).toHaveLength(MAX_EXHIBITION_ITEMS);
    expect(state.exhibitions[0].title).toBe("Night scenes");
  });

  it("round-trips through serialize", () => {
    const state = {
      version: 1 as const,
      favorites: [{ id: 7, savedAt: 1 }],
      exhibitions: [],
    };
    expect(parseCollection(serializeCollection(state)).state).toEqual(state);
  });
});

describe("favorites", () => {
  it("adds newest first and ignores repeats", () => {
    let state = EMPTY_COLLECTION;
    for (const id of [1, 2, 1]) {
      const result = addFavorite(state, id, id);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state.favorites.map((f) => f.id)).toEqual([2, 1]);
  });

  it("refuses invalid ids and a full collection", () => {
    expect(addFavorite(EMPTY_COLLECTION, -5)).toEqual({
      ok: false,
      reason: "invalid",
    });
    const full = {
      ...EMPTY_COLLECTION,
      favorites: Array.from({ length: MAX_FAVORITES }, (_, i) => ({
        id: i + 1,
        savedAt: 1,
      })),
    };
    expect(addFavorite(full, 999_999)).toEqual({ ok: false, reason: "limit" });
  });

  it("removes one or many", () => {
    const state = {
      ...EMPTY_COLLECTION,
      favorites: [1, 2, 3].map((id) => ({ id, savedAt: 1 })),
    };
    const one = removeFavorite(state, 2);
    expect(one.ok && one.state.favorites.map((f) => f.id)).toEqual([1, 3]);
    const many = removeFavorites(state, [1, 3]);
    expect(many.ok && many.state.favorites.map((f) => f.id)).toEqual([2]);
  });

  it("never mutates the frozen empty collection", () => {
    addFavorite(EMPTY_COLLECTION, 1);
    expect(EMPTY_COLLECTION.favorites).toHaveLength(0);
  });
});
