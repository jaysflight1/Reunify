"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomStudent } from "@/lib/general-rooms";
import type { YapParseResult } from "@/lib/teacher/parse-yap";

type ParseSource = "openrouter" | "regex" | null;

type UseOpenRouterVoiceParseArgs = {
  enabled: boolean;
  transcript: string;
  listening: boolean;
  selectedRoomNumber?: string;
  roster: RoomStudent[];
};

export function useOpenRouterVoiceParse({
  enabled,
  transcript,
  listening,
  selectedRoomNumber,
  roster,
}: UseOpenRouterVoiceParseArgs) {
  const [yap, setYap] = useState<YapParseResult | null>(null);
  const [source, setSource] = useState<ParseSource>(null);
  const [parsing, setParsing] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastParsedRef = useRef("");

  useEffect(() => {
    if (!enabled) {
      setYap(null);
      setSource(null);
      setParsing(false);
      setWarning(null);
      lastParsedRef.current = "";
      return;
    }

    const text = transcript.trim();
    if (listening || !text) {
      if (!text) {
        setYap(null);
        setSource(null);
        lastParsedRef.current = "";
      }
      return;
    }

    if (text === lastParsedRef.current) return;

    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setParsing(true);
      setWarning(null);

      void (async () => {
        try {
          const res = await fetch("/api/teacher/parse-voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcript: text,
              selectedRoomNumber,
            }),
            signal: controller.signal,
          });
          if (!res.ok) throw new Error("Parse request failed");
          const data = (await res.json()) as {
            result: YapParseResult;
            source: "openrouter" | "regex";
            warning?: string;
          };
          if (controller.signal.aborted) return;
          lastParsedRef.current = text;
          setYap(data.result);
          setSource(data.source);
          setWarning(data.warning ?? null);
        } catch (e) {
          if (controller.signal.aborted) return;
          setWarning(e instanceof Error ? e.message : "Could not parse voice");
        } finally {
          if (!controller.signal.aborted) setParsing(false);
        }
      })();
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, transcript, listening, selectedRoomNumber, roster.length]);

  return { yap, source, parsing, warning };
}
