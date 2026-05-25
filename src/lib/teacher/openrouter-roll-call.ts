import { z } from "zod";
import {
  generateOpenRouterJson,
  isOpenRouterConfigured,
  openRouterModelName,
} from "@/lib/openrouter/client";
import { getRoomByNumber } from "@/lib/general-rooms";
import type { YapParseResult } from "@/lib/teacher/parse-yap";

const FALLBACK_MODELS = ["openai/gpt-4o-mini", "openai/gpt-4.1-mini"] as const;

const OpenRouterRollCallSchema = z.object({
  spokenRoomNumber: z.string().nullable().optional(),
  allAccounted: z.boolean(),
  missingStudentIds: z.array(z.string()),
  unmatchedNames: z.array(z.string()),
  notes: z.string().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]),
  summary: z.string(),
});

export type OpenRouterRollCallRaw = z.infer<typeof OpenRouterRollCallSchema>;

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

async function generateRollCallJson(prompt: string, model: string): Promise<OpenRouterRollCallRaw> {
  const text = await generateOpenRouterJson({ prompt, model, temperature: 0.1 });
  return OpenRouterRollCallSchema.parse(JSON.parse(extractJson(text)));
}

export async function parseRollCallWithOpenRouter(input: {
  transcript: string;
  selectedRoomNumber: string;
  roster: { id: string; name: string }[];
}): Promise<OpenRouterRollCallRaw> {
  if (!isOpenRouterConfigured()) {
    throw new Error("OPENROUTER_API_KEY not configured");
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
- notes: any relevant staff-facing detail the transcript mentions that is NOT a name, room number, or simple "everyone is here" statement. Include injuries, medical needs, blocked or unsafe exits, smoke/fire/alarms, broken doors or windows, threats or intruders, weapons mentioned, extra people or visitors, students in distress or panicking, relocations (e.g. "we moved to the gym"), evacuation problems, and anything else staff should know. Combine multiple details into one short note. Use null only if the transcript has no such details.
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
    openRouterModelName(),
    ...FALLBACK_MODELS.filter((m) => m !== openRouterModelName()),
  ];

  let lastError: unknown;
  for (const modelName of modelsToTry) {
    try {
      const parsed = await generateRollCallJson(prompt, modelName);
      return normalizeOpenRouterRaw(parsed, input.roster);
    } catch (e) {
      lastError = e;
      const message = e instanceof Error ? e.message : String(e);
      const retryable =
        message.includes("404") ||
        message.includes("not found") ||
        message.includes("no allowed providers") ||
        message.includes("No allowed providers");
      if (!retryable) throw e;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenRouter request failed");
}

function normalizeOpenRouterRaw(
  raw: OpenRouterRollCallRaw,
  roster: { id: string; name: string }[],
): OpenRouterRollCallRaw {
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

export function yapFromOpenRouter(
  raw: OpenRouterRollCallRaw,
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
    allAccounted: raw.allAccounted,
    notes: raw.notes ?? null,
    confidence: raw.confidence,
    summary: raw.summary,
  };
}
