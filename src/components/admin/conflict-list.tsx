"use client";

import type { AdminStudentRecord } from "./admin-types";

type ConflictListProps = {
  records: AdminStudentRecord[];
};

export function ConflictList({ records }: ConflictListProps) {
  const reviewRecords = records.filter((record) => record.status === "unsafe" || record.status === "unaccounted");

  return (
    <section className="overflow-hidden rounded-lg border border-[#232a35] bg-[#0c0f13]">
      <div className="border-b border-[#232a35] px-3 py-2.5">
        <h2 className="text-xs font-semibold text-[#e2e8f0]">Review queue</h2>
        <p className="text-[10px] text-[#64748b]">Conflicts and pending verification</p>
      </div>
      <ul className="max-h-72 overflow-y-auto">
        {reviewRecords.map((record) => (
          <li key={record.id} className="border-b border-[#1a212b] px-3 py-2">
            <p className="text-sm font-medium text-[#f1f5f9]">{record.name}</p>
            <p className="text-xs text-[#94a3b8]">
              {record.status === "unsafe"
                ? record.note ?? "Needs staff follow-up"
                : "No verified report yet"}
            </p>
          </li>
        ))}
        {reviewRecords.length === 0 ? (
          <li className="px-3 py-8 text-center text-xs text-[#64748b]">No open review items</li>
        ) : null}
      </ul>
    </section>
  );
}
