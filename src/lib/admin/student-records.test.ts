import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildStaffStudentRecords } from "./student-records";
import type { CheckInEvent } from "@/hooks/use-live-simulation";

function event(id: string, status: "safe" | "unsafe"): CheckInEvent {
  return {
    id: `event-${id}`,
    student: { id, name: id.startsWith("beacon-") ? "Unknown student" : "Known Student", grade: "—" },
    roomNumber: "need-help",
    teacherName: "",
    status,
    at: "12:00",
    note: status === "unsafe" ? "Beacon activated" : "Beacon deactivated",
    source: "student",
  };
}

describe("buildStaffStudentRecords", () => {
  it("keeps active anonymous beacon reports in staff needs-help records", () => {
    const records = buildStaffStudentRecords({
      events: [event("beacon-device-1", "unsafe")],
      missingStudents: [],
      rosterIds: new Set(["GHS-1001"]),
      includeImplicitSafe: false,
    });

    assert.equal(records.length, 1);
    assert.equal(records[0].id, "beacon-device-1");
    assert.equal(records[0].status, "unsafe");
  });

  it("drops deactivated anonymous beacon reports from staff student records", () => {
    const records = buildStaffStudentRecords({
      events: [event("beacon-device-1", "safe")],
      missingStudents: [],
      rosterIds: new Set(["GHS-1001"]),
      includeImplicitSafe: false,
    });

    assert.deepEqual(records, []);
  });

  it("still keeps normal roster records", () => {
    const records = buildStaffStudentRecords({
      events: [event("GHS-1001", "safe")],
      missingStudents: [],
      rosterIds: new Set(["GHS-1001"]),
      includeImplicitSafe: false,
    });

    assert.equal(records.length, 1);
    assert.equal(records[0].id, "GHS-1001");
  });
});
