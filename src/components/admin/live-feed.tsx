"use client";

import type { CheckInEvent } from "@/hooks/use-live-simulation";

type LiveFeedProps = {
  events: CheckInEvent[];
};

function StatusChip({ status }: { status: CheckInEvent["status"] }) {
  if (status === "safe") {
    return (
      <span className="inline-flex items-center rounded border border-emerald-800/60 bg-emerald-950/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
        Safe
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded border border-rose-900/50 bg-rose-950/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-rose-400">
      Unsafe
    </span>
  );
}

export function LiveFeed({ events }: LiveFeedProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-[#232a35] bg-[#0c0f13]">
      <div className="flex shrink-0 items-center justify-between border-b border-[#232a35] px-3 py-2.5">
        <div>
          <h2 className="text-xs font-semibold text-[#e2e8f0]">Live check-ins</h2>
          <p className="text-[10px] text-[#64748b]">Student-reported status</p>
        </div>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      </div>

      <ul className="flex-1 overflow-y-auto overscroll-contain">
        {events.length === 0 ? (
          <li className="px-3 py-8 text-center text-xs text-[#64748b]">
            Waiting for incoming reports…
          </li>
        ) : (
          events.map((evt, i) => (
            <li
              key={evt.id}
              className="border-b border-[#1a212b] px-3 py-2.5 transition-colors hover:bg-[#11161d]"
              style={{ opacity: 1 - i * 0.018 }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#f1f5f9]">
                    {evt.student.name}
                  </p>
                  <p className="text-[10px] text-[#64748b]">
                    Gr {evt.student.grade}
                    {evt.roomNumber === "Off campus"
                      ? " · Off campus"
                      : evt.roomNumber === "Need help"
                        ? " · Need help"
                        : ` · Rm ${evt.roomNumber}`}
                  </p>
                  {evt.teacherName && evt.teacherName !== "—" ? (
                    <p className="truncate text-[10px] text-[#94a3b8]">{evt.teacherName}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusChip status={evt.status} />
                  <time className="font-mono text-[10px] tabular-nums text-[#475569]">
                    {evt.at}
                  </time>
                </div>
              </div>
              {evt.note ? (
                <p className="mt-1 text-[10px] text-rose-400/90">{evt.note}</p>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
