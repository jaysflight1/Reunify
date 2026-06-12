"use client";

import { useEffect, useRef, useState } from "react";
import { HomeLogoLink } from "@/components/layout/home-logo-link";
import {
  formatStudentIdentity,
  StudentIdentityPicker,
} from "@/components/student/student-identity-picker";
import { Simulated911Button } from "@/components/student/simulated-911-button";
import { EXAMPLE_STUDENTS, type ExampleStudent } from "@/lib/demo/example-students";
import {
  deactivateBeaconReport,
  submitBeaconReport,
} from "@/lib/student/beacon";
import {
  fallbackStudentBroadcasts,
  subscribeToStudentBroadcasts,
  type StudentBroadcast,
} from "@/lib/student/broadcasts";
import {
  submitSafeStatusReport,
  submitUpdateStatusReport,
} from "@/lib/student/status-actions";
import type { GeoLocation } from "@/lib/firebase/types";

const SELECTED_STUDENT_STORAGE_KEY = "reunify:selected-student";
const BEACON_ID_STORAGE_KEY = "reunify:beacon-id";
const HOLD_MS = 1000;
const SAFETY_TIPS = [
  "If you can escape safely, run away from danger — leave belongings behind.",
  "If you cannot get out, lock and barricade the door. Turn off lights and silence your phone.",
  "Stay quiet and out of sight. Do not open the door unless police clearly identify themselves.",
  "Text or message only if it is safe — do not reveal your hiding place aloud.",
];

type ViewMode = "home" | "beacon" | "safe" | "update";
type BeaconState = "idle" | "activating" | "activated" | "deactivating";

function loadStoredStudent(): ExampleStudent | null {
  if (typeof window === "undefined") return null;
  const storedId = window.localStorage.getItem(SELECTED_STUDENT_STORAGE_KEY);
  if (!storedId) return null;
  return EXAMPLE_STUDENTS.find((student) => student.id === storedId) ?? null;
}

function storeSelectedStudent(student: ExampleStudent): void {
  window.localStorage.setItem(SELECTED_STUDENT_STORAGE_KEY, student.id);
}

