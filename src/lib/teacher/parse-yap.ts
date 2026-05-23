import { getRoomByNumber, LAHS_ROOMS, type LahsRoom, type RoomStudent } from "@/lib/lahs-rooms";
import { matchNamesToRoster, normalizeText, splitNameList } from "./match-roster";

export type YapParseResult = {
  roomNumber: string | null;
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
  /\bi\s*'?m\s+in\s+(\d{3,4})\b/i,
];

function extractRoomNumber(text: string): string | null {
  for (const pattern of ROOM_IN_PATTERNS) {
    const m = text.match(pattern);
    if (m?.[1] && getRoomByNumber(m[1])) return m[1];
  }

  const known = new Set(LAHS_ROOMS.map((r) => r.number));
  const tokens = text.match(/\b\d{3,4}\b/g) ?? [];
  for (const token of tokens) {
    if (known.has(token)) return token;
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
  roster: RoomStudent[],
  fallbackRoom?: string,
): YapParseResult {
  const text = transcript.trim();
  const roomNumber = extractRoomNumber(text) ?? fallbackRoom ?? null;
  const room = roomNumber ? getRoomByNumber(roomNumber) ?? null : null;

  if (!text) {
    return emptyResult(roomNumber, room, "Say your room and who is missing.");
  }

  if (!roomNumber || !room) {
    return {
      roomNumber,
      room,
      presentIds: [],
      missingIds: [],
      unmatchedMissing: [],
      allAccounted: false,
      confidence: "low",
      summary: "Could not find a room number — try “room 903”.",
    };
  }

  const rosterIds = roster.map((s) => s.id);

  if (allAccountedPhrases(text) && !extractMissingFragment(text)) {
    return {
      roomNumber,
      room,
      presentIds: rosterIds,
      missingIds: [],
      unmatchedMissing: [],
      allAccounted: true,
      confidence: "high",
      summary: `Room ${roomNumber} · everyone accounted`,
    };
  }

  const missingFragment = extractMissingFragment(text);
  if (missingFragment) {
    const names = splitNameList(missingFragment);
    const { matched, unmatched } = matchNamesToRoster(names, roster);
    const missingIds = matched.map((s) => s.id);
    const presentIds = rosterIds.filter((id) => !missingIds.includes(id));
    return {
      roomNumber,
      room,
      presentIds,
      missingIds,
      unmatchedMissing: unmatched,
      allAccounted: missingIds.length === 0 && unmatched.length === 0,
      confidence: matched.length > 0 || unmatched.length > 0 ? "high" : "medium",
      summary:
        missingIds.length === 0 && unmatched.length === 0
          ? `Room ${roomNumber} · could not match names — use roster checkboxes`
          : `Room ${roomNumber} · ${missingIds.length + unmatched.length} missing`,
    };
  }

  return {
    roomNumber,
    room,
    presentIds: [],
    missingIds: [],
    unmatchedMissing: [],
    allAccounted: false,
    confidence: "low",
    summary: `Room ${roomNumber} — say “everyone but …” or use checkboxes`,
  };
}

function emptyResult(
  roomNumber: string | null,
  room: LahsRoom | null,
  summary: string,
): YapParseResult {
  return {
    roomNumber,
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
