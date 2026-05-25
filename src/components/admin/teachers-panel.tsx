"use client";

import { useMemo } from "react";
import { GHS_ROOMS, type GeneralRoom } from "@/lib/general-rooms";
import {
  getRoomEvacStats,
  roomTintFromEvacStats,
  type RoomEvacStats,
} from "@/lib/room-accounting";

type TeachersPanelProps = {
  roomStatsMap: ReadonlyMap<string, RoomEvacStats>;
  unaccountedIds: ReadonlySet<string>;
};

type RoomRow = {
  room: GeneralRoom;
  missing: number;
  checkedIn: number;
  stats: RoomEvacStats;
};

export function TeachersPanel({ roomStatsMap, unaccountedIds }: TeachersPanelProps) {
  const rows = useMemo(() => {
    const list: RoomRow[] = GHS_ROOMS.map((room) => {
      const stats = getRoomEvacStats(room, roomStatsMap, unaccountedIds);
      return {
        room,
        missing: stats.rosterMissing.length,
        checkedIn: stats.checkIns.length,
        stats,
      };
    });

    return list
      .filter((r) => r.missing > 0 || r.checkedIn > 0)
      .sort((a, b) => b.missing - a.missing || b.checkedIn - a.checkedIn);
  }, [roomStatsMap, unaccountedIds]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#232a35] bg-[#0c0f13]">
      <div className="shrink-0 border-b border-[#232a35] px-3 py-2.5">
        <h2 className="text-xs font-semibold text-[#e2e8f0]">Teachers &amp; rooms</h2>
        <p className="text-[10px] text-[#64748b]">
          Active rooms · {rows.length} with check-ins or missing
        </p>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {rows.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-[#64748b]">
            No room activity yet
          </li>
        ) : (
          rows.map(({ room, missing, checkedIn, stats }) => (
            <li
              key={room.id}
              className="flex items-start gap-2 border-b border-[#1a212b] px-3 py-2 hover:bg-[#11161d]"
            >
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: roomTintFromEvacStats(stats, room.roster.length) }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-[#f1f5f9]">
                    Rm {room.number}
                  </p>
                  {missing > 0 ? (
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-amber-400">
                      {missing} out
                    </span>
                  ) : (
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-emerald-500/80">
                      all in
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-[#94a3b8]">{room.teacher}</p>
                <p className="text-[10px] text-[#64748b]">
                  {room.building}
                  {checkedIn > 0 ? ` · ${checkedIn} checked in` : ""}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
