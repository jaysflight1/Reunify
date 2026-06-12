import { NEED_HELP_ROOM } from "@/lib/firebase/config";
import type { GeoLocation, StudentReportInput } from "@/lib/firebase/types";
import { submitStudentReportClient } from "@/lib/check-in/submit-reports";
import type { ExampleStudent } from "@/lib/demo/example-students";

export const SAFE_STATUS_NOTE = "I'm safe";
export const UPDATE_STATUS_FALLBACK_NOTE = "Status update sent";

export type StudentStatusIdentity = Pick<ExampleStudent, "id" | "fullName" | "grade">;

export type StudentStatusContext = {
  location?: GeoLocation | null;
  note?: string;
};

export function buildSafeStatusReportInput(
  identity: StudentStatusIdentity,
  context: StudentStatusContext = {},
): StudentReportInput {
  return {
    studentName: identity.fullName,
    studentId: identity.id,
    grade: identity.grade,
    status: "safe",
    offCampus: false,
    shooterNearby: false,
    roomNumber: "",
    teacherName: "",
    location: context.location ?? null,
    note: context.note?.trim() || SAFE_STATUS_NOTE,
  };
}

export function buildUpdateStatusReportInput(
  identity: StudentStatusIdentity,
  context: StudentStatusContext = {},
): StudentReportInput {
  return {
    studentName: identity.fullName,
    studentId: identity.id,
    grade: identity.grade,
    status: "unsafe",
    offCampus: false,
    shooterNearby: false,
    roomNumber: NEED_HELP_ROOM,
    teacherName: "",
    location: context.location ?? null,
    note: context.note?.trim() || UPDATE_STATUS_FALLBACK_NOTE,
  };
}

export async function submitSafeStatusReport(
  identity: StudentStatusIdentity,
  context: StudentStatusContext = {},
): Promise<void> {
  await submitStudentReportClient(buildSafeStatusReportInput(identity, context));
}

export async function submitUpdateStatusReport(
  identity: StudentStatusIdentity,
  context: StudentStatusContext = {},
): Promise<void> {
  await submitStudentReportClient(buildUpdateStatusReportInput(identity, context));
}
