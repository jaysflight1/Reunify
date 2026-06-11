import { ALL_ROSTER_STUDENTS, getRoomByNumber, type GeneralRoom, type RoomStudent } from "@/lib/general-rooms";
import { CAMPUS_MAP } from "@/lib/campus-map-config";

export type DotStatus = "safe" | "unsafe" | "missing";

export type StudentDotDetails = {
  grade: string;
  statusLabel: string;
  expectedRoom?: string;
  expectedTeacher?: string;
  reportedRoom?: string;
  reporter?: string;
  note?: string;
  updatedAt?: string;
  sourceLabel: string;
};

type StudentDotDetailsInput = Partial<StudentDotDetails>;

export type StudentDot = {
  studentId: string;
  studentName: string;
  status: DotStatus;
  x: number;
  y: number;
  walking: boolean;
  details: StudentDotDetails;
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

export function rosterRoomFor(studentId: string): GeneralRoom | undefined {
  const match = studentId.match(/^r([^-]+)-/);
  return match ? getRoomByNumber(match[1]) : undefined;
}

export function dotPositionInRoom(
  studentId: string,
  room: GeneralRoom,
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
  /** roster student id -> latest report fields shown in the map bubble. */
  detailsById?: ReadonlyMap<string, StudentDotDetailsInput>;
  /** roster student id -> override room number (e.g., student said "I'm in room 408"). */
  roomOverrideById?: ReadonlyMap<string, string>;
  /** roster student id -> walker world position (overrides room-based position). */
  walkerById?: ReadonlyMap<string, Walker>;
};

const STATUS_LABEL: Record<DotStatus, string> = {
  safe: "Accounted for",
  missing: "Unaccounted",
  unsafe: "Needs help",
};

function detailsForStudent(
  student: RoomStudent,
  status: DotStatus,
  expectedRoom: GeneralRoom | undefined,
  detail: StudentDotDetailsInput | undefined,
  walking: boolean,
): StudentDotDetails {
  return {
    grade: detail?.grade ?? student.grade,
    statusLabel: detail?.statusLabel ?? STATUS_LABEL[status],
    expectedRoom: detail?.expectedRoom ?? expectedRoom?.label,
    expectedTeacher: detail?.expectedTeacher ?? expectedRoom?.teacher,
    reportedRoom: detail?.reportedRoom,
    reporter: detail?.reporter,
    note: detail?.note ?? (walking ? "Moving in demo simulation" : undefined),
    updatedAt: detail?.updatedAt,
    sourceLabel:
      detail?.sourceLabel ??
      (status === "missing" ? "No report yet" : walking ? "Demo simulation" : "Roster"),
  };
}

export function buildStudentDots(input: StudentStatusInput): StudentDot[] {
  const { statusById, unaccountedIds, detailsById, roomOverrideById, walkerById } = input;
  return ALL_ROSTER_STUDENTS.map((student) => {
    const explicit = statusById.get(student.id);
    const status: DotStatus =
      explicit ?? (unaccountedIds.has(student.id) ? "missing" : "safe");
    const expectedRoom = rosterRoomFor(student.id);
    const detail = detailsById?.get(student.id);

    const walker = walkerById?.get(student.id);
    if (walker) {
      return {
        studentId: student.id,
        studentName: student.name,
        status,
        x: walker.x,
        y: walker.y,
        walking: true,
        details: detailsForStudent(student, status, expectedRoom, detail, true),
      };
    }

    const overrideRoomNumber = roomOverrideById?.get(student.id);
    const overrideRoom = overrideRoomNumber
      ? getRoomByNumber(overrideRoomNumber)
      : undefined;
    const room = overrideRoom ?? expectedRoom;
    const pos = room ? dotPositionInRoom(student.id, room) : fallbackPosition(student.id);
    return {
      studentId: student.id,
      studentName: student.name,
      status,
      x: pos.x,
      y: pos.y,
      walking: false,
      details: detailsForStudent(student, status, expectedRoom, detail, false),
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
