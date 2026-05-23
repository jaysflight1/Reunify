"use client";

import type { AdminStudentRecord } from "./admin-types";

type StudentProfileDrawerProps = {
  record: AdminStudentRecord | null;
  onClose: () => void;
};

export function StudentProfileDrawer({ record, onClose }: StudentProfileDrawerProps) {
  if (!record) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-sm border-l border-[#232a35] bg-[#0a0d11] p-4 text-[#e2e8f0] shadow-2xl shadow-black/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#64748b]">Student profile</p>
          <h2 className="mt-1 text-lg font-semibold text-[#f8fafc]">{record.name}</h2>
          <p className="text-sm text-[#94a3b8]">Grade {record.grade}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-[#2a3340] px-2 py-1 text-xs text-[#94a3b8] hover:bg-[#11161d]"
        >
          Close
        </button>
      </div>

      <dl className="mt-6 space-y-4 text-sm">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[#64748b]">Current status</dt>
          <dd className="mt-1 text-[#f1f5f9]">{record.status}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[#64748b]">Last known location</dt>
          <dd className="mt-1 text-[#f1f5f9]">
            {record.roomNumber ? `Room ${record.roomNumber}` : "Unknown"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[#64748b]">Teacher / reporter</dt>
          <dd className="mt-1 text-[#f1f5f9]">{record.teacherName ?? "No report yet"}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[#64748b]">Timeline</dt>
          <dd className="mt-2 rounded border border-[#232a35] bg-[#0c0f13] px-3 py-2 text-xs text-[#94a3b8]">
            {record.updatedAt
              ? `${record.updatedAt}: ${record.note ?? `Status marked ${record.status}`}`
              : "No timeline entries yet"}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
