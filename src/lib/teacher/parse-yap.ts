import { getRoomByNumber, LAHS_ROOMS, type LahsRoom, type RoomStudent } from "@/lib/lahs-rooms";
import { matchNamesToRoster, normalizeText, splitNameList } from "./match-roster";

export type YapParseResult = {
  /** Room from dropdown — default unless overridden by speech. */
  selectedRoomNumber: string;
  /** Set only when the teacher explicitly says a room in speech. */
  spokenRoomNumber: string | null;
  /** spokenRoomNumber ?? selectedRoomNumber */
  effectiveRoomNumber: string;
  room: LahsRoom | null;
  presentIds: string[];
  missingIds: string[];
  unmatchedMissing: string[];
  allAccounted: boolean;
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

export function parseTeacherYap(
  transcript: string,
  selectedRoomNumber: string,
): YapParseResult {
  const text = transcript.trim();
  const spokenRoomNumber = text ? extractSpokenRoomNumber(text) : null;
  const effectiveRoomNumber = spokenRoomNumber ?? selectedRoomNumber;
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
      spokenRoomNumber,
      effectiveRoomNumber,
      room: null,
      presentIds: [],
      missingIds: [],
      unmatchedMissing: [],
      allAccounted: false,
      confidence: "low",
      summary: spokenRoomNumber
        ? `Room ${spokenRoomNumber} is not in the catalog.`
        : "Select your room from the dropdown.",
    };
  }

  const rosterIds = roster.map((s) => s.id);
  const roomLabel = spokenRoomNumber
    ? `Room ${spokenRoomNumber} (from voice)`
    : `Room ${selectedRoomNumber} (dropdown)`;

  if (allAccountedPhrases(text) && !extractMissingFragment(text)) {
    return {
      selectedRoomNumber,
      spokenRoomNumber,
      effectiveRoomNumber,
      room,
      presentIds: rosterIds,
      missingIds: [],
      unmatchedMissing: [],
      allAccounted: true,
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
      spokenRoomNumber,
      effectiveRoomNumber,
      room,
      presentIds,
      missingIds,
      unmatchedMissing: unmatched,
      allAccounted: missingIds.length === 0 && unmatched.length === 0,
      confidence: matched.length > 0 || unmatched.length > 0 ? "high" : "medium",
      summary:
        missingIds.length === 0 && unmatched.length === 0
          ? `${roomLabel} · could not match names — use roster checkboxes`
          : `${roomLabel} · ${missingIds.length + unmatched.length} missing`,
    };
  }

  return {
    selectedRoomNumber,
    spokenRoomNumber,
    effectiveRoomNumber,
    room,
    presentIds: [],
    missingIds: [],
    unmatchedMissing: [],
    allAccounted: false,
    confidence: "low",
    summary: `${roomLabel} — say “everyone but …” or use checkboxes`,
  };
}

function emptyResult(
  selectedRoomNumber: string,
  spokenRoomNumber: string | null,
  effectiveRoomNumber: string,
  room: LahsRoom | null,
  summary: string,
): YapParseResult {
  return {
    selectedRoomNumber,
    spokenRoomNumber,
    effectiveRoomNumber,
    room,
    presentIds: [],
    missingIds: [],
    unmatchedMissing: [],
    allAccounted: false,
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
