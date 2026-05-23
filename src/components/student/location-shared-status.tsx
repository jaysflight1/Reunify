"use client";

import { useEffect } from "react";

type LocationSharedStatusProps = {
  locStatus: "idle" | "loading" | "ok" | "denied";
  onCaptureLocation: () => void;
  /** Request GPS automatically when the control mounts. */
  autoCapture?: boolean;
  className?: string;
};

export function LocationSharedStatus({
  locStatus,
  onCaptureLocation,
  autoCapture = true,
  className = "",
}: LocationSharedStatusProps) {
  useEffect(() => {
    if (autoCapture && locStatus === "idle") {
      onCaptureLocation();
    }
  }, [autoCapture, locStatus, onCaptureLocation]);

  if (locStatus === "ok") {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-emerald-900/40 bg-emerald-950/25 px-3 py-2.5 ${className}`}
        role="status"
        aria-live="polite"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-sm font-medium text-emerald-300">Location Shared</span>
      </div>
    );
  }

  if (locStatus === "loading" || locStatus === "idle") {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-[#2a3340] bg-[#0c0f13] px-3 py-2.5 ${className}`}
        role="status"
        aria-live="polite"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#475569] opacity-40" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#64748b]" />
        </span>
        <span className="text-sm text-[#94a3b8]">Getting location…</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onCaptureLocation}
      className={`w-full rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2.5 text-left text-sm text-amber-200/90 active:bg-amber-950/40 ${className}`}
    >
      Location unavailable — tap to retry
    </button>
  );
}
