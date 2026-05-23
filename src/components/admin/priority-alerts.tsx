"use client";

import type { AdminAlert } from "./admin-types";

type PriorityAlertsProps = {
  alerts: AdminAlert[];
};

const toneClass: Record<AdminAlert["severity"], string> = {
  critical: "border-rose-900/50 bg-rose-950/30 text-rose-200",
  warning: "border-amber-900/50 bg-amber-950/25 text-amber-100",
  info: "border-sky-900/50 bg-sky-950/25 text-sky-100",
};

export function PriorityAlerts({ alerts }: PriorityAlertsProps) {
  return (
    <section className="rounded-lg border border-[#232a35] bg-[#0c0f13]">
      <div className="border-b border-[#232a35] px-3 py-2.5">
        <h2 className="text-xs font-semibold text-[#e2e8f0]">Priority alerts</h2>
        <p className="text-[10px] text-[#64748b]">Items needing staff attention</p>
      </div>
      <div className="space-y-2 p-3">
        {alerts.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#64748b]">No priority alerts</p>
        ) : (
          alerts.map((alert) => (
            <article key={alert.id} className={`rounded border px-3 py-2 ${toneClass[alert.severity]}`}>
              <p className="text-sm font-medium">{alert.title}</p>
              <p className="mt-1 text-xs opacity-80">{alert.detail}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
