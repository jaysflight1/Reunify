"use client";

import type { RoomStudent } from "@/lib/general-rooms";

type RosterChecklistProps = {
  roster: RoomStudent[];
  presentIds: Set<string>;
  onToggle: (studentId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
};

export function RosterChecklist({
  roster,
  presentIds,
  onToggle,
  onSelectAll,
  onClearAll,
}: RosterChecklistProps) {
  const missingCount = roster.length - presentIds.size;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[#94a3b8]">
          Uncheck students <span className="text-[#f1f5f9]">not</span> in your room
        </p>
        <div className="flex gap-2 text-[10px]">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-[#64748b] underline underline-offset-2 hover:text-[#e2e8f0]"
          >
            All here
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="text-[#64748b] underline underline-offset-2 hover:text-[#e2e8f0]"
          >
            Clear
          </button>
        </div>
      </div>

      <p className="font-mono text-sm tabular-nums text-amber-400">
        {missingCount === 0 ? "Everyone marked present" : `${missingCount} missing`}
      </p>

      <ul className="max-h-[min(42vh,360px)] space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-[#232a35] bg-[#0a0d11] p-2">
        {roster.map((student) => {
          const present = presentIds.has(student.id);
          return (
            <li key={student.id}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition ${
                  present ? "bg-[#11161d]" : "bg-rose-950/20 ring-1 ring-rose-900/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={present}
                  onChange={() => onToggle(student.id)}
                  className="h-4 w-4 rounded border-[#475569] bg-[#0c0f13] text-sky-500 focus:ring-sky-500/40"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[#f1f5f9]">{student.name}</span>
                  <span className="text-[10px] text-[#64748b]">Grade {student.grade}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
