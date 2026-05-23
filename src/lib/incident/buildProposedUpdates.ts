import type { ParsedEmergencyReport } from "@/types/ai";
import type {
  ClassGroup,
  Location,
  LocationVisibility,
  ProposedStudentUpdate,
  Student,
  StudentIncidentState,
  StudentStatus,
} from "@/types/incident";
import type { AuthContext } from "@/types/user";

export type BuildProposedUpdatesInput = {
  parsed: ParsedEmergencyReport;
  reporter: AuthContext;
  students: Student[];
  classes: ClassGroup[];
  locations: Location[];
  currentStates: StudentIncidentState[];
};

type StudentMatch =
  | { kind: "matched"; student: Student; confidenceScore: number }
  | { kind: "ambiguous"; reason: string }
  | { kind: "missing"; reason: string };

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function firstName(value: string): string {
  return normalize(value).split(" ")[0] ?? "";
}

function includesNormalized(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle));
}

export function matchStudentByName(name: string, students: Student[]): StudentMatch {
  const target = normalize(name);
  if (!target) return { kind: "missing", reason: "Empty student name." };

  const exact = students.find((student) => normalize(student.fullName) === target);
  if (exact) return { kind: "matched", student: exact, confidenceScore: 1 };

  const caseInsensitive = students.filter((student) => normalize(student.fullName).includes(target));
  if (caseInsensitive.length === 1) {
    return { kind: "matched", student: caseInsensitive[0]!, confidenceScore: 0.9 };
  }
  if (caseInsensitive.length > 1) {
    return { kind: "ambiguous", reason: `Multiple students matched "${name}".` };
  }

  const byFirstName = students.filter((student) => firstName(student.fullName) === target);
  if (byFirstName.length === 1) {
    return { kind: "matched", student: byFirstName[0]!, confidenceScore: 0.72 };
  }
  if (byFirstName.length > 1) {
    return { kind: "ambiguous", reason: `First name "${name}" matched multiple students.` };
  }

  return { kind: "missing", reason: `No student matched "${name}".` };
}

export function matchClass(
  rawName: string | undefined,
  matchedName: string | undefined,
  classes: ClassGroup[],
): ClassGroup | null {
  const names = [matchedName, rawName].filter((value): value is string => Boolean(value?.trim()));
  for (const name of names) {
    const exact = classes.find((classGroup) => normalize(classGroup.name) === normalize(name));
    if (exact) return exact;

    const partial = classes.find(
      (classGroup) => includesNormalized(classGroup.name, name) || includesNormalized(name, classGroup.name),
    );
    if (partial) return partial;
  }
  return null;
}

export function matchLocation(parsed: ParsedEmergencyReport, locations: Location[]): Location | null {
  const candidates = [
    parsed.location?.matchedLocationLabel,
    parsed.location?.rawText,
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const label of candidates) {
    const exact = locations.find((location) => normalize(location.label) === normalize(label));
    if (exact) return exact;

    const partial = locations.find(
      (location) => includesNormalized(location.label, label) || includesNormalized(label, location.label),
    );
    if (partial) return partial;
  }

  return null;
}

function statusForContext(context: ParsedEmergencyReport["studentsMentioned"][number]["context"]): StudentStatus {
  switch (context) {
    case "injured":
      return "injured";
    case "needs_help":
      return "needs_help";
    case "missing":
      return "missing";
    case "present":
    case "safe":
      return "safe";
    case "last_seen":
      return "pending_verification";
    case "unknown":
      return "pending_verification";
  }
}

function parentStatusForUpdate(status: StudentStatus): ProposedStudentUpdate["parentVisibleStatus"] {
  switch (status) {
    case "safe":
    case "with_teacher":
    case "relocated":
      return "safe";
    case "needs_help":
    case "injured":
    case "with_nurse":
      return "needs_assistance";
    case "picked_up":
      return "picked_up";
    case "missing":
    case "unaccounted":
    case "pending_verification":
    case "unknown":
      return "being_verified";
  }
}

function locationVisibilityForReporter(reporter: AuthContext): LocationVisibility {
  if (reporter.role === "parent" || reporter.role === "student") return "admin_only";
  return "responder_and_admin";
}

function currentStateByStudentId(
  states: StudentIncidentState[],
): Map<string, StudentIncidentState> {
  return new Map(states.map((state) => [state.studentId, state]));
}

