"use client";

import { useMemo } from "react";
import { formatTime } from "@/lib/demo-data";
import type { StudentReport } from "@/lib/firebase/types";
import { isLocalCheckInMode } from "@/lib/check-in/local-mode";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { CheckInEvent } from "@/hooks/use-live-simulation";
import { useFirebaseReports } from "@/hooks/use-firebase-reports";
import { useLiveSimulation } from "@/hooks/use-live-simulation";
import {
  buildEvacuationState,
  computeDashboardStats,
  unaccountedStudents,
  type TeacherRoomSnapshot,
} from "@/lib/evacuation-state";
import { ALL_ROSTER_STUDENTS, type RoomStudent } from "@/lib/lahs-rooms";
import {
  buildRoomEvacStatsMap,
  groupCheckInsByRoom,
  type RoomCheckIn,
  type RoomEvacStats,
  unaccountedToStudents,
} from "@/lib/room-accounting";
import { buildStudentDots, type DotStatus, type StudentDot } from "@/lib/student-dots";

export type DataMode = "demo" | "firebase" | "local";

type UseAdminLiveDataOptions = {
  /** Override automatic mode detection. */
  forceMode?: "demo" | "live";
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function rosterIdForName(name: string): string | null {
  const key = normalizeName(name);
  if (!key) return null;
  return ALL_ROSTER_STUDENTS.find((s) => normalizeName(s.name) === key)?.id ?? null;
}

function reportToEvent(report: StudentReport): CheckInEvent {
  const needHelp = report.status === "unsafe";
  const shooterNote = report.shooterNearby ? "Shooter actively nearby" : null;
  const combinedNote = [shooterNote, report.note].filter(Boolean).join(" · ") || undefined;

  return {
    id: report.id,
    student: {
      id: report.studentUid,
      name: report.studentName,
      grade: report.grade || "—",
    },
    roomNumber: report.offCampus ? "Off campus" : report.roomNumber || "",
    teacherName: report.offCampus ? "—" : report.teacherName || "",
    status: report.status,
    at: formatTime(new Date(report.updatedAt)),
    note:
      combinedNote ??
      (report.offCampus ? "Safe off campus" : needHelp ? "Emergency help requested" : undefined),
    rawText: report.note?.trim() || undefined,
    source: "student",
  };
}

function eventsToCheckIns(events: CheckInEvent[]): RoomCheckIn[] {
  return events.map((e) => ({
    key: e.id,
    roomNumber: e.roomNumber,
    studentName: e.student.name,
    grade: e.student.grade,
    status: e.status,
    teacherName: e.teacherName,
  }));
}

function dotsFromDemoEvents(
  events: CheckInEvent[],
  unaccountedIds: ReadonlySet<string>,
  walkers: ReadonlyMap<string, import("@/lib/student-dots").Walker>,
): StudentDot[] {
  const statusById = new Map<string, DotStatus>();
  // Walk events newest-first so the latest status wins.
  for (const event of events) {
    const id = event.student.id;
    if (!id.startsWith("r")) continue; // skip teacher synthetic events
    if (statusById.has(id)) continue;
    statusById.set(id, event.status === "unsafe" ? "unsafe" : "safe");
  }
  return buildStudentDots({
    statusById,
    unaccountedIds,
    walkerById: walkers,
  });
}

function dotsFromFirebase(
  studentReports: readonly StudentReport[],
  teacherByRoom: ReadonlyMap<string, TeacherRoomSnapshot>,
  unaccountedIds: ReadonlySet<string>,
): StudentDot[] {
  const statusById = new Map<string, DotStatus>();
  const roomOverrideById = new Map<string, string>();

  // Teacher reports: anyone in presentIds is safe, anyone in missingIds is unsafe (treat
  // teacher-reported missing as "needs follow-up" yellow via the missing path).
  for (const snap of teacherByRoom.values()) {
    for (const id of snap.report.presentIds) {
      statusById.set(id, "safe");
      roomOverrideById.set(id, snap.report.roomNumber);
    }
  }

  // Student self-reports override teacher status (student speaks for themselves).
  const sorted = [...studentReports].sort((a, b) => b.updatedAt - a.updatedAt);
  for (const report of sorted) {
    const id = rosterIdForName(report.studentName);
    if (!id) continue;
    if (statusById.get(id) === "unsafe" && report.status !== "unsafe") continue;
    statusById.set(id, report.status === "unsafe" ? "unsafe" : "safe");
    if (report.roomNumber && !report.offCampus) {
      roomOverrideById.set(id, report.roomNumber);
    }
  }

  return buildStudentDots({
    statusById,
    unaccountedIds,
    roomOverrideById,
  });
}

export function useAdminLiveData(options: UseAdminLiveDataOptions = {}) {
  const localMode = isLocalCheckInMode();
  const firebaseAuto = isFirebaseConfigured() || localMode;
  const forceDemo = options.forceMode === "demo";
  const useLiveData = options.forceMode === "live" ? true : !forceDemo && firebaseAuto;

  const firebase = useFirebaseReports(useLiveData);
  const sim = useLiveSimulation({ forceDemo: !useLiveData });

  return useMemo(() => {
    const base = {
      toggleLive: sim.toggleLive,
      seedBurst: sim.seedBurst,
      firebaseConnected: firebase.connected,
      firebaseError: firebase.error,
      firebaseSource: firebase.source,
    };

    if (!useLiveData) {
      const checkIns = eventsToCheckIns(sim.events);
      const checkInsByRoom = groupCheckInsByRoom(checkIns);
      const demoStats = buildRoomEvacStatsMap(sim.unaccountedIds, checkInsByRoom);
      const studentDots = dotsFromDemoEvents(sim.events, sim.unaccountedIds, sim.walkers);

      return {
        ...base,
        mode: "demo" as const,
        events: sim.events,
        checkIns,
        unaccountedIds: sim.unaccountedIds,
        roomStatsMap: demoStats,
        teacherByRoom: new Map<string, TeacherRoomSnapshot>(),
        safeCount: sim.safeCount,
        unsafeCount: sim.unsafeCount,
        missingStudents: unaccountedToStudents(sim.unaccountedIds),
        studentDots,
        lastTick: sim.lastTick,
        isLive: sim.isLive,
      };
    }

    const evac = buildEvacuationState(firebase.reports, firebase.teacherReports);
    const stats = computeDashboardStats(firebase.reports, firebase.teacherReports);
    const events = firebase.reports.map(reportToEvent);

    const teacherEvents: CheckInEvent[] = firebase.teacherReports.map((tr) => ({
      id: `t-${tr.id}`,
      student: {
        id: tr.teacherUid,
        name: `${tr.teacherName} (roll call)`,
        grade: "—",
      },
      roomNumber: tr.roomNumber,
      teacherName: tr.teacherName,
      status: tr.missingIds.length > 0 ? "unsafe" : "safe",
      at: formatTime(new Date(tr.updatedAt)),
      note:
        tr.missingIds.length > 0
          ? `${tr.missingIds.length} not in class`
          : tr.inputMode === "voice"
            ? "Voice roll call"
            : "Roster submitted",
      rawText: tr.transcript?.trim() || tr.note?.trim() || undefined,
      source: "teacher",
    }));

    const missingByTeacher = new Map<string, RoomStudent>();
    for (const snap of evac.teacherByRoom.values()) {
      for (const s of snap.rosterMissing) {
        missingByTeacher.set(s.id, s);
      }
    }
    const teacherMissingEvents: CheckInEvent[] = [...missingByTeacher.values()].map(
      (student) => {
        const roomNum = student.id.match(/^r([^-]+)-/)?.[1] ?? "—";
        const snap = evac.teacherByRoom.get(roomNum);
        return {
          id: `tm-${student.id}`,
          student,
          roomNumber: roomNum,
          teacherName: snap?.report.teacherName ?? "—",
          status: "unsafe" as const,
          at: snap ? formatTime(new Date(snap.report.updatedAt)) : sim.lastTick,
          note: "Teacher: not in class",
        };
      },
    );

    const studentDots = dotsFromFirebase(
      firebase.reports,
      evac.teacherByRoom,
      evac.unaccountedIds,
    );

    return {
      ...base,
      mode: localMode ? ("local" as const) : ("firebase" as const),
      events: [...teacherMissingEvents, ...teacherEvents, ...events].sort((a, b) =>
        a.at < b.at ? 1 : -1,
      ),
      checkIns: evac.checkIns,
      unaccountedIds: evac.unaccountedIds,
      roomStatsMap: evac.roomStatsMap,
      teacherByRoom: evac.teacherByRoom,
      safeCount: stats.safeCount,
      unsafeCount: stats.unsafeCount,
      missingStudents: unaccountedStudents(evac.unaccountedIds),
      studentDots,
      lastTick:
        firebase.reports[0] != null
          ? formatTime(new Date(firebase.reports[0].updatedAt))
          : firebase.teacherReports[0] != null
            ? formatTime(new Date(firebase.teacherReports[0].updatedAt))
            : sim.lastTick,
      isLive: sim.isLive,
    };
  }, [useLiveData, localMode, firebase, sim]);
}

export type { RoomEvacStats, TeacherRoomSnapshot };
