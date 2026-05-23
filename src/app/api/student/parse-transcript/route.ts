import { NextResponse } from "next/server";
import { z } from "zod";
import { EXAMPLE_STUDENTS } from "@/lib/demo/example-students";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini/client";
import { ROOM_OPTIONS } from "@/lib/lahs-rooms/room-options";
import { isGeminiConfigured } from "@/lib/teacher/gemini-roll-call";

const ParsedStudentTranscriptSchema = z.object({
  studentId: z.string().nullable(),
  studentName: z.string().nullable(),
  status: z.enum(["safe", "unsafe", "unknown"]),
  offCampus: z.boolean().nullable(),
  roomNumber: z.string().nullable(),
  teacherName: z.string().nullable(),
  shooterNearby: z.boolean().nullable(),
  note: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

type ParsedStudentTranscript = z.infer<typeof ParsedStudentTranscriptSchema>;

function roomCatalog() {
  return ROOM_OPTIONS.map((room) => ({
    number: room.value,
    label: room.label,
    building: room.building,
    teacher: room.teacher,
  }));
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

function normalizeParsed(raw: ParsedStudentTranscript): ParsedStudentTranscript {
  const studentById = raw.studentId
    ? EXAMPLE_STUDENTS.find((student) => student.id.toLowerCase() === raw.studentId?.toLowerCase())
    : undefined;
  const studentByName = raw.studentName
    ? EXAMPLE_STUDENTS.find((student) => student.fullName.toLowerCase() === raw.studentName?.toLowerCase())
    : undefined;
  const student = studentById ?? studentByName;

  const rooms = roomCatalog();
  const room = raw.roomNumber
    ? rooms.find((candidate) => candidate.number.toLowerCase() === raw.roomNumber?.toLowerCase())
    : undefined;
  const teachers = new Set(rooms.map((candidate) => candidate.teacher.trim()).filter(Boolean));
  const teacher = raw.teacherName
    ? [...teachers].find((candidate) => candidate.toLowerCase() === raw.teacherName?.toLowerCase())
    : undefined;

  return {
    studentId: student?.id ?? null,
    studentName: student?.fullName ?? null,
    status: raw.status,
    offCampus: raw.offCampus,
    roomNumber: room?.number ?? null,
    teacherName: teacher ?? null,
    shooterNearby: raw.shooterNearby,
    note: raw.note?.trim() || null,
    confidence: raw.confidence,
  };
}

function extractSafetyNote(transcript: string): string | null {
  const notes: string[] = [];
  const injury = transcript.match(
    /\b(?:my\s+)?(?:ankle|leg|arm|wrist|head|shoulder|knee|foot|hand|back)\s+(?:is\s+)?(?:broken|hurt|injured|bleeding|sprained)\b/i,
  );
  if (injury?.[0]) notes.push(injury[0]);

  const trapped = transcript.match(/\b(?:trapped|stuck|locked in|can't get out|cannot get out)\b/i);
  if (trapped?.[0]) notes.push(trapped[0]);

  return notes.length > 0 ? notes.join("; ") : null;
}

function fallbackParse(transcript: string): ParsedStudentTranscript {
  const lower = transcript.toLowerCase();
  const student =
    EXAMPLE_STUDENTS.find((candidate) => lower.includes(candidate.id.toLowerCase())) ??
    EXAMPLE_STUDENTS.find((candidate) => lower.includes(candidate.fullName.toLowerCase()));
  const rooms = roomCatalog();
  const room =
    rooms.find((candidate) => lower.includes(`room ${candidate.number.toLowerCase()}`)) ??
    rooms.find((candidate) => lower.includes(candidate.label.toLowerCase()));
  const teachers = [...new Set(rooms.map((candidate) => candidate.teacher.trim()).filter(Boolean))];
  const teacher = teachers.find((candidate) => lower.includes(candidate.toLowerCase()));
  const unsafe = /\b(help|hurt|injured|trapped|unsafe|danger|emergency|shooter|bleeding)\b/i.test(
    transcript,
  );
  const safe = /\b(safe|ok|okay|fine|secure)\b/i.test(transcript);
  const offCampus = /\b(off campus|home|not on campus|away from school)\b/i.test(transcript);
  const shooterNearby =
    /\b(?:shooter|gunman|attacker|intruder)\b.*\b(?:near|nearby|next to|outside|close|by)\b/i.test(
      transcript,
    ) ||
    /\b(?:near|nearby|next to|outside|close|by)\b.*\b(?:shooter|gunman|attacker|intruder)\b/i.test(
      transcript,
    );
  const note = extractSafetyNote(transcript);

  return {
    studentId: student?.id ?? null,
    studentName: student?.fullName ?? null,
    status: unsafe ? "unsafe" : safe ? "safe" : "unknown",
    offCampus: offCampus || null,
    roomNumber: room?.number ?? null,
    teacherName: teacher ?? null,
    shooterNearby: shooterNearby || null,
    note,
    confidence: student || room || teacher || unsafe || safe || offCampus || shooterNearby || note ? 0.65 : 0.2,
  };
}

async function parseWithGemini(transcript: string): Promise<ParsedStudentTranscript> {
  const ai = getGeminiClient();
  const prompt = `Parse a student emergency check-in transcript into form fields.

Known students:
${JSON.stringify(EXAMPLE_STUDENTS)}

Known rooms:
${JSON.stringify(roomCatalog())}

Transcript:
"""
${transcript.trim()}
"""

Rules:
- Only return a studentId/studentName if the transcript clearly identifies one of the known students.
- status is "unsafe" if the student says they need help, are injured, trapped, in danger, or unsafe.
- status is "safe" if the student clearly says they are safe/ok and does not ask for help.
- offCampus is true only if the student clearly says they are away from campus/home/off campus.
- roomNumber must be one of the known room numbers or null.
- teacherName must be one of the known teachers or null.
- shooterNearby is true only if the student clearly says a shooter/gunman/attacker/intruder is near them, next to them, outside their room, or close by.
- note should be a concise staff-facing note for relevant details not captured elsewhere, especially injuries, trapped/blocked status, or specific help needs. Example: "ankle is broken". Do not include "shooter nearby" in note if shooterNearby is true.
- Return only JSON:
{
  "studentId": string | null,
  "studentName": string | null,
  "status": "safe" | "unsafe" | "unknown",
  "offCampus": boolean | null,
  "roomNumber": string | null,
  "teacherName": string | null,
  "shooterNearby": boolean | null,
  "note": string | null,
  "confidence": number
}`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const text = response.text ?? "";
  if (!text) throw new Error("Empty response from Gemini");
  return normalizeParsed(ParsedStudentTranscriptSchema.parse(JSON.parse(extractJson(text))));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transcript =
    typeof (body as { transcript?: unknown }).transcript === "string"
      ? (body as { transcript: string }).transcript.trim()
      : "";

  if (!transcript) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json({ source: "regex" as const, result: fallbackParse(transcript) });
  }

  try {
    return NextResponse.json({ source: "gemini" as const, result: await parseWithGemini(transcript) });
  } catch (error) {
    const warning = error instanceof Error ? error.message : "Gemini parse failed";
    return NextResponse.json({
      source: "regex" as const,
      result: fallbackParse(transcript),
      warning,
    });
  }
}
