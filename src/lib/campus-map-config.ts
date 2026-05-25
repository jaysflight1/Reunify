/** Normalized coords on the schematic campus map (landscape). */
export type MapPoint = { x: number; y: number };

export const CAMPUS_MAP = {
  viewBox: { w: 140, h: 92 },
  schoolName: "General High School",
} as const;

export const RALLY_POINT = {
  label: "Main Quad",
  x: 52,
  y: 50,
} as const;
