"use client";

import type { AdminStudentRecord } from "./admin-types";

type StudentStatusTableProps = {
  records: AdminStudentRecord[];
  onSelect: (record: AdminStudentRecord) => void;
};

function statusClass(status: AdminStudentRecord["status"]): string {
  if (status === "safe") return "text-emerald-300";
  if (status === "unsafe") return "text-rose-300";
  return "text-amber-300";
}

export function StudentStatusTable({ records, onSelect }: StudentStatusTableProps) {
  return (
    <section className="min-h-0 overflow-hidden rounded-lg border border-[#232a35] bg-[#0c0f13]">
      <div className="border-b border-[#232a35] px-3 py-2.5">
        <h2 className="text-xs font-semibold text-[#e2e8f0]">Student status</h2>
        <p className="text-[10px] text-[#64748b]">Latest known status by student</p>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-[#11161d] text-[10px] uppercase tracking-wider text-[#64748b]">
            <tr>
              <th className="px-3 py-2 font-medium">Student</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr
                key={record.id}
                className="cursor-pointer border-t border-[#1a212b] hover:bg-[#11161d]"
                onClick={() => onSelect(record)}
              >
                <td className="px-3 py-2">
                  <p className="font-medium text-[#f1f5f9]">{record.name}</p>
                  <p className="text-[10px] text-[#64748b]">Grade {record.grade}</p>
                </td>
                <td className={`px-3 py-2 font-medium ${statusClass(record.status)}`}>
                  {record.status}
                </td>
                <td className="px-3 py-2 text-[#94a3b8]">
                  {record.roomNumber ? `Rm ${record.roomNumber}` : "Unknown"}
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-[#64748b]">
                  {record.updatedAt ?? "—"}
                </td>
              </tr>
            ))}
            {records.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-[#64748b]">
                  Waiting for student records
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
