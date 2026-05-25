import type { RoomStudent } from "./types";

const FIRST = [
  "Aiden",
  "Bella",
  "Caleb",
  "Diana",
  "Ethan",
  "Faith",
  "Gavin",
  "Holly",
  "Ivan",
  "Jade",
  "Kai",
  "Luna",
  "Miles",
  "Nora",
  "Oscar",
  "Paige",
  "Quinn",
  "Rosa",
  "Seth",
  "Tara",
  "Uma",
  "Vince",
  "Willa",
  "Xander",
  "Yara",
  "Zane",
];

const LAST = [
  "Nguyen",
  "Patel",
  "Garcia",
  "Kim",
  "Brown",
  "Lee",
  "Martinez",
  "Wilson",
  "Singh",
  "Cohen",
  "Murphy",
  "Rivera",
  "Chen",
  "Foster",
  "Bell",
  "Hayes",
  "Cole",
  "Ward",
  "Price",
  "Ross",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Real/demo students appended to a room's generated roster. */
const ROOM_ROSTER_ADDITIONS: Record<string, RoomStudent[]> = {
  "602": [{ id: "GHS-1061", name: "Jay Roy", grade: "10" }],
};

export function rosterForRoom(roomNumber: string, size = 6): RoomStudent[] {
  const base = hash(roomNumber);
  const grades = ["9", "10", "11", "12"];
  const generated = Array.from({ length: size }, (_, i) => {
    const fi = (base + i * 7) % FIRST.length;
    const li = (base + i * 11) % LAST.length;
    const gi = (base + i) % grades.length;
    return {
      id: `r${roomNumber}-${i}`,
      name: `${FIRST[fi]} ${LAST[li]}`,
      grade: grades[gi]!,
    };
  });
  return [...generated, ...(ROOM_ROSTER_ADDITIONS[roomNumber] ?? [])];
}
