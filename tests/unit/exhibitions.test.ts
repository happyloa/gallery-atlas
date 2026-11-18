import { describe, expect, it } from "vitest";
import {
  addToExhibition,
  createExhibition,
  deleteExhibition,
  EMPTY_COLLECTION,
  findExhibition,
  MAX_EXHIBITION_ITEMS,
  MAX_EXHIBITION_TITLE,
  MAX_EXHIBITIONS,
  parseCollection,
  removeFromExhibition,
  renameExhibition,
  serializeCollection,
} from "@/lib/collections/schema";
import type { CollectionState } from "@/lib/collections/schema";

/** Unwraps a successful update, failing the test otherwise. */
function ok<T>(
  result:
    | { ok: true; state: CollectionState; value: T }
    | { ok: false; reason: string },
) {
  if (!result.ok) throw new Error(`expected success, got ${result.reason}`);
  return result;
}

function withTwo(): CollectionState {
  let state = ok(
    createExhibition(EMPTY_COLLECTION, "Night scenes", "a", 1),
  ).state;
  state = ok(createExhibition(state, "Water", "b", 2)).state;
  state = ok(addToExhibition(state, "a", 27992, 3)).state;
  return ok(addToExhibition(state, "b", 16568, 4)).state;
}

describe("createExhibition", () => {
  it("creates with a cleaned title, newest first", () => {
    const state = withTwo();
    expect(state.exhibitions.map((e) => [e.id, e.title])).toEqual([
      ["b", "Water"],
      ["a", "Night scenes"],
    ]);
    const created = ok(
      createExhibition(EMPTY_COLLECTION, "   Quiet\n  rooms  ", "x", 9),
    );
    expect(created.value).toEqual({
      id: "x",
      title: "Quiet rooms",
      artworkIds: [],
      createdAt: 9,
      updatedAt: 9,
    });
  });

  it("rejects an empty title or a duplicate id", () => {
    expect(createExhibition(EMPTY_COLLECTION, "   ", "x")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(createExhibition(withTwo(), "Again", "a")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("caps the title length, counting characters not bytes", () => {
    const created = ok(
      createExhibition(EMPTY_COLLECTION, "展".repeat(200), "x"),
    );
    expect(Array.from(created.value.title)).toHaveLength(MAX_EXHIBITION_TITLE);
  });

  it(`allows at most ${MAX_EXHIBITIONS} exhibitions`, () => {
    let state = EMPTY_COLLECTION;
    for (let i = 0; i < MAX_EXHIBITIONS; i++)
      state = ok(createExhibition(state, `E${i}`, `id${i}`)).state;
    expect(createExhibition(state, "One more", "extra")).toEqual({
      ok: false,
      reason: "limit",
    });
  });
});

describe("renameExhibition and deleteExhibition", () => {
  it("renames one exhibition and leaves the others alone", () => {
    const before = withTwo();
    const after = ok(renameExhibition(before, "a", "Nocturnes", 10)).state;
    expect(findExhibition(after, "a")?.title).toBe("Nocturnes");
    expect(findExhibition(after, "b")).toEqual(findExhibition(before, "b"));
  });

  it("refuses an empty name and unknown ids", () => {
    expect(renameExhibition(withTwo(), "a", "  ")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(renameExhibition(withTwo(), "zzz", "Name")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("deletes only the chosen exhibition and keeps favorites", () => {
    const before = { ...withTwo(), favorites: [{ id: 27992, savedAt: 1 }] };
    const after = ok(deleteExhibition(before, "a")).state;
    expect(after.exhibitions.map((e) => e.id)).toEqual(["b"]);
    expect(after.favorites).toEqual(before.favorites);
    expect(deleteExhibition(after, "a")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("works in an exhibition", () => {
  it("keeps each work once per exhibition, without touching other exhibitions", () => {
    let state = withTwo();
    state = ok(addToExhibition(state, "a", 27992)).state;
    state = ok(addToExhibition(state, "a", 14655)).state;
    expect(findExhibition(state, "a")?.artworkIds).toEqual([27992, 14655]);
    expect(findExhibition(state, "b")?.artworkIds).toEqual([16568]);
  });

  it(`allows at most ${MAX_EXHIBITION_ITEMS} works`, () => {
    let state = ok(createExhibition(EMPTY_COLLECTION, "Big", "big")).state;
    for (let i = 1; i <= MAX_EXHIBITION_ITEMS; i++)
      state = ok(addToExhibition(state, "big", i)).state;
    expect(addToExhibition(state, "big", 9999)).toEqual({
      ok: false,
      reason: "limit",
    });
    // Re-adding a work that is already there is still fine at the limit.
    expect(addToExhibition(state, "big", 1).ok).toBe(true);
  });

  it("rejects invalid artwork ids and unknown exhibitions", () => {
    expect(addToExhibition(withTwo(), "a", -1)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(addToExhibition(withTwo(), "missing", 1)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("removes one or several works", () => {
    let state = withTwo();
    state = ok(addToExhibition(state, "a", 14655)).state;
    state = ok(removeFromExhibition(state, "a", 27992)).state;
    expect(findExhibition(state, "a")?.artworkIds).toEqual([14655]);
    state = ok(removeFromExhibition(state, "a", [14655, 1])).state;
    expect(findExhibition(state, "a")?.artworkIds).toEqual([]);
  });

  it("survives a save and reload", () => {
    const state = withTwo();
    expect(parseCollection(serializeCollection(state))).toEqual({
      state,
      outcome: "ok",
    });
  });
});
