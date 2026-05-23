"use client";

import { useCallback, useEffect, useState } from "react";
import type { Status } from "@/lib/demo-data";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { ensureStudentAuth, submitStudentReport } from "@/lib/firebase/reports";
import { fetchRoomsFromFirestore, fallbackRooms, type FirestoreRoom } from "@/lib/firebase/rooms";
import type { GeoLocation } from "@/lib/firebase/types";
import { teacherForRoomOption } from "@/lib/lahs-rooms/room-options";
import { EmergencyHelpPanel } from "@/components/student/emergency-help-panel";
import { LocationSharedStatus } from "@/components/student/location-shared-status";
import { Simulated911Button } from "@/components/student/simulated-911-button";

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

const GRADES = ["9", "10", "11", "12"];

export function CheckInForm() {
  const [rooms, setRooms] = useState<FirestoreRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [form, setForm] = useState<FormState>({
    studentName: "",
    studentId: "",
    grade: "10",
    status: "safe",
    offCampus: false,
    roomNumber: "408",
    teacherName: teacherForRoomOption("408"),
    note: "",
  });
  const [shooterNearby, setShooterNearby] = useState(false);
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [locStatus, setLocStatus] = useState<"idle" | "loading" | "ok" | "denied">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const firebaseReady = isFirebaseConfigured();
  const onCampus = form.status === "safe" && !form.offCampus;
  const needHelp = form.status === "unsafe";
  const needsRoom = onCampus;

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
      const list = remote.length > 0 ? remote : local;
      setRooms(list);
      setForm((f) => ({
        ...f,
        roomNumber: list[0]?.number ?? f.roomNumber,
        teacherName: list[0]?.teacher ?? teacherForRoomOption(list[0]?.number ?? "408"),
      }));
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
    if (!onCampus) return;
    const room = rooms.find((r) => r.number === form.roomNumber);
    if (room) {
      setForm((f) => ({ ...f, teacherName: room.teacher }));
    } else if (form.roomNumber) {
      setForm((f) => ({ ...f, teacherName: teacherForRoomOption(form.roomNumber) }));
    }
  }, [form.roomNumber, rooms, onCampus]);

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

    if (!form.studentName.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!firebaseReady) {
      setError("Check-in is offline. Firebase is not configured yet.");
      return;
    }
    if (needsRoom && !form.roomNumber) {
      setError("Select the room you are in.");
      return;
    }

    setSubmitting(true);
    try {
      await submitStudentReport({
        studentName: form.studentName,
        studentId: form.studentId,
        grade: form.grade,
        status: form.status,
        offCampus: form.offCampus && form.status === "safe",
        shooterNearby: needHelp ? shooterNearby : undefined,
        roomNumber: needsRoom ? form.roomNumber : "",
        teacherName: needsRoom ? form.teacherName : "",
        location,
        note: form.note || undefined,
      });
      setSubmitted(true);
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
      {!firebaseReady ? (
        <p className="rounded-lg border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          Firebase env vars missing — form is preview only until configured.
        </p>
      ) : authReady ? (
        <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300/90">
          Connected · your report is private to staff
        </p>
      ) : null}

      <Field label="Your name" required>
        <input
          className={inputClass}
          value={form.studentName}
          onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))}
          placeholder="First Last"
          autoComplete="name"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Student ID">
          <input
            className={inputClass}
            value={form.studentId}
            onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
            placeholder="School ID"
          />
        </Field>
        <Field label="Grade" required>
          <select
            className={inputClass}
            value={form.grade}
            onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
      </div>

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
          note={form.note}
          onNoteChange={(note) => setForm((f) => ({ ...f, note }))}
        />
      ) : null}

      {needsRoom ? (
        <>
          <Field label="Room you're in" required>
            <select
              className={inputClass}
              value={form.roomNumber}
              disabled={roomsLoading}
              onChange={(e) => setForm((f) => ({ ...f, roomNumber: e.target.value }))}
            >
              {rooms.map((r) => (
                <option key={r.number} value={r.number}>
                  {r.label} · {r.building}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Teacher with you" required>
            <input
              className={inputClass}
              value={form.teacherName}
              onChange={(e) => setForm((f) => ({ ...f, teacherName: e.target.value }))}
            />
          </Field>
        </>
      ) : null}

      {!needHelp ? (
        <LocationSharedStatus locStatus={locStatus} onCaptureLocation={captureLocation} />
      ) : null}

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
