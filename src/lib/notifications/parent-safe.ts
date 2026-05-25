import { buildParentSafeMessage } from "./parent-safe-template";
import { isLikelyE164, redactPhone } from "./redact";
import { sendSms as defaultSendSms } from "./twilio";
import {
  NOTIFICATION_TYPE_PARENT_CHILD_SAFE,
  type AuditState,
  type NotificationAuditDoc,
  type NotificationKey,
  type SmsSendResult,
} from "./types";
import type { NotificationStore } from "./audit-store";

export type NotifyParentSafeInput = {
  schoolId: string;
  incidentId: string;
  studentId: string;
  parentId: string;
};

export type NotifyParentSafeDeps = {
  store: NotificationStore;
  sendSms?: (params: { to: string; body: string }) => Promise<SmsSendResult>;
  now?: () => string;
  log?: (entry: NotificationLogEntry) => void;
};

export type NotificationLogEntry = {
  templateId?: string;
  notificationType: typeof NOTIFICATION_TYPE_PARENT_CHILD_SAFE;
  studentId: string;
  parentId: string;
  state: AuditState;
  redactedPhone?: string;
};

export type NotifyParentSafeResult = {
  state: AuditState;
};

const FALLBACK_SCHOOL_NAME = "their school";

function keyFor(input: NotifyParentSafeInput): NotificationKey {
  return {
    schoolId: input.schoolId,
    incidentId: input.incidentId,
    studentId: input.studentId,
    parentId: input.parentId,
    notificationType: NOTIFICATION_TYPE_PARENT_CHILD_SAFE,
  };
}

function defaultLogger(entry: NotificationLogEntry): void {
  // Structured log: template id, type, ids, state, redacted phone only.
  // Never log body, full phone, or auth.
  console.info("[notifications]", entry);
}

/**
 * Orchestrates a single parent-safe SMS attempt.
 *
 * Guarantees:
 *   - Idempotency: a transactional create-if-absent on the audit doc gates
 *     sending. A second call with the same key never re-sends — it resolves
 *     to `skipped_duplicate` without invoking the SMS provider.
 *   - No throws: validation failures (missing student/parent/relationship/
 *     phone) produce skip-state audits and a non-throwing return.
 *   - Dry-run safe: if SMS credentials are absent or the feature flag is off,
 *     the send helper returns `dry_run` and an audit is still recorded.
 */
export async function notifyParentSafe(
  input: NotifyParentSafeInput,
  deps: NotifyParentSafeDeps,
): Promise<NotifyParentSafeResult> {
  const sendSms = deps.sendSms ?? defaultSendSms;
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const log = deps.log ?? defaultLogger;
  const key = keyFor(input);

  const initial: NotificationAuditDoc = {
    ...key,
    state: "queued",
    createdAt: now,
    updatedAt: now,
  };

  let created = false;
  try {
    created = await deps.store.tryCreateAudit(initial);
  } catch {
    // If the dedupe write itself fails we must NOT send — fail closed.
    const state: AuditState = "failed";
    log({
      notificationType: key.notificationType,
      studentId: key.studentId,
      parentId: key.parentId,
      state,
    });
    return { state };
  }

  if (!created) {
    log({
      notificationType: key.notificationType,
      studentId: key.studentId,
      parentId: key.parentId,
      state: "skipped_duplicate",
    });
    return { state: "skipped_duplicate" };
  }

  const finalize = async (
    state: AuditState,
    patch: Partial<NotificationAuditDoc> = {},
  ): Promise<NotifyParentSafeResult> => {
    await deps.store.updateAudit(key, { ...patch, state, updatedAt: now });
    log({
      templateId: patch.templateId,
      notificationType: key.notificationType,
      studentId: key.studentId,
      parentId: key.parentId,
      state,
      redactedPhone: patch.redactedPhone,
    });
    return { state };
  };

  const student = await deps.store.loadStudent(input.schoolId, input.studentId);
  if (!student) return finalize("skipped_missing_student");

  const parent = await deps.store.loadParent(input.schoolId, input.parentId);
  if (!parent) return finalize("skipped_missing_parent");

  // Two-sided relationship check: both the student and the parent record must
  // agree on the link. One-sided links are treated as configuration drift and
  // skipped (not sent) per the safety contract.
  const studentLinksParent = student.parentGuardianIds.includes(input.parentId);
  const parentLinksStudent = parent.linkedStudentIds.includes(input.studentId);
  if (!studentLinksParent || !parentLinksStudent) {
    return finalize("skipped_relationship_mismatch");
  }

  if (!isLikelyE164(parent.phone)) {
    return finalize("skipped_invalid_phone");
  }

  const schoolName = (await deps.store.loadSchoolName(input.schoolId)) ?? FALLBACK_SCHOOL_NAME;

  const message = buildParentSafeMessage({
    studentFirstName: student.firstName,
    studentLastName: student.lastName,
    schoolName,
  });

  const redactedPhone = redactPhone(parent.phone);
  const result = await sendSms({ to: parent.phone, body: message.body });

  if (result.status === "sent") {
    return finalize("sent", {
      templateId: message.templateId,
      body: message.body,
      redactedPhone,
      providerMessageId: result.providerMessageId,
    });
  }

  if (result.status === "dry_run") {
    return finalize("dry_run", {
      templateId: message.templateId,
      body: message.body,
      redactedPhone,
      dryRunReason: result.reason,
    });
  }

  return finalize("failed", {
    templateId: message.templateId,
    body: message.body,
    redactedPhone,
    error: result.error,
  });
}

export type NotifyParentsOfSafeStudentInput = {
  schoolId: string;
  incidentId: string;
  studentId: string;
};

/**
 * Fan-out helper: notify every guardian listed on the student's roster doc.
 *
 * Each per-parent attempt goes through {@link notifyParentSafe}, which
 * re-validates the two-sided link, dedupes, and writes its own audit. A
 * thrown error from one parent's attempt does not abort the loop — the next
 * parent is still attempted. The function itself never throws.
 */
export async function notifyParentsOfSafeStudent(
  input: NotifyParentsOfSafeStudentInput,
  deps: NotifyParentSafeDeps,
): Promise<NotifyParentSafeResult[]> {
  const log = deps.log ?? defaultLogger;

  let student;
  try {
    student = await deps.store.loadStudent(input.schoolId, input.studentId);
  } catch {
    log({
      notificationType: NOTIFICATION_TYPE_PARENT_CHILD_SAFE,
      studentId: input.studentId,
      parentId: "",
      state: "skipped_missing_student",
    });
    return [];
  }

  if (!student) {
    log({
      notificationType: NOTIFICATION_TYPE_PARENT_CHILD_SAFE,
      studentId: input.studentId,
      parentId: "",
      state: "skipped_missing_student",
    });
    return [];
  }

  const results: NotifyParentSafeResult[] = [];
  for (const parentId of student.parentGuardianIds) {
    try {
      const r = await notifyParentSafe({ ...input, parentId }, deps);
      results.push(r);
    } catch {
      results.push({ state: "failed" });
    }
  }
  return results;
}
