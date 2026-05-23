import { NextResponse } from "next/server";
import { getRoomByNumber } from "@/lib/lahs-rooms";
import {
  isGeminiConfigured,
  parseRollCallWithGemini,
  yapFromGemini,
} from "@/lib/teacher/gemini-roll-call";
import { parseTeacherYap } from "@/lib/teacher/parse-yap";

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
  const selectedRoomNumber =
    typeof (body as { selectedRoomNumber?: unknown }).selectedRoomNumber === "string"
      ? (body as { selectedRoomNumber: string }).selectedRoomNumber.trim()
      : "";

  if (!transcript) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }
  const preliminary = parseTeacherYap(transcript, selectedRoomNumber);
  const parserRoomNumber = preliminary.effectiveRoomNumber || selectedRoomNumber;
  const room = parserRoomNumber ? getRoomByNumber(parserRoomNumber) : null;
  const roster = room?.roster.map((s) => ({ id: s.id, name: s.name })) ?? [];

  if (!isGeminiConfigured() || !parserRoomNumber) {
    return NextResponse.json({
      source: "regex" as const,
      result: preliminary,
    });
  }

  try {
    let raw = await parseRollCallWithGemini({
      transcript,
      selectedRoomNumber: parserRoomNumber,
      roster,
    });

    const effectiveRoom = raw.spokenRoomNumber ?? parserRoomNumber;
    if (effectiveRoom !== parserRoomNumber) {
      const spokenMeta = getRoomByNumber(effectiveRoom);
      if (spokenMeta && spokenMeta.roster.length > 0) {
        raw = await parseRollCallWithGemini({
          transcript,
          selectedRoomNumber: effectiveRoom,
          roster: spokenMeta.roster.map((s) => ({ id: s.id, name: s.name })),
        });
      }
    }

    return NextResponse.json({
      source: "gemini" as const,
      result: {
        ...yapFromGemini(raw, parserRoomNumber),
        selectedRoomNumber,
        spokenTeacherName: preliminary.spokenTeacherName,
        teacherMatchedRoomNumber: preliminary.teacherMatchedRoomNumber,
        notes: raw.notes?.trim() || preliminary.notes,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gemini parse failed";
    return NextResponse.json({
      source: "regex" as const,
      result: preliminary,
      warning: message,
    });
  }
}
