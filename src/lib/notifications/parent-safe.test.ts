import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  notifyParentSafe,
  notifyParentsOfSafeStudent,
  type NotificationLogEntry,
} from "./parent-safe";
import type { NotificationStore, ParentSummary, StudentSummary } from "./audit-store";
import {
  NOTIFICATION_TYPE_PARENT_CHILD_SAFE,
  type NotificationAuditDoc,
  type NotificationKey,
  type SmsSendResult,
} from "./types";

type StubScenario = {
  students?: Record<string, StudentSummary>;
  parents?: Record<string, ParentSummary>;
  schoolName?: string | null;
};

type StubCallLog = {
  audits: NotificationAuditDoc[];
  patches: Array<{ key: NotificationKey; patch: Partial<NotificationAuditDoc> }>;
};

function makeStore(scenario: StubScenario): { store: NotificationStore; calls: StubCallLog } {
  const calls: StubCallLog = { audits: [], patches: [] };
  const auditsByKey = new Map<string, NotificationAuditDoc>();

  const keyId = (k: NotificationKey) =>
    `${k.schoolId}|${k.incidentId}|${k.studentId}|${k.parentId}|${k.notificationType}`;

  const store: NotificationStore = {
    async loadStudent(_schoolId, studentId) {
      return scenario.students?.[studentId] ?? null;
    },
    async loadParent(_schoolId, parentId) {
      return scenario.parents?.[parentId] ?? null;
    },
    async loadSchoolName() {
      return scenario.schoolName === undefined ? "Test School" : scenario.schoolName;
    },
    async tryCreateAudit(initial) {
      const id = keyId(initial);
      if (auditsByKey.has(id)) return false;
      auditsByKey.set(id, { ...initial });
      calls.audits.push({ ...initial });
      return true;
    },
    async updateAudit(key, patch) {
      const id = keyId(key);
      const existing = auditsByKey.get(id);
      if (existing) {
        auditsByKey.set(id, { ...existing, ...patch });
      }
      calls.patches.push({ key, patch });
    },
  };

  return { store, calls };
}

function makeSendSmsSpy(result: SmsSendResult) {
  const calls: Array<{ to: string; body: string }> = [];
  const sendSms = async (params: { to: string; body: string }): Promise<SmsSendResult> => {
    calls.push({ to: params.to, body: params.body });
    return result;
  };
  return { sendSms, calls };
}

function makeLogSpy() {
  const entries: NotificationLogEntry[] = [];
  return { log: (entry: NotificationLogEntry) => entries.push(entry), entries };
}

const VALID_INPUT = {
  schoolId: "school-1",
  incidentId: "incident-1",
  studentId: "GHS-1061",
  parentId: "parent-ann-roy",
};

const VALID_STUDENT: StudentSummary = {
  firstName: "Jay",
  lastName: "Roy",
  parentGuardianIds: ["parent-ann-roy"],
};

const VALID_PARENT: ParentSummary = {
  phone: "+15555550100",
  linkedStudentIds: ["GHS-1061"],
};

describe("notifyParentSafe — duplicate prevention", () => {
  it("does not call sendSms on the second invocation with the same key", async () => {
    const { store } = makeStore({
      students: { "GHS-1061": VALID_STUDENT },
      parents: { "parent-ann-roy": VALID_PARENT },
    });
    const send = makeSendSmsSpy({ status: "sent", providerMessageId: "SM123" });

    const first = await notifyParentSafe(VALID_INPUT, { store, sendSms: send.sendSms, log: () => {} });
    const second = await notifyParentSafe(VALID_INPUT, { store, sendSms: send.sendSms, log: () => {} });

    assert.equal(first.state, "sent");
    assert.equal(second.state, "skipped_duplicate");
    assert.equal(send.calls.length, 1, "sendSms must be called exactly once");
  });

  it("logs skipped_duplicate without exposing phone or body", async () => {
    const { store } = makeStore({
      students: { "GHS-1061": VALID_STUDENT },
      parents: { "parent-ann-roy": VALID_PARENT },
    });
    const send = makeSendSmsSpy({ status: "sent", providerMessageId: "SM123" });
    const logSpy = makeLogSpy();

    await notifyParentSafe(VALID_INPUT, { store, sendSms: send.sendSms, log: logSpy.log });
    await notifyParentSafe(VALID_INPUT, { store, sendSms: send.sendSms, log: logSpy.log });

    const dupeEntry = logSpy.entries.find((e) => e.state === "skipped_duplicate");
    assert.ok(dupeEntry, "should emit a skipped_duplicate log entry");
    assert.equal(dupeEntry?.notificationType, NOTIFICATION_TYPE_PARENT_CHILD_SAFE);
    assert.equal(dupeEntry?.studentId, "GHS-1061");
    assert.equal(dupeEntry?.parentId, "parent-ann-roy");
    // dupe log path doesn't carry a redacted phone (we never read parent).
    assert.equal(dupeEntry?.redactedPhone, undefined);
  });
});

