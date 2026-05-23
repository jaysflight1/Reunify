"use client";

type VoiceCaptureProps = {
  supported: boolean;
  listening: boolean;
  liveText: string;
  onToggleListen: () => void;
  onClear: () => void;
};

export function VoiceCapture({
  supported,
  listening,
  liveText,
  onToggleListen,
  onClear,
}: VoiceCaptureProps) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onToggleListen}
        disabled={!supported}
        className="group relative flex h-28 w-28 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:opacity-40"
        aria-label={listening ? "Stop listening" : "Start listening"}
      >
        <span
          className={`absolute inset-0 rounded-full bg-gradient-to-br from-sky-500/30 to-violet-600/30 blur-md transition ${
            listening ? "animate-pulse scale-110" : "scale-100 opacity-60"
          }`}
        />
        <span
          className={`absolute inset-2 rounded-full border transition ${
            listening ? "border-sky-400/50" : "border-[#334155]"
          }`}
        />
        <span
          className={`relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-[#1e293b] to-[#0f172a] shadow-inner transition ${
            listening ? "ring-2 ring-sky-400/40" : ""
          }`}
        >
          <MicIcon listening={listening} />
        </span>
      </button>

      <p className="mt-4 text-center text-sm text-[#94a3b8]">
        {supported
          ? listening
            ? "Listening… tap to stop"
            : "Tap and say your room + who’s missing"
          : "Voice not supported in this browser — use roster checkboxes"}
      </p>

      <div className="mt-4 w-full rounded-2xl border border-[#232a35] bg-[#0a0d11] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[#64748b]">
            Transcript
          </span>
          {liveText ? (
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] text-[#64748b] underline underline-offset-2 hover:text-[#94a3b8]"
            >
              Clear
            </button>
          ) : null}
        </div>
        <p
          className={`mt-2 min-h-[4.5rem] text-sm leading-relaxed ${
            liveText ? "text-[#f1f5f9]" : "text-[#475569]"
          }`}
        >
          {liveText ||
            "Example: “I’m in room 903, I have everyone but John Smith and Maria Garcia.”"}
        </p>
      </div>
    </div>
  );
}

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-8 w-8 ${listening ? "text-sky-400" : "text-[#94a3b8]"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3zm0 0v2m-4 2h8"
      />
      {listening ? (
        <circle cx="12" cy="12" r="10" className="animate-ping opacity-20" fill="currentColor" stroke="none" />
      ) : null}
    </svg>
  );
}
