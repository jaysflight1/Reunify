export type RoomStudent = {
  id: string;
  name: string;
  grade: string;
};

export type GeneralRoom = {
  id: string;
  number: string;
  label: string;
  building: string;
  teacher: string;
  /** Normalized map bounds (viewBox 100 × 129.38) */
  x: number;
  y: number;
  w: number;
  h: number;
  roster: RoomStudent[];
};

export type WingGridSpec = {
  building: string;
  numbers: string[];
  origin: { x: number; y: number };
  cols: number;
  cellW: number;
  cellH: number;
  gapX?: number;
  gapY?: number;
  teachers: Record<string, string>;
};
