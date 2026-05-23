"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatTime, type Status } from "@/lib/demo-data";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { ALL_ROSTER_STUDENTS, getRoomByNumber, type RoomStudent } from "@/lib/lahs-rooms";
import { buildInitialUnaccounted } from "@/lib/room-accounting";
import { newWalkerTarget, rosterPosition, type Walker } from "@/lib/student-dots";

export type CheckInEvent = {
  id: string;
  student: RoomStudent;
  roomNumber: string;
  teacherName: string;
  status: Status;
  at: string;
  note?: string;
  /** Raw text the reporter typed or said, before processing. */
  rawText?: string;
  source?: "student" | "teacher";
};

type SimulationState = {
  events: CheckInEvent[];
  unaccountedIds: Set<string>;
  safeCount: number;
  unsafeCount: number;
  walkers: Map<string, Walker>;
  lastTick: string;
  isLive: boolean;
};

const DEMO_SEED_TIME = Date.UTC(2026, 0, 1, 20, 0, 0);
const IDLE_TICK = "--:--:--";
const WALKER_COUNT = 18;
const WALKER_SPEED_MIN = 1.4;
const WALKER_SPEED_MAX = 3.2;
const ARRIVE_DISTANCE = 1.2;

function studentRoomNumber(student: RoomStudent): string {
  const match = student.id.match(/^r([^-]+)-/);
  return match?.[1] ?? "—";
}

function teacherForRoom(roomNumber: string): string {
  return getRoomByNumber(roomNumber)?.teacher ?? "—";
}

function randomRosterStudent(): RoomStudent {
  return ALL_ROSTER_STUDENTS[Math.floor(Math.random() * ALL_ROSTER_STUDENTS.length)]!;
}

type IncidentTemplate = { text: string; severity: "minor" | "major" };

const INCIDENT_TEMPLATES: IncidentTemplate[] = [
  { text: "Broken ankle", severity: "major" },
  { text: "Locked myself inside the closet", severity: "major" },
  { text: "Hit my head, feeling dizzy", severity: "major" },
  { text: "Asthma attack, can't find inhaler", severity: "major" },
  { text: "Sprained wrist, can't move it", severity: "major" },
  { text: "Door is jammed, we can't get out", severity: "major" },
  { text: "Bleeding from a deep cut on my arm", severity: "major" },
  { text: "Feeling lightheaded and nauseous", severity: "major" },
  { text: "Cut on my finger", severity: "minor" },
  { text: "Scraped my knee", severity: "minor" },
  { text: "Bumped my elbow on a desk", severity: "minor" },
  { text: "Lost my backpack", severity: "minor" },
  { text: "Phone battery is dying", severity: "minor" },
  { text: "Got a bee sting", severity: "minor" },
  { text: "Small nosebleed but it's stopping", severity: "minor" },
  { text: "Helping a classmate with a panic attack", severity: "minor" },
  { text: "Stuck in the bathroom but I'm fine", severity: "minor" },
];

function pickIncident(): IncidentTemplate {
  return INCIDENT_TEMPLATES[Math.floor(Math.random() * INCIDENT_TEMPLATES.length)]!;
}

function recomputeCounts(
  events: readonly CheckInEvent[],
  unaccounted: ReadonlySet<string>,
): { safeCount: number; unsafeCount: number } {
  // Use only the latest student event per id for status; teacher events don't count.
  const latestByStudent = new Map<string, CheckInEvent>();
  for (const event of events) {
    if (event.source === "teacher") continue;
    if (!latestByStudent.has(event.student.id)) {
      latestByStudent.set(event.student.id, event);
    }
  }
  let unsafeCount = 0;
  for (const event of latestByStudent.values()) {
    if (event.status === "unsafe") unsafeCount++;
  }
  // Anyone not unaccounted-for and not flagged unsafe is considered safe.
  const safeCount = Math.max(
    0,
    ALL_ROSTER_STUDENTS.length - unaccounted.size - unsafeCount,
  );
  return { safeCount, unsafeCount };
}

function seedEvents(unaccounted: Set<string>): CheckInEvent[] {
  const accounted = ALL_ROSTER_STUDENTS.filter((s) => !unaccounted.has(s.id)).slice(0, 6);
  return accounted.map((student, i) => {
    const roomNumber = studentRoomNumber(student);
    return {
      id: `seed-${i}`,
      student,
      roomNumber,
      teacherName: teacherForRoom(roomNumber),
      status: i === 2 || i === 5 ? ("unsafe" as const) : ("safe" as const),
      at: formatTime(new Date(DEMO_SEED_TIME - (6 - i) * 4500)),
      note: i === 2 ? "Needs follow-up" : undefined,
    };
  });
}

