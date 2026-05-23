import "server-only";

import { ACTIVE_DRILL_ID, OFF_CAMPUS_ROOM } from "@/lib/firebase/config";
import type {
  StudentReport,
  StudentReportInput,
  TeacherReportSubmit,
  TeacherRoomReport,
} from "@/lib/firebase/types";

type LocalStore = {
  studentReports: Map<string, StudentReport>;
  teacherReports: Map<string, TeacherRoomReport>;
  archivedStudentReports: Map<string, StudentReport>;
  archivedTeacherReports: Map<string, TeacherRoomReport>;
};

declare global {
  // eslint-disable-next-line no-var
  var __reunifyLocalReportStore: LocalStore | undefined;
}

function store(): LocalStore {
  if (!globalThis.__reunifyLocalReportStore) {
    globalThis.__reunifyLocalReportStore = {
      studentReports: new Map(),
      teacherReports: new Map(),
      archivedStudentReports: new Map(),
      archivedTeacherReports: new Map(),
    };
  }
  const s = globalThis.__reunifyLocalReportStore;
  if (!s.archivedStudentReports) {
    s.archivedStudentReports = new Map();
    s.archivedTeacherReports = new Map();
  }
  return s;
}

function studentDocId(studentId: string): string {
  return `${ACTIVE_DRILL_ID}_${studentId.trim()}`;
}

function teacherDocId(roomNumber: string, teacherName: string): string {
  const key = `${roomNumber.trim()}_${teacherName.trim().toLowerCase()}`;
  return `${ACTIVE_DRILL_ID}_${key.replace(/\s+/g, "-")}`;
}

function mapStudentInput(input: StudentReportInput, id: string, now: number): StudentReport {
  const offCampus = input.offCampus && input.status === "safe";
  const needHelp = input.status === "unsafe";

  return {
    id,
    drillId: ACTIVE_DRILL_ID,
    studentUid: `local-${input.studentId.trim()}`,
    studentName: input.studentName.trim(),
    studentId: input.studentId.trim(),
    grade: input.grade,
    status: input.status,
    offCampus,
    shooterNearby: needHelp ? Boolean(input.shooterNearby) : false,
    roomNumber: offCampus ? OFF_CAMPUS_ROOM : input.roomNumber.trim(),
    teacherName: offCampus ? "" : input.teacherName.trim(),
    location: input.location,
    note: input.note?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertLocalStudentReport(input: StudentReportInput): StudentReport {
  const now = Date.now();
  const id = studentDocId(input.studentId);
  const existing = store().studentReports.get(id);
  const report = mapStudentInput(input, id, now);
  if (existing) {
    report.createdAt = existing.createdAt;
  }
  const s = store();
  s.archivedStudentReports.delete(id);
  s.studentReports.set(id, report);
  return report;
}

export function upsertLocalTeacherReport(input: TeacherReportSubmit): TeacherRoomReport {
  const now = Date.now();
  const id = teacherDocId(input.roomNumber, input.teacherName);
  const existing = store().teacherReports.get(id);

  const report: TeacherRoomReport = {
    id,
    drillId: ACTIVE_DRILL_ID,
    teacherUid: `local-teacher-${input.roomNumber}`,
    roomNumber: input.roomNumber,
    spokenRoomNumber: input.spokenRoomNumber ?? null,
    teacherName: input.teacherName.trim(),
    presentIds: input.presentIds,
    missingIds: input.missingIds,
    unmatchedMissing: input.unmatchedMissing ?? [],
    allAccounted: input.allAccounted,
    note: input.note?.trim() || null,
    transcript: input.transcript?.trim() || null,
    inputMode: input.inputMode,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const s = store();
  s.archivedTeacherReports.delete(id);
  s.teacherReports.set(id, report);
  return report;
}

export function listLocalStudentReports(): StudentReport[] {
  return [...store().studentReports.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function listLocalTeacherReports(): TeacherRoomReport[] {
  return [...store().teacherReports.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function archiveLocalReports(): {
  studentReports: number;
  teacherReports: number;
} {
  const s = store();
  const counts = {
    studentReports: s.studentReports.size,
    teacherReports: s.teacherReports.size,
  };

  for (const [id, report] of s.studentReports) {
    s.archivedStudentReports.set(id, report);
  }
  for (const [id, report] of s.teacherReports) {
    s.archivedTeacherReports.set(id, report);
  }

  s.studentReports.clear();
  s.teacherReports.clear();
  return counts;
}
