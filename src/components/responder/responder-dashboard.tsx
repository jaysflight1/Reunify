"use client";

import { useMemo } from "react";
import { useAdminLiveData } from "@/hooks/use-admin-live-data";

export function ResponderDashboard() {
  const live = useAdminLiveData();
  const unsafeReports = useMemo(
    () => live.events.filter((event) => event.status === "unsafe"),
    [live.events],
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#64748b]">
          Responder view
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[#f8fafc]">
          Factual incident snapshot
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#94a3b8]">
          This view summarizes reported student status and last-known locations. It does not provide tactical recommendations.
        </p>
      </header>

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
    </main>
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
