import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/requireUser";
import { requireAdminDb } from "@/lib/firebase/admin";

type RejectReportRequest = {
  schoolId?: string;
  incidentId?: string;
  reason?: string;
};

type RouteContext = {
  params: Promise<{ reportId: string }>;
};

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Failed to reject report.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { reportId } = await context.params;
    const body = (await request.json()) as RejectReportRequest;
    const schoolId = body.schoolId;
    const incidentId = body.incidentId;

    if (!schoolId || !incidentId) {
      return NextResponse.json({ error: "schoolId and incidentId are required." }, { status: 400 });
    }

    const admin = await requireUser(request, { schoolId, roles: ["admin"] });
    const db = requireAdminDb();
    await db.doc(`schools/${schoolId}/incidents/${incidentId}/reports/${reportId}`).set(
      {
        reviewStatus: "rejected",
        rejectedAt: new Date().toISOString(),
        rejectedByUserId: admin.uid,
        rejectionReason: body.reason?.trim() || null,
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
