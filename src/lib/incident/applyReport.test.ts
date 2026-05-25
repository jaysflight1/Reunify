import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Firestore } from "firebase-admin/firestore";
import {
  applyReportUpdates,
  detectSafeTransitions,
  readPreviousParentStatuses,
  type PreviousParentStatusResult,
} from "./applyReport";
import type {
  ParentPublicStatus,
  ProposedStudentUpdate,
} from "@/types/incident";
import type { AppUser, AuthContext, UserRole } from "@/types/user";

function makeReporter(role: UserRole): AuthContext {
  const user: AppUser = {
    id: `user-${role}`,
    schoolId: "school-1",
    role,
    displayName: `Demo ${role}`,
    isDemoUser: true,
    createdAt: "",
    updatedAt: "",
  };
  return { uid: user.id, schoolId: user.schoolId, role, user };
}

function makeUpdate(
  studentId: string,
  parentVisibleStatus: ParentPublicStatus | undefined,
): ProposedStudentUpdate {
  return {
    studentId,
    studentName: studentId,
    newStatus: parentVisibleStatus === "safe" ? "safe" : "with_teacher",
    confidenceScore: 0.95,
    reason: "test",
    requiresReview: false,
    parentVisibleStatus,
    locationVisibility: "admin_only",
  };
}

// ───────────────────────── detectSafeTransitions (pure) ─────────────────────

describe("detectSafeTransitions", () => {
  it("flags an adult-applied transition into safe", () => {
    const updates = [makeUpdate("s1", "safe")];
    const previous: PreviousParentStatusResult = {
      ok: true,
      statuses: new Map([["s1", "being_verified"]]),
    };
    assert.deepEqual(detectSafeTransitions(updates, previous, makeReporter("admin")), ["s1"]);
  });

  for (const role of ["admin", "teacher", "responder"] as const) {
    it(`flags transitions for adult role: ${role}`, () => {
      const updates = [makeUpdate("s1", "safe")];
      const previous: PreviousParentStatusResult = {
        ok: true,
        statuses: new Map([["s1", "being_verified"]]),
      };
      assert.deepEqual(detectSafeTransitions(updates, previous, makeReporter(role)), ["s1"]);
    });
  }

  it("does not flag safe → safe (no transition)", () => {
    const updates = [makeUpdate("s1", "safe")];
    const previous: PreviousParentStatusResult = {
      ok: true,
      statuses: new Map([["s1", "safe"]]),
    };
    assert.deepEqual(detectSafeTransitions(updates, previous, makeReporter("admin")), []);
  });

  it("does not flag a student-applied safe update", () => {
    const updates = [makeUpdate("s1", "safe")];
    const previous: PreviousParentStatusResult = {
      ok: true,
      statuses: new Map([["s1", "being_verified"]]),
    };
    assert.deepEqual(detectSafeTransitions(updates, previous, makeReporter("student")), []);
  });

  it("does not flag a parent-applied safe update", () => {
    const updates = [makeUpdate("s1", "safe")];
    const previous: PreviousParentStatusResult = {
      ok: true,
      statuses: new Map([["s1", "being_verified"]]),
    };
    assert.deepEqual(detectSafeTransitions(updates, previous, makeReporter("parent")), []);
  });

  it("does not flag updates whose new parent-visible status is not safe", () => {
    const updates = [makeUpdate("s1", "being_verified"), makeUpdate("s2", "needs_assistance")];
    const previous: PreviousParentStatusResult = {
      ok: true,
      statuses: new Map([
        ["s1", "no_update_yet"],
        ["s2", "no_update_yet"],
      ]),
    };
    assert.deepEqual(detectSafeTransitions(updates, previous, makeReporter("admin")), []);
  });

  it("treats 'no previous doc' (key absent) as a first-safe transition", () => {
    const updates = [makeUpdate("s1", "safe")];
    const previous: PreviousParentStatusResult = { ok: true, statuses: new Map() };
    assert.deepEqual(detectSafeTransitions(updates, previous, makeReporter("admin")), ["s1"]);
  });

  it("returns [] when previous-state read failed (fail closed)", () => {
    const updates = [makeUpdate("s1", "safe"), makeUpdate("s2", "safe")];
    const previous: PreviousParentStatusResult = { ok: false };
    assert.deepEqual(detectSafeTransitions(updates, previous, makeReporter("admin")), []);
  });

  it("returns only the eligible students from a mixed batch", () => {
    const updates = [
      makeUpdate("s1", "safe"),
      makeUpdate("s2", "safe"),
      makeUpdate("s3", "needs_assistance"),
    ];
    const previous: PreviousParentStatusResult = {
      ok: true,
      statuses: new Map<string, ParentPublicStatus | undefined>([
        ["s1", "being_verified"],
        ["s2", "safe"], // already safe, skip
        ["s3", "no_update_yet"],
      ]),
    };
    assert.deepEqual(detectSafeTransitions(updates, previous, makeReporter("admin")), ["s1"]);
  });
});

