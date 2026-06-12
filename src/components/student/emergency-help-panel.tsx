"use client";

import { LocationSharedStatus } from "@/components/student/location-shared-status";
import { Simulated911Button } from "@/components/student/simulated-911-button";

const SAFETY_TIPS = [
  "If you can escape safely, run away from danger — leave belongings behind.",
  "If you cannot get out, lock and barricade the door. Turn off lights and silence your phone.",
  "Stay quiet and out of sight. Do not open the door unless police clearly identify themselves.",
  "Text or message only if it is safe — do not reveal your hiding place aloud.",
];

type EmergencyHelpPanelProps = {
  shooterNearby: boolean;
  onShooterNearbyChange: (value: boolean) => void;
  locStatus: "idle" | "loading" | "ok" | "denied";
  onCaptureLocation: () => void;
};

export function EmergencyHelpPanel({
  shooterNearby,
  onShooterNearbyChange,
  locStatus,
  onCaptureLocation,
}: EmergencyHelpPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-rose-900/50 bg-rose-950/20 p-4">
      <div>
        <p className="text-sm font-semibold text-rose-300">You need help now</p>
      </div>

      <Simulated911Button />

      <label
        className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition ${
          shooterNearby
            ? "border-rose-500 bg-rose-950/50"
            : "border-[#2a3340] bg-[#0c0f13]"
        }`}
      >
        <input
          type="checkbox"
          checked={shooterNearby}
          onChange={(e) => onShooterNearbyChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-[#475569] bg-[#0c0f13] text-rose-600 focus:ring-rose-500/40"
        />
        <span>
          <span className="block text-sm font-semibold text-[#f1f5f9]">
            Shooter is actively near me
          </span>
          <span className="mt-0.5 block text-xs text-[#94a3b8]">
            Staff will prioritize your alert. Only check if this is true right now.
          </span>
        </span>
      </label>

      <LocationSharedStatus locStatus={locStatus} onCaptureLocation={onCaptureLocation} />

      <div className="rounded-lg border border-[#232a35] bg-[#0a0d11] px-3 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#64748b]">
          Stay safe
        </p>
        <ul className="mt-2 space-y-2">
          {SAFETY_TIPS.map((tip) => (
            <li key={tip} className="flex gap-2 text-xs leading-relaxed text-[#cbd5e1]">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400/80" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