function makeWalker(student: RoomStudent, seed: number): Walker {
  const start = rosterPosition(student);
  const target = newWalkerTarget(seed);
  return {
    id: student.id,
    name: student.name,
    x: start.x,
    y: start.y,
    targetX: target.x,
    targetY: target.y,
    speed: WALKER_SPEED_MIN + Math.random() * (WALKER_SPEED_MAX - WALKER_SPEED_MIN),
  };
}

function initialWalkers(): Map<string, Walker> {
  const walkers = new Map<string, Walker>();
  const stride = Math.max(1, Math.floor(ALL_ROSTER_STUDENTS.length / WALKER_COUNT));
  for (let i = 0; i < WALKER_COUNT; i++) {
    const student = ALL_ROSTER_STUDENTS[(i * stride) % ALL_ROSTER_STUDENTS.length];
    if (!student) continue;
    walkers.set(student.id, makeWalker(student, i * 7919 + 1));
  }
  return walkers;
}

function buildDemoState(): SimulationState {
  const unaccounted = buildInitialUnaccounted(0.52);
  const seeds = seedEvents(unaccounted);
  const counts = recomputeCounts(seeds, unaccounted);
  return {
    events: seeds,
    unaccountedIds: unaccounted,
    safeCount: counts.safeCount,
    unsafeCount: counts.unsafeCount,
    walkers: initialWalkers(),
    lastTick: formatTime(new Date(DEMO_SEED_TIME)),
    isLive: true,
  };
}

function buildFirebaseIdleState(): SimulationState {
  return {
    events: [],
    unaccountedIds: buildInitialUnaccounted(0.52),
    safeCount: 0,
    unsafeCount: 0,
    walkers: new Map(),
    lastTick: IDLE_TICK,
    isLive: true,
  };
}

type Options = {
  /** Force demo mode regardless of Firebase config (true) or follow auto-detect (undefined). */
  forceDemo?: boolean;
};

