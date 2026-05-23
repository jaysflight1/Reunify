import type {
  Conflict,
  ConflictSeverity,
  ConflictType,
  ProposedStudentUpdate,
  StudentIncidentState,
  StudentStatus,
} from "@/types/incident";
import type { AuthContext } from "@/types/user";

export type DetectConflictsInput = {
  schoolId: string;
  incidentId: string;
  reportId: string;
  reporter: AuthContext;
  proposedUpdates: ProposedStudentUpdate[];
  currentStates: StudentIncidentState[];
  now?: string;
};

function stateByStudentId(states: StudentIncidentState[]): Map<string, StudentIncidentState> {
  return new Map(states.map((state) => [state.studentId, state]));
}

function conflictId(reportId: string, type: ConflictType, studentId: string | undefined): string {
  return `${reportId}-${type}-${studentId ?? "general"}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function isPresentStatus(status: StudentStatus): boolean {
  return status === "safe" || status === "with_teacher" || status === "relocated";
}

function isMissingStatus(status: StudentStatus): boolean {
  return status === "missing" || status === "unaccounted";
}

function makeConflict({
  input,
  update,
  type,
  severity,
  summary,
}: {
  input: DetectConflictsInput;
  update: ProposedStudentUpdate;
  type: ConflictType;
  severity: ConflictSeverity;
  summary: string;
}): Conflict {
  return {
    id: conflictId(input.reportId, type, update.studentId),
    schoolId: input.schoolId,
    incidentId: input.incidentId,
    studentId: update.studentId,
    type,
    severity,
    summary,
    relatedReportIds: [input.reportId],
    status: "open",
    createdAt: input.now ?? new Date().toISOString(),
  };
}

export function detectConflicts(input: DetectConflictsInput): Conflict[] {
  const states = stateByStudentId(input.currentStates);
  const conflicts: Conflict[] = [];

  for (const update of input.proposedUpdates) {
    const previous = states.get(update.studentId);

    if (previous && isPresentStatus(previous.status) && isMissingStatus(update.newStatus)) {
      conflicts.push(
        makeConflict({
          input,
          update,
          type: "safe_vs_missing",
          severity: previous.isStatusAdultVerified ? "high" : "medium",
          summary: `${update.studentName} was previously marked ${previous.status} and is now proposed as ${update.newStatus}.`,
        }),
      );
    }

    if (previous && isMissingStatus(previous.status) && isPresentStatus(update.newStatus)) {
      conflicts.push(
        makeConflict({
          input,
          update,
          type: "safe_vs_missing",
          severity: input.reporter.role === "student" ? "medium" : "low",
          summary: `${update.studentName} was previously ${previous.status} and is now reported ${update.newStatus}.`,
        }),
      );
    }

    if (previous?.status === "picked_up" && isPresentStatus(update.newStatus)) {
      conflicts.push(
        makeConflict({
          input,
          update,
          type: "picked_up_vs_present",
          severity: "high",
          summary: `${update.studentName} was marked picked up but is now reported present.`,
        }),
      );
    }

    if (previous?.status === "injured" && update.newStatus === "safe") {
      conflicts.push(
        makeConflict({
          input,
          update,
          type: "injured_vs_safe",
          severity: "medium",
          summary: `${update.studentName} was previously marked injured and is now proposed safe.`,
        }),
      );
    }

    if (
      previous?.locationLabel &&
      update.newLocationLabel &&
      previous.locationLabel !== update.newLocationLabel
    ) {
      conflicts.push(
        makeConflict({
          input,
          update,
          type: "different_locations",
          severity: previous.isLocationAdultVerified ? "high" : "medium",
          summary: `${update.studentName} has conflicting locations: ${previous.locationLabel} and ${update.newLocationLabel}.`,
        }),
      );
    }

    if (input.reporter.role === "student" && input.reporter.user.linkedStudentId !== update.studentId) {
      conflicts.push(
        makeConflict({
          input,
          update,
          type: "uncertain_name_match",
          severity: "medium",
          summary: `${update.studentName} was reported by a student account and needs adult verification.`,
        }),
      );
    }
  }

  return conflicts;
}
