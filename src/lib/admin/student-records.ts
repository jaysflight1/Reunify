import type { AdminStudentRecord } from "@/components/admin/admin-types";
import type { CheckInEvent } from "@/hooks/use-live-simulation";
import { BEACON_REPORT_ID_PREFIX } from "@/lib/student/beacon";
import type { RoomStudent } from "@/lib/general-rooms";

function eventToRecord(event: CheckInEvent): AdminStudentRecord {
  return {
    id: event.student.id || event.id,
    name: event.student.name,
    grade: event.student.grade,
    status: event.status,
    roomNumber: event.roomNumber,
    teacherName: event.teacherName,
    note: event.note,
    updatedAt: event.at,
  };
}

function latestRecordsByStudent(records: AdminStudentRecord[]): AdminStudentRecord[] {
  const byId = new Map<string, AdminStudentRecord>();

  for (const record of records) {
    if (!byId.has(record.id)) byId.set(record.id, record);
  }

  return [...byId.values()];
}

function roomFromStudentId(id: string): string | undefined {
  const match = id.match(/^r([^-]+)-/);
  return match?.[1];
}

export function isActiveAnonymousBeaconRecord(record: AdminStudentRecord): boolean {
  return record.status === "unsafe" && record.id.startsWith(`${BEACON_REPORT_ID_PREFIX}-`);
}

export function buildStaffStudentRecords({
  events,
  missingStudents,
  rosterIds,
  unaccountedIds,
  includeImplicitSafe,
  allRosterStudents,
}: {
  events: CheckInEvent[];
  missingStudents: RoomStudent[];
  rosterIds: ReadonlySet<string>;
  unaccountedIds?: ReadonlySet<string>;
  includeImplicitSafe: boolean;
  allRosterStudents?: RoomStudent[];
}): AdminStudentRecord[] {
  const latestFromEvents = latestRecordsByStudent(events.map(eventToRecord)).filter(
    (record) => rosterIds.has(record.id) || isActiveAnonymousBeaconRecord(record),
  );
  const eventIds = new Set(latestFromEvents.map((record) => record.id));
  const missing = missingStudents
    .filter((student) => !eventIds.has(student.id))
    .map(
      (student): AdminStudentRecord => ({
        id: student.id,
        name: student.name,
        grade: student.grade,
        status: "unaccounted",
        roomNumber: roomFromStudentId(student.id),
      }),
    );

  const implicitSafe =
    includeImplicitSafe && allRosterStudents && unaccountedIds
      ? allRosterStudents
          .filter((student) => !eventIds.has(student.id) && !unaccountedIds.has(student.id))
          .map(
            (student): AdminStudentRecord => ({
              id: student.id,
              name: student.name,
              grade: student.grade,
              status: "safe",
              roomNumber: roomFromStudentId(student.id),
            }),
          )
      : [];

  return [...latestFromEvents, ...missing, ...implicitSafe];
}
