"use client";

import { useState } from "react";
import { CAMPUS_MAP, RALLY_POINT } from "@/lib/demo-data";
import type { LahsRoom } from "@/lib/lahs-rooms";
import type { RoomEvacStats } from "@/lib/room-accounting";
import type { TeacherRoomSnapshot } from "@/lib/evacuation-state";
import { SchematicCampus } from "./schematic-campus";
import { RoomLayer } from "./room-layer";
import { RoomDetailPanel } from "./room-detail-panel";

type CampusMapProps = {
  unaccountedIds: ReadonlySet<string>;
  roomStatsMap: ReadonlyMap<string, RoomEvacStats>;
  teacherByRoom: ReadonlyMap<string, TeacherRoomSnapshot>;
};

const VB = `0 0 ${CAMPUS_MAP.viewBox.w} ${CAMPUS_MAP.viewBox.h}`;

export function CampusMap({ unaccountedIds, roomStatsMap, teacherByRoom }: CampusMapProps) {
  const [selectedRoom, setSelectedRoom] = useState<LahsRoom | null>(null);
  const [showRoomNumbers, setShowRoomNumbers] = useState(true);

  return (
    <div className="relative flex w-full flex-col overflow-hidden rounded-lg border border-[#232a35] bg-[#0a0d11]">
      <div className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#232a35] bg-[#0a0d11] px-3 py-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8b98a8]">
            Campus map
          </p>
          <p className="text-xs text-[#5c6b7d]">
            {CAMPUS_MAP.schoolName} · schematic · click a room
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] text-[#6b7a8f]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-500/50" />
            All in
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-amber-500/50" />
            Some out
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-rose-500/50" />
            Many out
          </span>
          <button
            type="button"
            onClick={() => setShowRoomNumbers((v) => !v)}
            className="rounded border border-[#2a3340] px-2 py-0.5 text-[#94a3b8] hover:bg-[#1a212b]"
          >
            {showRoomNumbers ? "Hide #" : "Room #"}
          </button>
        </div>
      </div>

      <div className="relative p-3">
        <div
          className="relative mx-auto w-full max-w-5xl"
          style={{
            aspectRatio: `${CAMPUS_MAP.viewBox.w} / ${CAMPUS_MAP.viewBox.h}`,
          }}
        >
          <svg
            viewBox={VB}
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
            aria-label="Interactive school campus map"
          >
            <SchematicCampus />

            <RoomLayer
              roomStatsMap={roomStatsMap}
              unaccountedIds={unaccountedIds}
              selectedRoomId={selectedRoom?.id ?? null}
              onSelectRoom={setSelectedRoom}
              showLabels={showRoomNumbers}
            />

            <g>
              <circle
                cx={RALLY_POINT.x}
                cy={RALLY_POINT.y}
                r={3.5}
                fill="#10b981"
                fillOpacity={0.15}
                stroke="#34d399"
                strokeWidth={0.45}
              />
              <circle cx={RALLY_POINT.x} cy={RALLY_POINT.y} r={1} fill="#34d399" />
              <text
                x={RALLY_POINT.x}
                y={RALLY_POINT.y + 5.5}
                textAnchor="middle"
                className="fill-emerald-400 text-[2.4px] font-medium"
              >
                {RALLY_POINT.label}
              </text>
            </g>

          </svg>

          {selectedRoom ? (
            <RoomDetailPanel
              room={selectedRoom}
              roomStatsMap={roomStatsMap}
              teacherByRoom={teacherByRoom}
              unaccountedIds={unaccountedIds}
              onClose={() => setSelectedRoom(null)}
            />
          ) : (
            <p className="pointer-events-none absolute bottom-3 left-3 rounded bg-[#0c0f13]/90 px-2 py-1 text-[10px] text-[#64748b]">
              Click a colored room tile for teacher &amp; missing students
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