function getOrCreateBeaconId(): string {
  const existing = window.localStorage.getItem(BEACON_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(BEACON_ID_STORAGE_KEY, generated);
  return generated;
}

function currentLocation(): Promise<GeoLocation | null> {
  if (!navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}

function broadcastTone(priority: StudentBroadcast["priority"]): string {
  void priority;
  return "border-orange-300 bg-orange-300 text-black";
}

function secondaryBroadcastTone(priority: StudentBroadcast["priority"], index: number): string {
  void priority;
  return index === 0
    ? "border-sky-300 bg-sky-300 text-black"
    : "border-violet-300 bg-violet-300 text-black";
}

function MessagePortal({
  message,
  emptyText,
}: {
  message: string | null;
  emptyText: string;
}) {
  return (
    <div
      className="mt-3 min-h-16 rounded-md border border-[#6b7280] bg-[#d1d5db] px-3 py-2"
      aria-label={message ? "Message" : emptyText}
    >
      {message ? (
        <p className="text-xs font-medium leading-relaxed text-black">{message}</p>
      ) : (
        <p className="text-xs font-semibold text-black">{emptyText}</p>
      )}
    </div>
  );
}

export function StudentHome() {
  const [mode, setMode] = useState<ViewMode>("home");
  const [selectedStudent, setSelectedStudent] = useState<ExampleStudent | null>(null);
  const [identityQuery, setIdentityQuery] = useState("");
  const [broadcasts, setBroadcasts] = useState<StudentBroadcast[]>(fallbackStudentBroadcasts);
  const [beaconState, setBeaconState] = useState<BeaconState>("idle");
  const [beaconError, setBeaconError] = useState<string | null>(null);
  const [beaconLocation, setBeaconLocation] = useState<GeoLocation | null>(null);
  const [beaconNote, setBeaconNote] = useState("");
  const [detailsSubmitting, setDetailsSubmitting] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [holdActive, setHoldActive] = useState(false);
  const holdTimerRef = useRef<number | null>(null);

  const primaryBroadcast = broadcasts[0] ?? fallbackStudentBroadcasts[0];
  useEffect(() => {
    const student = loadStoredStudent();
    if (!student) return;
    setSelectedStudent(student);
    setIdentityQuery(formatStudentIdentity(student));
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;

    void subscribeToStudentBroadcasts(
      (next) => {
        if (active) setBroadcasts(next);
      },
      (error) => {
        if (active) console.warn(error.message);
      },
    ).then((unsubscribe) => {
      cleanup = unsubscribe;
      if (!active) cleanup();
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  const selectStudent = (student: ExampleStudent) => {
    setSelectedStudent(student);
    setIdentityQuery(formatStudentIdentity(student));
    storeSelectedStudent(student);
    setBeaconError(null);
    setDetailsMessage(null);
    setStatusError(null);
  };

  const updateIdentityQuery = (value: string) => {
    setIdentityQuery(value);
    setSelectedStudent(null);
    setBeaconError(null);
    setDetailsMessage(null);
    setStatusError(null);
  };

  const activateBeacon = async () => {
    setBeaconError(null);
    if (beaconState !== "idle") return;

    const beaconId = getOrCreateBeaconId();
    setBeaconState("activating");
    setMode("beacon");
    try {
      await submitBeaconReport(selectedStudent, { beaconId });
      setBeaconState("activated");
      void currentLocation().then(async (location) => {
        if (!location) return;
        setBeaconLocation(location);
        try {
          await submitBeaconReport(selectedStudent, { beaconId, location });
        } catch {
          // The original alert has already been sent; location enrichment is best effort.
        }
      });
    } catch (err) {
      setBeaconState("idle");
      setMode("home");
      setBeaconError(err instanceof Error ? err.message : "Could not activate Beacon. Try again.");
    }
  };

  const deactivateBeacon = async () => {
    setBeaconError(null);
    if (beaconState !== "activated") return;

    setBeaconState("deactivating");
    try {
      await deactivateBeaconReport(selectedStudent, {
        beaconId: getOrCreateBeaconId(),
        location: beaconLocation,
      });
      setBeaconState("idle");
      setMode("home");
      setDetailsMessage(null);
    } catch (err) {
      setBeaconState("activated");
      setBeaconError(err instanceof Error ? err.message : "Could not deactivate Beacon. Try again.");
    }
  };

  const submitBeaconDetails = async () => {
    setBeaconError(null);
    setDetailsMessage(null);
    setDetailsSubmitting(true);
    try {
      await submitBeaconReport(selectedStudent, {
        beaconId: getOrCreateBeaconId(),
        location: beaconLocation,
        note: beaconNote || undefined,
      });
      setDetailsMessage("Details sent to staff.");
    } catch (err) {
      setBeaconError(err instanceof Error ? err.message : "Could not send details. Try again.");
    } finally {
      setDetailsSubmitting(false);
    }
  };

  const openAction = (nextMode: "safe" | "update") => {
    setStatusNote("");
    setStatusMessage(null);
    setStatusError(null);
    setMode(nextMode);
  };

  const submitSafeAction = async () => {
    setStatusError(null);
    setStatusMessage(null);
    if (!selectedStudent) {
      setStatusError("Select your name before sending a safe status.");
      return;
    }

    setStatusSubmitting(true);
    try {
      const location = await currentLocation();
      await submitSafeStatusReport(selectedStudent, {
        location,
        note: statusNote || undefined,
      });
      setStatusMessage("Safe status sent.");
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Could not send safe status.");
    } finally {
      setStatusSubmitting(false);
    }
  };

  const submitUpdateAction = async () => {
    setStatusError(null);
    setStatusMessage(null);
    if (!selectedStudent) {
      setStatusError("Select your name before sending an update.");
      return;
    }
    if (!statusNote.trim()) {
      setStatusError("Tell staff what they should know.");
      return;
    }

    setStatusSubmitting(true);
    try {
      const location = await currentLocation();
      await submitUpdateStatusReport(selectedStudent, {
        location,
        note: statusNote,
      });
      setStatusMessage("Update sent to staff.");
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Could not send update.");
    } finally {
      setStatusSubmitting(false);
    }
  };

  const clearHoldTimer = () => {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldActive(false);
  };

  const startBeaconHold = () => {
    if (beaconState === "activating" || beaconState === "deactivating") return;
    clearHoldTimer();
    setHoldActive(true);
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      setHoldActive(false);
      if (beaconState === "activated") {
        void deactivateBeacon();
        return;
      }
      void activateBeacon();
    }, HOLD_MS);
  };

  useEffect(() => {
    return () => clearHoldTimer();
  }, []);

  return (
    <div className="min-h-screen bg-[#06080a] text-[#e2e8f0]">
      <header className="border-b border-[#232a35] px-4 py-4">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <HomeLogoLink />
          <p className="shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-black">
            Student
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-3 px-4 py-3 pb-64">
        {mode === "beacon" ? (
          <BeaconDetails
            selectedStudent={selectedStudent}
            identityQuery={identityQuery}
            onIdentityQueryChange={updateIdentityQuery}
            onSelectStudent={selectStudent}
            beaconNote={beaconNote}
            onBeaconNoteChange={setBeaconNote}
            onSubmitDetails={() => void submitBeaconDetails()}
            submitting={detailsSubmitting}
            detailsMessage={detailsMessage}
            beaconState={beaconState}
            onBack={() => setMode("home")}
          />
        ) : mode === "safe" || mode === "update" ? (
          <StatusActionDetails
            mode={mode}
            selectedStudent={selectedStudent}
            identityQuery={identityQuery}
            onIdentityQueryChange={updateIdentityQuery}
            onSelectStudent={selectStudent}
            note={statusNote}
            onNoteChange={setStatusNote}
            onBack={() => setMode("home")}
            onSubmit={() => {
              if (mode === "safe") {
                void submitSafeAction();
                return;
              }
              void submitUpdateAction();
            }}
            submitting={statusSubmitting}
            message={statusMessage}
            error={statusError}
          />
        ) : (
          <>
            <section className={`rounded-none border-2 p-3 shadow-md ${broadcastTone(primaryBroadcast.priority)}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black">
                Active incident
              </p>
              <h1 className="mt-2 text-2xl font-black leading-tight">
                {primaryBroadcast.title}
              </h1>
              <p className="mt-3 text-base leading-relaxed">{primaryBroadcast.message}</p>
            </section>

            <section
              className={`min-h-[7.5rem] rounded-none border-2 p-3 shadow-md ${secondaryBroadcastTone(primaryBroadcast.priority, 0)}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black">
                Admin Announcements
              </p>
              <MessagePortal message={null} emptyText="No announcements yet" />
            </section>

            <section
              className={`min-h-[7.5rem] rounded-none border-2 p-3 shadow-md ${secondaryBroadcastTone(primaryBroadcast.priority, 1)}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black">
                Parent Messages
              </p>
              <MessagePortal message={null} emptyText="No messages yet" />
            </section>
          </>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#2a1118] bg-[#06080a]/98 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          {mode === "home" ? (
            <section className="grid grid-cols-2 gap-3">
              <ActionButton
                label="I'm Safe"
                detail="Tell staff you are safe"
                tone="safe"
                onClick={() => openAction("safe")}
              />
              <ActionButton
                label="Update Status"
                detail="Send notes or injuries"
                tone="update"
                onClick={() => openAction("update")}
              />
            </section>
          ) : null}

          <div className="flex flex-col items-center">
            <button
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                startBeaconHold();
              }}
              onPointerUp={clearHoldTimer}
              onPointerCancel={clearHoldTimer}
              onPointerLeave={clearHoldTimer}
              disabled={beaconState === "activating" || beaconState === "deactivating"}
              className={`flex h-32 w-32 items-center justify-center rounded-full border-4 text-center text-lg font-black text-white shadow-xl transition disabled:opacity-70 ${
                beaconState === "activated"
                  ? "border-rose-300 bg-rose-800 shadow-rose-950/60"
                  : "border-rose-400 bg-rose-600 shadow-rose-950/50"
              } ${holdActive ? "scale-95 ring-4 ring-rose-200/60" : ""}`}
              aria-label={
                beaconState === "activated"
                  ? "Hold to deactivate Emergency Beacon"
                  : "Hold to activate Emergency Beacon"
              }
            >
              {beaconState === "activating"
                ? "Activating"
                : beaconState === "deactivating"
                  ? "Deactivating"
                  : beaconState === "activated"
                    ? "Emergency on"
                    : (
                        <span className="leading-tight">
                          Emergency
                          <br />
                          Beacon
                        </span>
                      )}
            </button>
          <p className="mt-2 text-center text-xs text-black">
            {holdActive
              ? "Keep holding..."
              : beaconState === "activated"
                ? "Hold 1 second to deactivate Emergency Beacon."
                : "Hold 1 second to activate Emergency Beacon."}
          </p>
          {beaconError ? (
            <p className="mt-2 rounded-lg border border-rose-300 bg-rose-600 px-3 py-2 text-sm font-semibold text-white">
              {beaconError}
            </p>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  detail,
  tone,
  onClick,
}: {
  label: string;
  detail: string;
  tone: "safe" | "update";
  onClick: () => void;
}) {
  const toneClass =
    tone === "safe"
      ? "border-emerald-300 bg-emerald-500 text-emerald-950 shadow-emerald-950/35"
      : "border-yellow-200 bg-yellow-400 text-yellow-950 shadow-yellow-950/30";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border-4 px-5 py-5 text-left shadow-xl transition hover:brightness-105 active:translate-y-px active:scale-[0.98] ${toneClass}`}
    >
      <span className="block text-lg font-black">{label}</span>
      <span className="mt-1 block text-sm font-semibold leading-relaxed opacity-85">{detail}</span>
    </button>
  );
}

function StatusActionDetails({
  mode,
  selectedStudent,
  identityQuery,
  onIdentityQueryChange,
  onSelectStudent,
  note,
  onNoteChange,
  onBack,
  onSubmit,
  submitting,
  message,
  error,
}: {
  mode: "safe" | "update";
  selectedStudent: ExampleStudent | null;
  identityQuery: string;
  onIdentityQueryChange: (value: string) => void;
  onSelectStudent: (student: ExampleStudent) => void;
  note: string;
  onNoteChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  message: string | null;
  error: string | null;
}) {
  const safe = mode === "safe";

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="self-start rounded-full border border-[#334155] bg-[#111827] px-3 py-1.5 text-xs font-medium text-[#cbd5e1]"
      >
        Back
      </button>

      <section
        className={`rounded-2xl border-2 p-3 shadow-lg ${
          safe
            ? "border-emerald-200 bg-emerald-400 text-emerald-950 shadow-emerald-950/25"
            : "border-yellow-200 bg-yellow-300 text-yellow-950 shadow-yellow-950/25"
        }`}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.14em] opacity-75">
          Status update
        </p>
        <h1 className="mt-2 text-2xl font-black">
          {safe ? "I'm Safe" : "Update Status"}
        </h1>
        <p className="mt-2 text-sm font-medium leading-relaxed">
          {safe
            ? "Confirm your name, then send a safe status to staff."
            : "Tell staff what is happening. Include injuries, location details, or who is with you."}
        </p>
      </section>

      <section className="rounded-none border-2 border-slate-300 bg-slate-100 p-3 text-black shadow-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black">
          What&apos;s your name?
        </p>
        <div className="mt-3">
          <StudentIdentityPicker
            query={identityQuery}
            selectedStudentId={selectedStudent?.id}
            onQueryChange={onIdentityQueryChange}
            onSelect={onSelectStudent}
          />
        </div>
        {selectedStudent ? (
          <p className="mt-2 text-xs font-medium text-black">
            Selected: {selectedStudent.fullName} · Grade {selectedStudent.grade}
          </p>
        ) : (
          <p className="mt-2 text-xs text-black">Required before sending this update.</p>
        )}
      </section>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white">
          Optional Note
        </span>
        <textarea
          className="min-h-[110px] w-full resize-none rounded-lg border border-[#2a3340] bg-[#0c0f13] px-3 py-3 text-base text-[#f8fafc] outline-none focus:border-[#475569]"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={
            safe
              ? "Example: I am with Ms. Rivera near the library."
              : "Example: I hurt my ankle near the gym and cannot walk."
          }
        />
      </label>

      {error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-600 px-3 py-2 text-sm font-semibold text-white">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-center text-sm text-emerald-300">{message}</p> : null}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className={`rounded-xl px-4 py-4 text-base font-black shadow-lg transition active:scale-[0.99] disabled:opacity-50 ${
          safe ? "bg-emerald-500 text-emerald-950" : "bg-yellow-400 text-yellow-950"
        }`}
      >
        {submitting ? "Sending..." : safe ? "Send I'm Safe" : "Send Update"}
      </button>
    </>
  );
}

function BeaconDetails({
  selectedStudent,
  identityQuery,
  onIdentityQueryChange,
  onSelectStudent,
  beaconNote,
  onBeaconNoteChange,
  onSubmitDetails,
  submitting,
  detailsMessage,
  beaconState,
  onBack,
}: {
  selectedStudent: ExampleStudent | null;
  identityQuery: string;
  onIdentityQueryChange: (value: string) => void;
  onSelectStudent: (student: ExampleStudent) => void;
  beaconNote: string;
  onBeaconNoteChange: (value: string) => void;
  onSubmitDetails: () => void;
  submitting: boolean;
  detailsMessage: string | null;
  beaconState: BeaconState;
  onBack: () => void;
}) {
  return (
    <>
      <section className="rounded-none border-2 border-orange-400 bg-orange-300 p-3 text-center text-black shadow-md">
        <p className="text-2xl font-black">Emergency Beacon activated</p>
        <p className="mt-1 text-sm font-semibold">Help is on its way</p>
        {beaconState === "activating" ? (
          <p className="mt-2 text-xs">Sending alert to staff...</p>
        ) : null}
      </section>

      <button
        type="button"
        onClick={onBack}
        className="self-start rounded-full border border-[#334155] bg-[#111827] px-3 py-1.5 text-xs font-medium text-[#cbd5e1]"
      >
        Back
      </button>

      <section className="rounded-none border-2 border-slate-300 bg-slate-100 p-3 text-black shadow-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black">
          What&apos;s your name?
        </p>
        <div className="mt-3">
          <StudentIdentityPicker
            query={identityQuery}
            selectedStudentId={selectedStudent?.id}
            onQueryChange={onIdentityQueryChange}
            onSelect={onSelectStudent}
          />
        </div>
        {selectedStudent ? (
          <p className="mt-2 text-xs font-medium text-black">
            Selected: {selectedStudent.fullName} · Grade {selectedStudent.grade}
          </p>
        ) : null}
      </section>

      <Simulated911Button />

      <section className="rounded-none border-2 border-orange-300 bg-orange-300 p-3 text-black shadow-md">
        <p className="text-sm font-black">Stay safe</p>
        <ul className="mt-3 space-y-2">
          {SAFETY_TIPS.map((tip) => (
            <li key={tip} className="flex gap-2 text-xs font-medium leading-relaxed text-black">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-black" />
              {tip}
            </li>
          ))}
        </ul>
      </section>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white">
          Optional Note
        </span>
        <textarea
          className="min-h-[100px] w-full resize-none rounded-lg border border-[#2a3340] bg-[#0c0f13] px-3 py-3 text-base text-[#f8fafc] outline-none focus:border-[#475569]"
          value={beaconNote}
          onChange={(event) => onBeaconNoteChange(event.target.value)}
          placeholder="Injured, trapped, with others, or any detail staff should see..."
        />
      </label>

      <button
        type="button"
        onClick={onSubmitDetails}
        disabled={submitting || beaconState !== "activated"}
        className="rounded-xl bg-[#e2e8f0] px-4 py-4 text-base font-semibold text-[#0c0f13] disabled:opacity-50"
      >
        {submitting ? "Sending..." : "Send details to staff"}
      </button>
      {detailsMessage ? <p className="text-center text-sm text-emerald-300">{detailsMessage}</p> : null}
    </>
  );
}
