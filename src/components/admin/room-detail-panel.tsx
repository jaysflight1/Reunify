"use client";

import { getRoomEvacStats, type RoomEvacStats } from "@/lib/room-accounting";
import { getTeacherSnapshot, type TeacherRoomSnapshot } from "@/lib/evacuation-state";
import type { GeneralRoom, RoomStudent } from "@/lib/general-rooms";
import { formatTime } from "@/lib/demo-data";
import type { Status } from "@/lib/demo-data";

type RoomDetailPanelProps = {
  room: GeneralRoom;
  roomStatsMap: ReadonlyMap<string, RoomEvacStats>;
  teacherByRoom: ReadonlyMap<string, TeacherRoomSnapshot>;
  unaccountedIds: ReadonlySet<string>;
  onClose: () => void;
  mode?: "below" | "overlay";
};

type RoomStudentSummary = {
  key: string;
  name: string;
  grade: string;
  status: Status | "missing";
  teacherName?: string;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function studentStatusRank(status: RoomStudentSummary["status"]): number {
  if (status === "unsafe") return 0;
  if (status === "missing") return 1;
  return 2;
}

function statusLabel(status: RoomStudentSummary["status"]): string {
  if (status === "unsafe") return "Needs help";
  if (status === "missing") return "Missing";
  return "Safe";
}

function statusDotClass(status: RoomStudentSummary["status"]): string {
  if (status === "unsafe") return "bg-rose-400";
  if (status === "missing") return "bg-amber-300";
  return "bg-emerald-400";
}

function buildRoomStudents(
  roster: RoomStudent[],
  stats: RoomEvacStats,
): RoomStudentSummary[] {
  const missingIds = new Set(stats.rosterMissing.map((student) => student.id));
  const checkInByRosterId = new Map(
    stats.checkIns
      .filter((checkIn) => checkIn.rosterStudentId)
      .map((checkIn) => [checkIn.rosterStudentId!, checkIn]),
  );
  const checkInByName = new Map(
    stats.checkIns.map((checkIn) => [normalizeName(checkIn.studentName), checkIn]),
  );
  const rosterIds = new Set(roster.map((student) => student.id));

  const rosterRows = roster.map((student) => {
    const checkIn =
      checkInByRosterId.get(student.id) ?? checkInByName.get(normalizeName(student.name));
    const status: RoomStudentSummary["status"] = checkIn
      ? checkIn.status
      : missingIds.has(student.id)
        ? "missing"
        : "safe";
    return {
      key: student.id,
      name: student.name,
      grade: student.grade,
      status,
      teacherName: checkIn?.teacherName,
    };
  });

  const guestRows = stats.checkIns
    .filter((checkIn) => checkIn.rosterStudentId && !rosterIds.has(checkIn.rosterStudentId))
    .map((checkIn) => ({
      key: checkIn.key,
      name: checkIn.studentName,
      grade: checkIn.grade,
      status: checkIn.status,
      teacherName: checkIn.teacherName,
    }));

  return [...rosterRows, ...guestRows].sort(
    (a, b) => studentStatusRank(a.status) - studentStatusRank(b.status) || a.name.localeCompare(b.name),
  );
}

export function RoomDetailPanel({
  room,
  roomStatsMap,
  teacherByRoom,
  unaccountedIds,
  onClose,
  mode = "below",
}: RoomDetailPanelProps) {
  const stats = getRoomEvacStats(room, roomStatsMap, unaccountedIds);
  const teacherSnap = getTeacherSnapshot(room, teacherByRoom);
  const missing = stats.rosterMissing;
  const rosterIds = new Set(room.roster.map((student) => student.id));
  const guestCheckIns = stats.checkIns.filter(
    (checkIn) => checkIn.rosterStudentId && !rosterIds.has(checkIn.rosterStudentId),
  );
  const rosterTotal = room.roster.length + guestCheckIns.length;
  const rosterAccounted = room.roster.length - missing.length + guestCheckIns.length;
  const roomStudents = buildRoomStudents(room.roster, stats);
  const panelClass =
    mode === "overlay"
      ? "absolute bottom-3 left-3 right-3 z-20 max-h-[52%] overflow-hidden rounded-lg border border-[#334155] bg-[#0c0f13]/97 shadow-xl backdrop-blur-md sm:left-auto sm:right-3 sm:w-[340px]"
      : "mt-3 overflow-hidden rounded-lg border border-[#334155] bg-[#0c0f13]/97 shadow-xl backdrop-blur-md";

  return (
    <div className={panelClass}>
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
          <p className="font-mono text-base font-semibold text-[#e2e8f0]">{rosterTotal}</p>
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

      <div
        className="overflow-y-auto px-3 py-2"
        style={{ maxHeight: mode === "overlay" ? "min(320px, 42vh)" : "min(420px, 52vh)" }}
      >
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
              {teacherSnap.report.spokenRoomNumber
                ? ` · said room ${teacherSnap.report.spokenRoomNumber}`
                : null}
            </p>
          </div>
        ) : null}

        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[#64748b]">
          Room students
        </p>
        <ul className="space-y-1">
          {roomStudents.map((student) => (
            <li
              key={student.key}
              className="flex items-center justify-between gap-2 rounded border border-[#1e2630] bg-[#11161d] px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDotClass(student.status)}`} />
                <div className="min-w-0">
                  <span className="truncate text-xs text-[#f1f5f9]">{student.name}</span>
                  <p className="truncate text-[10px] text-[#64748b]">
                    Gr {student.grade}
                    {student.teacherName ? ` · ${student.teacherName}` : ""}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-medium uppercase text-[#94a3b8]">
                {statusLabel(student.status)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
