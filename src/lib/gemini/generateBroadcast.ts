import type { BroadcastAudience } from "@/types/incident";
import { GEMINI_MODEL, getGeminiClient } from "./client";

export type BroadcastTone = "calm" | "urgent" | "brief";

export type GenerateBroadcastInput = {
  audience: BroadcastAudience;
  tone: BroadcastTone;
  incidentTitle: string;
  summary: {
    totalStudents: number;
    safe: number;
    unaccounted: number;
    needsHelp: number;
    pendingVerification: number;
    openConflicts: number;
  };
  notes?: string[];
};

const AUDIENCE_RULES: Record<BroadcastAudience, string> = {
  parents:
    "Write parent-safe language. Do not include exact room locations, tactical details, names of unrelated students, or unverified rumors.",
  teachers:
    "Write concise staff-facing accountability guidance. Do not include parent contact details or tactical responder instructions.",
  responders:
    "Write factual responder-facing status only. Include unresolved counts and last-known factual status if provided. Do not recommend tactics, entry routes, or police/medical actions.",
  students:
    "Write generic student-safe instructions only. Do not mention missing students, other students' locations, maps, or staff movement.",
};

export async function generateBroadcast(input: GenerateBroadcastInput): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `
Generate one emergency accountability broadcast.

Audience: ${input.audience}
Tone: ${input.tone}
Incident: ${input.incidentTitle}
Safety rules: ${AUDIENCE_RULES[input.audience]}

Factual summary:
${JSON.stringify(input.summary)}

Additional notes:
${JSON.stringify(input.notes ?? [])}

Return only the message text. No markdown. No tactical instructions.
`,
    config: {
      temperature: 0.2,
    },
  });

  return (response.text ?? "").trim();
}
