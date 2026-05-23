import { ALL_ROSTER_STUDENTS, getRoomByNumber, type LahsRoom, type RoomStudent } from "@/lib/lahs-rooms";
import { CAMPUS_MAP } from "@/lib/campus-map-config";

export type DotStatus = "safe" | "unsafe" | "missing";

export type StudentDot = {
  studentId: string;
  studentName: string;
  status: DotStatus;
  x: number;
  y: number;
  walking: boolean;
};

export type Walker = {
  id: string;
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
};

export function hashStr(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function rosterRoomFor(studentId: string): LahsRoom | undefined {
  const match = studentId.match(/^r([^-]+)-/);
  return match ? getRoomByNumber(match[1]) : undefined;
}

export function dotPositionInRoom(
  studentId: string,
  room: LahsRoom,
): { x: number; y: number } {
  const h = hashStr(studentId);
  const px = (h & 0x3ff) / 0x3ff;
  const py = ((h >>> 10) & 0x3ff) / 0x3ff;
  const inset = 0.2;
  return {
    x: room.x + room.w * (inset + (1 - 2 * inset) * px),
    y: room.y + room.h * (inset + (1 - 2 * inset) * py),
  };
}

function fallbackPosition(studentId: string): { x: number; y: number } {
  const h = hashStr(studentId);
  return {
    x: 6 + ((h & 0x3ff) / 0x3ff) * (CAMPUS_MAP.viewBox.w - 12),
    y: 6 + (((h >>> 10) & 0x3ff) / 0x3ff) * (CAMPUS_MAP.viewBox.h - 12),
  };
}

export function rosterPosition(student: RoomStudent): { x: number; y: number } {
  const room = rosterRoomFor(student.id);
  return room ? dotPositionInRoom(student.id, room) : fallbackPosition(student.id);
}

export type StudentStatusInput = {
  /** roster student id -> latest known status from check-ins (student or teacher). */
  statusById: ReadonlyMap<string, DotStatus>;
  /** roster student ids currently unaccounted-for. */
  unaccountedIds: ReadonlySet<string>;
  /** roster student id -> override room number (e.g., student said "I'm in room 408"). */
  roomOverrideById?: ReadonlyMap<string, string>;
  /** roster student id -> walker world position (overrides room-based position). */
  walkerById?: ReadonlyMap<string, Walker>;
};

export function buildStudentDots(input: StudentStatusInput): StudentDot[] {
  const { statusById, unaccountedIds, roomOverrideById, walkerById } = input;
  return ALL_ROSTER_STUDENTS.map((student) => {
    const explicit = statusById.get(student.id);
    const status: DotStatus =
      explicit ?? (unaccountedIds.has(student.id) ? "missing" : "safe");

    const walker = walkerById?.get(student.id);
    if (walker) {
      return {
        studentId: student.id,
        studentName: student.name,
        status,
        x: walker.x,
        y: walker.y,
        walking: true,
      };
    }

    const overrideRoomNumber = roomOverrideById?.get(student.id);
    const overrideRoom = overrideRoomNumber
      ? getRoomByNumber(overrideRoomNumber)
      : undefined;
    const room = overrideRoom ?? rosterRoomFor(student.id);
    const pos = room ? dotPositionInRoom(student.id, room) : fallbackPosition(student.id);
    return {
      studentId: student.id,
      studentName: student.name,
      status,
      x: pos.x,
      y: pos.y,
      walking: false,
    };
  });
}

export function newWalkerTarget(seed: number): { x: number; y: number } {
  // Bias toward the corridors / open quad area; avoid extreme edges.
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  return {
    x: 8 + rand() * (CAMPUS_MAP.viewBox.w - 16),
    y: 8 + rand() * (CAMPUS_MAP.viewBox.h - 16),
  };
}
