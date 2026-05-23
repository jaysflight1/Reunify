"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Status } from "@/lib/demo-data";
import { EXAMPLE_STUDENTS, type ExampleStudent } from "@/lib/demo/example-students";
import { isLocalCheckInMode } from "@/lib/check-in/local-mode";
import { submitStudentReportClient } from "@/lib/check-in/submit-reports";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { ensureStudentAuth } from "@/lib/firebase/reports";
import {
  fetchRoomsFromFirestore,
  fallbackRooms,
  mergeRoomsWithFallback,
  type FirestoreRoom,
} from "@/lib/firebase/rooms";
import type { GeoLocation } from "@/lib/firebase/types";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { EmergencyHelpPanel } from "@/components/student/emergency-help-panel";
import { LocationSharedStatus } from "@/components/student/location-shared-status";
import { Simulated911Button } from "@/components/student/simulated-911-button";
import { VoiceCapture } from "@/components/teacher/voice-capture";

type FormState = {
  studentName: string;
  studentId: string;
  grade: string;
  status: Status;
  offCampus: boolean;
  roomNumber: string;
  teacherName: string;
  note: string;
};

type StudentTranscriptParseResult = {
  source: "gemini" | "regex";
  warning?: string;
  result: {
    studentId: string | null;
    studentName: string | null;
    status: "safe" | "unsafe" | "unknown";
    offCampus: boolean | null;
    roomNumber: string | null;
    teacherName: string | null;
    shooterNearby: boolean | null;
    note: string | null;
    confidence: number;
  };
};

