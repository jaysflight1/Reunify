"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatTime, type Status } from "@/lib/demo-data";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { ALL_ROSTER_STUDENTS, getRoomByNumber, type RoomStudent } from "@/lib/lahs-rooms";
import { buildInitialUnaccounted } from "@/lib/room-accounting";

export type CheckInEvent = {
  id: string;
  student: RoomStudent;
  roomNumber: string;
  teacherName: string;
  status: Status;
  at: string;
  note?: string;
};

type SimulationState = {
  events: CheckInEvent[];
  unaccountedIds: Set<string>;
  safeCount: number;
  unsafeCount: number;
  lastTick: string;
  isLive: boolean;
};

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

function seedEvents(unaccounted: Set<string>): CheckInEvent[] {
  const accounted = ALL_ROSTER_STUDENTS.filter((s) => !unaccounted.has(s.id)).slice(0, 6);
  const now = Date.now();
  return accounted.map((student, i) => {
    const roomNumber = studentRoomNumber(student);
    return {
      id: `seed-${i}`,
      student,
      roomNumber,
      teacherName: teacherForRoom(roomNumber),
      status: i === 2 || i === 5 ? ("unsafe" as const) : ("safe" as const),
      at: formatTime(new Date(now - (6 - i) * 4500)),
      note: i === 2 ? "Needs follow-up" : undefined,
    };
  });
}

function buildDemoState(): SimulationState {
  const unaccounted = buildInitialUnaccounted(0.52);
  const seeds = seedEvents(unaccounted);
  return {
    events: seeds,
    unaccountedIds: unaccounted,
    safeCount: seeds.filter((e) => e.status === "safe").length,
    unsafeCount: seeds.filter((e) => e.status === "unsafe").length,
    lastTick: formatTime(new Date(0)),
    isLive: true,
  };
}

function buildFirebaseIdleState(): SimulationState {
  return {
    events: [],
    unaccountedIds: buildInitialUnaccounted(0.52),
    safeCount: 0,
    unsafeCount: 0,
    lastTick: formatTime(new Date(0)),
    isLive: true,
  };
}

export function useLiveSimulation() {
  const demoMode = !isFirebaseConfigured();

  const [state, setState] = useState<SimulationState>(() =>
    demoMode ? buildDemoState() : buildFirebaseIdleState(),
  );

  const eventId = useRef(0);
  const unaccountedRef = useRef(state.unaccountedIds);
  unaccountedRef.current = state.unaccountedIds;

  const pushEvent = useCallback((status: Status, forced?: RoomStudent) => {
    if (!demoMode) return;
    const student = forced ?? randomRosterStudent();
    const id = `evt-${++eventId.current}`;
    const at = formatTime(new Date());
    const roomNumber = studentRoomNumber(student);

    setState((prev) => {
      const nextUnaccounted = new Set(prev.unaccountedIds);
      nextUnaccounted.delete(student.id);

      const event: CheckInEvent = {
        id,
        student,
        roomNumber,
        teacherName: teacherForRoom(roomNumber),
        status,
        at,
        note: status === "unsafe" ? "Needs follow-up" : undefined,
      };

      return {
        ...prev,
        events: [event, ...prev.events].slice(0, 48),
        unaccountedIds: nextUnaccounted,
        safeCount: status === "safe" ? prev.safeCount + 1 : prev.safeCount,
        unsafeCount: status === "unsafe" ? prev.unsafeCount + 1 : prev.unsafeCount,
        lastTick: at,
      };
    });
  }, [demoMode]);

  useEffect(() => {
    if (!demoMode) return;

    const interval = setInterval(() => {
      if (Math.random() < 0.18 && unaccountedRef.current.size > 0) {
        const pool = [...unaccountedRef.current];
        const pickId = pool[Math.floor(Math.random() * pool.length)]!;
        const student = ALL_ROSTER_STUDENTS.find((s) => s.id === pickId);
        if (student) {
          pushEvent("safe", student);
          return;
        }
      }
      pushEvent(Math.random() < 0.62 ? "safe" : "unsafe");
    }, 2500);

    return () => clearInterval(interval);
  }, [demoMode, pushEvent]);

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
    toggleLive,
    seedBurst,
    pushEvent,
  };
}
