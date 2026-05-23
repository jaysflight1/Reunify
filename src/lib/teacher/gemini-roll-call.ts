import { z } from "zod";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini/client";
import { getRoomByNumber } from "@/lib/lahs-rooms";
import type { YapParseResult } from "@/lib/teacher/parse-yap";

const FALLBACK_MODELS = ["gemini-2.5-flash-lite", "gemini-2.0-flash-001"] as const;

const GeminiRollCallSchema = z.object({
  spokenRoomNumber: z.string().nullable().optional(),
  allAccounted: z.boolean(),
  missingStudentIds: z.array(z.string()),
  unmatchedNames: z.array(z.string()),
  notes: z.string().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]),
  summary: z.string(),
});

export type GeminiRollCallRaw = z.infer<typeof GeminiRollCallSchema>;

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function geminiModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || GEMINI_MODEL;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  return trimmed;
}

async function generateRollCallJson(prompt: string, model: string): Promise<GeminiRollCallRaw> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const text = response.text ?? "";
  if (!text) throw new Error("Empty response from Gemini");

  return GeminiRollCallSchema.parse(JSON.parse(extractJson(text)));
}

export async function parseRollCallWithGemini(input: {
  transcript: string;
  selectedRoomNumber: string;
  roster: { id: string; name: string }[];
}): Promise<GeminiRollCallRaw> {
  if (!isGeminiConfigured()) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const rosterJson = JSON.stringify(input.roster);
  const prompt = `You parse teacher roll-call speech for a school evacuation drill.

Dropdown room (default unless teacher clearly states another valid room): ${input.selectedRoomNumber}

Roster for the effective room (id + full name):
${rosterJson}

Transcript:
"""
${input.transcript.trim()}
"""

Rules:
- spokenRoomNumber: ONLY set if the teacher clearly says they are in a different room (e.g. "room 903", "I'm in 903"). Otherwise null. Never guess from bare numbers without "room".
- missingStudentIds: use ONLY ids from the roster list for students who are missing / not accounted for.
- If everyone is present/accounted, set allAccounted true and missingStudentIds [].
- unmatchedNames: names mentioned as missing that do not match any roster id.
- notes: important staff-facing details that do not fit another field, such as injuries, blocked exits, medical needs, smoke, threats, extra people, or evacuation problems. Use null if no extra notes.
- confidence: high if intent is clear, low if garbled or ambiguous.
- summary: one short line for staff UI (include room if spoken).

Return JSON matching:
{
  "spokenRoomNumber": string | null,
  "allAccounted": boolean,
  "missingStudentIds": string[],
  "unmatchedNames": string[],
  "notes": string | null,
  "confidence": "high" | "medium" | "low",
  "summary": string
}`;

  const modelsToTry = [
    geminiModelName(),
    ...FALLBACK_MODELS.filter((m) => m !== geminiModelName()),
  ];

  let lastError: unknown;
  for (const modelName of modelsToTry) {
    try {
      const parsed = await generateRollCallJson(prompt, modelName);
      return normalizeGeminiRaw(parsed, input.roster);
    } catch (e) {
      lastError = e;
      const message = e instanceof Error ? e.message : String(e);
      const retryable =
        message.includes("404") ||
        message.includes("not found") ||
        message.includes("no longer available");
      if (!retryable) throw e;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini request failed");
}

function normalizeGeminiRaw(
  raw: GeminiRollCallRaw,
  roster: { id: string; name: string }[],
): GeminiRollCallRaw {
  const rosterIds = new Set(roster.map((s) => s.id));
  let spoken: string | null = raw.spokenRoomNumber?.trim() || null;
  if (spoken && !getRoomByNumber(spoken)) spoken = null;

  const missingStudentIds = (raw.missingStudentIds ?? []).filter((id) => rosterIds.has(id));
  const confidence =
    raw.confidence === "high" || raw.confidence === "medium" || raw.confidence === "low"
      ? raw.confidence
      : "medium";

  return {
    spokenRoomNumber: spoken,
    allAccounted: Boolean(raw.allAccounted),
    missingStudentIds,
    unmatchedNames: (raw.unmatchedNames ?? []).map((n) => String(n).trim()).filter(Boolean),
    notes: raw.notes?.trim() || null,
    confidence,
    summary: String(raw.summary ?? "").trim() || "Parsed roll call",
  };
}

export function yapFromGemini(
  raw: GeminiRollCallRaw,
  selectedRoomNumber: string,
): YapParseResult {
  const spokenRoomNumber = raw.spokenRoomNumber ?? null;
  const effectiveRoomNumber = spokenRoomNumber ?? selectedRoomNumber;
  const room = getRoomByNumber(effectiveRoomNumber) ?? null;
  const roster = room?.roster ?? [];
  const rosterIds = roster.map((s) => s.id);

  if (!room) {
    return {
      selectedRoomNumber,
      spokenTeacherName: null,
      teacherMatchedRoomNumber: null,
      spokenRoomNumber,
      effectiveRoomNumber,
      room: null,
      presentIds: [],
      missingIds: [],
      unmatchedMissing: raw.unmatchedNames,
      allAccounted: false,
      notes: raw.notes ?? null,
      confidence: "low",
      summary: spokenRoomNumber
        ? `Room ${spokenRoomNumber} is not in the catalog.`
        : "Select your room from the dropdown.",
    };
  }

  const missingIds = raw.missingStudentIds.filter((id) => rosterIds.includes(id));
  const presentIds = raw.allAccounted
    ? rosterIds
    : rosterIds.filter((id) => !missingIds.includes(id));

  const roomLabel = spokenRoomNumber
    ? `Room ${spokenRoomNumber} (from voice)`
    : `Room ${selectedRoomNumber} (dropdown)`;

  return {
    selectedRoomNumber,
    spokenTeacherName: null,
    teacherMatchedRoomNumber: null,
    spokenRoomNumber,
    effectiveRoomNumber,
    room,
    presentIds,
    missingIds,
    unmatchedMissing: raw.unmatchedNames,
    allAccounted: raw.allAccounted && missingIds.length === 0 && raw.unmatchedNames.length === 0,
    notes: raw.notes ?? null,
    confidence: raw.confidence,
    summary: raw.summary || `${roomLabel} · ${missingIds.length} missing`,
  };
}
