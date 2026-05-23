import { teacherForRoom } from "./teachers";
import { rosterForRoom } from "./roster";
import type { LahsRoom, WingGridSpec } from "./types";

export function buildWingGrid(spec: WingGridSpec): LahsRoom[] {
  const { building, numbers, origin, cols, cellW, cellH, gapX = 0.15, gapY = 0.15 } =
    spec;

  return numbers.map((number, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = origin.x + col * (cellW + gapX);
    const y = origin.y + row * (cellH + gapY);
    const teacher =
      spec.teachers[number] ?? teacherForRoom(number, building);

    return {
      id: `room-${number}`,
      number,
      label: `Room ${number}`,
      building,
      teacher,
      x,
      y,
      w: cellW,
      h: cellH,
      roster: rosterForRoom(number, number.startsWith("6") ? 7 : 6),
    };
  });
}

export function buildSingleRoom(
  number: string,
  building: string,
  bounds: { x: number; y: number; w: number; h: number },
  rosterSize = 8,
): LahsRoom {
  const specialLabels: Record<string, string> = {
    library: "Library",
    "student-services": "Student Services Building",
    theatre: "Room Theater",
  };

  return {
    id: `room-${number}`,
    number,
    label: specialLabels[number] ?? `Room ${number}`,
    building,
    teacher: teacherForRoom(number, building),
    ...bounds,
    roster: rosterForRoom(number, rosterSize),
  };
}
