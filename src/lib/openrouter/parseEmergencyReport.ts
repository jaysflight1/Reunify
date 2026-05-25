import { z } from "zod";
import type { AuthContext } from "@/types/user";
import type { ClassGroup, Location, Student } from "@/types/incident";
import type { ParsedEmergencyReportResult } from "@/types/ai";
import { generateOpenRouterJson } from "@/lib/openrouter/client";

const SYSTEM_PROMPT = `
You are an emergency school accountability report parser.
Your task is to convert a teacher/student/parent/admin report into structured JSON.
You are not making tactical recommendations.
You are not giving medical, police, or evacuation instructions.
You only extract facts, uncertainty, possible student status changes, and ambiguities.

Critical safety constraints:
- Do not infer more than the message supports.
- If a name is ambiguous, mark it ambiguous.
- If exact location is sensitive, still extract it for admin processing, but do not create parent-facing text.
- If a student reports another student's location, mark adultVerified=false.
- If a report may expose sensitive info to students or parents, flag it as adminOnly.
- Never provide tactical guidance.

Return only valid JSON. No markdown. No explanation.
`;

const NullableBooleanSchema = z.boolean().nullable();

const RawParsedEmergencyReportSchema = z.object({
  reporter: z.object({
    name: z.string().nullable(),
    role: z.string().nullable(),
    confidence: z.number().min(0).max(1),
  }),
  location: z.object({
    rawText: z.string().nullable(),
    matchedLocationLabel: z.string().nullable(),
    confidence: z.number().min(0).max(1),
  }),
  classReferences: z.array(
    z.object({
      rawText: z.string(),
      matchedClassName: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  studentsMentioned: z.array(
    z.object({
      rawText: z.string(),
      matchedStudentName: z.string().nullable(),
      context: z.enum([
        "present",
        "missing",
        "injured",
        "needs_help",
        "safe",
        "last_seen",
        "unknown",
      ]),
      confidence: z.number().min(0).max(1),
    }),
  ),
  groupStatus: z.enum(["safe", "unsafe", "needs_help", "mixed", "unknown"]),
  missingStudentNames: z.array(z.string()),
  injuredStudents: z.array(
    z.object({
      nameRaw: z.string(),
      injuryDescription: z.string().nullable(),
    }),
  ),
  notes: z.string(),
  safetyDetails: z.object({
    doorLocked: NullableBooleanSchema,
    withAdult: NullableBooleanSchema,
    needsMedical: NullableBooleanSchema,
    needsEvacuation: NullableBooleanSchema,
  }),
  ambiguities: z.array(z.string()),
  contradictions: z.array(z.string()),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  confidenceScore: z.number().min(0).max(1),
  needsAdminReview: z.boolean(),
});

export type RawParsedEmergencyReport = z.infer<typeof RawParsedEmergencyReportSchema>;

export type EmergencyReportParseContext = {
  rawText: string;
  reporter: AuthContext;
  students: Student[];
  classes: ClassGroup[];
  locations: Location[];
};

function compactStudents(students: Student[]) {
  return students.map((student) => ({
    id: student.id,
    name: student.fullName,
    grade: student.grade,
    classIds: student.classIds,
  }));
}

function compactClasses(classes: ClassGroup[]) {
  return classes.map((classGroup) => ({
    id: classGroup.id,
    name: classGroup.name,
    teacherName: classGroup.teacherName,
    studentIds: classGroup.studentIds,
    roomLabel: classGroup.roomLabel,
  }));
}

function compactLocations(locations: Location[]) {
  return locations.map((location) => ({
    id: location.id,
    label: location.label,
    zone: location.zone,
    type: location.type,
    parentSafeLabel: location.parentSafeLabel,
  }));
}

function buildPrompt(context: EmergencyReportParseContext): string {
  return `
Known classes:
${JSON.stringify(compactClasses(context.classes))}

Known students:
${JSON.stringify(compactStudents(context.students))}

Known locations:
${JSON.stringify(compactLocations(context.locations))}

Reporter context:
${JSON.stringify({
  uid: context.reporter.uid,
  role: context.reporter.role,
  displayName: context.reporter.user.displayName,
  linkedStudentId: context.reporter.user.linkedStudentId,
  assignedClassIds: context.reporter.user.assignedClassIds,
})}

Raw report:
${context.rawText}

Return JSON matching this shape:
{
  "reporter": { "name": string | null, "role": string | null, "confidence": number },
  "location": { "rawText": string | null, "matchedLocationLabel": string | null, "confidence": number },
  "classReferences": [{ "rawText": string, "matchedClassName": string | null, "confidence": number }],
  "studentsMentioned": [{ "rawText": string, "matchedStudentName": string | null, "context": "present" | "missing" | "injured" | "needs_help" | "safe" | "last_seen" | "unknown", "confidence": number }],
  "groupStatus": "safe" | "unsafe" | "needs_help" | "mixed" | "unknown",
  "missingStudentNames": string[],
  "injuredStudents": [{ "nameRaw": string, "injuryDescription": string | null }],
  "notes": string,
  "safetyDetails": { "doorLocked": boolean | null, "withAdult": boolean | null, "needsMedical": boolean | null, "needsEvacuation": boolean | null },
  "ambiguities": string[],
  "contradictions": string[],
  "urgency": "low" | "medium" | "high" | "critical",
  "confidenceScore": number,
  "needsAdminReview": boolean
}
`;
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

function nullableBoolean(value: boolean | null): boolean | undefined {
  return value ?? undefined;
}

function toParsedResult(raw: RawParsedEmergencyReport): ParsedEmergencyReportResult {
  return {
    parsed: {
      reporter: {
        name: raw.reporter.name ?? undefined,
        role:
          raw.reporter.role === "admin" ||
          raw.reporter.role === "teacher" ||
          raw.reporter.role === "student" ||
          raw.reporter.role === "parent" ||
          raw.reporter.role === "responder"
            ? raw.reporter.role
            : undefined,
        confidence: raw.reporter.confidence,
      },
      location: {
        rawText: raw.location.rawText ?? "",
        matchedLocationLabel: raw.location.matchedLocationLabel ?? undefined,
        confidence: raw.location.confidence,
      },
      classReferences: raw.classReferences.map((item) => ({
        rawText: item.rawText,
        matchedClassName: item.matchedClassName ?? undefined,
        confidence: item.confidence,
      })),
      studentsMentioned: raw.studentsMentioned.map((student) => ({
        rawText: student.rawText,
        matchedStudentName: student.matchedStudentName ?? undefined,
        confidence: student.confidence,
        context: student.context,
      })),
      groupStatus: raw.groupStatus,
      missingStudents: raw.missingStudentNames,
      injuredStudents: raw.injuredStudents.map((student) => ({
        nameRaw: student.nameRaw,
        injuryDescription: student.injuryDescription ?? undefined,
      })),
      notes: raw.notes,
      safetyDetails: {
        doorLocked: nullableBoolean(raw.safetyDetails.doorLocked),
        withAdult: nullableBoolean(raw.safetyDetails.withAdult),
        needsMedical: nullableBoolean(raw.safetyDetails.needsMedical),
        needsEvacuation: nullableBoolean(raw.safetyDetails.needsEvacuation),
      },
      ambiguities: raw.ambiguities,
      contradictions: raw.contradictions,
    },
    urgency: raw.urgency,
    confidenceScore: raw.confidenceScore,
    needsAdminReview: raw.needsAdminReview,
  };
}

function fallbackParsedReport(rawText: string, reason: string): ParsedEmergencyReportResult {
  return {
    parsed: {
      classReferences: [],
      studentsMentioned: [],
      missingStudents: [],
      injuredStudents: [],
      notes: rawText,
      safetyDetails: {},
      ambiguities: [reason],
      contradictions: [],
      groupStatus: "unknown",
    },
    urgency: "medium",
    confidenceScore: 0,
    needsAdminReview: true,
  };
}

async function generateJson(contents: string): Promise<string> {
  return generateOpenRouterJson({
    prompt: contents,
    system: SYSTEM_PROMPT,
    temperature: 0.1,
  });
}

function parseRawJson(text: string): RawParsedEmergencyReport {
  const json = JSON.parse(extractJson(text)) as unknown;
  return RawParsedEmergencyReportSchema.parse(json);
}

export async function parseEmergencyReport(
  context: EmergencyReportParseContext,
): Promise<ParsedEmergencyReportResult> {
  const prompt = buildPrompt(context);
  const firstResponse = await generateJson(prompt);

  try {
    return toParsedResult(parseRawJson(firstResponse));
  } catch (firstError) {
    const repairPrompt = `
The previous response was not valid JSON for the required schema.
Return only corrected JSON for the same report and schema.

Original report:
${context.rawText}

Invalid response:
${firstResponse}
`;

    try {
      const repairedResponse = await generateJson(repairPrompt);
      return toParsedResult(parseRawJson(repairedResponse));
    } catch {
      const reason = firstError instanceof Error ? firstError.message : "OpenRouter returned invalid JSON.";
      return fallbackParsedReport(context.rawText, reason);
    }
  }
}
