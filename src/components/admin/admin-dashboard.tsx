"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALL_ROSTER_STUDENTS, GHS_ROOMS } from "@/lib/general-rooms";
import { isLocalCheckInMode } from "@/lib/check-in/local-mode";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useAdminLiveData } from "@/hooks/use-admin-live-data";
import type { CheckInEvent } from "@/hooks/use-live-simulation";

type ModeSelection = "auto" | "demo" | "live";
import { CampusMap } from "./campus-map";
import { StatsBar } from "./stats-bar";
import type { AdminStudentRecord } from "./admin-types";

type FeedTone = "danger" | "warning" | "safe";

const FAST_SELECTION_SCROLL_MS = 150;
const SELECTION_SCROLL_PADDING = 12;

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

function latestRecordsByStudent(records: AdminStudentRecord[]): AdminStudentRecord[] {
  const byId = new Map<string, AdminStudentRecord>();

  for (const record of records) {
    if (!byId.has(record.id)) {
      byId.set(record.id, record);
    }
  }

  return [...byId.values()];
}

function roomFromStudentId(id: string): string | undefined {
  const match = id.match(/^r([^-]+)-/);
  return match?.[1];
}

function recordSort(a: AdminStudentRecord, b: AdminStudentRecord): number {
  return a.name.localeCompare(b.name);
}

export function AdminDashboard() {
  const firebaseOn = isFirebaseConfigured();
  const localMode = isLocalCheckInMode();
  const [modeSelection, setModeSelection] = useState<ModeSelection>("demo");
  const liveCapable = firebaseOn || localMode;
  const forceMode =
    modeSelection === "demo" ? "demo" : modeSelection === "live" ? "live" : undefined;
  const live = useAdminLiveData({ forceMode });
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
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
    const rosterIds = new Set(ALL_ROSTER_STUDENTS.map((student) => student.id));
    const fromEvents = live.events.map(eventToRecord);
    const latestFromEvents = latestRecordsByStudent(fromEvents).filter((record) =>
      rosterIds.has(record.id),
    );
    const eventIds = new Set(latestFromEvents.map((record) => record.id));
    const missing = live.missingStudents
      .filter((student) => !eventIds.has(student.id))
      .map(
        (student): AdminStudentRecord => ({
          id: student.id,
          name: student.name,
          grade: student.grade,
          status: "unaccounted",
          roomNumber: roomFromStudentId(student.id),
        }),
      );
    const implicitSafe = ALL_ROSTER_STUDENTS.filter(
      (student) => !eventIds.has(student.id) && !live.unaccountedIds.has(student.id),
    ).map(
      (student): AdminStudentRecord => ({
        id: student.id,
        name: student.name,
        grade: student.grade,
        status: "safe",
        roomNumber: roomFromStudentId(student.id),
      }),
    );
    return [...latestFromEvents, ...missing, ...implicitSafe];
  }, [live.events, live.missingStudents, live.unaccountedIds]);

  const needsHelpRecords = useMemo(
    () =>
      studentRecords
        .filter((record) => record.status === "unsafe" && record.note !== "Teacher: not in class")
        .sort((a, b) => (a.updatedAt && b.updatedAt ? b.updatedAt.localeCompare(a.updatedAt) : 0)),
    [studentRecords],
  );
  const unaccountedRecords = useMemo(
    () =>
      studentRecords
        .filter(
          (record) =>
            record.status === "unaccounted" ||
            (record.status === "unsafe" && record.note === "Teacher: not in class"),
        )
        .sort(recordSort),
    [studentRecords],
  );
  const accountedRecords = useMemo(
    () => studentRecords.filter((record) => record.status === "safe").sort(recordSort),
    [studentRecords],
  );
  const studentRecordMap = useMemo(
    () => new Map(studentRecords.map((record) => [record.id, record])),
    [studentRecords],
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#06080a] text-[#e2e8f0] lg:h-screen lg:overflow-hidden">
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

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(12rem,0.55fr)_minmax(12rem,0.55fr)_minmax(12rem,0.55fr)] lg:grid-rows-[auto_1fr] lg:gap-4 lg:overflow-hidden lg:p-4">
        <section className="min-h-0 lg:row-span-2 lg:overflow-y-auto lg:overscroll-contain">
          <CampusMap
            unaccountedIds={live.unaccountedIds}
            roomStatsMap={live.roomStatsMap}
            teacherByRoom={live.teacherByRoom}
            studentDots={live.studentDots}
            selectedStudentId={expandedRecordId}
            onSelectStudent={setExpandedRecordId}
          />
          <p className="mt-2 px-1 text-[10px] leading-relaxed text-[#475569]">
            {live.mode === "firebase" || live.mode === "local"
              ? `${live.events.length} reports · ${GHS_ROOMS.length} rooms · hover dots for student detail`
              : `Demo · ${GHS_ROOMS.length} rooms · ${ALL_ROSTER_STUDENTS.length} students · hover dots for student detail`}
          </p>
        </section>

        <StudentSearch
          records={studentRecords}
          selectedRecordId={expandedRecordId}
          onSelect={(id) => setExpandedRecordId(id)}
        />

        <CommandFeed
          title="Needs help"
          eyebrow="Unsafe"
          count={needsHelpRecords.length}
          tone="danger"
          emptyTitle="No active needs-help reports"
          emptyDetail="Unsafe reports will appear here."
        >
          {needsHelpRecords.map((record) => (
            <StudentFeedRow
              key={record.id}
              record={record}
              tone="danger"
              expanded={expandedRecordId === record.id}
              selectedRecord={studentRecordMap.get(expandedRecordId ?? "") ?? null}
              onToggle={setExpandedRecordId}
            />
          ))}
        </CommandFeed>

        <CommandFeed
          title="Unaccounted"
          eyebrow="Verify"
          count={unaccountedRecords.length}
          tone="warning"
          emptyTitle="All students accounted"
          emptyDetail="Missing students will appear here."
        >
          {unaccountedRecords.map((record) => (
            <StudentFeedRow
              key={record.id}
              record={record}
              tone="warning"
              expanded={expandedRecordId === record.id}
              selectedRecord={studentRecordMap.get(expandedRecordId ?? "") ?? null}
              onToggle={setExpandedRecordId}
            />
          ))}
        </CommandFeed>

        <CommandFeed
          title="Safe"
          eyebrow="Accounted"
          count={accountedRecords.length}
          tone="safe"
          emptyTitle="No safe students yet"
          emptyDetail="Safe reports will appear here."
        >
          {accountedRecords.map((record) => (
            <StudentFeedRow
              key={record.id}
              record={record}
              tone="safe"
              expanded={expandedRecordId === record.id}
              selectedRecord={studentRecordMap.get(expandedRecordId ?? "") ?? null}
              onToggle={setExpandedRecordId}
            />
          ))}
        </CommandFeed>
      </main>
    </div>
  );
}

