/**
 * Hangs a tour's works in 3D rooms. A room holds at most eight works, so a longer tour is
 * shared evenly across several rooms, in the order the stops first reach each work.
 */
import { MAX_WORKS } from "@/components/gallery-room/layout";

/** A spot on the walls: which room, and which work in that room. */
export interface RoomPlace {
  room: number;
  work: number;
}

export interface TourRoomPlan<T> {
  rooms: T[][];
  /** For each stop, where its own work hangs; null when it has no work to show. */
  places: (RoomPlace | null)[];
  /**
   * For each stop, where the visitor stands. A stop without a work stays by the last work
   * heard; stops before the first work wait in front of it. Null only in an empty plan.
   */
  anchors: (RoomPlace | null)[];
}

export function planTourRooms<T extends { id: number }>(
  stops: readonly (T | null | undefined)[],
  perRoom: number = MAX_WORKS,
): TourRoomPlan<T> {
  // A Map keeps each id where it first appeared.
  const works = [
    ...new Map(
      stops.flatMap((work) => (work ? [[work.id, work] as const] : [])),
    ).values(),
  ];

  const roomCount = Math.ceil(works.length / perRoom);
  const rooms: T[][] = [];
  const hung = new Map<number, RoomPlace>();
  let next = 0;
  for (let room = 0; room < roomCount; room++) {
    // Even shares, the larger rooms first: 11 works become rooms of 6 and 5.
    const size =
      Math.floor(works.length / roomCount) +
      (room < works.length % roomCount ? 1 : 0);
    const inRoom = works.slice(next, next + size);
    inRoom.forEach((work, index) => hung.set(work.id, { room, work: index }));
    rooms.push(inRoom);
    next += size;
  }

  const places = stops.map((work) =>
    work ? (hung.get(work.id) ?? null) : null,
  );
  const first = places.find((place) => place !== null) ?? null;
  let last = first;
  const anchors = places.map((place) => {
    last = place ?? last;
    return last;
  });

  return { rooms, places, anchors };
}
