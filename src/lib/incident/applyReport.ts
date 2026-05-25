import { FieldValue, type Firestore, type WriteBatch } from "firebase-admin/firestore";
import { requireAdminDb } from "@/lib/firebase/admin";
import { createFirestoreNotificationStore } from "@/lib/notifications/audit-store";
import { notifyParentsOfSafeStudent } from "@/lib/notifications/parent-safe";
import type {
  EmergencyReport,
  ParentPublicStatus,
  ProposedStudentUpdate,
  ReportReviewStatus,
  StudentIncidentState,
  StudentTimelineEvent,
} from "@/types/incident";
import type { AuthContext, UserRole } from "@/types/user";

export type ApplyReportInput = {
  schoolId: string;
  incidentId: string;
  reportId: string;
  updates: ProposedStudentUpdate[];
  appliedBy: AuthContext;
  reviewStatus?: ReportReviewStatus;
  db?: Firestore;
  now?: string;
  /**
   * Post-commit notification dispatcher. Defaults to the Firestore-backed
   * parent-safe notifier. Injectable for tests; callers in production should
   * not pass this.
   */
  notifyParentsOfSafe?: (
    input: { schoolId: string; incidentId: string; studentId: string },
  ) => Promise<void>;
};

const ADULT_ROLES: readonly UserRole[] = ["admin", "teacher", "responder"];

function isAdultRole(role: UserRole): boolean {
  return ADULT_ROLES.includes(role);
}

/** Max simultaneous parent-safe notification dispatches per applyReportUpdates call. */
const NOTIFY_CONCURRENCY = 5;

export type PreviousParentStatusResult =
  | { ok: true; statuses: Map<string, ParentPublicStatus | undefined> }
  | { ok: false };

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
  const adultVerified = isAdultRole(input.appliedBy.role);

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

/**
 * Read each student's current `publicParentStatus` in one round trip.
 *
 * Returns a discriminated result:
 *   - `{ ok: true, statuses }` — read succeeded; a missing key (no doc yet)
 *     legitimately represents "no previous state recorded" and should be
 *     treated by callers as a valid first-safe transition.
 *   - `{ ok: false }` — the read itself failed. Callers MUST treat this as
 *     "no transitions detected" and skip notifications entirely, so a
 *     Firestore read hiccup never produces spurious SMS.
 */
export async function readPreviousParentStatuses(
  db: Firestore,
  schoolId: string,
  incidentId: string,
  studentIds: readonly string[],
): Promise<PreviousParentStatusResult> {
  if (studentIds.length === 0) return { ok: true, statuses: new Map() };

  try {
    const refs = studentIds.map((id) =>
      db.doc(`schools/${schoolId}/incidents/${incidentId}/studentStates/${id}`),
    );
    const snaps = await db.getAll(...refs);
    const statuses = new Map<string, ParentPublicStatus | undefined>();
    for (let i = 0; i < snaps.length; i++) {
      const snap = snaps[i]!;
      const studentId = studentIds[i]!;
      if (!snap.exists) {
        statuses.set(studentId, undefined);
        continue;
      }
      const data = snap.data() ?? {};
      const raw = (data as { publicParentStatus?: unknown }).publicParentStatus;
      statuses.set(studentId, typeof raw === "string" ? (raw as ParentPublicStatus) : undefined);
    }
    return { ok: true, statuses };
  } catch {
    return { ok: false };
  }
}

/**
 * Pure transition detector. Returns the student IDs for which we should
 * dispatch a parent-safe notification.
 *
 * Conditions (all must hold):
 *   1. The reporter is an adult role (admin, teacher, responder).
 *   2. The previous-state read succeeded (`previous.ok === true`). A failed
 *      read fails closed — no notifications.
 *   3. The new `publicParentStatus` for this update is `"safe"`.
 *   4. The previous `publicParentStatus` was NOT `"safe"` (including the
 *      "no previous doc" case, which counts as a first-safe transition).
 */
export function detectSafeTransitions(
  updates: readonly ProposedStudentUpdate[],
  previous: PreviousParentStatusResult,
  appliedBy: AuthContext,
): string[] {
  if (!previous.ok) return [];
  if (!isAdultRole(appliedBy.role)) return [];

  const transitions: string[] = [];
  for (const update of updates) {
    if (parentStatusForUpdate(update) !== "safe") continue;
    const prev = previous.statuses.get(update.studentId);
    if (prev === "safe") continue;
    transitions.push(update.studentId);
  }
  return transitions;
}

/**
 * Bounded-concurrency worker pool. Each task's errors are swallowed so a
 * single failure cannot abort the pool — callers rely on this for the
 * "notification failure does not break applyReportUpdates" guarantee.
 */
async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<unknown>,
): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  const poolSize = Math.min(limit, items.length);
  const workers = Array.from({ length: poolSize }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        await worker(items[i]!);
      } catch {
        // Best-effort; never propagate to the caller.
      }
    }
  });
  await Promise.all(workers);
}

function defaultNotifier(db: Firestore) {
  const store = createFirestoreNotificationStore(db);
  return async (input: { schoolId: string; incidentId: string; studentId: string }) => {
    await notifyParentsOfSafeStudent(input, { store });
  };
}

export async function applyReportUpdates(input: ApplyReportInput): Promise<{ applied: number }> {
  const db = input.db ?? requireAdminDb();
  const timestamp = input.now ?? new Date().toISOString();

  // Capture previous parent-visible status BEFORE any writes so we can detect
  // a true transition into "safe" after the batch commits. Race window between
  // this read and the commit is acceptable because the parent-safe notifier
  // has its own per-(incident, student, parent) dedupe doc.
  const previousStatuses = await readPreviousParentStatuses(
    db,
    input.schoolId,
    input.incidentId,
    input.updates.map((u) => u.studentId),
  );

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
  // ── End of emergency-status write path. Everything below is best-effort
  //    and MUST NOT throw out of this function. ──────────────────────────

  try {
    const transitions = detectSafeTransitions(input.updates, previousStatuses, input.appliedBy);
    if (transitions.length > 0) {
      const notify = input.notifyParentsOfSafe ?? defaultNotifier(db);
      await runWithConcurrency(transitions, NOTIFY_CONCURRENCY, (studentId) =>
        notify({ schoolId: input.schoolId, incidentId: input.incidentId, studentId }),
      );
    }
  } catch {
    // Defensive: any synchronous throw inside dispatch setup is swallowed.
  }

  return { applied: input.updates.length };
}