function StudentSearch({
  records,
  selectedRecordId,
  onSelect,
}: {
  records: AdminStudentRecord[];
  selectedRecordId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedRecord = records.find((record) => record.id === selectedRecordId);
  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...records].sort(recordSort);
    if (!q) return sorted;
    return sorted.filter((record) => {
      const haystack = [
        record.name,
        record.status,
        record.roomNumber,
        record.teacherName,
        record.note,
        record.grade,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [records, query]);

  return (
    <div className="relative lg:col-start-2 lg:col-span-3">
      <label className="sr-only" htmlFor="admin-student-search">
        Search students
      </label>
      <input
        id="admin-student-search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={
          selectedRecord ? `Selected: ${selectedRecord.name}` : "Search students by name, status, room, or note"
        }
        className="w-full rounded-lg border border-[#2a3340] bg-[#0c0f13] px-3 py-2 text-sm text-[#f8fafc] outline-none transition placeholder:text-[#64748b] focus:border-sky-700"
      />
      {open ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-96 overflow-y-auto rounded-lg border border-[#334155] bg-[#0c0f13] shadow-2xl shadow-black/50">
          {filteredRecords.length > 0 ? (
            filteredRecords.map((record) => (
              <button
                key={record.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(record.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full gap-3 border-b border-[#1a212b] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#11161d]"
              >
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${recordDotClass(record)}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[#f8fafc]">
                        {record.name}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-[#64748b]">
                        Grade {record.grade} · {recordStatusText(record)}
                      </span>
                    </span>
                    {record.updatedAt ? (
                      <time className="shrink-0 font-mono text-[10px] tabular-nums text-[#475569]">
                        {record.updatedAt}
                      </time>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs text-[#94a3b8]">
                    {record.roomNumber ? `Room ${record.roomNumber}` : "Location unknown"}
                    {record.teacherName && record.teacherName !== "—" ? ` · ${record.teacherName}` : ""}
                  </span>
                  {record.note ? (
                    <span className="mt-1 block text-xs leading-relaxed text-[#cbd5e1]">
                      {record.note}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-xs text-[#64748b]">No matching students</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CommandFeed({
  title,
  eyebrow,
  count,
  tone,
  emptyTitle,
  emptyDetail,
  children,
}: {
  title: string;
  eyebrow: string;
  count: number;
  tone: FeedTone;
  emptyTitle: string;
  emptyDetail: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "danger"
      ? "text-rose-300 border-rose-900/50 bg-rose-950/20"
      : tone === "warning"
        ? "text-amber-300 border-amber-900/50 bg-amber-950/20"
        : "text-emerald-300 border-emerald-900/50 bg-emerald-950/20";

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#232a35] bg-[#0c0f13]">
      <div className="flex items-start justify-between gap-3 border-b border-[#232a35] px-3 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-sm font-semibold text-[#f8fafc]">{title}</h2>
        </div>
        <span
          className={`rounded border px-2 py-1 font-mono text-lg font-semibold tabular-nums ${toneClass}`}
        >
          {count}
        </span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {count > 0 ? (
          children
        ) : (
          <li className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-[#cbd5e1]">{emptyTitle}</p>
            <p className="mx-auto mt-1 max-w-64 text-xs leading-relaxed text-[#64748b]">
              {emptyDetail}
            </p>
          </li>
        )}
      </ul>
    </section>
  );
}

function StudentFeedRow({
  record,
  tone,
  expanded,
  selectedRecord,
  onToggle,
}: {
  record: AdminStudentRecord;
  tone: FeedTone;
  expanded: boolean;
  selectedRecord: AdminStudentRecord | null;
  onToggle: (id: string | null) => void;
}) {
  const rowRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!expanded) return;
    scrollFeedRowIntoView(rowRef.current);
  }, [expanded]);

  const accent =
    tone === "danger"
      ? "bg-rose-400"
      : tone === "warning"
        ? "bg-amber-300"
        : "bg-emerald-400";
  const statusText =
    record.status === "unsafe"
      ? "Needs help"
      : record.status === "unaccounted"
        ? "Unaccounted"
        : "Accounted";

  return (
    <li ref={rowRef} className="border-b border-[#1a212b] last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(expanded ? null : record.id)}
        aria-expanded={expanded}
        className="group flex w-full gap-3 px-3 py-3 text-left transition hover:bg-[#11161d]"
      >
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${accent}`} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-[#f8fafc]">
                {record.name}
              </span>
              <span className="mt-0.5 block text-[10px] text-[#64748b]">
                Grade {record.grade} · {statusText}
              </span>
            </span>
            {record.updatedAt ? (
              <time className="shrink-0 font-mono text-[10px] tabular-nums text-[#475569]">
                {record.updatedAt}
              </time>
            ) : null}
          </span>
          <span className="mt-2 block text-xs text-[#94a3b8]">
            {record.roomNumber ? `Room ${record.roomNumber}` : "Location unknown"}
            {record.teacherName && record.teacherName !== "—" ? ` · ${record.teacherName}` : ""}
          </span>
          {record.note ? (
            <span className="mt-1.5 block rounded border border-[#1f2937] bg-[#111827] px-2 py-1 text-xs leading-relaxed text-[#cbd5e1]">
              {record.note}
            </span>
          ) : null}
          {expanded ? (
            <span className="mt-3 grid gap-2 rounded-lg border border-[#263241] bg-[#090c10] p-2 text-xs">
              <DetailLine label="Status" value={statusText} />
              <DetailLine label="Location" value={record.roomNumber ? `Room ${record.roomNumber}` : "Unknown"} />
              <DetailLine label="Teacher" value={record.teacherName && record.teacherName !== "—" ? record.teacherName : "Unknown"} />
              <DetailLine label="Updated" value={record.updatedAt ?? "Not reported"} />
              {selectedRecord?.note ? <DetailLine label="Notes" value={selectedRecord.note} /> : null}
              <span className="text-[10px] leading-relaxed text-[#64748b]">
                Matching student dot is selected on the map.
              </span>
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function scrollFeedRowIntoView(row: HTMLElement | null): void {
  if (!row) return;
  const scroller = nearestVerticalScroller(row);
  if (!scroller) {
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return;
  }

  const scrollerRect = scroller.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  let targetTop = scroller.scrollTop;

  if (rowRect.top < scrollerRect.top + SELECTION_SCROLL_PADDING) {
    targetTop += rowRect.top - scrollerRect.top - SELECTION_SCROLL_PADDING;
  } else if (rowRect.bottom > scrollerRect.bottom - SELECTION_SCROLL_PADDING) {
    targetTop += rowRect.bottom - scrollerRect.bottom + SELECTION_SCROLL_PADDING;
  } else {
    return;
  }

  targetTop = clamp(
    targetTop,
    0,
    Math.max(0, scroller.scrollHeight - scroller.clientHeight),
  );
  animateScrollTop(scroller, targetTop);
}

function nearestVerticalScroller(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function animateScrollTop(scroller: HTMLElement, targetTop: number): void {
  const startTop = scroller.scrollTop;
  const delta = targetTop - startTop;
  if (Math.abs(delta) < 1) return;

  const start = performance.now();
  const step = (now: number) => {
    const progress = clamp((now - start) / FAST_SELECTION_SCROLL_MS, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    scroller.scrollTop = startTop + delta * eased;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function recordStatusText(record: AdminStudentRecord): string {
  if (record.status === "unsafe") return "Needs help";
  if (record.status === "unaccounted") return "Unaccounted";
  return "Accounted";
}

function recordDotClass(record: AdminStudentRecord): string {
  if (record.status === "unsafe") return "bg-rose-400";
  if (record.status === "unaccounted") return "bg-amber-300";
  return "bg-emerald-400";
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <span className="grid grid-cols-[4rem_1fr] gap-2">
      <span className="text-[#64748b]">{label}</span>
      <span className="min-w-0 truncate text-[#e2e8f0]">{value}</span>
    </span>
  );
}
