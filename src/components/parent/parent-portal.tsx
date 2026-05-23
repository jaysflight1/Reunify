"use client";

import { useEffect, useState } from "react";
import { DEMO_APP_USERS } from "@/lib/demo/constants";
import { DEMO_AUTH_HEADER, DEMO_USER_STORAGE_KEY } from "@/lib/auth/demo-users";
import type { Broadcast, ParentSafeStudentStatus } from "@/types/incident";

type ParentChildrenStatusResponse = {
  children: ParentSafeStudentStatus[];
  parentBroadcasts: Broadcast[];
  error?: string;
};

function demoUserId(): string {
  if (typeof window === "undefined") return DEMO_APP_USERS.parent;
  return window.localStorage.getItem(DEMO_USER_STORAGE_KEY) ?? DEMO_APP_USERS.parent;
}

export function ParentPortal() {
  const [data, setData] = useState<ParentChildrenStatusResponse | null>(null);
  const [eta, setEta] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/me/children-status", {
          cache: "no-store",
          headers: { [DEMO_AUTH_HEADER]: demoUserId() },
        });
        const json = (await response.json()) as ParentChildrenStatusResponse;
        if (!response.ok) throw new Error(json.error ?? "Could not load child status.");
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load child status.");
      }
    })();
  }, []);

  return (
    <div>
      <div className="grid gap-3">
        {data?.children.map((child) => (
          <article key={child.studentId} className="rounded-xl border border-[#232a35] bg-[#0c0f13] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#f8fafc]">{child.studentName}</h2>
                <p className="mt-1 text-sm text-[#94a3b8]">{child.parentSafeMessage}</p>
              </div>
              <span className="rounded border border-[#2a3340] px-2 py-1 text-xs text-[#e2e8f0]">
                {child.publicParentStatus.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-3 text-xs text-[#64748b]">
              Last update: {child.lastUpdatedAt || "No verified update yet"}
            </p>
            {child.pickupInstructions ? (
              <p className="mt-3 rounded border border-[#2a3340] bg-[#06080a] px-3 py-2 text-sm text-[#e2e8f0]">
                {child.pickupInstructions}
              </p>
            ) : null}
          </article>
        ))}
        {data && data.children.length === 0 ? (
          <p className="rounded-xl border border-[#232a35] bg-[#0c0f13] p-6 text-center text-sm text-[#64748b]">
            No children are linked to this parent account.
          </p>
        ) : null}
      </div>

      <section className="mt-4 rounded-xl border border-[#232a35] bg-[#0c0f13] p-4">
        <h2 className="text-sm font-semibold text-[#e2e8f0]">Pickup ETA</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={eta}
            onChange={(event) => setEta(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[#2a3340] bg-[#06080a] px-3 py-2 text-sm text-[#f8fafc]"
            placeholder="Example: 20 minutes"
          />
          <button
            type="button"
            className="rounded-lg border border-[#2a3340] px-3 py-2 text-sm text-[#e2e8f0]"
            onClick={() => setEta("")}
          >
            Save
          </button>
        </div>
      </section>

      {data?.parentBroadcasts.length ? (
        <section className="mt-4 rounded-xl border border-[#232a35] bg-[#0c0f13] p-4">
          <h2 className="text-sm font-semibold text-[#e2e8f0]">School updates</h2>
          <ul className="mt-3 space-y-2">
            {data.parentBroadcasts.map((broadcast) => (
              <li key={broadcast.id} className="text-sm text-[#94a3b8]">
                {broadcast.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}
    </div>
  );
}
