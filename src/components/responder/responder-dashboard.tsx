"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAdminLiveData } from "@/hooks/use-admin-live-data";
import type { CheckInEvent } from "@/hooks/use-live-simulation";
import { ALL_ROSTER_STUDENTS, GHS_ROOMS } from "@/lib/general-rooms";
import { CampusMap } from "@/components/admin/campus-map";
import type { AdminStudentRecord } from "@/components/admin/admin-types";

type FeedTone = "danger" | "warning" | "safe";

const SHOOTER_PATTERN =
  /\b(shooter|shooters|gunman|gunmen|gunwoman|gun|guns|firearm|firearms|weapon|weapons|armed|attacker|attackers|intruder|intruders|active\s+shooter)\b/i;

function mentionsShooter(event: CheckInEvent): boolean {
  const haystack = [event.rawText, event.note].filter(Boolean).join(" \n ");
  return haystack.length > 0 && SHOOTER_PATTERN.test(haystack);
}

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
    if (!byId.has(record.id)) byId.set(record.id, record);
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

export function ResponderDashboard() {
  const live = useAdminLiveData({ forceMode: "demo" });
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  const shooterReports = useMemo(
    () => live.events.filter(mentionsShooter),
    [live.events],
  );

  const studentRecords = useMemo(() => {
    const rosterIds = new Set(ALL_ROSTER_STUDENTS.map((student) => student.id));
    const latestFromEvents = latestRecordsByStudent(live.events.map(eventToRecord)).filter(
      (record) => rosterIds.has(record.id),
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

    return [...latestFromEvents, ...missing];
  }, [live.events, live.missingStudents]);

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
    <div className="flex flex-col gap-4">
      <section className="grid min-h-0 grid-cols-1 gap-3 lg:h-[calc(100vh-14rem)] lg:min-h-[31rem] lg:grid-cols-[minmax(0,1.85fr)_minmax(14rem,0.65fr)_minmax(14rem,0.65fr)_minmax(14rem,0.65fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-4">
        <div className="min-h-0 lg:row-span-2 lg:overflow-y-auto lg:overscroll-contain">
          <CampusMap
            unaccountedIds={live.unaccountedIds}
            roomStatsMap={live.roomStatsMap}
            teacherByRoom={live.teacherByRoom}
            studentDots={live.studentDots}
            selectedStudentId={expandedRecordId}
          />
          <p className="mt-2 px-1 text-[10px] leading-relaxed text-[#475569]">
            {live.mode === "firebase" || live.mode === "local"
              ? `${live.events.length} reports · ${GHS_ROOMS.length} rooms · hover dots for student detail`
              : `Demo · ${GHS_ROOMS.length} rooms · ${ALL_ROSTER_STUDENTS.length} students · hover dots for student detail`}
          </p>
        </div>

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
      </section>

      <ShooterReportsPanel reports={shooterReports} />
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
  const containerRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative lg:col-start-2 lg:col-span-3">
      <label className="sr-only" htmlFor="responder-student-search">
        Search students
      </label>
      <input
        id="responder-student-search"
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

function ShooterReportsPanel({ reports }: { reports: CheckInEvent[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#3f2730] bg-[#120b0e]">
      <div className="flex items-center justify-between gap-3 border-b border-[#3f2730] px-3 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#f8fafc]">Shooter reports</h2>
        </div>
        <span className="rounded border border-rose-900/60 bg-rose-950/30 px-2 py-1 font-mono text-lg font-semibold tabular-nums text-rose-200">
          {reports.length}
        </span>
      </div>

      {reports.length > 0 ? (
        <ul className="grid max-h-44 gap-0 overflow-y-auto overscroll-contain md:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => (
            <li key={report.id} className="border-b border-r border-[#2a1d23] p-3 last:border-b-0">
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${eventDotClass(report)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#f8fafc]">
                        {report.student.name}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#64748b]">
                        Grade {report.student.grade} · {eventStatusText(report)}
                      </p>
                    </div>
                    <time className="shrink-0 font-mono text-[10px] tabular-nums text-[#64748b]">
                      {report.at}
                    </time>
                  </div>
                  <p className="mt-2 text-xs text-[#94a3b8]">
                    {report.roomNumber ? `Room ${report.roomNumber}` : "Location unknown"}
                    {report.teacherName && report.teacherName !== "—" ? ` · ${report.teacherName}` : ""}
                  </p>
                  {report.note ? (
                    <p className="mt-2 rounded border border-[#3f2730] bg-[#090c10] px-2 py-1.5 text-xs leading-relaxed text-[#e2e8f0]">
                      {report.note}
                    </p>
                  ) : null}
                  {report.rawText && report.rawText !== report.note ? (
                    <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
                      {report.rawText}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-[#cbd5e1]">No shooter-related reports</p>
          <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-[#64748b]">
            Reports mentioning weapons, intruders, or active shooter language will appear here
            with the reporting student and last-known location.
          </p>
        </div>
      )}
    </section>
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
    rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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

function eventStatusText(event: CheckInEvent): string {
  if (event.status === "unsafe") return "Needs help";
  return "Accounted";
}

function eventDotClass(event: CheckInEvent): string {
  if (event.status === "unsafe") return "bg-rose-400";
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
