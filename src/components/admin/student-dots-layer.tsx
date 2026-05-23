"use client";

import type { DotStatus, StudentDot } from "@/lib/student-dots";

type StudentDotsLayerProps = {
  dots: readonly StudentDot[];
};

const STATUS_FILL: Record<DotStatus, string> = {
  safe: "#22c55e",
  missing: "#facc15",
  unsafe: "#ef4444",
};

const STATUS_STROKE: Record<DotStatus, string> = {
  safe: "#064e3b",
  missing: "#713f12",
  unsafe: "#7f1d1d",
};

export function StudentDotsLayer({ dots }: StudentDotsLayerProps) {
  return (
    <g className="student-dots-layer">
      {dots.map((dot) => (
        <circle
          key={dot.studentId}
          cx={dot.x}
          cy={dot.y}
          r={dot.walking ? 0.6 : 0.45}
          fill={STATUS_FILL[dot.status]}
          fillOpacity={dot.walking ? 0.95 : 0.85}
          stroke={STATUS_STROKE[dot.status]}
          strokeWidth={0.12}
          style={{
            transition: dot.walking
              ? undefined
              : "cx 600ms ease, cy 600ms ease",
            cursor: "pointer",
          }}
        >
          <title>
            {dot.studentName} · {dot.status}
            {dot.walking ? " · moving" : ""}
          </title>
        </circle>
      ))}
    </g>
  );
}
