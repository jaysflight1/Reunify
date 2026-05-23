"use client";

import { useEffect, useState } from "react";
import { DEMO_APP_USERS, DEMO_INCIDENT_ID, DEMO_SCHOOL_ID } from "@/lib/demo/constants";
import { DEMO_AUTH_HEADER, DEMO_USER_STORAGE_KEY } from "@/lib/auth/demo-users";
import type { ParentPublicStatus, StudentStatus } from "@/types/incident";

type StudentSelfStatusResponse = {
  studentId: string;
  studentName: string;
  status: StudentStatus;
  publicParentStatus: ParentPublicStatus;
  selfSafeMessage: string;
  lastUpdatedAt: string;
  canSubmitUpdate: boolean;
  error?: string;
};

function demoUserId(): string {
  if (typeof window === "undefined") return DEMO_APP_USERS.student;
  return window.localStorage.getItem(DEMO_USER_STORAGE_KEY) ?? DEMO_APP_USERS.student;
}

export function StudentCheckIn() {
  const [status, setStatus] = useState<StudentSelfStatusResponse | null>(null);
  const [updateText, setUpdateText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    const response = await fetch("/api/me/student-status", {
      cache: "no-store",
      headers: { [DEMO_AUTH_HEADER]: demoUserId() },
    });
    const json = (await response.json()) as StudentSelfStatusResponse;
    if (!response.ok) throw new Error(json.error ?? "Could not load your status.");
    setStatus(json);
  };

  useEffect(() => {
    void loadStatus().catch((err) =>
      setError(err instanceof Error ? err.message : "Could not load your status."),
    );
  }, []);

  const submit = async (kind: "safe" | "help" | "text") => {
    setError(null);
    const text =
      kind === "safe"
        ? "I am safe."
        : kind === "help"
          ? "I need help."
          : updateText.trim();
    if (!text) {
      setError("Enter an update first.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/reports/text", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [DEMO_AUTH_HEADER]: demoUserId(),
        },
        body: JSON.stringify({
          schoolId: DEMO_SCHOOL_ID,
          incidentId: DEMO_INCIDENT_ID,
          rawText: text,
          source: "text",
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not submit update.");
      setUpdateText("");
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit update.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <section className="rounded-xl border border-[#232a35] bg-[#0c0f13] p-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#64748b]">
          Your status
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#f8fafc]">
          {status?.studentName ?? "Student"}
        </h2>
        <p className="mt-3 text-sm text-[#94a3b8]">
          {status?.selfSafeMessage ?? "Loading your current status..."}
        </p>
        <p className="mt-3 rounded border border-[#2a3340] px-3 py-2 text-sm text-[#e2e8f0]">
          Current: {status?.status ?? "loading"}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => void submit("safe")}
          disabled={submitting}
          className="rounded-xl bg-emerald-500 px-4 py-4 text-base font-semibold text-emerald-950 disabled:opacity-50"
        >
          I&apos;m Safe
        </button>
        <button
          type="button"
          onClick={() => void submit("help")}
          disabled={submitting}
          className="rounded-xl bg-rose-500 px-4 py-4 text-base font-semibold text-white disabled:opacity-50"
        >
          I Need Help
        </button>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748b]">
          Optional update
        </span>
        <textarea
          value={updateText}
          onChange={(event) => setUpdateText(event.target.value)}
          className="min-h-24 w-full resize-none rounded-lg border border-[#2a3340] bg-[#0c0f13] px-3 py-3 text-base text-[#f8fafc] outline-none"
          placeholder="Example: Lydia Chen near gym with Alyssa Wang safe"
        />
      </label>

      <button
        type="button"
        onClick={() => void submit("text")}
        disabled={submitting}
        className="rounded-xl border border-[#2a3340] px-4 py-3 text-sm font-medium text-[#e2e8f0] disabled:opacity-50"
      >
        {submitting ? "Sending..." : "Send Update"}
      </button>

      <section className="rounded-lg border border-[#232a35] bg-[#0c0f13] px-3 py-3 text-sm text-[#94a3b8]">
        Follow instructions from school staff. This page only shows your own status.
      </section>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
    </div>
  );
}
