import type { RoomStudent } from "@/lib/lahs-rooms";

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Match spoken/written names to roster students (first, last, or full). */
export function matchNamesToRoster(
  names: string[],
  roster: RoomStudent[],
): { matched: RoomStudent[]; unmatched: string[] } {
  const matched: RoomStudent[] = [];
  const unmatched: string[] = [];
  const used = new Set<string>();

  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const n = normalizeText(name);
    const hit = roster.find((s) => {
      if (used.has(s.id)) return false;
      const full = normalizeText(s.name);
      const parts = full.split(" ");
      const first = parts[0] ?? "";
      const last = parts[parts.length - 1] ?? "";
      return (
        full === n ||
        n.includes(full) ||
        full.includes(n) ||
        (first.length > 2 && n.includes(first)) ||
        (last.length > 2 && n.includes(last)) ||
        (first.length > 2 && last.length > 2 && n.includes(`${first} ${last}`))
      );
    });
    if (hit) {
      matched.push(hit);
      used.add(hit.id);
    } else {
      unmatched.push(name);
    }
  }

  return { matched, unmatched };
}

export function splitNameList(fragment: string): string[] {
  return fragment
    .split(/\s*,\s*|\s+and\s+|\s*&\s*/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}