describe("notifyParentSafe — invalid or missing phone", () => {
  it("writes a skipped_invalid_phone audit when phone is missing", async () => {
    const { store, calls } = makeStore({
      students: { "GHS-1061": VALID_STUDENT },
      parents: { "parent-ann-roy": { ...VALID_PARENT, phone: undefined } },
    });
    const send = makeSendSmsSpy({ status: "sent", providerMessageId: "SM123" });

    const result = await notifyParentSafe(VALID_INPUT, {
      store,
      sendSms: send.sendSms,
      log: () => {},
    });

    assert.equal(result.state, "skipped_invalid_phone");
    assert.equal(send.calls.length, 0);
    assert.equal(calls.audits.length, 1, "queued audit was created");
    const finalPatch = calls.patches.at(-1);
    assert.equal(finalPatch?.patch.state, "skipped_invalid_phone");
    assert.equal(finalPatch?.patch.body, undefined, "no body recorded for invalid phone");
  });

  it("writes a skipped_invalid_phone audit when phone is not E.164", async () => {
    const { store, calls } = makeStore({
      students: { "GHS-1061": VALID_STUDENT },
      parents: { "parent-ann-roy": { ...VALID_PARENT, phone: "555-555-0100" } },
    });
    const send = makeSendSmsSpy({ status: "sent", providerMessageId: "SM123" });

    const result = await notifyParentSafe(VALID_INPUT, {
      store,
      sendSms: send.sendSms,
      log: () => {},
    });

    assert.equal(result.state, "skipped_invalid_phone");
    assert.equal(send.calls.length, 0);
    assert.equal(calls.patches.at(-1)?.patch.state, "skipped_invalid_phone");
  });
});

describe("notifyParentSafe — parent/student relationship mismatch", () => {
  it("skips when the student doc does not list the parent", async () => {
    const { store, calls } = makeStore({
      students: {
        "GHS-1061": { ...VALID_STUDENT, parentGuardianIds: ["someone-else"] },
      },
      parents: { "parent-ann-roy": VALID_PARENT },
    });
    const send = makeSendSmsSpy({ status: "sent", providerMessageId: "SM123" });

    const result = await notifyParentSafe(VALID_INPUT, {
      store,
      sendSms: send.sendSms,
      log: () => {},
    });

    assert.equal(result.state, "skipped_relationship_mismatch");
    assert.equal(send.calls.length, 0);
    assert.equal(calls.patches.at(-1)?.patch.state, "skipped_relationship_mismatch");
  });

  it("skips when the parent doc does not list the student", async () => {
    const { store } = makeStore({
      students: { "GHS-1061": VALID_STUDENT },
      parents: {
        "parent-ann-roy": { ...VALID_PARENT, linkedStudentIds: ["different-student"] },
      },
    });
    const send = makeSendSmsSpy({ status: "sent", providerMessageId: "SM123" });

    const result = await notifyParentSafe(VALID_INPUT, {
      store,
      sendSms: send.sendSms,
      log: () => {},
    });

    assert.equal(result.state, "skipped_relationship_mismatch");
    assert.equal(send.calls.length, 0);
  });

  it("skips when the student doc is missing entirely", async () => {
    const { store } = makeStore({
      students: {},
      parents: { "parent-ann-roy": VALID_PARENT },
    });
    const send = makeSendSmsSpy({ status: "sent", providerMessageId: "SM123" });

    const result = await notifyParentSafe(VALID_INPUT, {
      store,
      sendSms: send.sendSms,
      log: () => {},
    });

    assert.equal(result.state, "skipped_missing_student");
    assert.equal(send.calls.length, 0);
  });
});

