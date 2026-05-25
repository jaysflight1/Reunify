/** Render a phone for logs without exposing the full number. */
export function redactPhone(phone: string | null | undefined): string {
  if (!phone) return "•••";
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 4) return "•••";
  const last4 = digits.slice(-4);
  const prefix = phone.startsWith("+") ? "+" : "";
  return `${prefix}•••••${last4}`;
}

/** Permissive E.164 check: leading +, country code 1-9, 7-15 total digits. */
export function isLikelyE164(phone: string | null | undefined): phone is string {
  if (!phone) return false;
  return /^\+[1-9]\d{6,14}$/.test(phone);
}
