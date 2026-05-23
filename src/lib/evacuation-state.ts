import { ALL_ROSTER_STUDENTS, getMissingInRoom, LAHS_ROOMS, type LahsRoom, type RoomStudent } from "@/lib/lahs-rooms";
import type { StudentReport, TeacherRoomReport } from "@/lib/firebase/types";
import {
  groupCheckInsByRoom,
  type RoomCheckIn,
  type RoomEvacStats,
} from "@/lib/room-accounting";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function reportsToCheckIns(reports: readonly StudentReport[]): RoomCheckIn[] {
  return reports.map((r) => ({
    key: `s-${r.id}`,
    roomNumber: r.roomNumber,
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
  const names = new Set(
    studentReports.map((r) => normalizeName(r.studentName)).filter(Boolean),
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
