"use client";

import type { KeyboardEvent } from "react";
import type { DotStatus, StudentDot } from "@/lib/student-dots";

type StudentDotsLayerProps = {
  dots: readonly StudentDot[];
  activeDotId: string | null;
  onHoverDot: (dot: StudentDot | null) => void;
  onPinDot: (dot: StudentDot) => void;
  onClearPin: () => void;
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

export function StudentDotsLayer({
  dots,
  activeDotId,
  onHoverDot,
  onPinDot,
  onClearPin,
}: StudentDotsLayerProps) {
  const handleKeyDown = (event: KeyboardEvent<SVGCircleElement>, dot: StudentDot) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPinDot(dot);
    }
    if (event.key === "Escape") {
      onClearPin();
      onHoverDot(null);
    }
  };

  return (
    <g className="student-dots-layer">
      {dots.map((dot) => {
        const active = activeDotId === dot.studentId;
        const activeRadius = dot.walking ? 1.25 : 1;
        const baseRadius = dot.walking ? 0.6 : 0.45;
        return (
          <g key={dot.studentId}>
            {active ? (
              <>
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r={activeRadius + 0.75}
                  fill="none"
                  stroke="#f8fafc"
                  strokeOpacity={0.9}
                  strokeWidth={0.18}
                  className="pointer-events-none"
                />
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r={activeRadius + 0.35}
                  fill={STATUS_FILL[dot.status]}
                  fillOpacity={0.28}
                  className="pointer-events-none"
                />
              </>
            ) : null}
            <circle
              cx={dot.x}
              cy={dot.y}
              r={active ? activeRadius : baseRadius}
              fill={STATUS_FILL[dot.status]}
              fillOpacity={active ? 1 : dot.walking ? 0.95 : 0.85}
              stroke={active ? "#ffffff" : STATUS_STROKE[dot.status]}
              strokeWidth={active ? 0.28 : 0.12}
              tabIndex={0}
              role="button"
              aria-label={`${dot.studentName}, ${dot.details.statusLabel}`}
              onMouseEnter={() => onHoverDot(dot)}
              onMouseLeave={() => onHoverDot(null)}
              onFocus={() => onHoverDot(dot)}
              onBlur={() => onHoverDot(null)}
              onClick={(event) => {
                event.stopPropagation();
                onPinDot(dot);
              }}
              onKeyDown={(event) => handleKeyDown(event, dot)}
              style={{
                transition: dot.walking
                  ? undefined
                  : "cx 600ms ease, cy 600ms ease, r 150ms ease",
                cursor: "pointer",
                outline: "none",
              }}
            />
          </g>
        );
      })}
    </g>
  );
}
