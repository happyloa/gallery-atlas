/** Live check that random picks really differ (the API ignores random_score). */
import { describe, expect, it } from "vitest";
import { getRandomArtworkId, getWorkOfTheDayId } from "@/lib/artic/museum";

describe("random and daily works (live)", () => {
  it("lands on different works", async () => {
    const ids = [];
    for (let i = 0; i < 8; i++) ids.push(await getRandomArtworkId());
    console.log("random ids", ids.join(", "));
    expect(ids.every((id) => typeof id === "number")).toBe(true);
    expect(new Set(ids).size).toBeGreaterThan(4);
  });

  it("changes the daily work from one day to the next", async () => {
    const days = ["2026-11-18", "2026-11-19", "2026-11-20"].map((d) => new Date(`${d}T12:00:00Z`));
    const ids = await Promise.all(days.map((d) => getWorkOfTheDayId(d)));
    console.log("daily ids", ids.join(", "));
    expect(new Set(ids).size).toBe(3);
  });
});
