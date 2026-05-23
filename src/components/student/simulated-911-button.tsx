"use client";

import { useState } from "react";

type Simulated911ButtonProps = {
  className?: string;
};

/** Drill-only UI — never dials or opens the phone app. */
export function Simulated911Button({ className = "" }: Simulated911ButtonProps) {
  const [calling, setCalling] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setCalling(true)}
      disabled={calling}
      aria-label={calling ? "Calling (simulated)" : "Call 911 (simulated drill)"}
      className={`flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-4 text-base font-bold text-white shadow-lg shadow-rose-950/50 disabled:cursor-default disabled:opacity-90 active:bg-rose-700 ${className}`}
    >
      {calling ? (
        "Calling"
      ) : (
        <>
          <PhoneIcon />
          Call 911
        </>
      )}
    </button>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  );
}
