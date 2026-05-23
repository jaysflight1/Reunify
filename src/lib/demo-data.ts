import type { MapPoint } from "./campus-map-config";

export type { MapPoint };
export { CAMPUS_MAP, RALLY_POINT } from "./campus-map-config";

export type Status = "safe" | "unsafe";

export type EgressPath = {
  id: string;
  label: string;
  points: MapPoint[];
};

export const EGRESS_PATHS: EgressPath[] = [
  {
    id: "south",
    label: "South parking",
    points: [
      { x: 52, y: 50 },
      { x: 52, y: 68 },
      { x: 52, y: 84 },
    ],
  },
  {
    id: "east",
    label: "East gate",
    points: [
      { x: 58, y: 48 },
      { x: 95, y: 48 },
      { x: 128, y: 48 },
    ],
  },
  {
    id: "north",
    label: "North road",
    points: [
      { x: 52, y: 48 },
      { x: 52, y: 28 },
      { x: 52, y: 8 },
    ],
  },
  {
    id: "west",
    label: "Stadium lot",
    points: [
      { x: 46, y: 50 },
      { x: 24, y: 50 },
      { x: 8, y: 50 },
    ],
  },
];

export function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/Los_Angeles",
  });
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function interpolatePath(points: MapPoint[], t: number): MapPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0]!;

  const segments = points.length - 1;
  const scaled = Math.min(1, Math.max(0, t)) * segments;
  const idx = Math.min(Math.floor(scaled), segments - 1);
  const local = scaled - idx;
  const a = points[idx]!;
  const b = points[idx + 1]!;
  return { x: lerp(a.x, b.x, local), y: lerp(a.y, b.y, local) };
}
