export const NOTIFICATION_TYPE_PARENT_CHILD_SAFE = "parent_child_safe" as const;
export type NotificationType = typeof NOTIFICATION_TYPE_PARENT_CHILD_SAFE;

export const PARENT_CHILD_SAFE_TEMPLATE_ID = "parent_child_safe_v1" as const;
export type TemplateId = typeof PARENT_CHILD_SAFE_TEMPLATE_ID;

/**
 * The ONLY fields the parent-safe SMS builder is allowed to see.
 * Deliberately excludes anything that could leak room, teacher, location,
 * incident type, notes, or last-known-location tactical detail.
 */
export type ParentSafeSmsPayload = {
  studentFirstName: string;
  studentLastName: string;
  schoolName: string;
};

export type BuiltSmsMessage = {
  templateId: TemplateId;
  body: string;
};

export type SmsSendResult =
  | { status: "sent"; providerMessageId: string }
  | { status: "dry_run"; reason: "missing_env" | "disabled" }
  | { status: "failed"; error: string };

export type AuditState =
  | "queued"
  | "sent"
  | "dry_run"
  | "failed"
  | "skipped_duplicate"
  | "skipped_invalid_phone"
  | "skipped_relationship_mismatch"
  | "skipped_missing_student"
  | "skipped_missing_parent";

export type NotificationKey = {
  schoolId: string;
  incidentId: string;
  studentId: string;
  parentId: string;
  notificationType: NotificationType;
};

/**
 * Persisted audit record for one (incident, student, parent, notification type)
 * attempt. The doc id is `${studentId}_${parentId}_${notificationType}` inside
 * `schools/{schoolId}/incidents/{incidentId}/parentNotifications/`, giving us
 * a deterministic dedupe key per the Step 2 contract.
 */
export type NotificationAuditDoc = NotificationKey & {
  state: AuditState;
  templateId?: TemplateId;
  body?: string;
  redactedPhone?: string;
  providerMessageId?: string;
  error?: string;
  dryRunReason?: "missing_env" | "disabled";
  createdAt: string;
  updatedAt: string;
};
