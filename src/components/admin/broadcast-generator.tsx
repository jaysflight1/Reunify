"use client";

import { useEffect, useState } from "react";
import { DEMO_APP_USERS, DEMO_BROADCAST_AUDIENCES, DEMO_INCIDENT_ID, DEMO_SCHOOL_ID } from "@/lib/demo/constants";
import { DEMO_AUTH_HEADER, DEMO_USER_STORAGE_KEY } from "@/lib/auth/demo-users";
import type { Broadcast, BroadcastAudience } from "@/types/incident";

type GenerateResponse = {
  broadcast?: Broadcast;
  error?: string;
};

export function BroadcastGenerator() {
  const [audience, setAudience] = useState<BroadcastAudience>("parents");
  const [loading, setLoading] = useState(false);
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState(DEMO_APP_USERS.admin);

  useEffect(() => {
    setActiveUserId(window.localStorage.getItem(DEMO_USER_STORAGE_KEY) ?? DEMO_APP_USERS.admin);
  }, []);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setBroadcast(null);
    try {
      const response = await fetch("/api/broadcasts/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [DEMO_AUTH_HEADER]: activeUserId,
        },
        body: JSON.stringify({
          schoolId: DEMO_SCHOOL_ID,
          incidentId: DEMO_INCIDENT_ID,
          audience,
          tone: "calm",
        }),
      });
      const json = (await response.json()) as GenerateResponse;
      if (!response.ok || !json.broadcast) {
        throw new Error(json.error ?? "Could not generate broadcast.");
      }
      setBroadcast(json.broadcast);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate broadcast.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-[#232a35] bg-[#0c0f13] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-[#e2e8f0]">Broadcast generator</h2>
          <p className="text-[10px] text-[#64748b]">Role-filtered AI message</p>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading}
          className="rounded border border-[#2a3340] px-3 py-2 text-xs text-[#e2e8f0] disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEMO_BROADCAST_AUDIENCES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setAudience(option)}
            className={`rounded border px-2 py-1 text-xs ${
              audience === option
                ? "border-sky-700 bg-sky-950/40 text-sky-200"
                : "border-[#2a3340] text-[#94a3b8]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      {broadcast ? (
        <p className="mt-3 rounded border border-[#232a35] bg-[#06080a] px-3 py-2 text-xs text-[#e2e8f0]">
          {broadcast.message}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}
    </section>
  );
}