describe("notifyParentSafe — dry-run path", () => {
  it("records a dry_run audit and does not require Twilio credentials", async () => {
    // Sanity: this test injects sendSms returning dry_run, but to be extra
    // defensive we also assert process.env Twilio vars aren't relied on.
    const originalSid = process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_ACCOUNT_SID;

    try {
      const { store, calls } = makeStore({
        students: { "GHS-1061": VALID_STUDENT },
        parents: { "parent-ann-roy": VALID_PARENT },
      });
      const send = makeSendSmsSpy({ status: "dry_run", reason: "disabled" });

      const result = await notifyParentSafe(VALID_INPUT, {
        store,
        sendSms: send.sendSms,
        log: () => {},
      });

      assert.equal(result.state, "dry_run");
      assert.equal(send.calls.length, 1, "sendSms is still called; it decides dry-run itself");
      const finalPatch = calls.patches.at(-1)?.patch;
      assert.equal(finalPatch?.state, "dry_run");
      assert.equal(finalPatch?.dryRunReason, "disabled");
      assert.equal(finalPatch?.templateId, "parent_child_safe_v1");
      assert.equal(finalPatch?.redactedPhone, "+•••••0100");
      assert.ok(finalPatch?.body?.includes("Jay Roy"), "body recorded in audit");
    } finally {
      if (originalSid !== undefined) process.env.TWILIO_ACCOUNT_SID = originalSid;
    }
  });

  it("records dry_run with reason=missing_env when sendSms reports that", async () => {
    const { store, calls } = makeStore({
      students: { "GHS-1061": VALID_STUDENT },
      parents: { "parent-ann-roy": VALID_PARENT },
    });
    const send = makeSendSmsSpy({ status: "dry_run", reason: "missing_env" });

    const result = await notifyParentSafe(VALID_INPUT, {
      store,
      sendSms: send.sendSms,
      log: () => {},
    });

    assert.equal(result.state, "dry_run");
    assert.equal(calls.patches.at(-1)?.patch.dryRunReason, "missing_env");
  });
});

