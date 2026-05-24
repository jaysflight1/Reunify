"use client";

import { useMemo, useState } from "react";
import { useAdminLiveData } from "@/hooks/use-admin-live-data";
import type { CheckInEvent } from "@/hooks/use-live-simulation";
import type { RoomStudent } from "@/lib/lahs-rooms";
import {
  demoParentById,
  findDemoParents,
  type DemoParent,
} from "@/lib/demo/parents";
import {
  findLatestStudentEvent,
  findTeacherRollCallForStudent,
  resolveParentChildStatus,
  roomContextForStudent,
  type ParentChildStatus,
} from "@/lib/parent/child-status";

type ChildStatus = ParentChildStatus;

type ChildView = {
  student: RoomStudent;
  status: ChildStatus;
  latestEvent: CheckInEvent | null;
  roomLabel: string | null;
  roomBuilding: string | null;
  teacherName: string | null;
  lastUpdate: string | null;
  note: string | null;
};

const STATUS_BADGE: Record<ChildStatus, { label: string; className: string }> = {
  safe: {
    label: "Safe",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  unknown: {
    label: "No update yet",
    className: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  },
};

const STATUS_MESSAGE: Record<ChildStatus, string> = {
  safe: "Your child has been marked safe in their classroom.",
  unknown:
    "We don't have a confirmed status update for your child yet. Staff are still working through check-ins — we'll update you here as soon as we know more.",
};

function buildChildView(student: RoomStudent, events: CheckInEvent[]): ChildView {
  const status = resolveParentChildStatus(student, events);
  // Only expose dynamic / event-derived details when we are showing "safe".
  // If status is unknown we must not leak unsafe notes, distress timestamps,
  // or "reported by" attributions to the parent.
  const safeEvent =
    status === "safe" ? findLatestStudentEvent(events, student) : null;
  const safeRollCall =
    status === "safe" ? findTeacherRollCallForStudent(events, student) : null;
  const eventForContext = safeEvent && safeEvent.status === "safe" ? safeEvent : null;
  const { roomLabel, roomBuilding, teacherName } = roomContextForStudent(
    student,
    eventForContext,
  );

  return {
    student,
    status,
    latestEvent: safeEvent,
    roomLabel,
    roomBuilding,
    teacherName,
    lastUpdate: safeEvent?.at ?? safeRollCall?.at ?? null,
    note: safeEvent?.status === "safe" ? safeEvent.note ?? null : null,
  };
}

export function ParentPortal() {
  const live = useAdminLiveData();
  const [query, setQuery] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  const matches = useMemo(() => findDemoParents(query), [query]);
  const selectedParent = useMemo<DemoParent | null>(
    () => demoParentById(selectedParentId),
    [selectedParentId],
  );

  const children = useMemo<ChildView[]>(() => {
    if (!selectedParent) return [];
    return selectedParent.children.map((child) => buildChildView(child, live.events));
  }, [selectedParent, live.events]);

  const handleSelect = (parent: DemoParent) => {
    setSelectedParentId(parent.id);
    setQuery(parent.fullName);
  };

  const handleChange = () => {
    setSelectedParentId(null);
    setQuery("");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#232a35] bg-[#0c0f13] p-4">
        <label className="block text-[11px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
          Look up your name
        </label>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (selectedParentId) setSelectedParentId(null);
            }}
            placeholder="Start typing your full name"
            className="min-w-0 flex-1 rounded-lg border border-[#2a3340] bg-[#06080a] px-3 py-2 text-sm text-[#f8fafc] outline-none focus:border-sky-700"
            autoComplete="off"
          />
          {selectedParent ? (
            <button
              type="button"
              onClick={handleChange}
              className="rounded-lg border border-[#2a3340] px-3 py-2 text-sm text-[#e2e8f0] hover:bg-[#11161d]"
            >
              Change
            </button>
          ) : null}
        </div>

        {!selectedParent && query.trim() ? (
          <ul className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-[#232a35] bg-[#06080a]">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[#64748b]">
                No parent records match &ldquo;{query}&rdquo;.
              </li>
            ) : (
              matches.map((parent) => (
                <li key={parent.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(parent)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-[#e2e8f0] hover:bg-[#11161d]"
                  >
                    <span>{parent.fullName}</span>
                    <span className="text-[11px] text-[#64748b]">
                      {parent.children.length} child
                      {parent.children.length === 1 ? "" : "ren"}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}

        {!selectedParent && !query.trim() ? (
          <p className="mt-3 text-xs text-[#64748b]">
            Search for your name to see your child&rsquo;s current status. Demo
            data only — no real records are stored.
          </p>
        ) : null}
      </section>

      {selectedParent ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
              Signed in as
            </p>
            <p className="text-sm text-[#e2e8f0]">{selectedParent.fullName}</p>
          </div>

          {children.map((child) => {
            const badge = STATUS_BADGE[child.status];
            return (
              <article
                key={child.student.id}
                className="rounded-xl border border-[#232a35] bg-[#0c0f13] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[#f8fafc]">
                      {child.student.name}
                    </h2>
                    <p className="mt-1 text-xs text-[#64748b]">
                      Grade {child.student.grade} · ID {child.student.id}
                    </p>
                  </div>
                  <span
                    className={`rounded border px-2 py-1 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <p className="mt-3 text-sm text-[#94a3b8]">
                  {STATUS_MESSAGE[child.status]}
                </p>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-[#64748b]">
                      Last known location
                    </dt>
                    <dd className="mt-1 text-[#f1f5f9]">
                      {child.roomLabel ?? "Not yet reported"}
                    </dd>
                    {child.roomBuilding ? (
                      <dd className="mt-1 text-xs text-[#64748b]">
                        {child.roomBuilding}
                      </dd>
                    ) : null}
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-[#64748b]">
                      Teacher
                    </dt>
                    <dd className="mt-1 text-[#f1f5f9]">
                      {child.teacherName ?? "Not yet reported"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-[#64748b]">
                      Last update
                    </dt>
                    <dd className="mt-1 text-[#f1f5f9]">
                      {child.lastUpdate ?? "Waiting on first check-in"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-[#64748b]">
                      Reported by
                    </dt>
                    <dd className="mt-1 text-[#f1f5f9]">
                      {child.latestEvent
                        ? child.latestEvent.id.startsWith("tm-") ||
                          child.latestEvent.id.startsWith("t-")
                          ? "Teacher roll call"
                          : "Student check-in"
                        : "—"}
                    </dd>
                  </div>
                </dl>

                {child.note ? (
                  <p className="mt-4 rounded border border-[#2a3340] bg-[#06080a] px-3 py-2 text-sm text-[#e2e8f0]">
                    Note: {child.note}
                  </p>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