export function CheckInForm() {
  const speech = useSpeechRecognition();
  const [rooms, setRooms] = useState<FirestoreRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [identityQuery, setIdentityQuery] = useState("");
  const [identityFocused, setIdentityFocused] = useState(false);
  const [roomQuery, setRoomQuery] = useState("");
  const [roomFocused, setRoomFocused] = useState(false);
  const [form, setForm] = useState<FormState>({
    studentName: "",
    studentId: "",
    grade: "",
    status: "safe",
    offCampus: false,
    roomNumber: "",
    teacherName: "",
    note: "",
  });
  const [shooterNearby, setShooterNearby] = useState(false);
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [locStatus, setLocStatus] = useState<"idle" | "loading" | "ok" | "denied">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseStatus, setParseStatus] = useState<"idle" | "parsing" | "applied">("idle");
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const firebaseReady = isFirebaseConfigured();
  const localMode = isLocalCheckInMode();
  const checkInReady = firebaseReady || localMode;
  const onCampus = form.status === "safe" && !form.offCampus;
  const needHelp = form.status === "unsafe";
  const needsRoom = onCampus;
  const identityMatches = useMemo(() => {
    const query = identityQuery.trim().toLowerCase();
    const matches = query
      ? EXAMPLE_STUDENTS.filter((student) => {
          const searchable = `${student.fullName} ${student.id}`.toLowerCase();
          return searchable.includes(query);
        })
      : EXAMPLE_STUDENTS;
    return matches.slice(0, 8);
  }, [identityQuery]);
  const roomOptions = useMemo(
    () =>
      [...rooms].sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" }),
      ),
    [rooms],
  );
  const roomMatches = useMemo(() => {
    const query = roomQuery.trim().toLowerCase();
    const matches = query
      ? roomOptions.filter((room) => {
          const searchable = `${room.number} ${room.label} ${room.teacher} ${room.building}`.toLowerCase();
          return searchable.includes(query);
        })
      : roomOptions;
    return matches;
  }, [roomOptions, roomQuery]);
  const roomDisplayLabel = (room: FirestoreRoom) => room.label;

  const selectIdentity = (student: ExampleStudent) => {
    setForm((f) => ({
      ...f,
      studentName: student.fullName,
      studentId: student.id,
      grade: student.grade,
    }));
    setIdentityQuery(`${student.fullName} (${student.id})`);
    setIdentityFocused(false);
  };

  const onIdentityChange = (value: string) => {
    setIdentityQuery(value);
    setIdentityFocused(true);
    setForm((f) => ({
      ...f,
      studentName: "",
      studentId: "",
      grade: "",
    }));
  };

  const selectRoom = (room: FirestoreRoom) => {
    setRoomQuery(roomDisplayLabel(room));
    setRoomFocused(false);
    setForm((f) => ({ ...f, roomNumber: room.number, teacherName: room.teacher }));
  };

  const onRoomChange = (value: string) => {
    setRoomQuery(value);
    setRoomFocused(true);
    const normalized = value.trim().toLowerCase();
    const exactMatch = roomOptions.find((room) => {
      const visibleLabel = roomDisplayLabel(room).toLowerCase();
      const buildingLabel = `${room.label} · ${room.building}`.toLowerCase();
      const teacherName = room.teacher.toLowerCase();
      return (
        room.number.toLowerCase() === normalized ||
        room.label.toLowerCase() === normalized ||
        teacherName === normalized ||
        visibleLabel === normalized ||
        buildingLabel === normalized
      );
    });
    setForm((f) => ({
      ...f,
      roomNumber: exactMatch?.number ?? "",
      teacherName: exactMatch?.teacher ?? "",
    }));
  };

  const applyParsedTranscript = useCallback(
    (parsed: StudentTranscriptParseResult["result"]) => {
      const student = parsed.studentId
        ? EXAMPLE_STUDENTS.find((candidate) => candidate.id === parsed.studentId)
        : null;
      const room = parsed.roomNumber
        ? roomOptions.find((candidate) => candidate.number === parsed.roomNumber)
        : null;
      const selectedRoom = room ?? roomOptions.find((candidate) => candidate.teacher === parsed.teacherName);

      if (student) {
        setIdentityQuery(`${student.fullName} (${student.id})`);
      }
      if (selectedRoom) {
        setRoomQuery(roomDisplayLabel(selectedRoom));
      }

      setForm((f) => ({
        ...f,
        studentName: student?.fullName ?? f.studentName,
        studentId: student?.id ?? f.studentId,
        grade: student?.grade ?? f.grade,
        status:
          parsed.status === "safe" || parsed.status === "unsafe" ? parsed.status : f.status,
        offCampus: parsed.offCampus ?? f.offCampus,
        roomNumber: selectedRoom?.number ?? f.roomNumber,
        teacherName: selectedRoom?.teacher ?? f.teacherName,
        note: f.note || parsed.note || "",
      }));
      if (parsed.shooterNearby != null) {
        setShooterNearby(parsed.shooterNearby);
      }
    },
    [roomOptions],
  );

  const loadRooms = useCallback(async () => {
    const local = fallbackRooms();
    if (!firebaseReady) {
      setRooms(local);
      setRoomsLoading(false);
      return;
    }
    try {
      await ensureStudentAuth();
      setAuthReady(true);
      const remote = await fetchRoomsFromFirestore();
      const list = remote.length > 0 ? mergeRoomsWithFallback(remote) : local;
      setRooms(list);
      setForm((f) => {
        return {
          ...f,
          roomNumber: f.roomNumber,
          teacherName: f.teacherName,
        };
      });
    } catch (err) {
      setRooms(local);
      setAuthReady(false);
      setError(err instanceof Error ? err.message : "Could not connect to Firebase.");
    } finally {
      setRoomsLoading(false);
    }
  }, [firebaseReady]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    const transcript = speech.liveText.trim();
    if (speech.listening || transcript.length < 8) {
      setParseStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setParseStatus("parsing");
      setParseWarning(null);
      void (async () => {
        try {
          const response = await fetch("/api/student/parse-transcript", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript }),
            signal: controller.signal,
          });
          const json = (await response.json()) as StudentTranscriptParseResult & { error?: string };
          if (!response.ok) throw new Error(json.error ?? "Could not parse transcript.");
          if (controller.signal.aborted) return;
          applyParsedTranscript(json.result);
          setParseWarning(json.warning ?? null);
          setParseStatus("applied");
        } catch (err) {
          if (controller.signal.aborted) return;
          setParseWarning(err instanceof Error ? err.message : "Could not parse transcript.");
          setParseStatus("idle");
        }
      })();
    }, 700);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [applyParsedTranscript, speech.listening, speech.liveText]);

  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocStatus("denied");
      return;
    }
    setLocStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocStatus("ok");
      },
      () => setLocStatus("denied"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.studentId || !form.studentName) {
      setError("Select your name or student ID from the list.");
      return;
    }
    if (!checkInReady) {
      setError("Check-in is offline. Firebase is not configured yet.");
      return;
    }
    if (needsRoom && !form.roomNumber) {
      setError("Select the room you are in.");
      return;
    }

    setSubmitting(true);
    try {
      const voiceNote = speech.liveText.trim();
      await submitStudentReportClient({
        studentName: form.studentName,
        studentId: form.studentId,
        grade: form.grade,
        status: form.status,
        offCampus: form.offCampus && form.status === "safe",
        shooterNearby: needHelp ? shooterNearby : undefined,
        roomNumber: needsRoom ? form.roomNumber : "",
        teacherName: needsRoom ? form.teacherName : "",
        location,
        note: form.note || voiceNote || undefined,
      });
      setSubmitted(true);
      speech.stop();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    const emergency = needHelp;
    return (
      <div
        className={`rounded-xl border p-6 text-center ${
          emergency
            ? "border-rose-900/50 bg-rose-950/30"
            : "border-emerald-900/50 bg-emerald-950/30"
        }`}
      >
        <p
          className={`text-lg font-semibold ${emergency ? "text-rose-300" : "text-emerald-300"}`}
        >
          {emergency ? "Help alert sent" : "Report sent"}
        </p>
        <p className="mt-2 text-sm text-[#94a3b8]">
          {emergency
            ? "Staff see your alert and location if shared. Use your own phone to call 911 in a real emergency."
            : "Staff can see your status. You can close this page or send an update below."}
        </p>
        {emergency ? (
          <div className="mt-4">
            <Simulated911Button className="py-3 text-sm" />
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-4 text-sm text-[#94a3b8] underline underline-offset-2"
        >
          Update my status
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {localMode ? (
        <p className="rounded-lg border border-sky-900/40 bg-sky-950/30 px-3 py-2 text-sm text-sky-200">
          Live demo · your report appears on the staff dashboard in real time
        </p>
      ) : !firebaseReady ? (
        <p className="rounded-lg border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          Firebase env vars missing — form is preview only until configured.
        </p>
      ) : authReady ? (
        <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300/90">
          Connected · your report is private to staff
        </p>
      ) : null}

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
            idleText="Tap and say anything staff should know"
            unsupportedText="Voice not supported in this browser"
            transcriptPlaceholder="Example: I'm Lydia Chen in room 602 with Ms. Rivera and I am safe."
          />
        </div>

        {parseStatus !== "idle" || parseWarning ? (
          <p className="mt-3 text-xs text-[#64748b]">
            {parseStatus === "parsing"
              ? "AI is reading the transcript..."
              : parseWarning
                ? `Transcript parser used fallback: ${parseWarning}`
                : "Transcript details applied to the form."}
          </p>
        ) : null}
      </section>

      <Field label="Name / Student ID" required>
        <div className="relative">
          <input
            className={inputClass}
            value={identityQuery}
            onChange={(e) => onIdentityChange(e.target.value)}
            onFocus={() => setIdentityFocused(true)}
            onBlur={() => setIdentityFocused(false)}
            placeholder="Type your name or student ID"
            autoComplete="off"
            role="combobox"
            aria-expanded={identityFocused}
            aria-controls="student-identity-options"
          />
          {identityFocused ? (
            <div
              id="student-identity-options"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#2a3340] bg-[#0c0f13] shadow-xl shadow-black/30"
              role="listbox"
            >
              {identityMatches.length > 0 ? (
                identityMatches.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectIdentity(student)}
                    className="flex w-full items-center justify-between gap-3 border-b border-[#1a212b] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#12161d]"
                    role="option"
                    aria-selected={form.studentId === student.id}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[#f8fafc]">
                        {student.fullName}
                      </span>
                      <span className="block text-xs text-[#64748b]">{student.id}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-3 text-sm text-[#94a3b8]">No matching students</p>
              )}
            </div>
          ) : null}
        </div>
      </Field>

      <Field label="How are you?" required>
        <div className="grid grid-cols-2 gap-2">
          <StatusButton
            active={form.status === "safe" && !form.offCampus}
            tone="safe"
            onClick={() => setForm((f) => ({ ...f, status: "safe", offCampus: false }))}
          >
            Safe · on campus
          </StatusButton>
          <StatusButton
            active={form.status === "unsafe"}
            tone="unsafe"
            onClick={() => setForm((f) => ({ ...f, status: "unsafe", offCampus: false }))}
          >
            I need help
          </StatusButton>
        </div>
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, status: "safe", offCampus: true }))}
          className={`mt-2 w-full rounded-lg border px-3 py-3.5 text-sm font-semibold transition ${
            form.status === "safe" && form.offCampus
              ? "border-sky-600 bg-sky-950/40 text-sky-300"
              : "border-[#2a3340] bg-[#12161d] text-[#94a3b8]"
          }`}
        >
          Safe · off campus
        </button>
        {form.offCampus ? (
          <p className="mt-2 text-xs leading-relaxed text-[#94a3b8]">
            You don&apos;t need a room or teacher — share location below if you can.
          </p>
        ) : null}
      </Field>

      {needHelp ? (
        <EmergencyHelpPanel
          shooterNearby={shooterNearby}
          onShooterNearbyChange={setShooterNearby}
          locStatus={locStatus}
          onCaptureLocation={captureLocation}
        />
      ) : null}

      {needsRoom ? (
        <>
          <Field label="Room" required>
            <div className="relative">
              <input
                className={inputClass}
                value={roomQuery}
                disabled={roomsLoading}
                onChange={(e) => onRoomChange(e.target.value)}
                onFocus={() => setRoomFocused(true)}
                onBlur={() => setRoomFocused(false)}
                placeholder={roomsLoading ? "Loading rooms..." : "Type room number"}
                autoComplete="off"
                role="combobox"
                aria-expanded={roomFocused}
                aria-controls="room-options"
              />
              {roomFocused ? (
                <div
                  id="room-options"
                  className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#2a3340] bg-[#0c0f13] shadow-xl shadow-black/30"
                  role="listbox"
                >
                  {roomMatches.length > 0 ? (
                    roomMatches.map((room) => (
                      <button
                        key={room.number}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectRoom(room)}
                        className="flex w-full items-center justify-between gap-3 border-b border-[#1a212b] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#12161d]"
                        role="option"
                        aria-selected={form.roomNumber === room.number}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-[#f8fafc]">
                            {room.label}
                          </span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-3 text-sm text-[#94a3b8]">No matching rooms</p>
                  )}
                </div>
              ) : null}
            </div>
          </Field>
        </>
      ) : null}

      {!needHelp ? (
        <LocationSharedStatus locStatus={locStatus} onCaptureLocation={captureLocation} />
      ) : null}

      <Field label="Anything else staff should know">
        <textarea
          className="min-h-[80px] w-full resize-none rounded-lg border border-[#2a3340] bg-[#0c0f13] px-3 py-3 text-base text-[#f8fafc] outline-none focus:border-[#475569]"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          placeholder="Injured, trapped, with others, or any detail staff should see..."
        />
      </Field>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting || (needsRoom && roomsLoading)}
        className="mt-2 w-full rounded-xl bg-[#e2e8f0] py-4 text-base font-semibold text-[#0c0f13] disabled:opacity-50"
      >
        {submitting ? "Sending…" : needHelp ? "Send help alert" : "Send status to staff"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-[#2a3340] bg-[#0c0f13] px-3 py-3 text-base text-[#f8fafc] outline-none focus:border-[#475569]";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748b]">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function StatusButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "safe" | "unsafe";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeClass =
    tone === "safe"
      ? "border-emerald-600 bg-emerald-950/50 text-emerald-300"
      : "border-rose-600 bg-rose-950/50 text-rose-300";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-4 text-sm font-semibold transition ${
        active ? activeClass : "border-[#2a3340] bg-[#12161d] text-[#94a3b8]"
      }`}
    >
      {children}
    </button>
  );
}
