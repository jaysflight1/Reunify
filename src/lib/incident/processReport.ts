import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { requireAdminDb } from "@/lib/firebase/admin";
import { parseEmergencyReport } from "@/lib/openrouter/parseEmergencyReport";
import type {
  ClassGroup,
  Conflict,
  EmergencyReport,
  Location,
  ReportSource,
  Student,
  StudentIncidentState,
} from "@/types/incident";
import type { AuthContext } from "@/types/user";
import { applyReportUpdates, saveEmergencyReport } from "./applyReport";
import { buildProposedUpdates } from "./buildProposedUpdates";
import { detectConflicts } from "./detectConflicts";

export type SubmitReportInput = {
  schoolId: string;
  incidentId: string;
  rawText: string;
  source: ReportSource;
  reporter: AuthContext;
  db?: Firestore;
};

export type SubmitReportResult = {
  reportId: string;
  parsed: EmergencyReport["parsed"];
  proposedUpdates: EmergencyReport["proposedUpdates"];
  autoApplied: boolean;
  conflictsCreated: Conflict[];
  needsAdminReview: boolean;
};

type IncidentContext = {
  students: Student[];
  classes: ClassGroup[];
  locations: Location[];
  states: StudentIncidentState[];
};

function asRecord(data: DocumentData): Record<string, unknown> {
  return data as Record<string, unknown>;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapStudent(id: string, data: DocumentData): Student {
  const record = asRecord(data);
  const fullName = typeof record.fullName === "string" ? record.fullName : id;
  const [firstName = "", ...rest] = fullName.split(" ");
  return {
    id,
    schoolId: typeof record.schoolId === "string" ? record.schoolId : "",
    firstName: typeof record.firstName === "string" ? record.firstName : firstName,
    lastName: typeof record.lastName === "string" ? record.lastName : rest.join(" "),
    fullName,
    grade: typeof record.grade === "string" ? record.grade : "",
    classIds: stringArray(record.classIds),
    primaryClassId: typeof record.primaryClassId === "string" ? record.primaryClassId : undefined,
    phone: typeof record.phone === "string" ? record.phone : undefined,
    photoUrl: typeof record.photoUrl === "string" ? record.photoUrl : undefined,
    physicalDescription:
      typeof record.physicalDescription === "string" ? record.physicalDescription : undefined,
    medicalNotes: typeof record.medicalNotes === "string" ? record.medicalNotes : undefined,
    accessibilityNotes:
      typeof record.accessibilityNotes === "string" ? record.accessibilityNotes : undefined,
    parentGuardianIds: stringArray(record.parentGuardianIds),
    authorizedPickupGuardianIds: stringArray(record.authorizedPickupGuardianIds),
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
}

function mapClass(id: string, data: DocumentData): ClassGroup {
  const record = asRecord(data);
  return {
    id,
    schoolId: typeof record.schoolId === "string" ? record.schoolId : "",
    name: typeof record.name === "string" ? record.name : id,
    teacherUserId: typeof record.teacherUserId === "string" ? record.teacherUserId : "",
    teacherName: typeof record.teacherName === "string" ? record.teacherName : "",
    studentIds: stringArray(record.studentIds),
    roomId: typeof record.roomId === "string" ? record.roomId : undefined,
    roomLabel: typeof record.roomLabel === "string" ? record.roomLabel : undefined,
  };
}

function mapLocation(id: string, data: DocumentData): Location {
  const record = asRecord(data);
  return {
    id,
    schoolId: typeof record.schoolId === "string" ? record.schoolId : "",
    label: typeof record.label === "string" ? record.label : id,
    zone: typeof record.zone === "string" ? record.zone : undefined,
    type:
      record.type === "classroom" ||
      record.type === "gym" ||
      record.type === "field" ||
      record.type === "office" ||
      record.type === "nurse" ||
      record.type === "pickup"
        ? record.type
        : "other",
    parentSafeLabel: typeof record.parentSafeLabel === "string" ? record.parentSafeLabel : undefined,
    x: typeof record.x === "number" ? record.x : undefined,
    y: typeof record.y === "number" ? record.y : undefined,
  };
}

function mapStudentState(id: string, data: DocumentData): StudentIncidentState {
  const record = asRecord(data);
  return {
    studentId: typeof record.studentId === "string" ? record.studentId : id,
    schoolId: typeof record.schoolId === "string" ? record.schoolId : "",
    incidentId: typeof record.incidentId === "string" ? record.incidentId : "",
    status:
      record.status === "safe" ||
      record.status === "with_teacher" ||
      record.status === "missing" ||
      record.status === "needs_help" ||
      record.status === "injured" ||
      record.status === "with_nurse" ||
      record.status === "relocated" ||
      record.status === "picked_up" ||
      record.status === "pending_verification"
        ? record.status
        : "unaccounted",
    publicParentStatus:
      record.publicParentStatus === "safe" ||
      record.publicParentStatus === "being_verified" ||
      record.publicParentStatus === "needs_assistance" ||
      record.publicParentStatus === "pickup_ready" ||
      record.publicParentStatus === "picked_up"
        ? record.publicParentStatus
        : "no_update_yet",
    locationId: typeof record.locationId === "string" ? record.locationId : undefined,
    locationLabel: typeof record.locationLabel === "string" ? record.locationLabel : undefined,
    locationVisibility:
      record.locationVisibility === "responder_and_admin" ||
      record.locationVisibility === "parent_safe"
        ? record.locationVisibility
        : "admin_only",
    lastKnownLocationText:
      typeof record.lastKnownLocationText === "string" ? record.lastKnownLocationText : undefined,
    lastUpdatedAt: typeof record.lastUpdatedAt === "string" ? record.lastUpdatedAt : "",
    lastUpdatedByUserId:
      typeof record.lastUpdatedByUserId === "string" ? record.lastUpdatedByUserId : undefined,
    lastUpdatedByRole:
      record.lastUpdatedByRole === "admin" ||
      record.lastUpdatedByRole === "teacher" ||
      record.lastUpdatedByRole === "student" ||
      record.lastUpdatedByRole === "parent" ||
      record.lastUpdatedByRole === "responder"
        ? record.lastUpdatedByRole
        : undefined,
    lastReportId: typeof record.lastReportId === "string" ? record.lastReportId : undefined,
    confidence:
      record.confidence === "high" || record.confidence === "medium" ? record.confidence : "low",
    confidenceScore: typeof record.confidenceScore === "number" ? record.confidenceScore : undefined,
    isLocationAdultVerified: Boolean(record.isLocationAdultVerified),
    isStatusAdultVerified: Boolean(record.isStatusAdultVerified),
    notes: typeof record.notes === "string" ? record.notes : undefined,
    injuryNotes: typeof record.injuryNotes === "string" ? record.injuryNotes : undefined,
    timeline: [],
  };
}

async function loadIncidentContext(
  db: Firestore,
  schoolId: string,
  incidentId: string,
): Promise<IncidentContext> {
  const [studentsSnap, classesSnap, locationsSnap, statesSnap] = await Promise.all([
    db.collection(`schools/${schoolId}/students`).get(),
    db.collection(`schools/${schoolId}/classes`).get(),
    db.collection(`schools/${schoolId}/locations`).get(),
    db.collection(`schools/${schoolId}/incidents/${incidentId}/studentStates`).get(),
  ]);

  return {
    students: studentsSnap.docs.map((doc) => mapStudent(doc.id, doc.data())),
    classes: classesSnap.docs.map((doc) => mapClass(doc.id, doc.data())),
    locations: locationsSnap.docs.map((doc) => mapLocation(doc.id, doc.data())),
    states: statesSnap.docs.map((doc) => mapStudentState(doc.id, doc.data())),
  };
}

function canAutoApply(
  report: Pick<EmergencyReport, "confidenceScore" | "proposedUpdates">,
  conflicts: Conflict[],
  reporter: AuthContext,
): boolean {
  if (report.confidenceScore < 0.85) return false;
  if (conflicts.some((conflict) => conflict.severity === "high")) return false;
  if (report.proposedUpdates.some((update) => update.requiresReview)) return false;
  if (report.proposedUpdates.some((update) => update.newStatus === "picked_up")) return false;

  if (reporter.role === "admin" || reporter.role === "teacher" || reporter.role === "responder") {
    return true;
  }

  if (reporter.role === "student") {
    return report.proposedUpdates.every((update) => update.studentId === reporter.user.linkedStudentId);
  }

  return false;
}

async function saveConflicts(db: Firestore, conflicts: Conflict[]): Promise<void> {
  if (conflicts.length === 0) return;
  const batch = db.batch();
  for (const conflict of conflicts) {
    batch.set(
      db.doc(`schools/${conflict.schoolId}/incidents/${conflict.incidentId}/conflicts/${conflict.id}`),
      conflict,
      { merge: true },
    );
  }
  await batch.commit();
}

export async function processSubmittedReport(input: SubmitReportInput): Promise<SubmitReportResult> {
  const db = input.db ?? requireAdminDb();
  const now = new Date().toISOString();
  const reportRef = db.collection(`schools/${input.schoolId}/incidents/${input.incidentId}/reports`).doc();
  const context = await loadIncidentContext(db, input.schoolId, input.incidentId);
  const parsedResult = await parseEmergencyReport({
    rawText: input.rawText,
    reporter: input.reporter,
    students: context.students,
    classes: context.classes,
    locations: context.locations,
  });

  const proposedUpdates = buildProposedUpdates({
    parsed: parsedResult.parsed,
    reporter: input.reporter,
    students: context.students,
    classes: context.classes,
    locations: context.locations,
    currentStates: context.states,
  });

  const conflicts = detectConflicts({
    schoolId: input.schoolId,
    incidentId: input.incidentId,
    reportId: reportRef.id,
    reporter: input.reporter,
    proposedUpdates,
    currentStates: context.states,
    now,
  });

  const autoApplied = canAutoApply(
    { confidenceScore: parsedResult.confidenceScore, proposedUpdates },
    conflicts,
    input.reporter,
  );
  const needsAdminReview =
    parsedResult.needsAdminReview || !autoApplied || conflicts.length > 0 || proposedUpdates.length === 0;

  const report: EmergencyReport = {
    id: reportRef.id,
    schoolId: input.schoolId,
    incidentId: input.incidentId,
    source: input.source,
    reporterUserId: input.reporter.uid,
    reporterRole: input.reporter.role,
    reporterDisplayName: input.reporter.user.displayName,
    rawText: input.rawText,
    transcript: input.source === "voice" ? input.rawText : undefined,
    createdAt: now,
    parsed: parsedResult.parsed,
    proposedUpdates,
    reviewStatus: autoApplied ? "auto_applied" : "needs_review",
    urgency: parsedResult.urgency,
    confidenceScore: parsedResult.confidenceScore,
    needsAdminReview,
    appliedAt: autoApplied ? now : undefined,
    appliedByUserId: autoApplied ? input.reporter.uid : undefined,
  };

  await saveEmergencyReport(report, db);
  await saveConflicts(db, conflicts);

  if (autoApplied) {
    await applyReportUpdates({
      schoolId: input.schoolId,
      incidentId: input.incidentId,
      reportId: report.id,
      updates: proposedUpdates,
      appliedBy: input.reporter,
      reviewStatus: "auto_applied",
      db,
      now,
    });
  }

  return {
    reportId: report.id,
    parsed: report.parsed,
    proposedUpdates,
    autoApplied,
    conflictsCreated: conflicts,
    needsAdminReview,
  };
}
