import { ALL_ROSTER_STUDENTS, getMissingInRoom, LAHS_ROOMS, roomStatusTint } from "@/lib/lahs-rooms";
import type { LahsRoom, RoomStudent } from "@/lib/lahs-rooms";
import type { Status } from "@/lib/demo-data";

/** One student self-report or demo check-in tied to a room. */
export type RoomCheckIn = {
  key: string;
  roomNumber: string;
  rosterStudentId?: string;
  studentName: string;
  grade: string;
  status: Status;
  teacherName: string;
};

export type RoomEvacStats = {
  rosterMissing: RoomStudent[];
  checkIns: RoomCheckIn[];
};

export function allRosterIds(): string[] {
  return ALL_ROSTER_STUDENTS.map((s) => s.id);
}

/** Deterministic slice — avoids SSR hydration mismatch from Math.random(). */
export function buildInitialUnaccounted(fraction = 0.55): Set<string> {
  const ids = allRosterIds();
  const count = Math.floor(ids.length * fraction);
  return new Set(ids.slice(0, count));
}

export function unaccountedToStudents(ids: ReadonlySet<string>): RoomStudent[] {
  return ALL_ROSTER_STUDENTS.filter((s) => ids.has(s.id));
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Roster students with no matching check-in (any room). */
export function unaccountedIdsFromCheckIns(
  checkIns: readonly RoomCheckIn[],
): Set<string> {
  const names = new Set(
    checkIns.map((c) => normalizeName(c.studentName)).filter(Boolean),
  );

  const accounted = new Set<string>();
  for (const student of ALL_ROSTER_STUDENTS) {
    if (names.has(normalizeName(student.name))) {
      accounted.add(student.id);
    }
  }

  return new Set(ALL_ROSTER_STUDENTS.filter((s) => !accounted.has(s.id)).map((s) => s.id));
}

export function groupCheckInsByRoom(
  checkIns: readonly RoomCheckIn[],
): Map<string, RoomCheckIn[]> {
  const map = new Map<string, RoomCheckIn[]>();
  for (const checkIn of checkIns) {
    const list = map.get(checkIn.roomNumber);
    if (list) list.push(checkIn);
    else map.set(checkIn.roomNumber, [checkIn]);
  }
  return map;
}

export function buildRoomEvacStatsMap(
  unaccountedIds: ReadonlySet<string>,
  checkInsByRoom: ReadonlyMap<string, RoomCheckIn[]>,
): Map<string, RoomEvacStats> {
  const map = new Map<string, RoomEvacStats>();
  for (const room of LAHS_ROOMS) {
    map.set(room.number, {
      rosterMissing: getMissingInRoom(room, unaccountedIds),
      checkIns: checkInsByRoom.get(room.number) ?? [],
    });
  }
  return map;
}

/**
 * Map tile color: teacher roster + student self-reports in this room.
 * A check-in in a room turns it green/amber even if the student isn't on that roster.
 */
export function roomTintFromEvacStats(stats: RoomEvacStats, rosterSize: number): string {
  const missing = stats.rosterMissing.length;
  const checkIns = stats.checkIns.length;

  if (rosterSize === 0) {
    return checkIns > 0 ? roomStatusTint(0, 1) : roomStatusTint(0, 0);
  }
  if (missing === 0) return roomStatusTint(0, rosterSize);
  if (checkIns > 0) {
    const ratio = missing / rosterSize;
    if (ratio <= 0.35) return roomStatusTint(missing, rosterSize);
    return "rgba(245,158,11,0.48)";
  }
  return roomStatusTint(missing, rosterSize);
}

export function getRoomEvacStats(
  room: LahsRoom,
  roomStatsMap: ReadonlyMap<string, RoomEvacStats>,
  unaccountedIds: ReadonlySet<string>,
): RoomEvacStats {
  return (
    roomStatsMap.get(room.number) ?? {
      rosterMissing: getMissingInRoom(room, unaccountedIds),
      checkIns: [],
    }
  );
}
