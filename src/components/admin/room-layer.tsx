"use client";

import { LAHS_ROOMS, type LahsRoom } from "@/lib/lahs-rooms";
import {
  getRoomEvacStats,
  roomTintFromEvacStats,
  type RoomEvacStats,
} from "@/lib/room-accounting";

type RoomLayerProps = {
  roomStatsMap: ReadonlyMap<string, RoomEvacStats>;
  unaccountedIds: ReadonlySet<string>;
  selectedRoomId: string | null;
  onSelectRoom: (room: LahsRoom) => void;
  showLabels?: boolean;
};

export function RoomLayer({
  roomStatsMap,
  unaccountedIds,
  selectedRoomId,
  onSelectRoom,
  showLabels = true,
}: RoomLayerProps) {
  return (
    <g className="room-layer">
      {LAHS_ROOMS.map((room) => {
        const stats = getRoomEvacStats(room, roomStatsMap, unaccountedIds);
        const missing = stats.rosterMissing;
        const fill = roomTintFromEvacStats(stats, room.roster.length);
        const isSelected = selectedRoomId === room.id;
        const cx = room.x + room.w / 2;
        const cy = room.y + room.h / 2;
        const fontSize = Math.min(room.w * 0.42, 3.2);
        const roomSummary = `${room.label} · ${room.teacher} · ${missing.length} roster missing · ${stats.checkIns.length} checked in here`;

        return (
          <g key={room.id}>
            <rect
              x={room.x}
              y={room.y}
              width={room.w}
              height={room.h}
              rx={0.35}
              fill={fill}
              stroke={isSelected ? "#f8fafc" : "rgba(15,23,42,0.7)"}
              strokeWidth={isSelected ? 0.5 : 0.25}
              className="cursor-pointer hover:stroke-[#e2e8f0] hover:[stroke-width:0.4]"
              onClick={() => onSelectRoom(room)}
              aria-label={roomSummary}
            />
            {showLabels && room.w >= 2.5 ? (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none fill-[#0f172a] font-semibold"
                style={{ fontSize }}
              >
                {room.number.length <= 3 ? room.number : room.number.slice(0, 3)}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
