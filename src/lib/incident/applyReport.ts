import { FieldValue, type Firestore, type WriteBatch } from "firebase-admin/firestore";
import { requireAdminDb } from "@/lib/firebase/admin";
import type {
  EmergencyReport,
  ProposedStudentUpdate,
  ReportReviewStatus,
  StudentIncidentState,
  StudentTimelineEvent,
} from "@/types/incident";
import type { AuthContext } from "@/types/user";

export type ApplyReportInput = {
  schoolId: string;
  incidentId: string;
  reportId: string;
  updates: ProposedStudentUpdate[];
  appliedBy: AuthContext;
  reviewStatus?: ReportReviewStatus;
  db?: Firestore;
  now?: string;
};

function stripUndefined(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value instanceof FieldValue) return value;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefined(item))
      .filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const cleaned = stripUndefined(child);
      if (cleaned !== undefined) output[key] = cleaned;
    }
    return output;
  }
  return undefined;
}

function cleanObject<T extends object>(value: T): Record<string, unknown> {
  return stripUndefined(value) as Record<string, unknown>;
}

function parentStatusForUpdate(update: ProposedStudentUpdate): StudentIncidentState["publicParentStatus"] {
  return update.parentVisibleStatus ?? "being_verified";
}

function confidenceForScore(score: number): StudentIncidentState["confidence"] {
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

function timelineEvent(
  update: ProposedStudentUpdate,
  input: ApplyReportInput,
  timestamp: string,
): StudentTimelineEvent {
  return {
    id: `${input.reportId}-${update.studentId}-${timestamp}`.replace(/[^a-zA-Z0-9_-]/g, "-"),
    timestamp,
    type: update.newStatus === "missing" ? "missing_report" : "status_update",
    summary: update.reason,
    reportId: input.reportId,
    actorUserId: input.appliedBy.uid,
    actorRole: input.appliedBy.role,
  };
}

function statePatch(
  update: ProposedStudentUpdate,
  input: ApplyReportInput,
  timestamp: string,
): Omit<Partial<StudentIncidentState>, "timeline"> & { timeline: FieldValue } {
  const adultVerified =
    input.appliedBy.role === "admin" ||
    input.appliedBy.role === "teacher" ||
    input.appliedBy.role === "responder";

  return {
    studentId: update.studentId,
    schoolId: input.schoolId,
    incidentId: input.incidentId,
    status: update.newStatus,
    publicParentStatus: parentStatusForUpdate(update),
    locationId: update.newLocationId,
    locationLabel: update.newLocationLabel,
    locationVisibility: update.locationVisibility,
    lastUpdatedAt: timestamp,
    lastUpdatedByUserId: input.appliedBy.uid,
    lastUpdatedByRole: input.appliedBy.role,
    lastReportId: input.reportId,
    confidence: confidenceForScore(update.confidenceScore),
    confidenceScore: update.confidenceScore,
    isLocationAdultVerified: adultVerified && Boolean(update.newLocationId),
    isStatusAdultVerified: adultVerified,
    timeline: FieldValue.arrayUnion(timelineEvent(update, input, timestamp)),
  };
}

async function flushBatch(batch: WriteBatch, pendingWrites: number): Promise<number> {
  if (pendingWrites > 0) await batch.commit();
  return 0;
}

export async function saveEmergencyReport(
  report: EmergencyReport,
  db: Firestore = requireAdminDb(),
): Promise<void> {
  const ref = db.doc(
    `schools/${report.schoolId}/incidents/${report.incidentId}/reports/${report.id}`,
  );
  await ref.set(cleanObject(report));
}

export async function applyReportUpdates(input: ApplyReportInput): Promise<{ applied: number }> {
  const db = input.db ?? requireAdminDb();
  const timestamp = input.now ?? new Date().toISOString();
  let batch = db.batch();
  let pendingWrites = 0;

  const queueSet = async (path: string, value: object, merge = true) => {
    if (pendingWrites >= 450) {
      pendingWrites = await flushBatch(batch, pendingWrites);
      batch = db.batch();
    }
    batch.set(db.doc(path), cleanObject(value), { merge });
    pendingWrites += 1;
  };

  for (const update of input.updates) {
    await queueSet(
      `schools/${input.schoolId}/incidents/${input.incidentId}/studentStates/${update.studentId}`,
      statePatch(update, input, timestamp),
    );
  }

  await queueSet(
    `schools/${input.schoolId}/incidents/${input.incidentId}/reports/${input.reportId}`,
    {
      reviewStatus: input.reviewStatus ?? "approved",
      appliedAt: timestamp,
      appliedByUserId: input.appliedBy.uid,
      updatedAt: timestamp,
    },
  );

  await flushBatch(batch, pendingWrites);
  return { applied: input.updates.length };
}
