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

const MIDDLE_INITIALS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const usedGeneratedNames = new Set<string>();

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Real/demo students appended to a room's generated roster. */
const ROOM_ROSTER_ADDITIONS: Record<string, RoomStudent[]> = {
  "602": [{ id: "GHS-1061", name: "Jay Roy", grade: "10" }],
};

function generatedStudentName(roomNumber: string, index: number, seed: number): string {
  const total = FIRST.length * MIDDLE_INITIALS.length * LAST.length;
  let cursor = (seed + index * 9973) % total;

  for (let attempt = 0; attempt < total; attempt++) {
    const first = FIRST[cursor % FIRST.length]!;
    const middle = MIDDLE_INITIALS[Math.floor(cursor / FIRST.length) % MIDDLE_INITIALS.length]!;
    const last = LAST[Math.floor(cursor / (FIRST.length * MIDDLE_INITIALS.length)) % LAST.length]!;
    const name = `${first} ${middle}. ${last}`;
    if (!usedGeneratedNames.has(name)) {
      usedGeneratedNames.add(name);
      return name;
    }
    cursor = (cursor + 1) % total;
  }

  return `${FIRST[seed % FIRST.length]} ${roomNumber}-${index} ${LAST[seed % LAST.length]}`;
}

export function rosterForRoom(roomNumber: string, size = 6): RoomStudent[] {
  const base = hash(roomNumber);
  const grades = ["9", "10", "11", "12"];
  const generated = Array.from({ length: size }, (_, i) => {
    const gi = (base + i) % grades.length;
    return {
      id: `r${roomNumber}-${i}`,
      name: generatedStudentName(roomNumber, i, base),
      grade: grades[gi]!,
    };
  });
  return [...generated, ...(ROOM_ROSTER_ADDITIONS[roomNumber] ?? [])];
}
