"use client";

import { useCallback, useMemo, useState } from "react";
import { ALL_ROSTER_STUDENTS, GHS_ROOMS } from "@/lib/general-rooms";
import { isLocalCheckInMode } from "@/lib/check-in/local-mode";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useAdminLiveData } from "@/hooks/use-admin-live-data";
import type { CheckInEvent } from "@/hooks/use-live-simulation";

type ModeSelection = "auto" | "demo" | "live";
import { CampusMap } from "./campus-map";
import { ConflictList } from "./conflict-list";
import { LiveFeed } from "./live-feed";
import { MissingPanel } from "./missing-panel";
import { PriorityAlerts } from "./priority-alerts";
import { ReportFeed } from "./report-feed";
import { StatsBar } from "./stats-bar";
import { StudentProfileDrawer } from "./student-profile-drawer";
import { StudentStatusTable } from "./student-status-table";
import { TeachersPanel } from "./teachers-panel";
import { FirebaseSetupBanner } from "./firebase-setup-banner";
import type { AdminAlert, AdminStudentRecord } from "./admin-types";

function eventToRecord(event: CheckInEvent): AdminStudentRecord {
  return {
    id: event.student.id || event.id,
    name: event.student.name,
    grade: event.student.grade,
    status: event.status,
    roomNumber: event.roomNumber,
    teacherName: event.teacherName,
    note: event.note,
    updatedAt: event.at,
  };
}

function buildAlerts(records: AdminStudentRecord[], missingCount: number): AdminAlert[] {
  const alerts: AdminAlert[] = [];
  const unsafe = records.filter((record) => record.status === "unsafe");

  if (missingCount > 0) {
    alerts.push({
      id: "missing",
      severity: missingCount > 10 ? "critical" : "warning",
      title: `${missingCount} students unaccounted`,
      detail: "Use room details and teacher reports to verify status.",
    });
  }

  for (const record of unsafe.slice(0, 3)) {
    alerts.push({
      id: `unsafe-${record.id}`,
      severity: "critical",
      title: `${record.name} needs help`,
      detail: record.note ?? `Last reported in room ${record.roomNumber ?? "unknown"}.`,
    });
  }

  if (alerts.length === 0 && records.length > 0) {
    alerts.push({
      id: "stable",
      severity: "info",
      title: "No critical student reports",
      detail: "Continue collecting teacher roll calls and student check-ins.",
    });
  }

  return alerts;
}

function latestRecordsByStudent(records: AdminStudentRecord[]): AdminStudentRecord[] {
  const byId = new Map<string, AdminStudentRecord>();

  for (const record of records) {
    if (!byId.has(record.id)) {
      byId.set(record.id, record);
    }
  }

  return [...byId.values()];
}

