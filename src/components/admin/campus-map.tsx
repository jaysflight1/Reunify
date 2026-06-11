"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { CAMPUS_MAP } from "@/lib/demo-data";
import type { GeneralRoom } from "@/lib/general-rooms";
import type { RoomEvacStats } from "@/lib/room-accounting";
import type { TeacherRoomSnapshot } from "@/lib/evacuation-state";
import type { StudentDot } from "@/lib/student-dots";
import { SchematicCampus } from "./schematic-campus";
import { RoomLayer } from "./room-layer";
import { RoomDetailPanel } from "./room-detail-panel";
import { StudentDotsLayer } from "./student-dots-layer";

type CampusMapProps = {
  unaccountedIds: ReadonlySet<string>;
  roomStatsMap: ReadonlyMap<string, RoomEvacStats>;
  teacherByRoom: ReadonlyMap<string, TeacherRoomSnapshot>;
  studentDots: readonly StudentDot[];
  selectedStudentId?: string | null;
  onSelectStudent?: (studentId: string | null) => void;
};

const VB = `0 0 ${CAMPUS_MAP.viewBox.w} ${CAMPUS_MAP.viewBox.h}`;

export function CampusMap({
  unaccountedIds,
  roomStatsMap,
  teacherByRoom,
  studentDots,
  selectedStudentId,
  onSelectStudent,
}: CampusMapProps) {
  const [selectedRoom, setSelectedRoom] = useState<GeneralRoom | null>(null);
  const [showRoomNumbers, setShowRoomNumbers] = useState(true);
  const [showDots, setShowDots] = useState(true);
  const [hoveredDotId, setHoveredDotId] = useState<string | null>(null);
  const [pinnedDotId, setPinnedDotId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastSelectedStudentIdRef = useRef<string | null | undefined>(undefined);

  const activeDotId = pinnedDotId ?? hoveredDotId;
  const activeDot = useMemo(
    () => studentDots.find((dot) => dot.studentId === activeDotId) ?? null,
    [activeDotId, studentDots],
  );

  useEffect(() => {
    if (showDots) return;
    setHoveredDotId(null);
    setPinnedDotId(null);
  }, [showDots]);

  useEffect(() => {
    if (selectedStudentId === undefined) return;
    if (lastSelectedStudentIdRef.current === selectedStudentId) return;
    lastSelectedStudentIdRef.current = selectedStudentId;
    if (selectedStudentId === null) {
      setPinnedDotId(null);
      setHoveredDotId(null);
      return;
    }
    if (!studentDots.some((dot) => dot.studentId === selectedStudentId)) return;
    setShowDots(true);
    setSelectedRoom(null);
    setHoveredDotId(null);
    setPinnedDotId(selectedStudentId);
  }, [selectedStudentId, studentDots]);

  useEffect(() => {
    if (!selectedRoom && !pinnedDotId) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      setSelectedRoom(null);
      setPinnedDotId(null);
      setHoveredDotId(null);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [selectedRoom, pinnedDotId]);

  const clearMapPopups = useCallback(() => {
    setSelectedRoom(null);
    setPinnedDotId(null);
    setHoveredDotId(null);
    onSelectStudent?.(null);
  }, [onSelectStudent]);

  return (
    <div
      ref={rootRef}
      className="relative flex w-full flex-col overflow-hidden rounded-lg border border-[#232a35] bg-[#0a0d11]"
      onMouseDown={() => {
        clearMapPopups();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          if (expanded) setExpanded(false);
          clearMapPopups();
        }
      }}
    >
      <div className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#232a35] bg-[#0a0d11] px-3 py-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8b98a8]">
            Campus map
          </p>
          <p className="text-xs text-[#5c6b7d]">
            {CAMPUS_MAP.schoolName} · schematic · click a room
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] text-[#6b7a8f]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Safe
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Missing
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Needs help
          </span>
          <button
            type="button"
            onClick={() => setShowDots((v) => !v)}
            onMouseDown={(event) => event.stopPropagation()}
            className="rounded border border-[#2a3340] px-2 py-0.5 text-[#94a3b8] hover:bg-[#1a212b]"
          >
            {showDots ? "Hide dots" : "Show dots"}
          </button>
          <button
            type="button"
            onClick={() => setShowRoomNumbers((v) => !v)}
            onMouseDown={(event) => event.stopPropagation()}
            className="rounded border border-[#2a3340] px-2 py-0.5 text-[#94a3b8] hover:bg-[#1a212b]"
          >
            {showRoomNumbers ? "Hide #" : "Room #"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            onMouseDown={(event) => event.stopPropagation()}
            className="flex h-6 w-6 items-center justify-center rounded border border-sky-900/60 bg-sky-950/20 text-sky-200 hover:bg-sky-950/40"
            aria-label="Expand campus map"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
              <path
                d="M6 3H3v3M10 3h3v3M6 13H3v-3M10 13h3v-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6 3 3 6M10 3l3 3M6 13l-3-3M10 13l3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative p-3">
        <MapCanvas
          maxWidthClass="max-w-3xl"
          roomStatsMap={roomStatsMap}
          unaccountedIds={unaccountedIds}
          selectedRoom={selectedRoom}
          setSelectedRoom={setSelectedRoom}
          teacherByRoom={teacherByRoom}
          showRoomNumbers={showRoomNumbers}
          showDots={showDots}
          studentDots={studentDots}
          activeDot={activeDot}
          pinnedDotId={pinnedDotId}
          setHoveredDotId={setHoveredDotId}
          setPinnedDotId={setPinnedDotId}
          onSelectStudent={onSelectStudent}
          roomDetailMode="below"
        />
      </div>

      {expanded ? (
        <div
          className="fixed inset-0 z-50 bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded campus map"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setExpanded(false);
              clearMapPopups();
            }
          }}
        >
          <div
            className="relative flex h-full w-full flex-col overflow-hidden rounded-lg border border-[#334155] bg-[#0a0d11] shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#232a35] px-4 py-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8b98a8]">
                  Campus map
                </p>
                <p className="text-xs text-[#5c6b7d]">Expanded view</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  clearMapPopups();
                }}
                className="flex h-8 w-8 items-center justify-center rounded border border-[#334155] text-[#94a3b8] transition hover:bg-[#1a212b] hover:text-[#f8fafc]"
                aria-label="Close expanded campus map"
              >
                <span aria-hidden="true" className="-mt-px text-lg leading-none">
                  x
                </span>
              </button>
            </div>
            <div className="min-h-0 flex-1 p-4">
              <MapCanvas
                maxWidthClass="max-w-[min(100%,150vh)]"
                roomStatsMap={roomStatsMap}
                unaccountedIds={unaccountedIds}
                selectedRoom={selectedRoom}
                setSelectedRoom={setSelectedRoom}
                teacherByRoom={teacherByRoom}
                showRoomNumbers={showRoomNumbers}
                showDots={showDots}
                studentDots={studentDots}
                activeDot={activeDot}
                pinnedDotId={pinnedDotId}
                setHoveredDotId={setHoveredDotId}
                setPinnedDotId={setPinnedDotId}
                onSelectStudent={onSelectStudent}
                roomDetailMode="overlay"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MapCanvas({
  maxWidthClass,
  roomStatsMap,
  unaccountedIds,
  selectedRoom,
  setSelectedRoom,
  teacherByRoom,
  showRoomNumbers,
  showDots,
  studentDots,
  activeDot,
  pinnedDotId,
  setHoveredDotId,
  setPinnedDotId,
  onSelectStudent,
  roomDetailMode,
}: {
  maxWidthClass: string;
  roomStatsMap: ReadonlyMap<string, RoomEvacStats>;
  unaccountedIds: ReadonlySet<string>;
  selectedRoom: GeneralRoom | null;
  setSelectedRoom: (room: GeneralRoom | null) => void;
  teacherByRoom: ReadonlyMap<string, TeacherRoomSnapshot>;
  showRoomNumbers: boolean;
  showDots: boolean;
  studentDots: readonly StudentDot[];
  activeDot: StudentDot | null;
  pinnedDotId: string | null;
  setHoveredDotId: (id: string | null) => void;
  setPinnedDotId: Dispatch<SetStateAction<string | null>>;
  onSelectStudent?: (studentId: string | null) => void;
  roomDetailMode: "below" | "overlay";
}) {
  const handleClearStudent = useCallback(() => {
    setPinnedDotId(null);
    setHoveredDotId(null);
    onSelectStudent?.(null);
  }, [onSelectStudent, setHoveredDotId, setPinnedDotId]);

  const handlePinDot = useCallback(
    (dot: StudentDot) => {
      const next = pinnedDotId === dot.studentId ? null : dot.studentId;
      setPinnedDotId(next);
      onSelectStudent?.(next);
    },
    [onSelectStudent, pinnedDotId, setPinnedDotId],
  );

  const handleHoverDot = useCallback(
    (dot: StudentDot | null) => {
      setHoveredDotId(dot?.studentId ?? null);
    },
    [setHoveredDotId],
  );

  return (
    <div
      className={`relative mx-auto w-full ${maxWidthClass}`}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        className="relative w-full"
        style={{
          aspectRatio: `${CAMPUS_MAP.viewBox.w} / ${CAMPUS_MAP.viewBox.h}`,
        }}
        onClick={() => {
          setSelectedRoom(null);
          handleClearStudent();
        }}
      >
        <svg
          viewBox={VB}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Interactive school campus map"
        >
          <SchematicCampus />

          <RoomLayer
            roomStatsMap={roomStatsMap}
            unaccountedIds={unaccountedIds}
            selectedRoomId={selectedRoom?.id ?? null}
            onSelectRoom={setSelectedRoom}
            showLabels={showRoomNumbers}
          />

          {showDots ? (
            <StudentDotsLayer
              dots={studentDots}
              activeDotId={activeDot?.studentId ?? null}
              onHoverDot={handleHoverDot}
              onPinDot={handlePinDot}
              onClearPin={handleClearStudent}
            />
          ) : null}
        </svg>

        {showDots && activeDot ? (
          <StudentDotBubble
            dot={activeDot}
            pinned={pinnedDotId === activeDot.studentId}
            onClose={() => {
              handleClearStudent();
            }}
          />
        ) : null}

        {!selectedRoom ? (
          <p className="pointer-events-none absolute bottom-3 left-3 rounded bg-[#0c0f13]/90 px-2 py-1 text-[10px] text-[#64748b]">
            Click a colored room tile for teacher &amp; missing students
          </p>
        ) : null}
      </div>

      {selectedRoom ? (
        <div onMouseDown={(event) => event.stopPropagation()}>
          <RoomDetailPanel
            room={selectedRoom}
            roomStatsMap={roomStatsMap}
          teacherByRoom={teacherByRoom}
          unaccountedIds={unaccountedIds}
          onClose={() => setSelectedRoom(null)}
          mode={roomDetailMode}
        />
        </div>
      ) : null}
    </div>
  );
}

function StudentDotBubble({
  dot,
  pinned,
  onClose,
}: {
  dot: StudentDot;
  pinned: boolean;
  onClose: () => void;
}) {
  const left = clamp((dot.x / CAMPUS_MAP.viewBox.w) * 100, 14, 86);
  const top = clamp((dot.y / CAMPUS_MAP.viewBox.h) * 100, 10, 90);
  const placeBelow = top < 24;
  const details = dot.details;

  return (
    <div
      className={`absolute z-30 w-64 rounded-lg border border-[#334155] bg-[#0c0f13]/95 p-3 text-left shadow-2xl shadow-black/50 backdrop-blur ${
        pinned ? "pointer-events-auto" : "pointer-events-none"
      }`}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: placeBelow
          ? "translate(-50%, 12px)"
          : "translate(-50%, calc(-100% - 12px))",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#f8fafc]">{dot.studentName}</p>
          <p className="mt-0.5 text-[11px] text-[#94a3b8]">
            Grade {details.grade} · {details.sourceLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadgeClass(dot.status)}`}>
            {details.statusLabel}
          </span>
          {pinned ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${dot.studentName} details`}
              className="flex h-5 w-5 items-center justify-center rounded border border-[#334155] text-[#94a3b8] transition hover:bg-[#1a212b] hover:text-[#f8fafc]"
            >
              <span aria-hidden="true" className="-mt-px text-sm leading-none">
                x
              </span>
            </button>
          ) : null}
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-xs">
        <BubbleRow label="Expected" value={details.expectedRoom} />
        {details.reportedRoom && details.reportedRoom !== details.expectedRoom ? (
          <BubbleRow label="Reported" value={details.reportedRoom} />
        ) : null}
        <BubbleRow label="Teacher" value={details.reporter ?? details.expectedTeacher} />
        <BubbleRow label="Updated" value={details.updatedAt} />
      </dl>

      {details.note ? (
        <p className="mt-3 rounded border border-[#1f2937] bg-[#111827] px-2 py-1.5 text-xs leading-relaxed text-[#cbd5e1]">
          {details.note}
        </p>
      ) : null}
    </div>
  );
}

function BubbleRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[4.75rem_1fr] gap-2">
      <dt className="text-[#64748b]">{label}</dt>
      <dd className="min-w-0 truncate text-[#e2e8f0]">{value}</dd>
    </div>
  );
}

function statusBadgeClass(status: StudentDot["status"]): string {
  if (status === "unsafe") return "bg-rose-500/15 text-rose-200";
  if (status === "missing") return "bg-amber-400/15 text-amber-200";
  return "bg-emerald-500/15 text-emerald-200";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
