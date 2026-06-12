import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapStudentBroadcastDoc,
  sortStudentBroadcasts,
  type StudentBroadcast,
} from "./broadcasts";

describe("student broadcasts", () => {
  it("maps only curated student-facing fields", () => {
    const broadcast = mapStudentBroadcastDoc("b1", {
      active: true,
      audience: "students",
      priority: "update",
      title: " Police are on campus ",
      message: " Stay where you are. ",
      staffOnlyNotes: "hidden",
      missingStudentIds: ["GHS-1001"],
      createdAt: { toMillis: () => 500 },
    });

    assert.deepEqual(broadcast, {
      id: "b1",
      priority: "update",
      title: "Police are on campus",
      message: "Stay where you are.",
      createdAt: 500,
    });
  });

  it("drops inactive and non-student broadcasts", () => {
    assert.equal(mapStudentBroadcastDoc("b1", { active: false, title: "x", message: "y" }), null);
    assert.equal(
      mapStudentBroadcastDoc("b2", {
        active: true,
        audience: "staff",
        title: "x",
        message: "y",
      }),
      null,
    );
  });

  it("sorts by student priority before recency", () => {
    const broadcasts: StudentBroadcast[] = [
      { id: "2", priority: "update", title: "Update", message: "B", createdAt: 20 },
      { id: "3", priority: "all-clear", title: "Clear", message: "C", createdAt: 30 },
      { id: "1", priority: "emergency", title: "Emergency", message: "A", createdAt: 10 },
    ];

    assert.deepEqual(sortStudentBroadcasts(broadcasts).map((item) => item.id), ["1", "2", "3"]);
  });
});
