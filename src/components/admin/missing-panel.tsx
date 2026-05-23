"use client";

import { useState } from "react";
import type { RoomStudent } from "@/lib/lahs-rooms";
import { ALL_ROSTER_STUDENTS } from "@/lib/lahs-rooms";

type MissingPanelProps = {
  students: RoomStudent[];
  defaultOpen?: boolean;
};

function roomFromStudentId(id: string): string {
  const match = id.match(/^r([^-]+)-/);
  return match?.[1] ?? "—";
}

export function MissingPanel({ students, defaultOpen = false }: MissingPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const total = ALL_ROSTER_STUDENTS.length;
  const accounted = total - students.length;

  return (
    <div className="shrink-0 overflow-hidden rounded-lg border border-[#232a35] bg-[#0c0f13]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[#11161d]"
        aria-expanded={open}
      >
        <Chevron open={open} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold text-[#e2e8f0]">Unaccounted</h2>
            <span className="font-mono text-lg font-semibold tabular-nums text-amber-400">
              {students.length}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-[#64748b]">
            {accounted} of {total} across campus
            {!open ? " · click to expand" : ""}
          </p>
        </div>
      </button>

      {open ? (
        <>
          <div className="px-3 pb-2">
            <div className="h-1 overflow-hidden rounded-full bg-[#1a212b]">
              <div
                className="h-full rounded-full bg-[#3b4f63] transition-all duration-500"
                style={{ width: `${(accounted / total) * 100}%` }}
              />
            </div>
          </div>
          <ul className="max-h-[min(36vh,280px)] overflow-y-auto overscroll-contain border-t border-[#232a35]">
            {students.length === 0 ? (
              <li className="px-3 py-8 text-center">
                <p className="text-sm font-medium text-emerald-400/90">All students accounted</p>
                <p className="mt-1 text-[10px] text-[#64748b]">No open records</p>
              </li>
            ) : (
              students.map((student) => (
                <li
                  key={student.id}
                  className="group flex items-center gap-2 border-b border-[#1a212b] px-3 py-2 hover:bg-[#11161d]"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#1a212b] text-[10px] font-medium text-[#94a3b8] group-hover:bg-amber-950/40 group-hover:text-amber-400">
                    {student.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[#f1f5f9]">{student.name}</p>
                    <p className="text-[10px] text-[#64748b]">
                      Gr {student.grade} · Rm {roomFromStudentId(student.id)}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 shrink-0 text-[#64748b] transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
