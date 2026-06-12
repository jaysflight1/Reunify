import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NEED_HELP_ROOM } from "@/lib/firebase/config";
import {
  ANONYMOUS_BEACON_NAME,
  BEACON_DEACTIVATED_NOTE,
  BEACON_NOTE,
  buildBeaconDeactivationInput,
  buildBeaconReportInput,
} from "./beacon";

describe("buildBeaconReportInput", () => {
  it("builds an unsafe beacon report with the selected student identity", () => {
    const input = buildBeaconReportInput({
      id: "GHS-1001",
      fullName: "Alyssa Wang",
      grade: "9",
    });

    assert.equal(input.studentId, "GHS-1001");
    assert.equal(input.studentName, "Alyssa Wang");
    assert.equal(input.grade, "9");
    assert.equal(input.status, "unsafe");
    assert.equal(input.note, BEACON_NOTE);
    assert.equal(input.roomNumber, NEED_HELP_ROOM);
    assert.equal(input.teacherName, "");
    assert.equal(input.location, null);
  });

  it("preserves explicit location and room context when present", () => {
    const input = buildBeaconReportInput(
      { id: "GHS-1002", fullName: "Lydia Chen", grade: "10" },
      {
        roomNumber: "602",
        teacherName: "Ms. Rivera",
        location: { latitude: 10, longitude: 20, accuracy: 30 },
      },
    );

    assert.equal(input.roomNumber, "602");
    assert.equal(input.teacherName, "Ms. Rivera");
    assert.deepEqual(input.location, { latitude: 10, longitude: 20, accuracy: 30 });
  });

  it("builds an anonymous unsafe beacon report before identity is known", () => {
    const input = buildBeaconReportInput(null, {
      beaconId: "device-1",
      location: { latitude: 1, longitude: 2, accuracy: null },
    });

    assert.equal(input.clientReportId, "beacon-device-1");
    assert.equal(input.studentId, "beacon-device-1");
    assert.equal(input.studentName, ANONYMOUS_BEACON_NAME);
    assert.equal(input.grade, "—");
    assert.equal(input.status, "unsafe");
    assert.equal(input.note, BEACON_NOTE);
    assert.equal(input.roomNumber, NEED_HELP_ROOM);
    assert.deepEqual(input.location, { latitude: 1, longitude: 2, accuracy: null });
  });

  it("keeps the anonymous report key when identity is added later", () => {
    const input = buildBeaconReportInput(
      { id: "GHS-1001", fullName: "Alyssa Wang", grade: "9" },
      { beaconId: "device-1", note: "Behind the gym" },
    );

    assert.equal(input.clientReportId, "beacon-device-1");
    assert.equal(input.studentId, "GHS-1001");
    assert.equal(input.studentName, "Alyssa Wang");
    assert.equal(input.note, "Behind the gym");
  });

  it("builds a same-key deactivation report that clears active danger", () => {
    const input = buildBeaconDeactivationInput(null, { beaconId: "device-1" });

    assert.equal(input.clientReportId, "beacon-device-1");
    assert.equal(input.studentId, "beacon-device-1");
    assert.equal(input.status, "safe");
    assert.equal(input.offCampus, true);
    assert.equal(input.note, BEACON_DEACTIVATED_NOTE);
  });
});
