"use client";

import Link from "next/link";
import { DEMO_ROLE_OPTIONS, DEMO_USER_STORAGE_KEY } from "@/lib/auth/demo-users";
import type { UserRole } from "@/types/user";

const DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Command center, map, alerts, reports.",
  teacher: "Voice or text reports plus roster roll call.",
  student: "Locked-down self status and help request.",
  parent: "Child-only status and pickup messaging.",
  responder: "Factual missing, needs-help, and report snapshot.",
};

export function RoleSelector() {
  const selectRole = (userId: string) => {
    window.localStorage.setItem(DEMO_USER_STORAGE_KEY, userId);
  };

  return (
    <div className="grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {DEMO_ROLE_OPTIONS.map((option) => (
        <Link
          key={option.userId}
          href={option.href}
          onClick={() => selectRole(option.userId)}
          className="group rounded-lg border border-[#232a35] bg-[#0c0f13] p-4 transition hover:border-sky-800 hover:bg-[#11161d]"
        >
          <p className="text-sm font-semibold text-[#f8fafc]">{option.label}</p>
          <p className="mt-2 text-xs leading-relaxed text-[#94a3b8]">{DESCRIPTIONS[option.role]}</p>
          <p className="mt-4 text-[10px] font-medium uppercase tracking-wider text-sky-300 opacity-70 group-hover:opacity-100">
            Open
          </p>
        </Link>
      ))}
    </div>
  );
}
