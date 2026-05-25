export type { GeneralRoom, RoomStudent } from "./types";
import type { GeneralRoom, RoomStudent } from "./types";
export {
  GHS_ROOMS,
  ALL_ROSTER_STUDENTS,
  getRoomById,
  getRoomByNumber,
} from "./wings";

export function getMissingInRoom(
  room: GeneralRoom,
  unaccountedIds: ReadonlySet<string>,
): RoomStudent[] {
  return room.roster.filter((s) => unaccountedIds.has(s.id));
}

export function roomStatusTint(missingCount: number, rosterSize: number): string {
  if (rosterSize === 0) return "rgba(100,116,139,0.15)";
  const ratio = missingCount / rosterSize;
  if (missingCount === 0) return "rgba(16,185,129,0.42)";
  if (ratio <= 0.35) return "rgba(245,158,11,0.45)";
  return "rgba(244,63,94,0.48)";
}
