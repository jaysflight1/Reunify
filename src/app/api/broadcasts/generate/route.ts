import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/requireUser";
import { requireAdminDb } from "@/lib/firebase/admin";
import { generateBroadcast, type BroadcastTone } from "@/lib/gemini/generateBroadcast";
import type { Broadcast, BroadcastAudience, StudentIncidentState } from "@/types/incident";

type GenerateBroadcastRequest = {
  schoolId?: string;
  incidentId?: string;
  audience?: BroadcastAudience;
  tone?: BroadcastTone;
};

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Failed to generate broadcast.";
  return NextResponse.json({ error: message }, { status: 500 });
}

function validAudience(value: unknown): value is BroadcastAudience {
  return value === "parents" || value === "teachers" || value === "responders" || value === "students";
}

function validTone(value: unknown): value is BroadcastTone {
  return value === "calm" || value === "urgent" || value === "brief";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateBroadcastRequest;
    const schoolId = body.schoolId;
    const incidentId = body.incidentId;
    const audience = body.audience;
    const tone = validTone(body.tone) ? body.tone : "calm";

    if (!schoolId || !incidentId || !validAudience(audience)) {
      return NextResponse.json(
        { error: "schoolId, incidentId, and valid audience are required." },
        { status: 400 },
      );
    }

    const admin = await requireUser(request, { schoolId, roles: ["admin"] });
    const db = requireAdminDb();
    const [incidentSnap, statesSnap, conflictsSnap] = await Promise.all([
      db.doc(`schools/${schoolId}/incidents/${incidentId}`).get(),
      db.collection(`schools/${schoolId}/incidents/${incidentId}/studentStates`).get(),
      db
        .collection(`schools/${schoolId}/incidents/${incidentId}/conflicts`)
        .where("status", "==", "open")
        .get(),
    ]);

    const states = statesSnap.docs.map((doc) => doc.data() as StudentIncidentState);
    const summary = {
      totalStudents: states.length,
      safe: states.filter((state) => state.status === "safe" || state.status === "with_teacher").length,
      unaccounted: states.filter((state) => state.status === "unaccounted" || state.status === "missing").length,
      needsHelp: states.filter((state) => state.status === "needs_help" || state.status === "injured").length,
      pendingVerification: states.filter((state) => state.status === "pending_verification").length,
      openConflicts: conflictsSnap.size,
    };

    const incident = incidentSnap.data();
    const message = await generateBroadcast({
      audience,
      tone,
      incidentTitle: typeof incident?.title === "string" ? incident.title : "Active school incident",
      summary,
    });

    const ref = db.collection(`schools/${schoolId}/incidents/${incidentId}/broadcasts`).doc();
    const broadcast: Broadcast = {
      id: ref.id,
      schoolId,
      incidentId,
      audience,
      message,
      createdAt: new Date().toISOString(),
      createdByUserId: admin.uid,
      generatedByAi: true,
    };
    await ref.set(broadcast);

    return NextResponse.json({ broadcast });
  } catch (error) {
    return errorResponse(error);
  }
}
