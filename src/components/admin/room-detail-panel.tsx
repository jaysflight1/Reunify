"use client";

import { getRoomEvacStats, type RoomEvacStats } from "@/lib/room-accounting";
import { getTeacherSnapshot, type TeacherRoomSnapshot } from "@/lib/evacuation-state";
import type { LahsRoom } from "@/lib/lahs-rooms";
import { formatTime } from "@/lib/demo-data";

type RoomDetailPanelProps = {
  room: LahsRoom;
  roomStatsMap: ReadonlyMap<string, RoomEvacStats>;
  teacherByRoom: ReadonlyMap<string, TeacherRoomSnapshot>;
  unaccountedIds: ReadonlySet<string>;
  onClose: () => void;
};

export function RoomDetailPanel({
  room,
  roomStatsMap,
  teacherByRoom,
  unaccountedIds,
  onClose,
}: RoomDetailPanelProps) {
  const stats = getRoomEvacStats(room, roomStatsMap, unaccountedIds);
  const teacherSnap = getTeacherSnapshot(room, teacherByRoom);
  const missing = stats.rosterMissing;
  const rosterAccounted = room.roster.length - missing.length;

  return (
    <div className="absolute bottom-3 left-3 right-3 z-20 max-h-[42%] overflow-hidden rounded-lg border border-[#334155] bg-[#0c0f13]/97 shadow-xl backdrop-blur-md sm:left-auto sm:right-3 sm:w-[300px]">
      <div className="flex items-start justify-between gap-2 border-b border-[#232a35] px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
            {room.building}
          </p>
          <h3 className="truncate text-sm font-semibold text-[#f8fafc]">{room.label}</h3>
          <p className="mt-0.5 text-xs text-[#94a3b8]">{room.teacher}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded border border-[#2a3340] px-2 py-0.5 text-[10px] text-[#94a3b8] hover:bg-[#1a212b] hover:text-[#e2e8f0]"
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-3 gap-px border-b border-[#232a35] bg-[#232a35] text-center">
        <div className="bg-[#0c0f13] px-2 py-2">
          <p className="text-[9px] uppercase tracking-wider text-[#64748b]">Roster</p>
          <p className="font-mono text-base font-semibold text-[#e2e8f0]">{room.roster.length}</p>
        </div>
        <div className="bg-[#0c0f13] px-2 py-2">
          <p className="text-[9px] uppercase tracking-wider text-[#64748b]">Roster in</p>
          <p className="font-mono text-base font-semibold text-emerald-400">{rosterAccounted}</p>
        </div>
        <div className="bg-[#0c0f13] px-2 py-2">
          <p className="text-[9px] uppercase tracking-wider text-[#64748b]">Reports</p>
          <p className="font-mono text-base font-semibold text-sky-400">{stats.checkIns.length}</p>
        </div>
      </div>

      <div className="overflow-y-auto px-3 py-2" style={{ maxHeight: "min(220px, 32vh)" }}>
        {teacherSnap ? (
          <div className="mb-3 rounded-lg border border-sky-900/40 bg-sky-950/20 px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-sky-400/90">
              Teacher roll call
            </p>
            <p className="mt-0.5 text-xs text-[#e2e8f0]">
              {teacherSnap.report.teacherName} ·{" "}
              {teacherSnap.report.allAccounted
                ? "Everyone accounted"
                : `${teacherSnap.rosterMissing.length} missing on roster`}
            </p>
            <p className="text-[10px] text-[#64748b]">
              {teacherSnap.report.inputMode === "voice" ? "Voice" : "Roster"} ·{" "}
              {formatTime(new Date(teacherSnap.report.updatedAt))}
            </p>
          </div>
        ) : null}

        {stats.checkIns.length > 0 ? (
          <>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[#64748b]">
              Checked in here
            </p>
            <ul className="mb-3 space-y-1">
              {stats.checkIns.map((checkIn) => (
                <li
                  key={checkIn.key}
                  className="flex items-center justify-between rounded border border-[#1e2630] bg-[#11161d] px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <span className="text-xs text-[#f1f5f9]">{checkIn.studentName}</span>
                    <p className="truncate text-[10px] text-[#64748b]">
                      Gr {checkIn.grade} · {checkIn.teacherName}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-medium uppercase ${
                      checkIn.status === "safe" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {checkIn.status}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[#64748b]">
          Roster still missing
        </p>
        {missing.length === 0 ? (
          <p className="py-2 text-center text-xs text-emerald-400/90">
            Everyone on the teacher roster has checked in.
          </p>
        ) : (
          <ul className="space-y-1">
            {missing.map((student) => (
              <li
                key={student.id}
                className="flex items-center justify-between rounded border border-[#1e2630] bg-[#11161d] px-2 py-1.5"
              >
                <span className="text-xs text-[#f1f5f9]">{student.name}</span>
                <span className="text-[10px] text-[#64748b]">Gr {student.grade}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
