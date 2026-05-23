import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/requireUser";
import { getAdminDb } from "@/lib/firebase/admin";
import type { ParentPublicStatus, StudentStatus } from "@/types/incident";

type StudentSelfStatusResponse = {
  studentId: string;
  studentName: string;
  status: StudentStatus;
  publicParentStatus: ParentPublicStatus;
  selfSafeMessage: string;
  lastUpdatedAt: string;
  canSubmitUpdate: boolean;
};

function messageForStatus(status: StudentStatus): string {
  if (status === "safe" || status === "with_teacher" || status === "relocated") {
    return "Your status is marked safe with school staff.";
  }
  if (status === "needs_help" || status === "injured") {
    return "Your help request has been sent to school staff.";
  }
  if (status === "pending_verification") {
    return "Your update is being verified by school staff.";
  }
  return "No verified update is available yet. You can send your current status below.";
}

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Failed to load student status.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request, { roles: ["student"] });
    const studentId = user.user.linkedStudentId;
    if (!studentId) {
      return NextResponse.json({ error: "Student user is not linked to a student." }, { status: 403 });
    }

    const db = getAdminDb();
    if (!db) {
      const fallback: StudentSelfStatusResponse = {
        studentId,
        studentName: user.user.displayName,
        status: "unknown",
        publicParentStatus: "no_update_yet",
        selfSafeMessage: messageForStatus("unknown"),
        lastUpdatedAt: "",
        canSubmitUpdate: true,
      };
      return NextResponse.json(fallback);
    }

    const schoolId = user.schoolId;
    const schoolSnap = await db.doc(`schools/${schoolId}`).get();
    const activeIncidentId =
      typeof schoolSnap.data()?.activeIncidentId === "string"
        ? (schoolSnap.data()?.activeIncidentId as string)
        : "incident-demo-gas-leak";

    const [studentSnap, stateSnap] = await Promise.all([
      db.doc(`schools/${schoolId}/students/${studentId}`).get(),
      db.doc(`schools/${schoolId}/incidents/${activeIncidentId}/studentStates/${studentId}`).get(),
    ]);

    const state = stateSnap.data();
    const status =
      state?.status === "safe" ||
      state?.status === "with_teacher" ||
      state?.status === "unaccounted" ||
      state?.status === "missing" ||
      state?.status === "needs_help" ||
      state?.status === "injured" ||
      state?.status === "with_nurse" ||
      state?.status === "relocated" ||
      state?.status === "picked_up" ||
      state?.status === "pending_verification"
        ? state.status
        : "unknown";
    const publicParentStatus =
      state?.publicParentStatus === "safe" ||
      state?.publicParentStatus === "being_verified" ||
      state?.publicParentStatus === "needs_assistance" ||
      state?.publicParentStatus === "pickup_ready" ||
      state?.publicParentStatus === "picked_up"
        ? state.publicParentStatus
        : "no_update_yet";

    const response: StudentSelfStatusResponse = {
      studentId,
      studentName:
        typeof studentSnap.data()?.fullName === "string"
          ? (studentSnap.data()?.fullName as string)
          : user.user.displayName,
      status,
      publicParentStatus,
      selfSafeMessage: messageForStatus(status),
      lastUpdatedAt: typeof state?.lastUpdatedAt === "string" ? state.lastUpdatedAt : "",
      canSubmitUpdate: true,
    };

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
