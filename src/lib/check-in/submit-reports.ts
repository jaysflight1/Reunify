import { isFirebaseConfigured } from "@/lib/firebase/config";
import { submitStudentReport } from "@/lib/firebase/reports";
import { submitTeacherRoomReport } from "@/lib/firebase/teacher-reports";
import type { StudentReportInput, TeacherReportSubmit } from "@/lib/firebase/types";
import { isLocalCheckInMode } from "./local-mode";

async function readApiError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string };
    return json.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function submitStudentReportClient(input: StudentReportInput): Promise<void> {
  if (isFirebaseConfigured()) {
    await submitStudentReport(input);
    return;
  }

  if (!isLocalCheckInMode()) {
    throw new Error("Check-in is offline. Firebase is not configured yet.");
  }

  const res = await fetch("/api/check-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
}

export async function submitTeacherRoomReportClient(input: TeacherReportSubmit): Promise<void> {
  if (isFirebaseConfigured()) {
    await submitTeacherRoomReport(input);
    return;
  }

  if (!isLocalCheckInMode()) {
    throw new Error("Firebase is not configured.");
  }

  const res = await fetch("/api/teacher/check-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
}
