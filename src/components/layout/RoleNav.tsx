"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DEMO_ROLE_OPTIONS,
  DEMO_USER_STORAGE_KEY,
  demoUserById,
} from "@/lib/auth/demo-users";

export function RoleNav() {
  const [selectedUserId, setSelectedUserId] = useState<string>(DEMO_ROLE_OPTIONS[0]?.userId ?? "");

  useEffect(() => {
    const stored = window.localStorage.getItem(DEMO_USER_STORAGE_KEY);
    if (demoUserById(stored)) setSelectedUserId(stored ?? "");
  }, []);

  const selectRole = (userId: string) => {
    setSelectedUserId(userId);
    window.localStorage.setItem(DEMO_USER_STORAGE_KEY, userId);
  };

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Demo roles">
      {DEMO_ROLE_OPTIONS.map((option) => {
        const active = option.userId === selectedUserId;
        return (
          <Link
            key={option.userId}
            href={option.href}
            onClick={() => selectRole(option.userId)}
            className={`rounded border px-3 py-2 text-sm transition ${
              active
                ? "border-sky-600 bg-sky-950/40 text-sky-200"
                : "border-[#2a3340] text-[#94a3b8] hover:bg-[#11161d] hover:text-[#e2e8f0]"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
