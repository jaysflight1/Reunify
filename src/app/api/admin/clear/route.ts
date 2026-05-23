import { NextResponse } from "next/server";
import { archiveLocalReports } from "@/lib/check-in/local-report-store";
import { isLocalCheckInMode } from "@/lib/check-in/local-mode";
import {
  archiveDrillReportsAdmin,
  firebaseAdminConfigError,
  isFirebaseAdminConfigured,
} from "@/lib/firebase/admin";
import { ACTIVE_DRILL_ID } from "@/lib/firebase/config";

export async function POST() {
  if (isLocalCheckInMode()) {
    const counts = archiveLocalReports();
    return NextResponse.json({
      ok: true,
      drillId: ACTIVE_DRILL_ID,
      source: "local",
      ...counts,
    });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      {
        error: `${firebaseAdminConfigError()} Restart the dev server after adding credentials.`,
      },
      { status: 503 },
    );
  }

  try {
    const counts = await archiveDrillReportsAdmin(ACTIVE_DRILL_ID);
    return NextResponse.json({
      ok: true,
      drillId: ACTIVE_DRILL_ID,
      source: "firebase",
      ...counts,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reset failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
