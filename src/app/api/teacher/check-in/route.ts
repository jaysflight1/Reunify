import { NextResponse } from "next/server";
import { isLocalCheckInMode } from "@/lib/check-in/local-mode";
import { upsertLocalTeacherReport } from "@/lib/check-in/local-report-store";
import type { TeacherReportSubmit, TeacherReportInputMode } from "@/lib/firebase/types";

function parseBody(body: unknown): TeacherReportSubmit | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const roomNumber = typeof data.roomNumber === "string" ? data.roomNumber.trim() : "";
  const teacherName = typeof data.teacherName === "string" ? data.teacherName.trim() : "";
  if (!roomNumber || !teacherName) return null;

  const inputMode: TeacherReportInputMode =
    data.inputMode === "checkbox" ? "checkbox" : "voice";

  return {
    roomNumber,
    spokenRoomNumber:
      typeof data.spokenRoomNumber === "string" ? data.spokenRoomNumber : null,
    teacherName,
    presentIds: Array.isArray(data.presentIds)
      ? data.presentIds.filter((id): id is string => typeof id === "string")
      : [],
    missingIds: Array.isArray(data.missingIds)
      ? data.missingIds.filter((id): id is string => typeof id === "string")
      : [],
    unmatchedMissing: Array.isArray(data.unmatchedMissing)
      ? data.unmatchedMissing.filter((name): name is string => typeof name === "string")
      : [],
    allAccounted: Boolean(data.allAccounted),
    note: typeof data.note === "string" ? data.note : null,
    transcript: typeof data.transcript === "string" ? data.transcript : null,
    inputMode,
  };
}

export async function POST(request: Request) {
  if (!isLocalCheckInMode()) {
    return NextResponse.json(
      { error: "Local teacher check-in is disabled when Firebase client env is configured." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = parseBody(body);
  if (!input) {
    return NextResponse.json({ error: "Room and teacher name are required." }, { status: 400 });
  }

  const report = upsertLocalTeacherReport(input);
  return NextResponse.json({ ok: true, id: report.id });
}
