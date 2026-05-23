import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/requireUser";
import { processSubmittedReport } from "@/lib/incident/processReport";
import type { ReportSource } from "@/types/incident";

type SubmitTextReportRequest = {
  schoolId?: string;
  incidentId?: string;
  rawText?: string;
  source?: ReportSource;
};

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Failed to submit report.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubmitTextReportRequest;
    const schoolId = body.schoolId;
    const incidentId = body.incidentId;
    const rawText = body.rawText?.trim();

    if (!schoolId || !incidentId || !rawText) {
      return NextResponse.json(
        { error: "schoolId, incidentId, and rawText are required." },
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
      rawText,
      source: body.source === "sms" || body.source === "manual" ? body.source : "text",
      reporter,
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
