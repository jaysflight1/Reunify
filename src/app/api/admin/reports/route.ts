import { NextResponse } from "next/server";
import {
  listLocalStudentReports,
  listLocalTeacherReports,
} from "@/lib/check-in/local-report-store";
import { isLocalCheckInMode } from "@/lib/check-in/local-mode";
import {
  firebaseAdminConfigError,
  fetchDrillReportsAdmin,
  fetchTeacherReportsAdmin,
  isFirebaseAdminConfigured,
} from "@/lib/firebase/admin";
import { ACTIVE_DRILL_ID } from "@/lib/firebase/config";

export async function GET() {
  if (isLocalCheckInMode()) {
    return NextResponse.json({
      reports: listLocalStudentReports(),
      teacherReports: listLocalTeacherReports(),
      source: "local",
    });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      {
        error: firebaseAdminConfigError(),
        reports: [],
        teacherReports: [],
      },
      { status: 503 },
    );
  }

  try {
    const [reports, teacherReports] = await Promise.all([
      fetchDrillReportsAdmin(ACTIVE_DRILL_ID),
      fetchTeacherReportsAdmin(ACTIVE_DRILL_ID),
    ]);
    return NextResponse.json({ reports, teacherReports });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load reports";
    return NextResponse.json(
      { error: message, reports: [], teacherReports: [] },
      { status: 500 },
    );
  }
}
