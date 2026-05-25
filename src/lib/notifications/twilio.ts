import type { SmsSendResult } from "./types";

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

type TwilioCreds = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

function readCredsFromEnv(): TwilioCreds | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim();
  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}

function smsEnabled(): boolean {
  return process.env.SMS_NOTIFICATIONS_ENABLED === "true";
}

/**
 * Send an SMS via Twilio's REST API using fetch (no SDK dependency).
 *
 * Never logs `to`, `body`, credentials, or Twilio response payloads. Callers
 * are responsible for redacted logging at the audit layer. Failures return
 * a discriminated result rather than throwing, so the upstream status-update
 * flow is never derailed by an SMS error.
 */
export async function sendSms(params: { to: string; body: string }): Promise<SmsSendResult> {
  if (!smsEnabled()) {
    return { status: "dry_run", reason: "disabled" };
  }

  const creds = readCredsFromEnv();
  if (!creds) {
    return { status: "dry_run", reason: "missing_env" };
  }

  const url = `${TWILIO_API_BASE}/Accounts/${encodeURIComponent(creds.accountSid)}/Messages.json`;
  const form = new URLSearchParams();
  form.set("To", params.to);
  form.set("From", creds.fromNumber);
  form.set("Body", params.body);

  const basic = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!res.ok) {
      // Read status code only; do not propagate Twilio's error body, which can
      // echo `To`/`Body` and would risk PII leakage if it lands in a log.
      return { status: "failed", error: `twilio_http_${res.status}` };
    }

    const json = (await res.json().catch(() => null)) as { sid?: unknown } | null;
    const sid = typeof json?.sid === "string" ? json.sid : "";
    return { status: "sent", providerMessageId: sid };
  } catch {
    return { status: "failed", error: "twilio_network_error" };
  }
}

export const __testing = { readCredsFromEnv, smsEnabled };
