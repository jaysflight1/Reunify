import type { CheckInEvent } from "@/hooks/use-live-simulation";
import { ALL_ROSTER_STUDENTS, GHS_ROOMS, getRoomByNumber, type RoomStudent } from "@/lib/general-rooms";

/**
 * What the parent portal is allowed to display. Even if internal data marks a
 * child as unsafe or unaccounted, the parent only ever sees `unknown` until we
 * have a positive safe confirmation — at which point we flip to `safe`.
 */
export type ParentChildStatus = "safe" | "unknown";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function rosterStudentIdForName(name: string): string | null {
  const key = normalizeName(name);
  if (!key) return null;
  return ALL_ROSTER_STUDENTS.find((s) => normalizeName(s.name) === key)?.id ?? null;
}

export function isOnCampusRoster(studentId: string): boolean {
  return ALL_ROSTER_STUDENTS.some((s) => s.id === studentId);
}

export function findRoomForStudent(studentId: string) {
  return GHS_ROOMS.find((room) => room.roster.some((s) => s.id === studentId));
}

function eventMatchesStudent(event: CheckInEvent, student: RoomStudent): boolean {
  if (event.id.startsWith("t-")) return false;
  if (event.student.id === student.id) return true;
  return normalizeName(event.student.name) === normalizeName(student.name);
}

/** Best student-relevant event (self check-in or teacher missing). Prefers needs-help. */
export function findLatestStudentEvent(
  events: readonly CheckInEvent[],
  student: RoomStudent,
): CheckInEvent | null {
  let found: CheckInEvent | null = null;
  for (const event of events) {
    if (!eventMatchesStudent(event, student)) continue;
    if (!found) {
      found = event;
      continue;
    }
    if (event.status === "unsafe") found = event;
    else if (found.status !== "unsafe") found = event;
  }
  return found;
}

export function resolveParentChildStatus(
  student: RoomStudent,
  events: readonly CheckInEvent[],
): ParentChildStatus {
  // Parents only see `safe` when we have an affirmative confirmation:
  // a student-source safe check-in, or a teacher roll call covering them.
  // Anything else (including unsafe / unaccounted) is shown as `unknown`.
  const latestEvent = findLatestStudentEvent(events, student);
  if (latestEvent?.status === "safe") return "safe";
  if (findTeacherRollCallForStudent(events, student)) return "safe";
  return "unknown";
}

export function roomContextForStudent(
  student: RoomStudent,
  latestEvent: CheckInEvent | null,
) {
  const rawRoom = latestEvent?.roomNumber?.trim();
  const parsedNumber = rawRoom?.replace(/^Room\s+/i, "").trim();
  const room =
    (parsedNumber && parsedNumber !== "Off campus"
      ? getRoomByNumber(parsedNumber)
      : undefined) ?? findRoomForStudent(student.id);

  return {
    room,
    roomLabel: rawRoom
      ? room && parsedNumber && parsedNumber !== "Off campus"
        ? `Room ${room.number} · ${room.label}`
        : rawRoom
      : room
        ? `Room ${room.number} · ${room.label}`
        : null,
    roomBuilding: room?.building ?? null,
    teacherName: latestEvent?.teacherName ?? room?.teacher ?? null,
  };
}

export function findTeacherRollCallForStudent(
  events: readonly CheckInEvent[],
  student: RoomStudent,
): CheckInEvent | null {
  const room = findRoomForStudent(student.id);
  if (!room) return null;
  return events.find((e) => e.id.startsWith("t-") && e.roomNumber === room.number) ?? null;
}