// ───────────────────────── In-memory Firestore fake ─────────────────────────
// Just enough surface to support what applyReportUpdates touches:
//   db.doc(path), db.batch().set(ref, value, {merge}).commit(), db.getAll(...refs)

type DocRef = { path: string };
type SetOp = { path: string; value: Record<string, unknown>; merge: boolean };

type FakeDb = {
  db: Firestore;
  data: Map<string, Record<string, unknown>>;
  batches: SetOp[][];
  // Toggle to make the next getAll call throw.
  failGetAll: { value: boolean };
};

function createFakeDb(seed: Record<string, Record<string, unknown>> = {}): FakeDb {
  const data = new Map(Object.entries(seed));
  const batches: SetOp[][] = [];
  const failGetAll = { value: false };

  const doc = (path: string): DocRef => ({ path });

  const batch = () => {
    const ops: SetOp[] = [];
    return {
      set(ref: DocRef, value: Record<string, unknown>, opts?: { merge?: boolean }) {
        ops.push({ path: ref.path, value, merge: opts?.merge ?? false });
      },
      async commit() {
        batches.push(ops.slice());
        for (const op of ops) {
          const existing = data.get(op.path);
          data.set(op.path, op.merge && existing ? { ...existing, ...op.value } : { ...op.value });
        }
      },
    };
  };

  const getAll = async (...refs: DocRef[]) => {
    if (failGetAll.value) throw new Error("simulated read failure");
    return refs.map((ref) => {
      const stored = data.get(ref.path);
      return {
        exists: stored !== undefined,
        data: () => stored,
      };
    });
  };

  const fakeDb = { doc, batch, getAll } as unknown as Firestore;
  return { db: fakeDb, data, batches, failGetAll };
}

const SCHOOL = "school-1";
const INCIDENT = "incident-1";
const REPORT = "report-1";

function statePath(studentId: string): string {
  return `schools/${SCHOOL}/incidents/${INCIDENT}/studentStates/${studentId}`;
}

// ───────────────────────── readPreviousParentStatuses ───────────────────────

describe("readPreviousParentStatuses", () => {
  it("returns { ok: true, empty map } for an empty studentIds list", async () => {
    const { db } = createFakeDb();
    const result = await readPreviousParentStatuses(db, SCHOOL, INCIDENT, []);
    assert.deepEqual(result, { ok: true, statuses: new Map() });
  });

  it("maps existing docs to their publicParentStatus and missing docs to undefined", async () => {
    const { db } = createFakeDb({
      [statePath("s1")]: { publicParentStatus: "being_verified" },
      [statePath("s2")]: { publicParentStatus: "safe" },
    });
    const result = await readPreviousParentStatuses(db, SCHOOL, INCIDENT, ["s1", "s2", "s3"]);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.statuses.get("s1"), "being_verified");
      assert.equal(result.statuses.get("s2"), "safe");
      assert.equal(result.statuses.get("s3"), undefined);
    }
  });

  it("returns { ok: false } when the underlying read throws", async () => {
    const { db, failGetAll } = createFakeDb();
    failGetAll.value = true;
    const result = await readPreviousParentStatuses(db, SCHOOL, INCIDENT, ["s1"]);
    assert.deepEqual(result, { ok: false });
  });
});

// ───────────────────────── applyReportUpdates orchestration ─────────────────

type NotifyCall = { schoolId: string; incidentId: string; studentId: string };

function makeNotifySpy(behavior: { throwFor?: Set<string> } = {}) {
  const calls: NotifyCall[] = [];
  const notify = async (input: NotifyCall) => {
    calls.push(input);
    if (behavior.throwFor?.has(input.studentId)) {
      throw new Error(`notify boom for ${input.studentId}`);
    }
  };
  return { notify, calls };
}

