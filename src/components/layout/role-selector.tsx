"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { DEMO_ROLE_OPTIONS, DEMO_USER_STORAGE_KEY } from "@/lib/auth/demo-users";
import type { UserRole } from "@/types/user";

type RoleMeta = {
  description: string;
  features: string[];
  /** Tailwind classes applied on hover for the accent ring + glow. */
  hoverRing: string;
  /** Background + ring for the icon square. */
  iconChip: string;
  icon: ReactNode;
};

const ROLE_META: Record<UserRole, RoleMeta> = {
  admin: {
    description: "Command center for the incident.",
    features: ["Live campus map", "Priority alerts", "Reports queue"],
    hoverRing:
      "hover:border-indigo-400/40 hover:shadow-[0_0_0_1px_rgba(129,140,248,0.25),0_10px_40px_-12px_rgba(99,102,241,0.45)]",
    iconChip: "bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-400/25",
    icon: <ShieldIcon />,
  },
  teacher: {
    description: "Voice or roster roll call for your room.",
    features: ["Voice roll call", "Roster checklist", "Status notes"],
    hoverRing:
      "hover:border-sky-400/40 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.25),0_10px_40px_-12px_rgba(14,165,233,0.45)]",
    iconChip: "bg-sky-500/10 text-sky-300 ring-1 ring-sky-400/25",
    icon: <ClipboardIcon />,
  },
  student: {
    description: "Quick self-status and help requests.",
    features: ["I'm safe", "I need help", "Share location"],
    hoverRing:
      "hover:border-emerald-400/40 hover:shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_10px_40px_-12px_rgba(16,185,129,0.45)]",
    iconChip: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/25",
    icon: <HandIcon />,
  },
  parent: {
    description: "Your child's verified status, nothing else.",
    features: ["Confirmed updates", "Calm messaging", "No raw alerts"],
    hoverRing:
      "hover:border-violet-400/40 hover:shadow-[0_0_0_1px_rgba(167,139,250,0.25),0_10px_40px_-12px_rgba(139,92,246,0.45)]",
    iconChip: "bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/25",
    icon: <HeartPeopleIcon />,
  },
  responder: {
    description: "Field-ready snapshot for first responders.",
    features: ["Needs-help list", "Missing students", "Shooter reports"],
    hoverRing:
      "hover:border-amber-400/40 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_10px_40px_-12px_rgba(245,158,11,0.45)]",
    iconChip: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-400/25",
    icon: <BoltIcon />,
  },
};

export function RoleSelector() {
  const selectRole = (userId: string) => {
    window.localStorage.setItem(DEMO_USER_STORAGE_KEY, userId);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
      {DEMO_ROLE_OPTIONS.map((option) => {
        const meta = ROLE_META[option.role];
        return (
          <Link
            key={option.userId}
            href={option.href}
            onClick={() => selectRole(option.userId)}
            className={`group relative flex flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 ${meta.hoverRing}`}
          >
            <span
              className={`mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl ${meta.iconChip}`}
            >
              {meta.icon}
            </span>
            <p className="text-[17px] font-semibold tracking-tight text-white">
              {option.label}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
              {meta.description}
            </p>
            <ul className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-4">
              {meta.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2 text-[12px] text-slate-400"
                >
                  <Dot />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-300 transition-colors group-hover:text-white">
              Open
              <ArrowRightIcon />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function Dot() {
  return (
    <span className="h-1 w-1 shrink-0 rounded-full bg-slate-500 group-hover:bg-slate-300" />
  );
}

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
      aria-hidden="true"
    >
      <path
        d="M3 8h10m0 0L9 4m4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6l-8-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect
        x="5"
        y="5"
        width="14"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m9 13 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M9 11V5a1.5 1.5 0 1 1 3 0v5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 10V4.5a1.5 1.5 0 1 1 3 0V11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M15 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.6-3l-2-4.6a1.5 1.5 0 0 1 2.6-1.5l1.5 2.1V7.5a1.5 1.5 0 1 1 3 0V11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartPeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
