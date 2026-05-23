"use client";

import type { CheckInEvent } from "@/hooks/use-live-simulation";

type ReportFeedProps = {
  events: CheckInEvent[];
};

export function ReportFeed({ events }: ReportFeedProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#232a35] bg-[#0c0f13]">
      <div className="border-b border-[#232a35] px-3 py-2.5">
        <h2 className="text-xs font-semibold text-[#e2e8f0]">Report feed</h2>
        <p className="text-[10px] text-[#64748b]">Teacher and student submissions</p>
      </div>
      <ul className="max-h-72 overflow-y-auto">
        {events.map((event) => (
          <li key={event.id} className="border-b border-[#1a212b] px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#f1f5f9]">{event.student.name}</p>
                <p className="text-[10px] text-[#64748b]">
                  Rm {event.roomNumber} · {event.teacherName}
                </p>
              </div>
              <time className="shrink-0 font-mono text-[10px] text-[#64748b]">{event.at}</time>
            </div>
            {event.note ? <p className="mt-1 text-xs text-amber-200/90">{event.note}</p> : null}
          </li>
        ))}
        {events.length === 0 ? (
          <li className="px-3 py-8 text-center text-xs text-[#64748b]">No reports yet</li>
        ) : null}
      </ul>
    </section>
  );
}
