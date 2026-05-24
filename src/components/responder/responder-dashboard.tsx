"use client";

import { useMemo } from "react";
import { useAdminLiveData } from "@/hooks/use-admin-live-data";
import type { CheckInEvent } from "@/hooks/use-live-simulation";
import { CampusMap } from "@/components/admin/campus-map";

const SHOOTER_PATTERN =
  /\b(shooter|shooters|gunman|gunmen|gunwoman|gun|guns|firearm|firearms|weapon|weapons|armed|attacker|attackers|intruder|intruders|active\s+shooter)\b/i;

function mentionsShooter(event: CheckInEvent): boolean {
  const haystack = [event.rawText, event.note].filter(Boolean).join(" \n ");
  return haystack.length > 0 && SHOOTER_PATTERN.test(haystack);
}

export function ResponderDashboard() {
  const live = useAdminLiveData();
  const unsafeReports = useMemo(
    () => live.events.filter((event) => event.status === "unsafe"),
    [live.events],
  );
  const shooterReports = useMemo(
    () => live.events.filter(mentionsShooter),
    [live.events],
  );

  return (
    <div>
      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Unaccounted" value={live.missingStudents.length} tone="warning" />
        <Metric label="Needs help reports" value={unsafeReports.length} tone="critical" />
        <Metric label="Safe reports" value={live.safeCount} tone="safe" />
        <Metric label="Recent reports" value={live.events.length} tone="neutral" />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Missing / unaccounted students">
          <ul className="max-h-96 overflow-y-auto">
            {live.missingStudents.map((student) => (
              <li key={student.id} className="border-b border-[#1a212b] px-3 py-2">
                <p className="text-sm font-medium text-[#f1f5f9]">{student.name}</p>
                <p className="text-xs text-[#64748b]">Grade {student.grade}</p>
              </li>
            ))}
            {live.missingStudents.length === 0 ? (
              <li className="px-3 py-8 text-center text-xs text-[#64748b]">
                No unaccounted students in current data
              </li>
            ) : null}
          </ul>
        </Panel>

        <Panel title="Needs-help / injury reports">
          <ul className="max-h-96 overflow-y-auto">
            {unsafeReports.map((event) => (
              <li key={event.id} className="border-b border-[#1a212b] px-3 py-2">
                <p className="text-sm font-medium text-[#f1f5f9]">{event.student.name}</p>
                <p className="text-xs text-[#94a3b8]">
                  Rm {event.roomNumber} · {event.teacherName} · {event.at}
                </p>
                {event.note ? <p className="mt-1 text-xs text-rose-300">{event.note}</p> : null}
              </li>
            ))}
            {unsafeReports.length === 0 ? (
              <li className="px-3 py-8 text-center text-xs text-[#64748b]">
                No needs-help reports in current data
              </li>
            ) : null}
          </ul>
        </Panel>
      </section>

      <Panel title="Shooter reports" className="mt-4">
        <p className="border-b border-[#1a212b] px-3 py-2 text-[10px] text-[#64748b]">
          Original text from any teacher or student whose update mentioned a shooter, gunman, weapon, or intruder.
        </p>
        <ul className="max-h-96 overflow-y-auto">
          {shooterReports.map((event) => {
            const original = event.rawText ?? event.note ?? "(no text recorded)";
            const roleLabel = event.source === "teacher" ? "Teacher" : "Student";
            return (
              <li key={event.id} className="border-b border-[#1a212b] px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#f1f5f9]">
                      {event.student.name}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-[#64748b]">
                      {roleLabel}
                      {event.roomNumber && event.roomNumber !== "Off campus"
                        ? ` · Rm ${event.roomNumber}`
                        : ""}
                    </p>
                  </div>
                  <time className="font-mono text-[10px] tabular-nums text-[#64748b]">
                    {event.at}
                  </time>
                </div>
                <blockquote className="mt-2 rounded border border-rose-900/40 bg-rose-950/20 px-3 py-2 text-xs italic text-rose-100">
                  &ldquo;{original}&rdquo;
                </blockquote>
              </li>
            );
          })}
          {shooterReports.length === 0 ? (
            <li className="px-3 py-8 text-center text-xs text-[#64748b]">
              No shooter mentions in current reports.
            </li>
          ) : null}
        </ul>
      </Panel>

      <Panel title="Timestamped report feed" className="mt-4">
        <ul className="max-h-96 overflow-y-auto">
          {live.events.map((event) => (
            <li key={event.id} className="grid gap-2 border-b border-[#1a212b] px-3 py-2 md:grid-cols-[1fr_auto]">
              <div>
                <p className="text-sm font-medium text-[#f1f5f9]">{event.student.name}</p>
                <p className="text-xs text-[#94a3b8]">
                  Status {event.status} · Rm {event.roomNumber} · {event.teacherName}
                </p>
              </div>
              <time className="font-mono text-xs text-[#64748b]">{event.at}</time>
            </li>
          ))}
          {live.events.length === 0 ? (
            <li className="px-3 py-8 text-center text-xs text-[#64748b]">No reports yet</li>
          ) : null}
        </ul>
      </Panel>

      <section className="mt-4">
        <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#64748b]">
          Campus map
        </p>
        <CampusMap
          unaccountedIds={live.unaccountedIds}
          roomStatsMap={live.roomStatsMap}
          teacherByRoom={live.teacherByRoom}
          studentDots={live.studentDots}
        />
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "safe" | "warning" | "critical" | "neutral";
}) {
  const toneClass =
    tone === "safe"
      ? "text-emerald-300"
      : tone === "warning"
        ? "text-amber-300"
        : tone === "critical"
          ? "text-rose-300"
          : "text-[#e2e8f0]";

  return (
    <article className="rounded-lg border border-[#232a35] bg-[#0c0f13] p-4">
      <p className="text-[10px] uppercase tracking-wider text-[#64748b]">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </article>
  );
}

function Panel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`overflow-hidden rounded-lg border border-[#232a35] bg-[#0c0f13] ${className ?? ""}`}>
      <div className="border-b border-[#232a35] px-3 py-2.5">
        <h2 className="text-sm font-semibold text-[#e2e8f0]">{title}</h2>
      </div>
      {children}
    </section>
  );
}