describe("notifyParentSafe — happy path and logging hygiene", () => {
  it("records a sent audit with provider message id and redacted phone", async () => {
    const { store, calls } = makeStore({
      students: { "GHS-1061": VALID_STUDENT },
      parents: { "parent-ann-roy": VALID_PARENT },
      schoolName: "General High School",
    });
    const send = makeSendSmsSpy({ status: "sent", providerMessageId: "SM_abc" });

    const result = await notifyParentSafe(VALID_INPUT, {
      store,
      sendSms: send.sendSms,
      log: () => {},
    });

    assert.equal(result.state, "sent");
    const patch = calls.patches.at(-1)?.patch;
    assert.equal(patch?.state, "sent");
    assert.equal(patch?.providerMessageId, "SM_abc");
    assert.equal(patch?.redactedPhone, "+•••••0100");
    assert.ok(patch?.body?.includes("General High School"));
  });

  it("falls back to 'their school' when school name lookup returns null", async () => {
    const { store } = makeStore({
      students: { "GHS-1061": VALID_STUDENT },
      parents: { "parent-ann-roy": VALID_PARENT },
      schoolName: null,
    });
    const send = makeSendSmsSpy({ status: "sent", providerMessageId: "SM_abc" });

    await notifyParentSafe(VALID_INPUT, { store, sendSms: send.sendSms, log: () => {} });

    assert.equal(send.calls.length, 1);
    assert.match(send.calls[0]!.body, /at their school\./);
  });

  it("log entries never carry the SMS body or full phone", async () => {
    const { store } = makeStore({
      students: { "GHS-1061": VALID_STUDENT },
      parents: { "parent-ann-roy": VALID_PARENT },
    });
    const send = makeSendSmsSpy({ status: "sent", providerMessageId: "SM_abc" });
    const logSpy = makeLogSpy();

    await notifyParentSafe(VALID_INPUT, { store, sendSms: send.sendSms, log: logSpy.log });

    for (const entry of logSpy.entries) {
      const serialized = JSON.stringify(entry);
      assert.doesNotMatch(serialized, /\+15555550100/, "full phone must not appear in logs");
      assert.doesNotMatch(serialized, /marked safe with school staff/, "body must not appear in logs");
    }
  });

  it("notifyParentsOfSafeStudent fans out across multiple parents", async () => {
    const twoParentsStudent: StudentSummary = {
      firstName: "Jay",
      lastName: "Roy",
      parentGuardianIds: ["parent-a", "parent-b"],
    };
    const { store } = makeStore({
      students: { "GHS-1061": twoParentsStudent },
      parents: {
        "parent-a": { phone: "+15555550100", linkedStudentIds: ["GHS-1061"] },
        "parent-b": { phone: "+15555550200", linkedStudentIds: ["GHS-1061"] },
      },
    });
    const send = makeSendSmsSpy({ status: "sent", providerMessageId: "SM_x" });

    const results = await notifyParentsOfSafeStudent(
      { schoolId: "school-1", incidentId: "incident-1", studentId: "GHS-1061" },
      { store, sendSms: send.sendSms, log: () => {} },
    );

    assert.equal(results.length, 2);
    assert.equal(results.every((r) => r.state === "sent"), true);
    assert.equal(send.calls.length, 2);
    assert.deepEqual(send.calls.map((c) => c.to).sort(), ["+15555550100", "+15555550200"]);
  });

  it("notifyParentsOfSafeStudent continues past a single parent failure", async () => {
    const twoParentsStudent: StudentSummary = {
      firstName: "Jay",
      lastName: "Roy",
      parentGuardianIds: ["parent-a", "parent-b"],
    };
    // Make loadParent throw for parent-a only; parent-b should still be reached.
    const baseStore = makeStore({
      students: { "GHS-1061": twoParentsStudent },
      parents: {
        "parent-b": { phone: "+15555550200", linkedStudentIds: ["GHS-1061"] },
      },
    });
    const throwingStore: NotificationStore = {
      ...baseStore.store,
      async loadParent(schoolId, parentId) {
        if (parentId === "parent-a") throw new Error("firestore blip");
        return baseStore.store.loadParent(schoolId, parentId);
      },
    };
    const send = makeSendSmsSpy({ status: "sent", providerMessageId: "SM_x" });

    const results = await notifyParentsOfSafeStudent(
      { schoolId: "school-1", incidentId: "incident-1", studentId: "GHS-1061" },
      { store: throwingStore, sendSms: send.sendSms, log: () => {} },
    );

    assert.equal(results.length, 2);
    assert.equal(results[0]?.state, "failed");
    assert.equal(results[1]?.state, "sent");
    assert.equal(send.calls.length, 1);
    assert.equal(send.calls[0]?.to, "+15555550200");
  });

  it("notifyParentsOfSafeStudent returns [] when the student doc is missing", async () => {
    const { store } = makeStore({ students: {}, parents: {} });
    const send = makeSendSmsSpy({ status: "sent", providerMessageId: "SM_x" });

    const results = await notifyParentsOfSafeStudent(
      { schoolId: "school-1", incidentId: "incident-1", studentId: "ghost" },
      { store, sendSms: send.sendSms, log: () => {} },
    );

    assert.deepEqual(results, []);
    assert.equal(send.calls.length, 0);
  });

  it("treats a dedupe-write failure as failed (fail closed, no send)", async () => {
    const send = makeSendSmsSpy({ status: "sent", providerMessageId: "SM_abc" });
    const store: NotificationStore = {
      async loadStudent() {
        return VALID_STUDENT;
      },
      async loadParent() {
        return VALID_PARENT;
      },
      async loadSchoolName() {
        return "Test School";
      },
      async tryCreateAudit() {
        throw new Error("firestore down");
      },
      async updateAudit() {
        /* no-op */
      },
    };

    const result = await notifyParentSafe(VALID_INPUT, { store, sendSms: send.sendSms, log: () => {} });
    assert.equal(result.state, "failed");
    assert.equal(send.calls.length, 0, "must not send when dedupe write fails");
  });
});