export function AdminDashboard() {
  const firebaseOn = isFirebaseConfigured();
  const localMode = isLocalCheckInMode();
  const [modeSelection, setModeSelection] = useState<ModeSelection>("auto");
  const liveCapable = firebaseOn || localMode;
  const forceMode =
    modeSelection === "demo" ? "demo" : modeSelection === "live" ? "live" : undefined;
  const live = useAdminLiveData({ forceMode });
  const [selectedRecord, setSelectedRecord] = useState<AdminStudentRecord | null>(null);
  const [clearingLiveData, setClearingLiveData] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  const handleClearLiveData = useCallback(async () => {
    const confirmed = window.confirm(
      "Reset the live dashboard for a fresh demo?\n\nCurrent check-ins will be hidden from the admin view but kept in Firebase (archived). New student and teacher submissions will show up normally.",
    );
    if (!confirmed) return;

    setClearingLiveData(true);
    setClearMessage(null);
    try {
      const res = await fetch("/api/admin/clear", { method: "POST" });
      const json = (await res.json()) as {
        ok?: boolean;
        studentReports?: number;
        teacherReports?: number;
        error?: string;
      };
      if (!res.ok) {
        setClearMessage(json.error ?? "Could not reset dashboard");
        return;
      }
      const total = (json.studentReports ?? 0) + (json.teacherReports ?? 0);
      setClearMessage(
        total > 0
          ? `Archived ${json.studentReports ?? 0} student and ${json.teacherReports ?? 0} teacher report(s) for demo. Prior data is still in Firebase.`
          : "Dashboard is already empty — nothing to archive.",
      );
    } catch {
      setClearMessage("Reset request failed");
    } finally {
      setClearingLiveData(false);
    }
  }, []);

  const studentRecords = useMemo(() => {
    const fromEvents = live.events.map(eventToRecord);
    const latestFromEvents = latestRecordsByStudent(fromEvents);
    const eventIds = new Set(latestFromEvents.map((record) => record.id));
    const missing = live.missingStudents
      .filter((student) => !eventIds.has(student.id))
      .map(
        (student): AdminStudentRecord => ({
          id: student.id,
          name: student.name,
          grade: student.grade,
          status: "unaccounted",
        }),
      );
    return [...latestFromEvents, ...missing];
  }, [live.events, live.missingStudents]);

  const alerts = useMemo(
    () => buildAlerts(studentRecords, live.missingStudents.length),
    [studentRecords, live.missingStudents.length],
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#06080a] text-[#e2e8f0]">
      <FirebaseSetupBanner />
      <StatsBar
        safeCount={live.safeCount}
        unsafeCount={live.unsafeCount}
        missingCount={live.missingStudents.length}
        lastTick={live.lastTick}
        isLive={live.isLive}
        onToggleLive={live.toggleLive}
        onSeedBurst={live.seedBurst}
        dataMode={live.mode}
        firebaseConnected={live.firebaseConnected}
        liveCapable={liveCapable}
        onSelectMode={setModeSelection}
        onClearLiveData={
          liveCapable && (live.mode === "firebase" || live.mode === "local")
            ? handleClearLiveData
            : undefined
        }
        clearingLiveData={clearingLiveData}
      />

      {clearMessage ? (
        <p className="border-b border-[#232a35] bg-[#0c0f13] px-4 py-2 text-center text-xs text-[#94a3b8]">
          {clearMessage}
        </p>
      ) : null}

      {(firebaseOn || localMode) &&
      (live.mode === "firebase" || live.mode === "local") &&
      live.events.length === 0 ? (
        <p className="border-b border-amber-900/30 bg-amber-950/20 px-4 py-2 text-center text-xs text-amber-200/90">
          Waiting for student check-ins — share{" "}
          <span className="font-mono">/check-in</span> on student phones
        </p>
      ) : null}

      {live.firebaseError ? (
        <p className="border-b border-rose-900/30 bg-rose-950/20 px-4 py-2 text-center text-xs text-rose-300">
          Firebase: {live.firebaseError}
        </p>
      ) : null}

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-12 lg:gap-4 lg:p-4">
        <section className="flex min-h-0 flex-col gap-3 lg:col-span-4 lg:max-h-[calc(100vh-4.25rem)] xl:col-span-3">
          <PriorityAlerts alerts={alerts} />
          <div className="h-[min(34vh,300px)] shrink-0 lg:h-[36vh] lg:max-h-[320px] lg:min-h-[200px]">
            <LiveFeed events={live.events} />
          </div>
          <div className="h-[min(28vh,220px)] shrink-0 lg:min-h-[140px] lg:flex-1 lg:max-h-none">
            <TeachersPanel
              roomStatsMap={live.roomStatsMap}
              unaccountedIds={live.unaccountedIds}
            />
          </div>
          <MissingPanel students={live.missingStudents} defaultOpen={false} />
        </section>

        <section className="flex min-h-[min(50vh,480px)] flex-col lg:col-span-8 lg:min-h-[calc(100vh-5.5rem)] xl:col-span-9">
          <div className="min-h-0 flex-1">
            <CampusMap
              unaccountedIds={live.unaccountedIds}
              roomStatsMap={live.roomStatsMap}
              teacherByRoom={live.teacherByRoom}
              studentDots={live.studentDots}
            />
          </div>
          <p className="mt-2 shrink-0 px-1 text-[10px] leading-relaxed text-[#475569]">
            {live.mode === "firebase" || live.mode === "local"
              ? `${live.events.length} checked in · ${GHS_ROOMS.length} rooms · click a tile for roster`
              : `Demo · ${GHS_ROOMS.length} rooms · ${ALL_ROSTER_STUDENTS.length} students · click room for detail`}
          </p>
          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <StudentStatusTable records={studentRecords} onSelect={setSelectedRecord} />
            </div>
            <div className="grid gap-3">
              <ReportFeed events={live.events} />
              <ConflictList records={studentRecords} />
            </div>
          </div>
        </section>
      </main>
      <StudentProfileDrawer record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}
