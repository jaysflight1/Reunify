"use client";

import { useMemo } from "react";
import { formatTime } from "@/lib/demo-data";
import type { StudentReport } from "@/lib/firebase/types";
import { isFirebaseConfigured, NEED_HELP_ROOM } from "@/lib/firebase/config";
import type { CheckInEvent } from "@/hooks/use-live-simulation";
import { useFirebaseReports } from "@/hooks/use-firebase-reports";
import { useLiveSimulation } from "@/hooks/use-live-simulation";
import {
  buildEvacuationState,
  computeDashboardStats,
  unaccountedStudents,
  type TeacherRoomSnapshot,
} from "@/lib/evacuation-state";
import type { RoomStudent } from "@/lib/lahs-rooms";
import {
  buildRoomEvacStatsMap,
  groupCheckInsByRoom,
  type RoomCheckIn,
  type RoomEvacStats,
  unaccountedToStudents,
} from "@/lib/room-accounting";

function reportToEvent(report: StudentReport): CheckInEvent {
  const needHelp = report.status === "unsafe" || report.roomNumber === NEED_HELP_ROOM;
  const shooterNote = report.shooterNearby ? "Shooter actively nearby" : null;
  const combinedNote = [shooterNote, report.note].filter(Boolean).join(" · ") || undefined;

  return {
    id: report.id,
    student: {
      id: report.studentUid,
      name: report.studentName,
      grade: report.grade || "—",
    },
    roomNumber: report.offCampus ? "Off campus" : needHelp ? "Need help" : report.roomNumber,
    teacherName: report.offCampus || needHelp ? "—" : report.teacherName,
    status: report.status,
    at: formatTime(new Date(report.updatedAt)),
    note:
      combinedNote ??
      (report.offCampus ? "Safe off campus" : needHelp ? "Emergency help requested" : undefined),
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

export function useAdminLiveData() {
  const firebaseEnabled = isFirebaseConfigured();
  const firebase = useFirebaseReports(firebaseEnabled);
  const sim = useLiveSimulation();

  return useMemo(() => {
    const base = {
      toggleLive: sim.toggleLive,
      seedBurst: sim.seedBurst,
      firebaseConnected: firebase.connected,
      firebaseError: firebase.error,
      firebaseSource: firebase.source,
    };

    if (!firebaseEnabled) {
      const checkIns = eventsToCheckIns(sim.events);
      const checkInsByRoom = groupCheckInsByRoom(checkIns);
      const demoStats = buildRoomEvacStatsMap(sim.unaccountedIds, checkInsByRoom);

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
          at: snap
            ? formatTime(new Date(snap.report.updatedAt))
            : formatTime(new Date()),
          note: "Teacher: not in class",
        };
      },
    );

    return {
      ...base,
      mode: "firebase" as const,
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
      lastTick:
        firebase.reports[0] != null
          ? formatTime(new Date(firebase.reports[0].updatedAt))
          : firebase.teacherReports[0] != null
            ? formatTime(new Date(firebase.teacherReports[0].updatedAt))
            : formatTime(new Date()),
      isLive: sim.isLive,
    };
  }, [firebaseEnabled, firebase, sim]);
}

export type { RoomEvacStats, TeacherRoomSnapshot };
