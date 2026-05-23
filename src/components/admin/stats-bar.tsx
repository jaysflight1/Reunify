"use client";

type StatsBarProps = {
  safeCount: number;
  unsafeCount: number;
  missingCount: number;
  lastTick: string;
  isLive: boolean;
  onToggleLive: () => void;
  onSeedBurst: () => void;
  dataMode?: "demo" | "firebase" | "local";
  firebaseConnected?: boolean;
};

export function StatsBar({
  safeCount,
  unsafeCount,
  missingCount,
  lastTick,
  isLive,
  onToggleLive,
  onSeedBurst,
  dataMode = "demo",
  firebaseConnected = false,
}: StatsBarProps) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-[#232a35] bg-[#080a0d] px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded border border-[#2a3340] bg-[#12161d]">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-[#94a3b8]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path d="M12 3L4 9v12h16V9l-8-6z" />
            <path d="M9 21v-6h6v6" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-[#f8fafc]">
            Evacuation Command
          </h1>
          <p className="text-[11px] text-[#64748b]">
            Staff only · Los Altos HS ·{" "}
            {dataMode === "local" ? (
              <span className={firebaseConnected ? "text-emerald-500" : "text-amber-500"}>
                {firebaseConnected ? "Live check-ins" : "Waiting for check-ins…"}
              </span>
            ) : dataMode === "firebase" ? (
              <span className={firebaseConnected ? "text-emerald-500" : "text-amber-500"}>
                {firebaseConnected ? "Firebase live" : "Firebase connecting…"}
              </span>
            ) : (
              "Demo data"
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Stat label="Safe" value={safeCount} tone="safe" />
        <Stat label="Unsafe" value={unsafeCount} tone="unsafe" />
        <Stat label="Missing" value={missingCount} tone="warn" />
      </div>

      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        <p className="font-mono text-[10px] tabular-nums text-[#475569]">
          Updated {lastTick}
        </p>
        <div className="flex gap-1.5">
          {dataMode === "demo" ? (
            <button
              type="button"
              onClick={onSeedBurst}
              className="rounded border border-[#2a3340] bg-[#12161d] px-2.5 py-1 text-[10px] font-medium text-[#94a3b8] transition hover:border-[#3d4f63] hover:text-[#e2e8f0]"
            >
              Burst
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleLive}
            className={`rounded border px-2.5 py-1 text-[10px] font-medium transition ${
              isLive
                ? "border-emerald-900/50 bg-emerald-950/40 text-emerald-400"
                : "border-[#2a3340] bg-[#12161d] text-[#64748b]"
            }`}
          >
            {isLive ? "Live" : "Paused"}
          </button>
        </div>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "safe" | "unsafe" | "warn";
}) {
  const colors = {
    safe: "text-emerald-400 border-emerald-900/40",
    unsafe: "text-rose-400 border-rose-900/40",
    warn: "text-amber-400 border-amber-900/40",
  };

  return (
    <div
      className={`flex items-baseline gap-2 rounded border bg-[#0c0f13] px-3 py-1.5 ${colors[tone]}`}
    >
      <span className="text-[10px] uppercase tracking-wider text-[#64748b]">{label}</span>
      <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}
