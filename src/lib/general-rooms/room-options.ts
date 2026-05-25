import { GHS_ROOMS } from "./wings";
import { teacherForRoom } from "./teachers";

export const ROOM_OPTIONS = GHS_ROOMS.map((r) => ({
  value: r.number,
  label: r.label,
  building: r.building,
  teacher: r.teacher,
})).sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));

export function teacherForRoomOption(roomNumber: string): string {
  const room = GHS_ROOMS.find((r) => r.number === roomNumber);
  return room?.teacher ?? teacherForRoom(roomNumber, "Campus");
}
