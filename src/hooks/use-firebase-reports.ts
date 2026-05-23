"use client";

import { useCallback, useEffect, useState } from "react";
import { isLocalCheckInMode } from "@/lib/check-in/local-mode";
import { ACTIVE_DRILL_ID, isFirebaseConfigured } from "@/lib/firebase/config";
import { subscribeToDrillReports } from "@/lib/firebase/reports";
import type { StudentReport, TeacherRoomReport } from "@/lib/firebase/types";

type FirebaseReportsState = {
  reports: StudentReport[];
  teacherReports: TeacherRoomReport[];
  connected: boolean;
  error: string | null;
  source: "firestore" | "api" | "local" | "off";
};

const POLL_MS = 4000;

function shouldUseClientListener(): boolean {
  return process.env.NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_LISTEN === "true";
}

export function useFirebaseReports(enabled: boolean): FirebaseReportsState {
  const [state, setState] = useState<FirebaseReportsState>({
    reports: [],
    teacherReports: [],
    connected: false,
    error: null,
    source: "off",
  });

  const loadFromApi = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/reports", { cache: "no-store" });
      const json = (await res.json()) as {
        reports?: StudentReport[];
        teacherReports?: TeacherRoomReport[];
        error?: string;
      };
      if (!res.ok) {
        const err = json.error ?? "Failed to load reports";
        if (res.status === 503) return false;
        const hint =
          err.includes("index") || err.includes("FAILED_PRECONDITION")
            ? " Run: npm run firebase:deploy (indexes), or restart dev after pulling latest."
            : "";
        setState({
          reports: json.reports ?? [],
          teacherReports: json.teacherReports ?? [],
          connected: false,
          error: err + hint,
          source: "api",
        });
        return false;
      }
      setState({
        reports: json.reports ?? [],
        teacherReports: json.teacherReports ?? [],
        connected: true,
        error: null,
        source: isLocalCheckInMode() ? "local" : "api",
      });
      return true;
    } catch (e) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : "Failed to load reports",
        connected: false,
      }));
      return false;
    }
  }, []);

  useEffect(() => {
    const localMode = isLocalCheckInMode();

    if (!enabled || (!isFirebaseConfigured() && !localMode)) {
      setState({
        reports: [],
        teacherReports: [],
        connected: false,
        error: null,
        source: "off",
      });
      return;
    }

    if (localMode) {
      let cancelled = false;
      void loadFromApi();
      const pollId = setInterval(() => {
        if (!cancelled) void loadFromApi();
      }, POLL_MS);
      return () => {
        cancelled = true;
        clearInterval(pollId);
      };
    }

    let cancelled = false;
    let unsub: (() => void) | undefined;

    const startClientListener = () => {
      if (!shouldUseClientListener()) return;
      unsub = subscribeToDrillReports(
        ACTIVE_DRILL_ID,
        (reports) => {
          if (!cancelled) {
            setState((s) => ({
              ...s,
              reports,
              connected: true,
              error: null,
              source: "firestore",
            }));
          }
        },
        (err) => {
          if (!cancelled) {
            const msg = err.message;
            const hint =
              msg.includes("index") || msg.includes("FAILED_PRECONDITION")
                ? " Create the Firestore index (see docs/FIREBASE.md)."
                : msg.includes("permission") || msg.includes("PERMISSION_DENIED")
                  ? " Deploy firestore.rules, or add FIREBASE_SERVICE_ACCOUNT_JSON."
                  : "";
            setState((s) => ({
              ...s,
              error: msg + hint,
              connected: false,
            }));
          }
        },
      );
    };

    void (async () => {
      const apiOk = await loadFromApi();
      if (cancelled) return;
      if (!apiOk) {
        startClientListener();
        if (!shouldUseClientListener()) {
          setState((s) => ({
            ...s,
            error: "Add FIREBASE_SERVICE_ACCOUNT_JSON for admin API.",
          }));
        }
      }
    })();

    const pollId = setInterval(() => void loadFromApi(), POLL_MS);

    return () => {
      cancelled = true;
      unsub?.();
      if (pollId) clearInterval(pollId);
    };
  }, [enabled, loadFromApi]);

  return state;
}
