import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildParentSafeMessage } from "./parent-safe-template";
import { PARENT_CHILD_SAFE_TEMPLATE_ID } from "./types";
import { isLikelyE164, redactPhone } from "./redact";

describe("buildParentSafeMessage", () => {
  it("renders the approved template with names and school", () => {
    const result = buildParentSafeMessage({
      studentFirstName: "Jay",
      studentLastName: "Roy",
      schoolName: "General High School",
    });

    assert.equal(result.templateId, PARENT_CHILD_SAFE_TEMPLATE_ID);
    assert.equal(
      result.body,
      "Reunify Demo: Your student Jay Roy has been marked safe with school staff at " +
        "General High School. Please wait for further school instructions. " +
        "Reply STOP to opt out of SMS notifications.",
    );
  });

  it("falls back to a generic school name when missing", () => {
    const result = buildParentSafeMessage({
      studentFirstName: "Jay",
      studentLastName: "Roy",
      schoolName: "   ",
    });
    assert.match(result.body, /at their school\./);
  });

  it("omits the name (no duplicated 'your student') when both names are blank", () => {
    const result = buildParentSafeMessage({
      studentFirstName: "",
      studentLastName: "",
      schoolName: "General High School",
    });
    assert.match(result.body, /^Reunify Demo: Your student has been marked safe with school staff/);
    assert.doesNotMatch(result.body, /your student your student/i);
  });

  it("uses only the first name when last name is blank", () => {
    const result = buildParentSafeMessage({
      studentFirstName: "Jay",
      studentLastName: "  ",
      schoolName: "General High School",
    });
    assert.match(result.body, /Your student Jay has been marked safe/);
  });

  it("includes the required opt-out phrase", () => {
    const result = buildParentSafeMessage({
      studentFirstName: "Jay",
      studentLastName: "Roy",
      schoolName: "General High School",
    });
    assert.match(result.body, /Reply STOP to opt out of SMS notifications\./);
  });

  it("identifies the sender as Reunify Demo and not an official alert", () => {
    const result = buildParentSafeMessage({
      studentFirstName: "Jay",
      studentLastName: "Roy",
      schoolName: "General High School",
    });
    assert.match(result.body, /^Reunify Demo:/);
    assert.doesNotMatch(result.body, /official|emergency alert|911|evacuation order/i);
  });

  it("trims and collapses whitespace inside names", () => {
    const result = buildParentSafeMessage({
      studentFirstName: "  Jay  ",
      studentLastName: "  Roy\tRoy ",
      schoolName: "General High School",
    });
    assert.match(result.body, /Your student Jay Roy Roy has been marked safe/);
  });

  it("the fixed template string contains no sensitive tactical tokens", () => {
    // Scope of this check: the *fixed* template strings only (greeting,
    // verbs, opt-out phrase, school-context wording). We do NOT sanitize
    // caller-supplied values (studentFirstName, studentLastName, schoolName)
    // beyond whitespace trimming, so this test does not claim those inputs
    // are safe — only the template scaffolding itself. Caller-side data
    // hygiene is the responsibility of the orchestrator and its inputs.
    const result = buildParentSafeMessage({
      studentFirstName: "Jay",
      studentLastName: "Roy",
      schoolName: "Reunify School",
    });

    const forbidden = [
      /\broom\b/i,
      /\bteacher\b/i,
      /\bbuilding\b/i,
      /\blocation\b/i,
      /\bgas leak\b/i,
      /\bfire\b/i,
      /\blockdown\b/i,
      /\bearthquake\b/i,
      /\bshooter\b/i,
      /\binjured\b/i,
      /\bnurse\b/i,
      /\blat(itude)?\b/i,
      /\blon(gitude)?\b/i,
      /\bnote[s]?\b/i,
      /\bincident\b/i,
    ];
    for (const pattern of forbidden) {
      assert.doesNotMatch(result.body, pattern, `template leaked: ${pattern}`);
    }
  });

  it("type signature prevents passing internal incident fields (compile-time check, runtime witness)", () => {
    // The payload type is the *only* surface. This test exists as a runtime
    // witness for the structural guarantee: any future widening of
    // ParentSafeSmsPayload that adds, e.g., `locationLabel` would require
    // editing this file and would be visible in code review.
    type PayloadKeys = keyof Parameters<typeof buildParentSafeMessage>[0];
    const allowed: Record<PayloadKeys, true> = {
      studentFirstName: true,
      studentLastName: true,
      schoolName: true,
    };
    assert.deepEqual(Object.keys(allowed).sort(), [
      "schoolName",
      "studentFirstName",
      "studentLastName",
    ]);
  });
});

describe("redactPhone", () => {
  it("keeps the leading + and last four digits", () => {
    assert.equal(redactPhone("+15555550123"), "+•••••0123");
  });

  it("handles missing input", () => {
    assert.equal(redactPhone(undefined), "•••");
    assert.equal(redactPhone(null), "•••");
    assert.equal(redactPhone(""), "•••");
  });

  it("handles short input safely", () => {
    assert.equal(redactPhone("12"), "•••");
  });

  it("strips formatting before computing last four", () => {
    assert.equal(redactPhone("+1 (555) 555-0123"), "+•••••0123");
  });
});

describe("isLikelyE164", () => {
  it("accepts standard E.164", () => {
    assert.equal(isLikelyE164("+15555550100"), true);
  });

  it("rejects formatted, local, or missing values", () => {
    assert.equal(isLikelyE164("+1 (555) 555-0100"), false);
    assert.equal(isLikelyE164("5555550100"), false);
    assert.equal(isLikelyE164(""), false);
    assert.equal(isLikelyE164(undefined), false);
    assert.equal(isLikelyE164("+05555550100"), false);
  });
});