function makeUpdate({
  student,
  status,
  reason,
  confidenceScore,
  requiresReview,
  location,
  visibility,
  states,
}: {
  student: Student;
  status: StudentStatus;
  reason: string;
  confidenceScore: number;
  requiresReview: boolean;
  location: Location | null;
  visibility: LocationVisibility;
  states: ReadonlyMap<string, StudentIncidentState>;
}): ProposedStudentUpdate {
  const previous = states.get(student.id);
  return {
    studentId: student.id,
    studentName: student.fullName,
    previousStatus: previous?.status,
    newStatus: status,
    previousLocationLabel: previous?.locationLabel,
    newLocationId: location?.id,
    newLocationLabel: location?.label,
    confidenceScore,
    reason,
    requiresReview,
    parentVisibleStatus: parentStatusForUpdate(status),
    locationVisibility: visibility,
  };
}

function collectMissingNames(parsed: ParsedEmergencyReport): string[] {
  const names = new Set<string>();
  for (const name of parsed.missingStudents) {
    if (name.trim()) names.add(name.trim());
  }
  for (const mention of parsed.studentsMentioned) {
    if (mention.context === "missing" && mention.matchedStudentName) {
      names.add(mention.matchedStudentName);
    } else if (mention.context === "missing" && mention.rawText) {
      names.add(mention.rawText);
    }
  }
  return [...names];
}

function shouldReviewByReporter(
  reporter: AuthContext,
  student: Student,
  status: StudentStatus,
): boolean {
  if (reporter.role === "admin" || reporter.role === "teacher" || reporter.role === "responder") {
    return status === "picked_up";
  }

  if (reporter.role === "student") {
    return reporter.user.linkedStudentId !== student.id || status === "missing" || status === "injured";
  }

  return true;
}

export function buildProposedUpdates(input: BuildProposedUpdatesInput): ProposedStudentUpdate[] {
  const states = currentStateByStudentId(input.currentStates);
  const updates = new Map<string, ProposedStudentUpdate>();
  const location = matchLocation(input.parsed, input.locations);
  const visibility = locationVisibilityForReporter(input.reporter);
  const missingNames = collectMissingNames(input.parsed);
  const missingIds = new Set<string>();

  for (const name of missingNames) {
    const match = matchStudentByName(name, input.students);
    if (match.kind === "matched") {
      missingIds.add(match.student.id);
    }
  }

  for (const classReference of input.parsed.classReferences) {
    const classGroup = matchClass(
      classReference.rawText,
      classReference.matchedClassName,
      input.classes,
    );
    if (!classGroup) continue;

    const classIsSafe =
      input.parsed.groupStatus === "safe" ||
      input.parsed.studentsMentioned.some((mention) => mention.context === "safe");

    if (!classIsSafe && missingIds.size === 0) continue;

    for (const studentId of classGroup.studentIds) {
      const student = input.students.find((candidate) => candidate.id === studentId);
      if (!student) continue;

      const missing = missingIds.has(student.id);
      const status: StudentStatus = missing ? "missing" : "safe";
      const confidenceScore = Math.min(classReference.confidence, missing ? 0.86 : 0.9);
      const requiresReview =
        shouldReviewByReporter(input.reporter, student, status) ||
        classReference.confidence < 0.85 ||
        (missing && status !== states.get(student.id)?.status);

      updates.set(
        student.id,
        makeUpdate({
          student,
          status,
          reason: missing
            ? `${student.fullName} was listed as an exception to ${classGroup.name}.`
            : `${classGroup.name} was reported safe.`,
          confidenceScore,
          requiresReview,
          location,
          visibility,
          states,
        }),
      );
    }
  }

  for (const mention of input.parsed.studentsMentioned) {
    const name = mention.matchedStudentName ?? mention.rawText;
    const match = matchStudentByName(name, input.students);
    if (match.kind !== "matched") continue;

    const status = statusForContext(mention.context);
    const requiresReview =
      shouldReviewByReporter(input.reporter, match.student, status) ||
      mention.confidence < 0.85 ||
      status === "pending_verification";

    updates.set(
      match.student.id,
      makeUpdate({
        student: match.student,
        status,
        reason: `Report mentioned ${match.student.fullName} as ${mention.context}.`,
        confidenceScore: Math.min(mention.confidence, match.confidenceScore),
        requiresReview,
        location,
        visibility,
        states,
      }),
    );
  }

  for (const injured of input.parsed.injuredStudents) {
    const match = matchStudentByName(injured.nameRaw, input.students);
    if (match.kind !== "matched") continue;

    updates.set(
      match.student.id,
      makeUpdate({
        student: match.student,
        status: "injured",
        reason: injured.injuryDescription
          ? `${match.student.fullName} reported injured: ${injured.injuryDescription}.`
          : `${match.student.fullName} reported injured.`,
        confidenceScore: match.confidenceScore,
        requiresReview: shouldReviewByReporter(input.reporter, match.student, "injured"),
        location,
        visibility,
        states,
      }),
    );
  }

  return [...updates.values()];
}
