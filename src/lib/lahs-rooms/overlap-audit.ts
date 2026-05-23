import type { LahsRoom } from "./types";

export function countRoomOverlaps(rooms: LahsRoom[]) {
  let overlaps = 0;
  const samples: [string, string][] = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i]!;
      const b = rooms[j]!;
      const hit =
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y;
      if (hit) {
        overlaps++;
        if (samples.length < 6) samples.push([a.number, b.number]);
      }
    }
  }
  const maxX = Math.max(...rooms.map((r) => r.x + r.w));
  const maxY = Math.max(...rooms.map((r) => r.y + r.h));
  return { overlaps, samples, maxX, maxY, roomCount: rooms.length };
}