export function useLiveSimulation(options: Options = {}) {
  const demoMode = options.forceDemo ?? !isFirebaseConfigured();

  const [state, setState] = useState<SimulationState>(() =>
    demoMode ? buildDemoState() : buildFirebaseIdleState(),
  );
  const previousModeRef = useRef(demoMode);

  // When the parent toggles modes, rebuild the simulation state for the new mode.
  useEffect(() => {
    if (previousModeRef.current === demoMode) return;
    previousModeRef.current = demoMode;
    setState(demoMode ? buildDemoState() : buildFirebaseIdleState());
  }, [demoMode]);

  const eventId = useRef(0);
  const frameRef = useRef<number | null>(null);
  const unaccountedRef = useRef(state.unaccountedIds);
  unaccountedRef.current = state.unaccountedIds;

  const pushEvent = useCallback(
    (
      status: Status,
      options: { forced?: RoomStudent; note?: string; rawText?: string } = {},
    ) => {
      if (!demoMode) return;
      const student = options.forced ?? randomRosterStudent();
      const id = `evt-${++eventId.current}`;
      const at = formatTime(new Date());
      const roomNumber = studentRoomNumber(student);

      setState((prev) => {
        const nextUnaccounted = new Set(prev.unaccountedIds);
        nextUnaccounted.delete(student.id);

        const nextWalkers = new Map(prev.walkers);
        nextWalkers.delete(student.id);

        const event: CheckInEvent = {
          id,
          student,
          roomNumber,
          teacherName: teacherForRoom(roomNumber),
          status,
          at,
          note: options.note ?? (status === "unsafe" ? "Needs follow-up" : undefined),
          rawText: options.rawText,
          source: "student",
        };

        // Dedup: keep only the latest event per student so the feed shows one
        // row per student with their current status / latest update.
        const dedupedPrev = prev.events.filter((e) => e.student.id !== student.id);
        const events = [event, ...dedupedPrev].slice(0, 48);
        const counts = recomputeCounts(events, nextUnaccounted);

        return {
          ...prev,
          events,
          unaccountedIds: nextUnaccounted,
          walkers: nextWalkers,
          safeCount: counts.safeCount,
          unsafeCount: counts.unsafeCount,
          lastTick: at,
        };
      });
    },
    [demoMode],
  );

  const pushTeacherRollCall = useCallback(() => {
    if (!demoMode) return;
    // Mark a random room's roster as accounted, as if the teacher reported in.
    const candidates = ALL_ROSTER_STUDENTS.filter((s) =>
      unaccountedRef.current.has(s.id),
    );
    if (candidates.length === 0) return;
    const picked = candidates[Math.floor(Math.random() * candidates.length)]!;
    const roomNumber = studentRoomNumber(picked);
    const room = getRoomByNumber(roomNumber);
    if (!room) return;
    const at = formatTime(new Date());

    setState((prev) => {
      const nextUnaccounted = new Set(prev.unaccountedIds);
      const nextWalkers = new Map(prev.walkers);
      for (const s of room.roster) {
        nextUnaccounted.delete(s.id);
        nextWalkers.delete(s.id);
      }

      const teacherEventId = `teacher-${roomNumber}`;
      const event: CheckInEvent = {
        id: `roll-${++eventId.current}`,
        student: {
          id: teacherEventId,
          name: `${room.teacher} (roll call)`,
          grade: "—",
        },
        roomNumber,
        teacherName: room.teacher,
        status: "safe",
        at,
        note: `Room ${roomNumber} all accounted`,
        source: "teacher",
      };

      // Dedup any previous roll-call event for this same room.
      const dedupedPrev = prev.events.filter((e) => e.student.id !== teacherEventId);
      const events = [event, ...dedupedPrev].slice(0, 48);
      const counts = recomputeCounts(events, nextUnaccounted);

      return {
        ...prev,
        events,
        unaccountedIds: nextUnaccounted,
        walkers: nextWalkers,
        safeCount: counts.safeCount,
        unsafeCount: counts.unsafeCount,
        lastTick: at,
      };
    });
  }, [demoMode]);

  // Demo: periodic individual student check-ins. About 35% of the time the
  // check-in carries an incident text (broken ankle, locked in closet, etc.)
  // — severity drives whether the status is safe or unsafe. Otherwise it's a
  // plain check-in. Single emission path per tick so the live feed never gets
  // two entries for the same student in quick succession.
  useEffect(() => {
    if (!demoMode) return;

    const interval = setInterval(() => {
      // Catch up an unaccounted student.
      if (Math.random() < 0.18 && unaccountedRef.current.size > 0) {
        const pool = [...unaccountedRef.current];
        const pickId = pool[Math.floor(Math.random() * pool.length)]!;
        const student = ALL_ROSTER_STUDENTS.find((s) => s.id === pickId);
        if (student) {
          pushEvent("safe", { forced: student });
          return;
        }
      }
      // Incident update mixed into the check-in stream.
      if (Math.random() < 0.35) {
        const template = pickIncident();
        pushEvent(template.severity === "major" ? "unsafe" : "safe", {
          note: template.text,
          rawText: template.text,
        });
        return;
      }
      // Plain status update.
      pushEvent(Math.random() < 0.62 ? "safe" : "unsafe");
    }, 2500);

    return () => clearInterval(interval);
  }, [demoMode, pushEvent]);

  // Demo: every ~7s a teacher does a roll call.
  useEffect(() => {
    if (!demoMode) return;
    const interval = setInterval(() => {
      if (Math.random() < 0.4) pushTeacherRollCall();
    }, 7000);
    return () => clearInterval(interval);
  }, [demoMode, pushTeacherRollCall]);

  // RAF tick: move walkers toward their targets.
  useEffect(() => {
    if (!demoMode) {
      // In firebase mode there are no walkers to animate.
      return;
    }
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;

      setState((prev) => {
        if (!prev.isLive || prev.walkers.size === 0) return prev;
        const next = new Map<string, Walker>();
        let seedBump = Math.floor(now);
        for (const [id, walker] of prev.walkers) {
          const dx = walker.targetX - walker.x;
          const dy = walker.targetY - walker.y;
          const dist = Math.hypot(dx, dy);
          if (dist < ARRIVE_DISTANCE) {
            seedBump += 31;
            const target = newWalkerTarget(seedBump);
            next.set(id, {
              ...walker,
              targetX: target.x,
              targetY: target.y,
              speed: WALKER_SPEED_MIN + Math.random() * (WALKER_SPEED_MAX - WALKER_SPEED_MIN),
            });
          } else {
            const step = Math.min(dist, walker.speed * dt);
            next.set(id, {
              ...walker,
              x: walker.x + (dx / dist) * step,
              y: walker.y + (dy / dist) * step,
            });
          }
        }
        return { ...prev, walkers: next };
      });

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [demoMode]);

  const toggleLive = useCallback(() => {
    setState((prev) => ({ ...prev, isLive: !prev.isLive }));
  }, []);

  const seedBurst = useCallback(() => {
    if (!demoMode) return;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => pushEvent(Math.random() > 0.3 ? "safe" : "unsafe"), i * 120);
    }
  }, [demoMode, pushEvent]);

  return {
    ...state,
    unaccountedIds: state.unaccountedIds,
    walkers: state.walkers,
    toggleLive,
    seedBurst,
    pushEvent,
  };
}
