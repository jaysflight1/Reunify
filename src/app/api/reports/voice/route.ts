import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/requireUser";
import { processSubmittedReport } from "@/lib/incident/processReport";

type SubmitVoiceReportRequest = {
  schoolId?: string;
  incidentId?: string;
  transcript?: string;
};

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Failed to submit voice report.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubmitVoiceReportRequest;
    const schoolId = body.schoolId;
    const incidentId = body.incidentId;
    const transcript = body.transcript?.trim();

    if (!schoolId || !incidentId || !transcript) {
      return NextResponse.json(
        { error: "schoolId, incidentId, and transcript are required." },
        { status: 400 },
      );
    }

    const reporter = await requireUser(request, {
      schoolId,
      roles: ["admin", "teacher", "student", "parent", "responder"],
    });
    const result = await processSubmittedReport({
      schoolId,
      incidentId,
      rawText: transcript,
      source: "voice",
      reporter,
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
