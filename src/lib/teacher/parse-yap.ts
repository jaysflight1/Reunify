import {
  GHS_ROOMS,
  getRoomByNumber,
  type GeneralRoom,
  type RoomStudent,
} from "@/lib/general-rooms";
import { matchNamesToRoster, normalizeText, splitNameList } from "./match-roster";

export type YapParseResult = {
  /** Room from dropdown — default unless overridden by speech. */
  selectedRoomNumber: string;
  /** Teacher inferred from speech, including fuzzy matches. */
  spokenTeacherName: string | null;
  /** Room for spokenTeacherName, when a teacher match exists. */
  teacherMatchedRoomNumber: string | null;
  /** Set only when the teacher explicitly says a room in speech. */
  spokenRoomNumber: string | null;
  /** spokenRoomNumber ?? selectedRoomNumber */
  effectiveRoomNumber: string;
  room: GeneralRoom | null;
  presentIds: string[];
  missingIds: string[];
  unmatchedMissing: string[];
  allAccounted: boolean;
  notes: string | null;
  confidence: "high" | "medium" | "low";
  summary: string;
};

const ROOM_IN_PATTERNS = [
  /\b(?:room|rm)\s*#?\s*(\d{3,4})\b/i,
  /\b(?:in|at)\s+(?:room\s*)?(\d{3,4})\b/i,
  /\bi\s*'?m\s+in\s+(?:room\s*)?(\d{3,4})\b/i,
  /\bi\s*am\s+in\s+(?:room\s*)?(\d{3,4})\b/i,
];

/** Only matches clear room phrases — never bare digits (avoids overriding the dropdown). */
export function extractSpokenRoomNumber(text: string): string | null {
  for (const pattern of ROOM_IN_PATTERNS) {
    const m = text.match(pattern);
    if (m?.[1] && getRoomByNumber(m[1])) return m[1];
  }
  return null;
}

function levenshtein(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] =
        a[i - 1] === b[j - 1]
          ? rows[i - 1][j - 1]
          : Math.min(rows[i - 1][j - 1], rows[i - 1][j], rows[i][j - 1]) + 1;
    }
  }
  return rows[a.length][b.length];
}

function teacherCandidateFragments(text: string): string[] {
  const fragments: string[] = [];
  const patterns = [
    /\bi\s*'?m\s+((?:mr|mrs|ms|miss|dr)\.?\s+[a-z]+)/gi,
    /\bi\s+am\s+((?:mr|mrs|ms|miss|dr)\.?\s+[a-z]+)/gi,
    /\bthis\s+is\s+((?:mr|mrs|ms|miss|dr)\.?\s+[a-z]+)/gi,
    /\bteacher\s+is\s+((?:mr|mrs|ms|miss|dr)\.?\s+[a-z]+)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) fragments.push(match[1]);
    }
  }
  return fragments;
}

export function extractSpokenTeacher(
  text: string,
): { teacherName: string; roomNumber: string } | null {
  const teachers = GHS_ROOMS.filter((room) => room.roster.length > 0).map((room) => ({
    teacherName: room.teacher,
    roomNumber: room.number,
    normalized: normalizeText(room.teacher),
  }));
  const normalizedText = normalizeText(text);
  const exact = teachers.find((teacher) => normalizedText.includes(teacher.normalized));
  if (exact) return { teacherName: exact.teacherName, roomNumber: exact.roomNumber };

  const candidates = teacherCandidateFragments(text).map(normalizeText);
  let best: { teacherName: string; roomNumber: string; score: number } | null = null;
  for (const candidate of candidates) {
    for (const teacher of teachers) {
      const score = levenshtein(candidate, teacher.normalized);
      const maxDistance = teacher.normalized.length <= 7 ? 2 : 3;
      if (score <= maxDistance && (!best || score < best.score)) {
        best = { teacherName: teacher.teacherName, roomNumber: teacher.roomNumber, score };
      }
    }
  }
  return best ? { teacherName: best.teacherName, roomNumber: best.roomNumber } : null;
}

