import { NEED_HELP_ROOM } from "@/lib/firebase/config";
import type { GeoLocation, StudentReportInput } from "@/lib/firebase/types";
import { submitStudentReportClient } from "@/lib/check-in/submit-reports";
import type { ExampleStudent } from "@/lib/demo/example-students";

export const BEACON_NOTE = "Beacon activated";
export const BEACON_DEACTIVATED_NOTE = "Beacon deactivated";
export const ANONYMOUS_BEACON_NAME = "Unknown student";
export const ANONYMOUS_BEACON_GRADE = "—";
export const BEACON_REPORT_ID_PREFIX = "beacon";

export type BeaconIdentity = Pick<ExampleStudent, "id" | "fullName" | "grade">;

export type BeaconLocationContext = {
  beaconId?: string;
  roomNumber?: string;
  teacherName?: string;
  location?: GeoLocation | null;
  note?: string;
};

export function anonymousBeaconStudentId(beaconId: string): string {
  return `${BEACON_REPORT_ID_PREFIX}-${beaconId.trim()}`;
}

export function buildAnonymousBeaconIdentity(beaconId: string): BeaconIdentity {
  return {
    id: anonymousBeaconStudentId(beaconId),
    fullName: ANONYMOUS_BEACON_NAME,
    grade: ANONYMOUS_BEACON_GRADE,
  };
}

export function buildBeaconReportInput(
  identity: BeaconIdentity | null,
  context: BeaconLocationContext = {},
): StudentReportInput {
  const beaconIdentity = identity ?? buildAnonymousBeaconIdentity(context.beaconId ?? "unknown");
  const roomNumber = context.roomNumber?.trim() || NEED_HELP_ROOM;

  return {
    clientReportId: context.beaconId ? anonymousBeaconStudentId(context.beaconId) : undefined,
    studentName: beaconIdentity.fullName,
    studentId: beaconIdentity.id,
    grade: beaconIdentity.grade,
    status: "unsafe",
    offCampus: false,
    shooterNearby: false,
    roomNumber,
    teacherName: roomNumber === NEED_HELP_ROOM ? "" : context.teacherName?.trim() || "",
    location: context.location ?? null,
    note: context.note?.trim() || BEACON_NOTE,
  };
}

export function buildBeaconDeactivationInput(
  identity: BeaconIdentity | null,
  context: BeaconLocationContext = {},
): StudentReportInput {
  const beaconIdentity = identity ?? buildAnonymousBeaconIdentity(context.beaconId ?? "unknown");

  return {
    clientReportId: context.beaconId ? anonymousBeaconStudentId(context.beaconId) : undefined,
    studentName: beaconIdentity.fullName,
    studentId: beaconIdentity.id,
    grade: beaconIdentity.grade,
    status: "safe",
    offCampus: true,
    shooterNearby: false,
    roomNumber: "",
    teacherName: "",
    location: context.location ?? null,
    note: BEACON_DEACTIVATED_NOTE,
  };
}

export async function submitBeaconReport(
  identity: BeaconIdentity | null,
  context: BeaconLocationContext = {},
): Promise<void> {
  await submitStudentReportClient(buildBeaconReportInput(identity, context));
}

export async function deactivateBeaconReport(
  identity: BeaconIdentity | null,
  context: BeaconLocationContext = {},
): Promise<void> {
  await submitStudentReportClient(buildBeaconDeactivationInput(identity, context));
}
