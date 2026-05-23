"use client";

import { useState } from "react";
import { DEMO_APP_USERS, DEMO_INCIDENT_ID, DEMO_SCHOOL_ID } from "@/lib/demo/constants";
import { DEMO_AUTH_HEADER, DEMO_USER_STORAGE_KEY } from "@/lib/auth/demo-users";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import type { ParsedEmergencyReport } from "@/types/ai";
import type { ProposedStudentUpdate } from "@/types/incident";

type SubmitReportResponse = {
  reportId: string;
  parsed: ParsedEmergencyReport;
  proposedUpdates: ProposedStudentUpdate[];
  autoApplied: boolean;
  needsAdminReview: boolean;
  error?: string;
};

const EXAMPLES = [
  "I'm in room 44 with all students from Class 47 except Alyssa Wang and Lydia Chen. We're safe and the door is locked.",
  "I'm in the gym with Ethan Brooks, Maya Singh, and Jacob Lee. Ethan hurt his ankle but we are safe.",
  "We moved Class 47 from Room 44 to the field. Everyone is safe.",
];

function demoUserId(): string {
  if (typeof window === "undefined") return DEMO_APP_USERS.teacher;
  return window.localStorage.getItem(DEMO_USER_STORAGE_KEY) ?? DEMO_APP_USERS.teacher;
}

export function TeacherReportForm() {
  const speech = useSpeechRecognition();
  const [rawText, setRawText] = useState(EXAMPLES[0] ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const useTranscript = () => {
    if (speech.liveText.trim()) setRawText(speech.liveText.trim());
  };

  const submit = async () => {
    setError(null);
    setResult(null);
    const text = rawText.trim();
    if (!text) {
      setError("Enter a report before submitting.");
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
      const json = (await response.json()) as SubmitReportResponse;
      if (!response.ok) {
        throw new Error(json.error ?? "Report submission failed.");
      }
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mb-6 rounded-xl border border-[#232a35] bg-[#0c0f13] p-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#64748b]">
          AI report console
        </p>
        <h2 className="mt-1 text-base font-semibold text-[#f8fafc]">Submit emergency report</h2>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((example, index) => (
          <button
            key={example}
            type="button"
            onClick={() => setRawText(example)}
            className="rounded border border-[#2a3340] px-2.5 py-1.5 text-xs text-[#94a3b8] hover:bg-[#11161d] hover:text-[#e2e8f0]"
          >
            Example {index + 1}
          </button>
        ))}
      </div>

      <textarea
        value={rawText}
        onChange={(event) => setRawText(event.target.value)}
        className="mt-3 min-h-28 w-full resize-none rounded-lg border border-[#2a3340] bg-[#06080a] px-3 py-3 text-sm text-[#f8fafc] outline-none focus:border-sky-700"
        placeholder="Type what happened, who is with you, who is missing, and where you are."
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={speech.toggle}
          disabled={!speech.supported}
          className="rounded-lg border border-[#2a3340] px-3 py-2 text-sm text-[#e2e8f0] disabled:opacity-50"
        >
          {speech.listening ? "Stop voice" : "Start voice"}
        </button>
        <button
          type="button"
          onClick={useTranscript}
          disabled={!speech.liveText.trim()}
          className="rounded-lg border border-[#2a3340] px-3 py-2 text-sm text-[#94a3b8] disabled:opacity-50"
        >
          Use transcript
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="ml-auto rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit to AI"}
        </button>
      </div>

      {speech.liveText ? (
        <p className="mt-3 rounded border border-[#232a35] bg-[#06080a] px-3 py-2 text-xs text-[#94a3b8]">
          {speech.liveText}
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
      {result ? <ParsedReportPreview result={result} /> : null}
    </section>
  );
}

function ParsedReportPreview({ result }: { result: SubmitReportResponse }) {
  return (
    <div className="mt-4 rounded-lg border border-[#232a35] bg-[#06080a] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#e2e8f0]">Parsed report</p>
        <span className="rounded border border-[#2a3340] px-2 py-1 text-[10px] text-[#94a3b8]">
          {result.autoApplied ? "Auto-applied" : result.needsAdminReview ? "Needs review" : "Saved"}
        </span>
      </div>
      <p className="mt-2 text-xs text-[#94a3b8]">
        {result.parsed.notes || "No parser notes returned."}
      </p>
      <ul className="mt-3 space-y-2">
        {result.proposedUpdates.map((update) => (
          <li key={update.studentId} className="rounded border border-[#1a212b] px-2 py-2 text-xs">
            <span className="font-medium text-[#f1f5f9]">{update.studentName}</span>
            <span className="text-[#94a3b8]"> {"->"} {update.newStatus}</span>
            {update.newLocationLabel ? (
              <span className="text-[#64748b]"> at {update.newLocationLabel}</span>
            ) : null}
          </li>
        ))}
        {result.proposedUpdates.length === 0 ? (
          <li className="text-xs text-amber-300">No student updates proposed.</li>
        ) : null}
      </ul>
    </div>
  );
}