function extractMissingFragment(text: string): string | null {
  const patterns = [
    /\beveryone\s+but\s+(.+?)(?:\.|$)/i,
    /\ball\s+(?:here|accounted|present)\s+(?:except|but)\s+(.+?)(?:\.|$)/i,
    /\bhave\s+everyone\s+but\s+(.+?)(?:\.|$)/i,
    /\bmissing\s+(.+?)(?:\.|$)/i,
    /\bdon'?t\s+have\s+(.+?)(?:\.|$)/i,
    /\bwithout\s+(.+?)(?:\.|$)/i,
    /\bexcept\s+(.+?)(?:\.|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function allAccountedPhrases(text: string): boolean {
  const n = normalizeText(text);
  return (
    /\b(everyone|everybody|all students|whole class|full class)\s+(is\s+)?(here|present|accounted|safe)\b/.test(
      n,
    ) ||
    /\b(i\s+)?have\s+(everyone|everybody|all of them)\b/.test(n) ||
    /\ball\s+accounted\b/.test(n) ||
    /\bno\s+one\s+missing\b/.test(n)
  );
}

function extractTeacherNotes(text: string): string | null {
  const sentences = text
    .split(/(?<=[.!?])\s+|\s*;\s*/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const noteSentences = sentences.filter((sentence) => {
    const normalized = normalizeText(sentence);
    if (
      /\b(i m|i am|this is)\s+(mr|mrs|ms|miss|dr)\b/.test(normalized) ||
      /\b(room|rm)\s*\d{3,4}\b/.test(normalized) ||
      /\b(everyone|everybody|all students|whole class|full class)\b/.test(normalized) ||
      /\b(missing|except|without|everyone but|don t have)\b/.test(normalized)
    ) {
      return false;
    }
    return /\b(injur|hurt|bleed|medical|nurse|trapped|stuck|locked|smoke|fire|weapon|shooter|threat|unsafe|blocked|damage|panic|crying|wheelchair|evacuat)\b/.test(
      normalized,
    );
  });
  return noteSentences.length > 0 ? noteSentences.join(" ") : null;
}

export function parseTeacherYap(
  transcript: string,
  selectedRoomNumber: string,
): YapParseResult {
  const text = transcript.trim();
  const spokenRoomNumber = text ? extractSpokenRoomNumber(text) : null;
  const spokenTeacher = text ? extractSpokenTeacher(text) : null;
  const notes = text ? extractTeacherNotes(text) : null;
  const teacherMatchedRoomNumber = spokenTeacher?.roomNumber ?? null;
  const effectiveRoomNumber = (spokenRoomNumber ?? selectedRoomNumber) || teacherMatchedRoomNumber || "";
  const room = getRoomByNumber(effectiveRoomNumber) ?? null;
  const roster = room?.roster ?? [];

  if (!text) {
    return emptyResult(
      selectedRoomNumber,
      spokenRoomNumber,
      effectiveRoomNumber,
      room,
      "Say who is missing, or “room 903” if not using the dropdown.",
    );
  }

  if (!room) {
    return {
      selectedRoomNumber,
      spokenTeacherName: spokenTeacher?.teacherName ?? null,
      teacherMatchedRoomNumber,
      spokenRoomNumber,
      effectiveRoomNumber,
      room: null,
      presentIds: [],
      missingIds: [],
      unmatchedMissing: [],
      allAccounted: false,
      notes,
      confidence: "low",
      summary: spokenRoomNumber
        ? `Room ${spokenRoomNumber} is not in the catalog.`
        : "Select your room from the dropdown.",
    };
  }

  const rosterIds = roster.map((s) => s.id);
  const roomLabel = spokenRoomNumber
    ? `Room ${spokenRoomNumber} (from voice)`
    : selectedRoomNumber
      ? `Room ${selectedRoomNumber} (dropdown)`
      : `Room ${effectiveRoomNumber} (from voice)`;

  if (allAccountedPhrases(text) && !extractMissingFragment(text)) {
    return {
      selectedRoomNumber,
      spokenTeacherName: spokenTeacher?.teacherName ?? null,
      teacherMatchedRoomNumber,
      spokenRoomNumber,
      effectiveRoomNumber,
      room,
      presentIds: rosterIds,
      missingIds: [],
      unmatchedMissing: [],
      allAccounted: true,
      notes,
      confidence: "high",
      summary: `${roomLabel} · everyone accounted`,
    };
  }

  const missingFragment = extractMissingFragment(text);
  if (missingFragment) {
    const names = splitNameList(missingFragment);
    const { matched, unmatched } = matchNamesToRoster(names, roster);
    const missingIds = matched.map((s) => s.id);
    const presentIds = rosterIds.filter((id) => !missingIds.includes(id));
    return {
      selectedRoomNumber,
      spokenTeacherName: spokenTeacher?.teacherName ?? null,
      teacherMatchedRoomNumber,
      spokenRoomNumber,
      effectiveRoomNumber,
      room,
      presentIds,
      missingIds,
      unmatchedMissing: unmatched,
      allAccounted: missingIds.length === 0 && unmatched.length === 0,
      notes,
      confidence: matched.length > 0 || unmatched.length > 0 ? "high" : "medium",
      summary:
        missingIds.length === 0 && unmatched.length === 0
          ? `${roomLabel} · could not match names — use roster checkboxes`
          : `${roomLabel} · ${missingIds.length + unmatched.length} missing`,
    };
  }

  return {
    selectedRoomNumber,
    spokenTeacherName: spokenTeacher?.teacherName ?? null,
    teacherMatchedRoomNumber,
    spokenRoomNumber,
    effectiveRoomNumber,
    room,
    presentIds: [],
    missingIds: [],
    unmatchedMissing: [],
    allAccounted: false,
    notes,
    confidence: "low",
    summary: `${roomLabel} — say “everyone but …” or use checkboxes`,
  };
}

function emptyResult(
  selectedRoomNumber: string,
  spokenRoomNumber: string | null,
  effectiveRoomNumber: string,
  room: GeneralRoom | null,
  summary: string,
): YapParseResult {
  return {
    selectedRoomNumber,
    spokenTeacherName: null,
    teacherMatchedRoomNumber: null,
    spokenRoomNumber,
    effectiveRoomNumber,
    room,
    presentIds: [],
    missingIds: [],
    unmatchedMissing: [],
    allAccounted: false,
    notes: null,
    confidence: "low",
    summary,
  };
}

export function rosterFromSelection(
  roster: RoomStudent[],
  presentIds: ReadonlySet<string>,
): { presentIds: string[]; missingIds: string[]; allAccounted: boolean } {
  const missingIds = roster.filter((s) => !presentIds.has(s.id)).map((s) => s.id);
  return {
    presentIds: [...presentIds],
    missingIds,
    allAccounted: missingIds.length === 0,
  };
}
