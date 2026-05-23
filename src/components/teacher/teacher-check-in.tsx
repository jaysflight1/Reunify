"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { submitTeacherRoomReport } from "@/lib/firebase/teacher-reports";
import { LAHS_ROOMS, getRoomByNumber, type LahsRoom } from "@/lib/lahs-rooms";
import { parseTeacherYap, rosterFromSelection } from "@/lib/teacher/parse-yap";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { VoiceCapture } from "./voice-capture";
import { RosterChecklist } from "./roster-checklist";

type InputMode = "voice" | "checkbox";

const ROOM_OPTIONS = [...LAHS_ROOMS]
  .filter((r) => r.roster.length > 0)
  .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

export function TeacherCheckIn() {
  const firebaseReady = isFirebaseConfigured();
  const speech = useSpeechRecognition();

  const [mode, setMode] = useState<InputMode>("voice");
  const [roomNumber, setRoomNumber] = useState(ROOM_OPTIONS[0]?.number ?? "408");
  const [teacherName, setTeacherName] = useState(ROOM_OPTIONS[0]?.teacher ?? "");
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const room: LahsRoom | undefined = getRoomByNumber(roomNumber);
  const roster = room?.roster ?? [];

  useEffect(() => {
    if (!room) return;
    setTeacherName(room.teacher);
    setPresentIds(new Set(room.roster.map((s) => s.id)));
  }, [room]);

  const yap = useMemo(
    () => parseTeacherYap(speech.liveText, roomNumber),
    [speech.liveText, roomNumber],
  );

  useEffect(() => {
    if (mode !== "voice" || speech.listening || !speech.transcript) return;
    if (yap.confidence === "low") return;
    if (yap.presentIds.length > 0 || yap.allAccounted) {
      setPresentIds(new Set(yap.presentIds));
    }
  }, [mode, speech.listening, speech.transcript, yap]);

  const checkboxSelection = useMemo(
    () => rosterFromSelection(roster, presentIds),
    [roster, presentIds],
  );

  const handleRoomChange = (num: string) => {
    setRoomNumber(num);
    const next = getRoomByNumber(num);
    if (next) {
      setTeacherName(next.teacher);
      setPresentIds(new Set(next.roster.map((s) => s.id)));
    }
  };

  const toggleStudent = (id: string) => {
    setPresentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = useCallback(async () => {
    setError(null);
    if (!firebaseReady) {
      setError("Firebase is not configured.");
      return;
    }
    if (!room) {
      setError("Select a valid room.");
      return;
    }

    const submitRoom = yap.effectiveRoomNumber;
    const submitRoomMeta = getRoomByNumber(submitRoom);

    const payload =
      mode === "voice"
        ? {
            roomNumber: submitRoom,
            spokenRoomNumber: yap.spokenRoomNumber,
            teacherName: teacherName.trim() || submitRoomMeta?.teacher || room.teacher,
            presentIds: yap.presentIds,
            missingIds: yap.missingIds,
            unmatchedMissing: yap.unmatchedMissing,
            allAccounted: yap.allAccounted,
            transcript: speech.liveText,
            inputMode: "voice" as const,
          }
        : {
            roomNumber,
            teacherName: teacherName.trim() || room.teacher,
            presentIds: checkboxSelection.presentIds,
            missingIds: checkboxSelection.missingIds,
            unmatchedMissing: [],
            allAccounted: checkboxSelection.allAccounted,
            transcript: null,
            inputMode: "checkbox" as const,
          };

    if (payload.presentIds.length === 0 && payload.missingIds.length === 0) {
      setError("Mark who is present or say your roll call out loud.");
      return;
    }

    setSubmitting(true);
    try {
      await submitTeacherRoomReport(payload);
      setSubmitted(true);
      speech.stop();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }, [
    firebaseReady,
    room,
    mode,
    yap,
    roomNumber,
    teacherName,
    speech,
    checkboxSelection,
  ]);

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/25 p-8 text-center">
        <p className="text-lg font-semibold text-emerald-300">Roll call sent</p>
        <p className="mt-2 text-sm text-[#94a3b8]">
          Room {mode === "voice" ? yap.effectiveRoomNumber : roomNumber}
          {mode === "voice" && yap.spokenRoomNumber ? " (from voice)" : ""} · staff
          updated
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            speech.reset();
          }}
          className="mt-6 text-sm text-[#94a3b8] underline underline-offset-2"
        >
          Update roll call
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {!firebaseReady ? (
        <p className="rounded-lg border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          Firebase env vars missing — configure to submit roll call.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#232a35] bg-[#0a0d11] p-1">
        <ModeTab active={mode === "voice"} onClick={() => setMode("voice")}>
          Voice
        </ModeTab>
        <ModeTab active={mode === "checkbox"} onClick={() => setMode("checkbox")}>
          Roster
        </ModeTab>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748b]">
          Your room
        </span>
        <select
          value={roomNumber}
          onChange={(e) => handleRoomChange(e.target.value)}
          className="w-full rounded-xl border border-[#2a3340] bg-[#0c0f13] px-3 py-3 text-base text-[#f8fafc]"
        >
          {ROOM_OPTIONS.map((r) => (
            <option key={r.id} value={r.number}>
              {r.label} · {r.building}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748b]">
          Teacher name
        </span>
        <input
          value={teacherName}
          onChange={(e) => setTeacherName(e.target.value)}
          className="w-full rounded-xl border border-[#2a3340] bg-[#0c0f13] px-3 py-3 text-base text-[#f8fafc]"
        />
      </label>

      {mode === "voice" ? (
        <>
          <VoiceCapture
            supported={speech.supported}
            listening={speech.listening}
            liveText={speech.liveText}
            onToggleListen={speech.toggle}
            onClear={speech.reset}
          />
          <ParsePreview
            summary={yap.summary}
            unmatched={yap.unmatchedMissing}
            selectedRoom={roomNumber}
            spokenRoom={yap.spokenRoomNumber}
            submitRoom={yap.effectiveRoomNumber}
          />
        </>
      ) : (
        <RosterChecklist
          roster={roster}
          presentIds={presentIds}
          onToggle={toggleStudent}
          onSelectAll={() => setPresentIds(new Set(roster.map((s) => s.id)))}
          onClearAll={() => setPresentIds(new Set())}
        />
      )}

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={submitting || !firebaseReady}
        className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-violet-600 py-4 text-base font-semibold text-white shadow-lg shadow-sky-950/40 disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send roll call to staff"}
      </button>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg py-2.5 text-sm font-medium transition ${
        active ? "bg-[#1e293b] text-[#f8fafc]" : "text-[#64748b] hover:text-[#94a3b8]"
      }`}
    >
      {children}
    </button>
  );
}

function ParsePreview({
  summary,
  unmatched,
  selectedRoom,
  spokenRoom,
  submitRoom,
}: {
  summary: string;
  unmatched: string[];
  selectedRoom: string;
  spokenRoom: string | null;
  submitRoom: string;
}) {
  return (
    <div className="rounded-xl border border-[#232a35] bg-[#0c0f13] px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[#64748b]">
        Parsed roll call
      </p>
      <p className="mt-1 text-[11px] text-[#94a3b8]">
        Submitting as room <span className="font-mono text-[#e2e8f0]">{submitRoom}</span>
        {spokenRoom
          ? " · heard in voice"
          : ` · dropdown (${selectedRoom})`}
      </p>
      <p className="mt-1 text-sm text-[#e2e8f0]">{summary}</p>
      {unmatched.length > 0 ? (
        <p className="mt-2 text-[10px] text-amber-400/90">
          Unmatched names: {unmatched.join(", ")} — fix in roster tab if needed
        </p>
      ) : null}
    </div>
  );
}
