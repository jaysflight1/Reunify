"use client";

import { useMemo } from "react";
import { formatTime } from "@/lib/demo-data";
import type { StudentReport } from "@/lib/firebase/types";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { CheckInEvent } from "@/hooks/use-live-simulation";
import { useFirebaseReports } from "@/hooks/use-firebase-reports";
import { useLiveSimulation } from "@/hooks/use-live-simulation";
import {
  buildEvacuationState,
  unaccountedStudents,
  type TeacherRoomSnapshot,
} from "@/lib/evacuation-state";
import {
  buildRoomEvacStatsMap,
  groupCheckInsByRoom,
  type RoomCheckIn,
  type RoomEvacStats,
  unaccountedToStudents,
} from "@/lib/room-accounting";

function reportToEvent(report: StudentReport): CheckInEvent {
  return {
    id: report.id,
    student: {
      id: report.studentUid,
      name: report.studentName,
      grade: report.grade || "—",
    },
    roomNumber: report.roomNumber,
    teacherName: report.teacherName,
    status: report.status,
    at: formatTime(new Date(report.updatedAt)),
    note: report.note ?? (report.status === "unsafe" ? "Needs follow-up" : undefined),
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
      phones: sim.phones,
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
    const events = firebase.reports.map(reportToEvent);
    const safeCount = firebase.reports.filter((r) => r.status === "safe").length;
    const unsafeCount = firebase.reports.filter((r) => r.status === "unsafe").length;

    const teacherEvents: CheckInEvent[] = firebase.teacherReports.map((tr) => ({
      id: `t-${tr.id}`,
      student: {
        id: tr.teacherUid,
        name: `${tr.teacherName} (roll call)`,
        grade: "—",
      },
      roomNumber: tr.roomNumber,
      teacherName: tr.teacherName,
      status: tr.allAccounted ? "safe" : "unsafe",
      at: formatTime(new Date(tr.updatedAt)),
      note:
        tr.missingIds.length > 0
          ? `${tr.missingIds.length} roster missing`
          : tr.inputMode === "voice"
            ? "Voice roll call"
            : "Roster submitted",
    }));

    return {
      ...base,
      mode: "firebase" as const,
      events: [...teacherEvents, ...events].sort((a, b) => (a.at < b.at ? 1 : -1)),
      checkIns: evac.checkIns,
      unaccountedIds: evac.unaccountedIds,
      roomStatsMap: evac.roomStatsMap,
      teacherByRoom: evac.teacherByRoom,
      safeCount,
      unsafeCount,
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
