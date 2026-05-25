import {
  PARENT_CHILD_SAFE_TEMPLATE_ID,
  type BuiltSmsMessage,
  type ParentSafeSmsPayload,
} from "./types";

const DEFAULT_SCHOOL_NAME = "their school";

function cleanName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function pickSchoolName(value: string): string {
  const cleaned = cleanName(value);
  return cleaned.length > 0 ? cleaned : DEFAULT_SCHOOL_NAME;
}

/**
 * Pure, side-effect-free renderer for the parent-safe SMS.
 *
 * Accepts ONLY {@link ParentSafeSmsPayload}. The type system prevents callers
 * from passing internal incident state, room/location, notes, or incident
 * type, so those fields cannot appear in the body by construction.
 */
export function buildParentSafeMessage(payload: ParentSafeSmsPayload): BuiltSmsMessage {
  const first = cleanName(payload.studentFirstName);
  const last = cleanName(payload.studentLastName);
  const fullName = [first, last].filter((part) => part.length > 0).join(" ");
  const subject = fullName.length > 0 ? `Your student ${fullName}` : "Your student";
  const schoolName = pickSchoolName(payload.schoolName);

  const body =
    `Reunify Demo: ${subject} has been marked safe with school staff at ${schoolName}. ` +
    `Please wait for further school instructions. Reply STOP to opt out of SMS notifications.`;

  return { templateId: PARENT_CHILD_SAFE_TEMPLATE_ID, body };
}
