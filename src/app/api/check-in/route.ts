import { NextResponse } from "next/server";
import { isLocalCheckInMode } from "@/lib/check-in/local-mode";
import { upsertLocalStudentReport } from "@/lib/check-in/local-report-store";
import type { StudentReportInput } from "@/lib/firebase/types";
import type { Status } from "@/lib/demo-data";

function parseBody(body: unknown): StudentReportInput | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const status: Status = data.status === "unsafe" ? "unsafe" : "safe";
  const studentName = typeof data.studentName === "string" ? data.studentName.trim() : "";
  const studentId = typeof data.studentId === "string" ? data.studentId.trim() : "";
  const grade = typeof data.grade === "string" ? data.grade : "";

  if (!studentName || !studentId) return null;

  const location =
    data.location &&
    typeof data.location === "object" &&
    typeof (data.location as { latitude?: unknown }).latitude === "number" &&
    typeof (data.location as { longitude?: unknown }).longitude === "number"
      ? {
          latitude: (data.location as { latitude: number }).latitude,
          longitude: (data.location as { longitude: number }).longitude,
          accuracy:
            typeof (data.location as { accuracy?: unknown }).accuracy === "number"
              ? (data.location as { accuracy: number }).accuracy
              : null,
        }
      : null;

  return {
    studentName,
    studentId,
    grade,
    status,
    offCampus: Boolean(data.offCampus),
    shooterNearby: data.shooterNearby === true,
    roomNumber: typeof data.roomNumber === "string" ? data.roomNumber : "",
    teacherName: typeof data.teacherName === "string" ? data.teacherName : "",
    location,
    note: typeof data.note === "string" ? data.note : undefined,
  };
}

export async function POST(request: Request) {
  if (!isLocalCheckInMode()) {
    return NextResponse.json(
      { error: "Local check-in is disabled when Firebase client env is configured." },
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
    return NextResponse.json({ error: "Name and student ID are required." }, { status: 400 });
  }

  const report = upsertLocalStudentReport(input);
  return NextResponse.json({ ok: true, id: report.id });
}
