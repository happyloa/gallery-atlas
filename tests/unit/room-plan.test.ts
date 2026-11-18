import { describe, expect, it } from "vitest";
import { planTourRooms } from "@/lib/tours/room-plan";

const work = (id: number) => ({ id });
const works = (count: number) =>
  Array.from({ length: count }, (_, index) => work(index + 1));

describe("planTourRooms", () => {
  it("keeps a short tour in one room, in stop order", () => {
    const plan = planTourRooms([work(5), work(2), work(9)]);
    expect(plan.rooms).toEqual([[work(5), work(2), work(9)]]);
    expect(plan.places).toEqual([
      { room: 0, work: 0 },
      { room: 0, work: 1 },
      { room: 0, work: 2 },
    ]);
  });

  it("shares a long tour evenly across rooms of at most eight", () => {
    expect(planTourRooms(works(8)).rooms.map((r) => r.length)).toEqual([8]);
    expect(planTourRooms(works(9)).rooms.map((r) => r.length)).toEqual([5, 4]);
    expect(planTourRooms(works(11)).rooms.map((r) => r.length)).toEqual([6, 5]);
    expect(planTourRooms(works(17)).rooms.map((r) => r.length)).toEqual([
      6, 6, 5,
    ]);
  });

  it("places the same work once, however many stops discuss it", () => {
    const plan = planTourRooms([work(1), work(2), work(1)]);
    expect(plan.rooms).toEqual([[work(1), work(2)]]);
    expect(plan.places[2]).toEqual(plan.places[0]);
  });

  it("stands by the nearest work during stops that have none", () => {
    const plan = planTourRooms([null, work(1), undefined, work(2), null]);
    expect(plan.places).toEqual([
      null,
      { room: 0, work: 0 },
      null,
      { room: 0, work: 1 },
      null,
    ]);
    expect(plan.anchors).toEqual([
      { room: 0, work: 0 },
      { room: 0, work: 0 },
      { room: 0, work: 0 },
      { room: 0, work: 1 },
      { room: 0, work: 1 },
    ]);
  });

  it("plans no rooms for a tour with nothing to show", () => {
    const plan = planTourRooms([null, null]);
    expect(plan.rooms).toEqual([]);
    expect(plan.anchors).toEqual([null, null]);
  });
});
