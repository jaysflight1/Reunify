import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/requireUser";
import { requireAdminDb } from "@/lib/firebase/admin";
import { applyReportUpdates } from "@/lib/incident/applyReport";
import type { ProposedStudentUpdate } from "@/types/incident";

type ConfirmReportRequest = {
  schoolId?: string;
  incidentId?: string;
  editedUpdates?: ProposedStudentUpdate[];
};

type RouteContext = {
  params: Promise<{ reportId: string }>;
};

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Failed to confirm report.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { reportId } = await context.params;
    const body = (await request.json()) as ConfirmReportRequest;
    const schoolId = body.schoolId;
    const incidentId = body.incidentId;

    if (!schoolId || !incidentId) {
      return NextResponse.json({ error: "schoolId and incidentId are required." }, { status: 400 });
    }

    const admin = await requireUser(request, { schoolId, roles: ["admin"] });
    const db = requireAdminDb();
    const reportRef = db.doc(`schools/${schoolId}/incidents/${incidentId}/reports/${reportId}`);
    const snap = await reportRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const data = snap.data() as { proposedUpdates?: ProposedStudentUpdate[] };
    const updates = body.editedUpdates ?? data.proposedUpdates ?? [];
    const result = await applyReportUpdates({
      schoolId,
      incidentId,
      reportId,
      updates,
      appliedBy: admin,
      reviewStatus: "approved",
      db,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
