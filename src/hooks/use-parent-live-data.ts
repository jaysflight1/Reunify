"use client";

import { useMemo } from "react";
import { formatTime } from "@/lib/demo-data";
import type { StudentReport, TeacherRoomReport } from "@/lib/firebase/types";
import { isLocalCheckInMode } from "@/lib/check-in/local-mode";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { CheckInEvent } from "@/hooks/use-live-simulation";
import { useFirebaseReports } from "@/hooks/use-firebase-reports";
import { useLiveSimulation } from "@/hooks/use-live-simulation";

type ParentLiveDataOptions = {
  forceMode?: "demo" | "live";
};

function rosterStudentIdForReport(report: StudentReport): string {
  const id = report.studentId.trim();
  if (id) return id;
  return report.studentUid || report.id;
}

function reportToEvent(report: StudentReport): CheckInEvent {
  const needHelp = report.status === "unsafe";
  const shooterNote = report.shooterNearby ? "Shooter actively nearby" : null;
  const combinedNote = [shooterNote, report.note].filter(Boolean).join(" · ") || undefined;

  return {
    id: report.id,
    student: {
      id: rosterStudentIdForReport(report),
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

function teacherReportToEvent(report: TeacherRoomReport): CheckInEvent {
  return {
    id: `t-${report.id}`,
    student: {
      id: report.teacherUid,
      name: `${report.teacherName} (roll call)`,
      grade: "—",
    },
    roomNumber: report.roomNumber,
    teacherName: report.teacherName,
    status: report.missingIds.length > 0 ? "unsafe" : "safe",
    at: formatTime(new Date(report.updatedAt)),
    note:
      report.missingIds.length > 0
        ? `${report.missingIds.length} not in class`
        : report.inputMode === "voice"
          ? "Voice roll call"
          : "Roster submitted",
    rawText: report.transcript?.trim() || report.note?.trim() || undefined,
    source: "teacher",
  };
}

export function useParentLiveData(options: ParentLiveDataOptions = {}) {
  const localMode = isLocalCheckInMode();
  const firebaseAuto = isFirebaseConfigured() || localMode;
  const forceDemo = options.forceMode === "demo";
  const useLiveData = options.forceMode === "live" ? true : !forceDemo && firebaseAuto;

  const firebase = useFirebaseReports(useLiveData);
  const sim = useLiveSimulation({ forceDemo: !useLiveData });

  return useMemo(() => {
    if (!useLiveData) {
      return {
        mode: "demo" as const,
        events: sim.events,
        connected: firebase.connected,
        error: firebase.error,
        source: firebase.source,
      };
    }

    const studentEvents = firebase.reports.map(reportToEvent);
    const teacherEvents = firebase.teacherReports.map(teacherReportToEvent);

    return {
      mode: localMode ? ("local" as const) : ("firebase" as const),
      events: [...teacherEvents, ...studentEvents].sort((a, b) => (a.at < b.at ? 1 : -1)),
      connected: firebase.connected,
      error: firebase.error,
      source: firebase.source,
    };
  }, [firebase.connected, firebase.error, firebase.reports, firebase.source, firebase.teacherReports, localMode, useLiveData, sim.events]);
}
