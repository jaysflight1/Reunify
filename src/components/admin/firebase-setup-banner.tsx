"use client";

import { useCallback, useEffect, useState } from "react";

type Status = {
  clientConfigured: boolean;
  adminConfigured: boolean;
  drillId: string;
};

export function FirebaseSetupBanner() {
  const [status, setStatus] = useState<Status | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/status");
    setStatus((await res.json()) as Status);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const seed = async () => {
    setSeeding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/seed", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; rooms?: number; error?: string };
      if (!res.ok) {
        setMessage(json.error ?? "Seed failed");
      } else {
        setMessage(`Seeded ${json.rooms ?? 0} rooms + drill metadata.`);
      }
    } catch {
      setMessage("Seed request failed");
    } finally {
      setSeeding(false);
    }
  };

  if (!status?.clientConfigured) return null;

  return (
    <div className="border-b border-[#232a35] bg-[#0c0f13] px-4 py-2 text-xs text-[#94a3b8]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          Firebase · drill <span className="font-mono text-[#cbd5e1]">{status.drillId}</span>
          {status.adminConfigured ? (
            <span className="ml-2 text-emerald-500">Admin API ready</span>
          ) : (
            <span className="ml-2 text-amber-500">Add service account for admin API</span>
          )}
        </span>
        <button
          type="button"
          onClick={seed}
          disabled={seeding || !status.adminConfigured}
          className="rounded border border-[#2a3340] px-2 py-1 text-[#e2e8f0] hover:bg-[#1a212b] disabled:opacity-40"
        >
          {seeding ? "Seeding…" : "Seed rooms to Firestore"}
        </button>
      </div>
      {message ? <p className="mt-1 text-[#64748b]">{message}</p> : null}
    </div>
  );
}
