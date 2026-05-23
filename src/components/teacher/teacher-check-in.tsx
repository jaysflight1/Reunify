"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isLocalCheckInMode } from "@/lib/check-in/local-mode";
import { submitTeacherRoomReportClient } from "@/lib/check-in/submit-reports";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { LAHS_ROOMS, getRoomByNumber, type LahsRoom } from "@/lib/lahs-rooms";
import { parseTeacherYap, rosterFromSelection } from "@/lib/teacher/parse-yap";
import { useGeminiVoiceParse } from "@/hooks/use-gemini-voice-parse";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { VoiceCapture } from "./voice-capture";
import { RosterChecklist } from "./roster-checklist";

type InputMode = "voice" | "checkbox";

const ROOM_OPTIONS = [...LAHS_ROOMS]
  .filter((r) => r.roster.length > 0)
  .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

type TeacherOption = {
  key: string;
  teacher: string;
  roomNumber: string;
  roomLabel: string;
};

export function TeacherCheckIn() {
  const firebaseReady = isFirebaseConfigured();
  const localMode = isLocalCheckInMode();
  const checkInReady = firebaseReady || localMode;
  const speech = useSpeechRecognition();

  const [mode, setMode] = useState<InputMode>("voice");
  const [roomNumber, setRoomNumber] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherQuery, setTeacherQuery] = useState("");
  const [teacherFocused, setTeacherFocused] = useState(false);
  const [roomQuery, setRoomQuery] = useState("");
  const [roomFocused, setRoomFocused] = useState(false);
  const teacherManuallyEditedRef = useRef(false);
  const roomManuallyEditedRef = useRef(false);
  const noteManuallyEditedRef = useRef(false);
  const [note, setNote] = useState("");
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const room: LahsRoom | undefined = getRoomByNumber(roomNumber);
  const roster = useMemo(() => room?.roster ?? [], [room]);
  const teacherOptions = useMemo<TeacherOption[]>(
    () =>
      ROOM_OPTIONS.map((roomOption) => ({
        key: roomOption.id,
        teacher: roomOption.teacher,
        roomNumber: roomOption.number,
        roomLabel: roomOption.label,
      })).sort((a, b) => a.teacher.localeCompare(b.teacher)),
    [],
  );
  const teacherMatches = useMemo(() => {
    const query = teacherQuery.trim().toLowerCase();
    if (!query) return teacherOptions;
    return teacherOptions.filter((option) => {
      const searchable = `${option.teacher} ${option.roomNumber} ${option.roomLabel}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [teacherOptions, teacherQuery]);
  const roomMatches = useMemo(() => {
    const query = roomQuery.trim().toLowerCase();
    if (!query) return ROOM_OPTIONS;
    return ROOM_OPTIONS.filter((option) => {
      const searchable = `${option.number} ${option.label} ${option.teacher} ${option.building}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [roomQuery]);

  useEffect(() => {
    if (!room) return;
    setPresentIds(new Set(room.roster.map((s) => s.id)));
  }, [room]);

  const regexYap = useMemo(
    () => parseTeacherYap(speech.liveText, roomNumber),
    [speech.liveText, roomNumber],
  );

  const gemini = useGeminiVoiceParse({
    enabled: mode === "voice",
    transcript: speech.liveText,
    listening: speech.listening,
    selectedRoomNumber: roomNumber,
    roster,
  });

  const yap = gemini.yap ?? regexYap;
  const parseSource = gemini.yap ? gemini.source : "regex";

  useEffect(() => {
    if (mode !== "voice" || speech.listening || !speech.liveText.trim()) return;
    if (gemini.parsing) return;
    if (
      yap.spokenTeacherName &&
      !teacherManuallyEditedRef.current &&
      !teacherQuery.trim() &&
      !teacherName
    ) {
      setTeacherName(yap.spokenTeacherName);
      setTeacherQuery(yap.spokenTeacherName);
    }
    if (
      yap.effectiveRoomNumber &&
      !roomManuallyEditedRef.current &&
      !roomQuery.trim() &&
      !roomNumber
    ) {
      const inferredRoom = getRoomByNumber(yap.effectiveRoomNumber);
      setRoomNumber(yap.effectiveRoomNumber);
      setRoomQuery(inferredRoom?.label ?? `Room ${yap.effectiveRoomNumber}`);
      if (
        inferredRoom?.teacher &&
        !teacherManuallyEditedRef.current &&
        !teacherQuery.trim() &&
        !teacherName
      ) {
        setTeacherName(inferredRoom.teacher);
        setTeacherQuery(inferredRoom.teacher);
      }
    }
    if (yap.notes && !noteManuallyEditedRef.current && yap.notes !== note) {
      setNote(yap.notes);
    }
    if (yap.confidence === "low") return;
    if (yap.presentIds.length > 0 || yap.allAccounted) {
      setPresentIds(new Set(yap.presentIds));
    }
  }, [
    mode,
    speech.listening,
    speech.liveText,
    yap,
    gemini.parsing,
    teacherName,
    teacherQuery,
    roomNumber,
    roomQuery,
    note,
  ]);

  const checkboxSelection = useMemo(
    () => rosterFromSelection(roster, presentIds),
    [roster, presentIds],
  );

  const selectTeacher = (option: TeacherOption) => {
    const roomAlreadySelected = Boolean(roomNumber || roomQuery.trim());
    setTeacherQuery(option.teacher);
    setTeacherName(option.teacher);
    teacherManuallyEditedRef.current = true;
    setTeacherFocused(false);
    if (!roomAlreadySelected) {
      setRoomNumber(option.roomNumber);
      setRoomQuery(option.roomLabel);
      roomManuallyEditedRef.current = false;
      const next = getRoomByNumber(option.roomNumber);
      if (next) setPresentIds(new Set(next.roster.map((s) => s.id)));
    }
  };

  const selectRoom = (option: LahsRoom) => {
    const teacherAlreadySelected = Boolean(teacherName || teacherQuery.trim());
    setRoomQuery(option.label);
    setRoomNumber(option.number);
    roomManuallyEditedRef.current = true;
    if (!teacherAlreadySelected) {
      setTeacherName(option.teacher);
      setTeacherQuery(option.teacher);
      teacherManuallyEditedRef.current = false;
    }
    setRoomFocused(false);
    setTeacherFocused(false);
    setPresentIds(new Set(option.roster.map((s) => s.id)));
  };

  const onTeacherChange = (value: string) => {
    setTeacherQuery(value);
    teacherManuallyEditedRef.current = true;
    setTeacherFocused(true);
    const normalized = value.trim().toLowerCase();
    const exact = teacherOptions.find(
      (option) =>
        option.teacher.toLowerCase() === normalized ||
        `${option.teacher} ${option.roomLabel}`.toLowerCase() === normalized,
    );
    if (exact) {
      setTeacherQuery(exact.teacher);
      setTeacherName(exact.teacher);
      if (!roomManuallyEditedRef.current && !roomNumber && !roomQuery.trim()) {
        setRoomNumber(exact.roomNumber);
        setRoomQuery(exact.roomLabel);
      }
    } else {
      setTeacherName(value.trim());
      if (!roomManuallyEditedRef.current && !roomNumber && !roomQuery.trim()) {
        setRoomNumber("");
        setRoomQuery("");
        setPresentIds(new Set());
      }
    }
  };

  const onRoomChange = (value: string) => {
    setRoomQuery(value);
    roomManuallyEditedRef.current = true;
    setRoomFocused(true);
    const normalized = value.trim().toLowerCase();
    const exact = ROOM_OPTIONS.find(
      (option) =>
        option.number.toLowerCase() === normalized ||
        option.label.toLowerCase() === normalized ||
        `${option.label} ${option.teacher}`.toLowerCase() === normalized,
    );
    if (exact) {
      setRoomQuery(exact.label);
      setRoomNumber(exact.number);
      if (!teacherManuallyEditedRef.current && !teacherName && !teacherQuery.trim()) {
        setTeacherName(exact.teacher);
        setTeacherQuery(exact.teacher);
      }
      setPresentIds(new Set(exact.roster.map((s) => s.id)));
    } else {
      setRoomNumber("");
      if (!teacherManuallyEditedRef.current && !teacherName && !teacherQuery.trim()) {
        setTeacherName("");
        setTeacherQuery("");
      }
      setPresentIds(new Set());
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
    if (!checkInReady) {
      setError("Firebase is not configured.");
      return;
    }
    if (!room) {
      setError("Select your teacher or room from the list.");
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
            note,
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
            note,
            transcript: null,
            inputMode: "checkbox" as const,
          };

    if (payload.presentIds.length === 0 && payload.missingIds.length === 0) {
      setError("Mark who is present or say your roll call out loud.");
      return;
    }

    setSubmitting(true);
    try {
      await submitTeacherRoomReportClient(payload);
      setSubmitted(true);
      speech.stop();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }, [
    checkInReady,
    room,
    mode,
    yap,
    roomNumber,
    teacherName,
    note,
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
      {localMode ? (
        <p className="rounded-lg border border-sky-900/40 bg-sky-950/30 px-3 py-2 text-sm text-sky-200">
          Live demo · roll call syncs to the staff dashboard in real time
        </p>
      ) : !firebaseReady ? (
        <p className="rounded-lg border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          Firebase env vars missing — configure to submit roll call.
        </p>
      ) : null}

      {mode === "voice" ? (
        <section className="rounded-xl border border-[#232a35] bg-[#0c0f13] p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[#64748b]">
            AI Autofill
          </p>
          <div className="mt-3">
            <VoiceCapture
              supported={speech.supported}
              listening={speech.listening}
              liveText={speech.liveText}
              onToggleListen={speech.toggle}
              onClear={speech.reset}
              editable
              onLiveTextChange={speech.setTranscript}
              transcriptPlaceholder={`Example: "I'm Mr. Blake in room 707, and I have everyone but Maria Garcia"`}
            />
          </div>
        </section>
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
          Teacher
        </span>
        <div className="relative">
          <input
            value={teacherQuery}
            onChange={(e) => onTeacherChange(e.target.value)}
            onFocus={() => setTeacherFocused(true)}
            onBlur={() => setTeacherFocused(false)}
            placeholder="Type your name"
            autoComplete="off"
            role="combobox"
            aria-expanded={teacherFocused}
            aria-controls="teacher-options"
            className="w-full rounded-xl border border-[#2a3340] bg-[#0c0f13] px-3 py-3 text-base text-[#f8fafc] outline-none focus:border-[#475569]"
          />
          {teacherFocused ? (
            <div
              id="teacher-options"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#2a3340] bg-[#0c0f13] shadow-xl shadow-black/30"
              role="listbox"
            >
              {teacherMatches.length > 0 ? (
                teacherMatches.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectTeacher(option)}
                    className="flex w-full items-center justify-between gap-3 border-b border-[#1a212b] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#12161d]"
                    role="option"
                    aria-selected={roomNumber === option.roomNumber}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[#f8fafc]">
                        {option.teacher}
                      </span>
                      <span className="block text-xs text-[#64748b]">{option.roomLabel}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-3 text-sm text-[#94a3b8]">No matching teachers</p>
              )}
            </div>
          ) : null}
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748b]">
          Room
        </span>
        <div className="relative">
          <input
            value={roomQuery}
            onChange={(e) => onRoomChange(e.target.value)}
            onFocus={() => setRoomFocused(true)}
            onBlur={() => setRoomFocused(false)}
            placeholder="Type room number"
            autoComplete="off"
            role="combobox"
            aria-expanded={roomFocused}
            aria-controls="room-options"
            className="w-full rounded-xl border border-[#2a3340] bg-[#0c0f13] px-3 py-3 text-base text-[#f8fafc] outline-none focus:border-[#475569]"
          />
          {roomFocused ? (
            <div
              id="room-options"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#2a3340] bg-[#0c0f13] shadow-xl shadow-black/30"
              role="listbox"
            >
              {roomMatches.length > 0 ? (
                roomMatches.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectRoom(option)}
                    className="flex w-full items-center justify-between gap-3 border-b border-[#1a212b] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#12161d]"
                    role="option"
                    aria-selected={roomNumber === option.number}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[#f8fafc]">
                        {option.label}
                      </span>
                      <span className="block text-xs text-[#64748b]">{option.teacher}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-3 text-sm text-[#94a3b8]">No matching rooms</p>
              )}
            </div>
          ) : null}
        </div>
      </label>

      {mode === "voice" ? (
        <>
          <ParsePreview
            summary={yap.summary}
            unmatched={yap.unmatchedMissing}
            selectedRoom={roomNumber}
            spokenRoom={yap.spokenRoomNumber}
            submitRoom={yap.effectiveRoomNumber}
            parsing={gemini.parsing}
            parseSource={parseSource}
            warning={gemini.warning}
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

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748b]">
          Notes
        </span>
        <textarea
          value={note}
          onChange={(event) => {
            noteManuallyEditedRef.current = true;
            setNote(event.target.value);
          }}
          placeholder="Injuries, blocked exits, extra people, medical needs, or other details..."
          className="min-h-[84px] w-full resize-none rounded-xl border border-[#2a3340] bg-[#0c0f13] px-3 py-3 text-base text-[#f8fafc] outline-none placeholder:text-[#475569] focus:border-[#475569]"
        />
      </label>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={submitting || !checkInReady || !roomNumber}
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
  parsing,
  parseSource,
  warning,
}: {
  summary: string;
  unmatched: string[];
  selectedRoom: string;
  spokenRoom: string | null;
  submitRoom: string;
  parsing: boolean;
  parseSource: "gemini" | "regex" | null;
  warning: string | null;
}) {
  return (
    <div className="rounded-xl border border-[#232a35] bg-[#0c0f13] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#64748b]">
          Parsed roll call
        </p>
        {parsing ? (
          <span className="text-[10px] text-sky-400/90">Understanding…</span>
        ) : parseSource === "gemini" ? (
          <span className="text-[10px] text-violet-400/90">Gemini</span>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-[#94a3b8]">
        Submitting as room <span className="font-mono text-[#e2e8f0]">{submitRoom}</span>
        {spokenRoom
          ? " · heard in voice"
          : ` · selected room (${selectedRoom})`}
      </p>
      <p className="mt-1 text-sm text-[#e2e8f0]">{summary}</p>
      {unmatched.length > 0 ? (
        <p className="mt-2 text-[10px] text-amber-400/90">
          Unmatched names: {unmatched.join(", ")} — fix in roster tab if needed
        </p>
      ) : null}
      {warning ? (
        <p className="mt-2 text-[10px] text-amber-400/80">Fallback: {warning}</p>
      ) : null}
    </div>
  );
}