describe("applyReportUpdates — notification wiring", () => {
  it("triggers the notifier for an adult-applied safe transition", async () => {
    const { db, data } = createFakeDb({
      [statePath("s1")]: { publicParentStatus: "being_verified" },
    });
    const notify = makeNotifySpy();

    const result = await applyReportUpdates({
      schoolId: SCHOOL,
      incidentId: INCIDENT,
      reportId: REPORT,
      updates: [makeUpdate("s1", "safe")],
      appliedBy: makeReporter("admin"),
      db,
      notifyParentsOfSafe: notify.notify,
    });

    assert.deepEqual(result, { applied: 1 });
    assert.equal(notify.calls.length, 1);
    assert.deepEqual(notify.calls[0], {
      schoolId: SCHOOL,
      incidentId: INCIDENT,
      studentId: "s1",
    });
    // State-patch was written.
    assert.equal(data.get(statePath("s1"))?.publicParentStatus, "safe");
  });

  it("does not trigger the notifier for a safe → safe no-op", async () => {
    const { db } = createFakeDb({
      [statePath("s1")]: { publicParentStatus: "safe" },
    });
    const notify = makeNotifySpy();

    await applyReportUpdates({
      schoolId: SCHOOL,
      incidentId: INCIDENT,
      reportId: REPORT,
      updates: [makeUpdate("s1", "safe")],
      appliedBy: makeReporter("admin"),
      db,
      notifyParentsOfSafe: notify.notify,
    });

    assert.equal(notify.calls.length, 0);
  });

  it("does not trigger the notifier for a student-applied safe update", async () => {
    const { db } = createFakeDb({
      [statePath("s1")]: { publicParentStatus: "being_verified" },
    });
    const notify = makeNotifySpy();

    await applyReportUpdates({
      schoolId: SCHOOL,
      incidentId: INCIDENT,
      reportId: REPORT,
      updates: [makeUpdate("s1", "safe")],
      appliedBy: makeReporter("student"),
      db,
      notifyParentsOfSafe: notify.notify,
    });

    assert.equal(notify.calls.length, 0);
  });

  it("does not throw when the notifier throws, and still returns the applied count", async () => {
    const { db, data } = createFakeDb({
      [statePath("s1")]: { publicParentStatus: "being_verified" },
    });
    const notify = makeNotifySpy({ throwFor: new Set(["s1"]) });

    const result = await applyReportUpdates({
      schoolId: SCHOOL,
      incidentId: INCIDENT,
      reportId: REPORT,
      updates: [makeUpdate("s1", "safe")],
      appliedBy: makeReporter("admin"),
      db,
      notifyParentsOfSafe: notify.notify,
    });

    assert.deepEqual(result, { applied: 1 });
    assert.equal(notify.calls.length, 1);
    assert.equal(data.get(statePath("s1"))?.publicParentStatus, "safe");
  });

  it("attempts every eligible student even when one notify call throws", async () => {
    const { db } = createFakeDb({
      [statePath("s1")]: { publicParentStatus: "being_verified" },
      [statePath("s2")]: { publicParentStatus: "being_verified" },
      [statePath("s3")]: { publicParentStatus: "being_verified" },
    });
    const notify = makeNotifySpy({ throwFor: new Set(["s1"]) });

    await applyReportUpdates({
      schoolId: SCHOOL,
      incidentId: INCIDENT,
      reportId: REPORT,
      updates: [
        makeUpdate("s1", "safe"),
        makeUpdate("s2", "safe"),
        makeUpdate("s3", "safe"),
      ],
      appliedBy: makeReporter("admin"),
      db,
      notifyParentsOfSafe: notify.notify,
    });

    assert.equal(notify.calls.length, 3);
    assert.deepEqual(notify.calls.map((c) => c.studentId).sort(), ["s1", "s2", "s3"]);
  });

  it("skips notifications entirely when the previous-state read fails", async () => {
    const { db, data, failGetAll } = createFakeDb({
      [statePath("s1")]: { publicParentStatus: "being_verified" },
    });
    failGetAll.value = true;
    const notify = makeNotifySpy();

    const result = await applyReportUpdates({
      schoolId: SCHOOL,
      incidentId: INCIDENT,
      reportId: REPORT,
      updates: [makeUpdate("s1", "safe")],
      appliedBy: makeReporter("admin"),
      db,
      notifyParentsOfSafe: notify.notify,
    });

    assert.deepEqual(result, { applied: 1 });
    assert.equal(notify.calls.length, 0, "no notify on read failure (fail closed)");
    // Batch still committed — the emergency-status write path is preserved.
    assert.equal(data.get(statePath("s1"))?.publicParentStatus, "safe");
  });

  it("treats 'no previous state doc' as a valid first-safe transition", async () => {
    const { db } = createFakeDb(); // no seed for s1
    const notify = makeNotifySpy();

    await applyReportUpdates({
      schoolId: SCHOOL,
      incidentId: INCIDENT,
      reportId: REPORT,
      updates: [makeUpdate("s1", "safe")],
      appliedBy: makeReporter("admin"),
      db,
      notifyParentsOfSafe: notify.notify,
    });

    assert.equal(notify.calls.length, 1);
    assert.equal(notify.calls[0]?.studentId, "s1");
  });
});
