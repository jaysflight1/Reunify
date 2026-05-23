import { ALL_ROSTER_STUDENTS, getMissingInRoom, LAHS_ROOMS, type LahsRoom, type RoomStudent } from "@/lib/lahs-rooms";
import { NEED_HELP_ROOM } from "@/lib/firebase/config";
import type { StudentReport, TeacherRoomReport } from "@/lib/firebase/types";
import {
  groupCheckInsByRoom,
  type RoomCheckIn,
  type RoomEvacStats,
} from "@/lib/room-accounting";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function rosterIdForStudentName(name: string): string | null {
  const key = normalizeName(name);
  if (!key) return null;
  const hit = ALL_ROSTER_STUDENTS.find((s) => normalizeName(s.name) === key);
  return hit?.id ?? null;
}

function latestStudentReports(reports: readonly StudentReport[]): StudentReport[] {
  const map = new Map<string, StudentReport>();
  for (const report of reports) {
    const key = report.studentId.trim() || normalizeName(report.studentName) || report.id;
    const previous = map.get(key);
    if (!previous || report.updatedAt > previous.updatedAt) {
      map.set(key, report);
    }
  }
  return [...map.values()];
}

function reportsToCheckIns(reports: readonly StudentReport[]): RoomCheckIn[] {
  return latestStudentReports(reports)
    .filter((r) => !r.offCampus && r.roomNumber !== NEED_HELP_ROOM)
    .map((r) => ({
      key: `s-${r.id}`,
      roomNumber: r.roomNumber,
      rosterStudentId: rosterIdForStudentName(r.studentName) ?? undefined,
      studentName: r.studentName,
      grade: r.grade || "—",
      status: r.status,
      teacherName: r.teacherName,
    }));
}

export type TeacherRoomSnapshot = {
  report: TeacherRoomReport;
  rosterMissing: RoomStudent[];
  presentCount: number;
};

/** Latest teacher report per room. */
export function latestTeacherReportByRoom(
  reports: readonly TeacherRoomReport[],
): Map<string, TeacherRoomReport> {
  const map = new Map<string, TeacherRoomReport>();
  const sorted = [...reports].sort((a, b) => b.updatedAt - a.updatedAt);
  for (const r of sorted) {
    if (!map.has(r.roomNumber)) map.set(r.roomNumber, r);
  }
  return map;
}

export function buildAccountedRosterIds(
  studentReports: readonly StudentReport[],
  teacherReports: readonly TeacherRoomReport[],
): Set<string> {
  const accounted = new Set<string>();
  const latestReports = latestStudentReports(studentReports);
  const names = new Set(
    latestReports.map((r) => normalizeName(r.studentName)).filter(Boolean),
  );

  for (const student of ALL_ROSTER_STUDENTS) {
    if (names.has(normalizeName(student.name))) {
      accounted.add(student.id);
    }
  }

  for (const tr of teacherReports) {
    for (const id of tr.presentIds) {
      accounted.add(id);
    }
  }

  return accounted;
}

export function buildEvacuationState(
  studentReports: readonly StudentReport[],
  teacherReports: readonly TeacherRoomReport[],
): {
  accountedIds: Set<string>;
  unaccountedIds: Set<string>;
  checkIns: RoomCheckIn[];
  roomStatsMap: Map<string, RoomEvacStats>;
  teacherByRoom: Map<string, TeacherRoomSnapshot>;
} {
  const teacherByRoomLatest = latestTeacherReportByRoom(teacherReports);
  const accountedIds = buildAccountedRosterIds(studentReports, teacherReports);
  const unaccountedIds = new Set(
    ALL_ROSTER_STUDENTS.filter((s) => !accountedIds.has(s.id)).map((s) => s.id),
  );

  const checkIns = reportsToCheckIns(studentReports);
  const checkInsByRoom = groupCheckInsByRoom(checkIns);

  const roomStatsMap = new Map<string, RoomEvacStats>();
  const teacherByRoom = new Map<string, TeacherRoomSnapshot>();

  for (const room of LAHS_ROOMS) {
    const teacherReport = teacherByRoomLatest.get(room.number);
    let rosterMissing: RoomStudent[];

    if (teacherReport) {
      const missingSet = new Set(teacherReport.missingIds);
      rosterMissing = room.roster.filter((s) => missingSet.has(s.id));
      teacherByRoom.set(room.number, {
        report: teacherReport,
        rosterMissing,
        presentCount: teacherReport.presentIds.length,
      });
    } else {
      rosterMissing = getMissingInRoom(room, unaccountedIds);
    }

    roomStatsMap.set(room.number, {
      rosterMissing,
      checkIns: checkInsByRoom.get(room.number) ?? [],
    });
  }

  return {
    accountedIds,
    unaccountedIds,
    checkIns,
    roomStatsMap,
    teacherByRoom,
  };
}

export function unaccountedStudents(ids: ReadonlySet<string>): RoomStudent[] {
  return ALL_ROSTER_STUDENTS.filter((s) => ids.has(s.id));
}

export function getTeacherSnapshot(
  room: LahsRoom,
  teacherByRoom: ReadonlyMap<string, TeacherRoomSnapshot>,
): TeacherRoomSnapshot | null {
  return teacherByRoom.get(room.number) ?? null;
}

/**
 * Campus-wide safe / unsafe counts.
 * Teacher missing roster students count as unsafe (not in class).
 * Teacher present + student safe count as safe unless marked unsafe/missing.
 */
export function computeDashboardStats(
  studentReports: readonly StudentReport[],
  teacherReports: readonly TeacherRoomReport[],
): { safeCount: number; unsafeCount: number; missingCount: number } {
  const teacherByRoom = latestTeacherReportByRoom(teacherReports);
  const latestReports = latestStudentReports(studentReports);
  const unsafeIds = new Set<string>();

  for (const report of latestReports) {
    const id = rosterIdForStudentName(report.studentName);
    if (id && report.status === "unsafe") unsafeIds.add(id);
  }

  for (const tr of teacherByRoom.values()) {
    for (const id of tr.missingIds) unsafeIds.add(id);
  }

  const safeIds = new Set<string>();

  for (const tr of teacherByRoom.values()) {
    for (const id of tr.presentIds) {
      if (!unsafeIds.has(id)) safeIds.add(id);
    }
  }

  for (const report of latestReports) {
    const id = rosterIdForStudentName(report.studentName);
    if (id && report.status === "safe" && !unsafeIds.has(id)) safeIds.add(id);
  }

  const accountedIds = buildAccountedRosterIds(latestReports, teacherReports);
  const missingCount = ALL_ROSTER_STUDENTS.filter((s) => !accountedIds.has(s.id)).length;

  return {
    safeCount: safeIds.size,
    unsafeCount: unsafeIds.size,
    missingCount,
  };
}
