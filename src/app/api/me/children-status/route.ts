import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/requireUser";
import { getAdminDb } from "@/lib/firebase/admin";
import { toParentSafeStatus } from "@/lib/incident/parentSafe";
import type { Broadcast, ParentSafeStudentStatus, Student, StudentIncidentState } from "@/types/incident";

type ParentChildrenStatusResponse = {
  children: ParentSafeStudentStatus[];
  parentBroadcasts: Broadcast[];
};

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Failed to load children status.";
  return NextResponse.json({ error: message }, { status: 500 });
}

function fallbackState(studentId: string, schoolId: string, incidentId: string): StudentIncidentState {
  return {
    studentId,
    schoolId,
    incidentId,
    status: "unknown",
    publicParentStatus: "no_update_yet",
    locationVisibility: "admin_only",
    lastUpdatedAt: "",
    confidence: "low",
    isLocationAdultVerified: false,
    isStatusAdultVerified: false,
    timeline: [],
  };
}

export async function GET(request: Request) {
  try {
    const parent = await requireUser(request, { roles: ["parent"] });
    const linkedStudentIds = parent.user.linkedStudentIds ?? [];
    if (linkedStudentIds.length === 0) {
      return NextResponse.json({ children: [], parentBroadcasts: [] });
    }

    const db = getAdminDb();
    if (!db) {
      const response: ParentChildrenStatusResponse = {
        children: linkedStudentIds.map((studentId) =>
          toParentSafeStatus(fallbackState(studentId, parent.schoolId, "incident-demo-gas-leak"), {
            id: studentId,
            schoolId: parent.schoolId,
            firstName: "",
            lastName: "",
            fullName: studentId,
            grade: "",
            classIds: [],
            parentGuardianIds: [parent.uid],
            authorizedPickupGuardianIds: [parent.uid],
            createdAt: "",
            updatedAt: "",
          }),
        ),
        parentBroadcasts: [],
      };
      return NextResponse.json(response);
    }

    const schoolSnap = await db.doc(`schools/${parent.schoolId}`).get();
    const activeIncidentId =
      typeof schoolSnap.data()?.activeIncidentId === "string"
        ? (schoolSnap.data()?.activeIncidentId as string)
        : "incident-demo-gas-leak";

    const children = await Promise.all(
      linkedStudentIds.map(async (studentId) => {
        const [studentSnap, stateSnap] = await Promise.all([
          db.doc(`schools/${parent.schoolId}/students/${studentId}`).get(),
          db
            .doc(`schools/${parent.schoolId}/incidents/${activeIncidentId}/studentStates/${studentId}`)
            .get(),
        ]);

        const student = studentSnap.exists ? (studentSnap.data() as Student) : undefined;
        const state = stateSnap.exists
          ? (stateSnap.data() as StudentIncidentState)
          : fallbackState(studentId, parent.schoolId, activeIncidentId);
        return toParentSafeStatus(state, student);
      }),
    );

    const broadcastsSnap = await db
      .collection(`schools/${parent.schoolId}/incidents/${activeIncidentId}/broadcasts`)
      .where("audience", "==", "parents")
      .limit(5)
      .get();

    const response: ParentChildrenStatusResponse = {
      children,
      parentBroadcasts: broadcastsSnap.docs.map((doc) => doc.data() as Broadcast),
    };

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
