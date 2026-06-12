import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NEED_HELP_ROOM } from "@/lib/firebase/config";
import {
  SAFE_STATUS_NOTE,
  UPDATE_STATUS_FALLBACK_NOTE,
  buildSafeStatusReportInput,
  buildUpdateStatusReportInput,
} from "./status-actions";

const student = { id: "GHS-1001", fullName: "Alyssa Wang", grade: "9" };

describe("student status action report inputs", () => {
  it("builds a safe report with selected identity and unknown room", () => {
    const input = buildSafeStatusReportInput(student);

    assert.equal(input.studentId, "GHS-1001");
    assert.equal(input.studentName, "Alyssa Wang");
    assert.equal(input.status, "safe");
    assert.equal(input.offCampus, false);
    assert.equal(input.roomNumber, "");
    assert.equal(input.teacherName, "");
    assert.equal(input.note, SAFE_STATUS_NOTE);
  });

  it("builds an update-status report as staff-attention unsafe with notes", () => {
    const input = buildUpdateStatusReportInput(student, {
      note: "I twisted my ankle near the gym",
      location: { latitude: 1, longitude: 2, accuracy: 3 },
    });

    assert.equal(input.status, "unsafe");
    assert.equal(input.roomNumber, NEED_HELP_ROOM);
    assert.equal(input.teacherName, "");
    assert.equal(input.note, "I twisted my ankle near the gym");
    assert.deepEqual(input.location, { latitude: 1, longitude: 2, accuracy: 3 });
  });

  it("uses a fallback note for empty update-status notes", () => {
    const input = buildUpdateStatusReportInput(student, { note: "  " });

    assert.equal(input.note, UPDATE_STATUS_FALLBACK_NOTE);
  });
});
