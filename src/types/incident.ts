import type { ParsedEmergencyReport } from "./ai";
import type { UserRole } from "./user";

export type StudentStatus =
  | "unknown"
  | "safe"
  | "with_teacher"
  | "unaccounted"
  | "missing"
  | "needs_help"
  | "injured"
  | "with_nurse"
  | "relocated"
  | "picked_up"
  | "pending_verification";

export type ParentPublicStatus =
  | "safe"
  | "being_verified"
  | "needs_assistance"
  | "pickup_ready"
  | "picked_up"
  | "no_update_yet";

export type LocationVisibility = "admin_only" | "responder_and_admin" | "parent_safe";

export type ConfidenceLevel = "low" | "medium" | "high";

export type Student = {
  id: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  grade: string;
  classIds: string[];
  primaryClassId?: string;
  phone?: string;
  photoUrl?: string;
  physicalDescription?: string;
  medicalNotes?: string;
  accessibilityNotes?: string;
  parentGuardianIds: string[];
  authorizedPickupGuardianIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type StudentTimelineEventType =
  | "status_update"
  | "location_update"
  | "missing_report"
  | "found_report"
  | "injury_report"
  | "pickup_update"
  | "manual_override"
  | "conflict_detected";

export type StudentTimelineEvent = {
  id: string;
  timestamp: string;
  type: StudentTimelineEventType;
  summary: string;
  reportId?: string;
  actorUserId?: string;
  actorRole?: UserRole;
};

export type StudentIncidentState = {
  studentId: string;
  schoolId: string;
  incidentId: string;
  status: StudentStatus;
  publicParentStatus: ParentPublicStatus;
  locationId?: string;
  locationLabel?: string;
  locationVisibility: LocationVisibility;
  lastKnownLocationText?: string;
  lastUpdatedAt: string;
  lastUpdatedByUserId?: string;
  lastUpdatedByRole?: UserRole;
  lastReportId?: string;
  confidence: ConfidenceLevel;
  confidenceScore?: number;
  isLocationAdultVerified: boolean;
  isStatusAdultVerified: boolean;
  notes?: string;
  injuryNotes?: string;
  lastSighted?: {
    text: string;
    reportedAt: string;
    reportedByUserId?: string;
    reportId?: string;
  };
  timeline: StudentTimelineEvent[];
};

export type ClassGroup = {
  id: string;
  schoolId: string;
  name: string;
  teacherUserId: string;
  teacherName: string;
  studentIds: string[];
  roomId?: string;
  roomLabel?: string;
};

export type LocationType =
  | "classroom"
  | "gym"
  | "field"
  | "office"
  | "nurse"
  | "pickup"
  | "other";

export type Location = {
  id: string;
  schoolId: string;
  label: string;
  zone?: string;
  type: LocationType;
  parentSafeLabel?: string;
  x?: number;
  y?: number;
};

export type IncidentType =
  | "gas_leak"
  | "fire"
  | "earthquake"
  | "lockdown"
  | "power_outage"
  | "other";

export type IncidentStatus = "active" | "resolved" | "drill";

export type Incident = {
  id: string;
  schoolId: string;
  title: string;
  type: IncidentType;
  status: IncidentStatus;
  startedAt: string;
  endedAt?: string;
  createdByUserId: string;
  description?: string;
  demoScenario?: boolean;
};

export type ReportSource = "voice" | "text" | "sms" | "manual";

export type ReportReviewStatus =
  | "pending"
  | "auto_applied"
  | "approved"
  | "rejected"
  | "needs_review";

export type ReportUrgency = "low" | "medium" | "high" | "critical";

export type ProposedStudentUpdate = {
  studentId: string;
  studentName: string;
  previousStatus?: StudentStatus;
  newStatus: StudentStatus;
  previousLocationLabel?: string;
  newLocationId?: string;
  newLocationLabel?: string;
  confidenceScore: number;
  reason: string;
  requiresReview: boolean;
  parentVisibleStatus?: ParentPublicStatus;
  locationVisibility: LocationVisibility;
};

export type EmergencyReport = {
  id: string;
  schoolId: string;
  incidentId: string;
  source: ReportSource;
  reporterUserId?: string;
  reporterRole?: UserRole;
  reporterDisplayName?: string;
  rawText: string;
  transcript?: string;
  audioStoragePath?: string;
  createdAt: string;
  parsed: ParsedEmergencyReport;
  proposedUpdates: ProposedStudentUpdate[];
  reviewStatus: ReportReviewStatus;
  urgency: ReportUrgency;
  confidenceScore: number;
  needsAdminReview: boolean;
  appliedAt?: string;
  appliedByUserId?: string;
  rejectedAt?: string;
  rejectedByUserId?: string;
};

export type ConflictType =
  | "different_locations"
  | "picked_up_vs_present"
  | "safe_vs_missing"
  | "injured_vs_safe"
  | "unknown_student"
  | "uncertain_name_match";

export type ConflictSeverity = "low" | "medium" | "high";

export type ConflictStatus = "open" | "resolved" | "dismissed";

export type Conflict = {
  id: string;
  schoolId: string;
  incidentId: string;
  studentId?: string;
  type: ConflictType;
  severity: ConflictSeverity;
  summary: string;
  relatedReportIds: string[];
  status: ConflictStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
};

export type ParentSafeStudentStatus = {
  studentId: string;
  studentName: string;
  publicParentStatus: ParentPublicStatus;
  lastUpdatedAt: string;
  parentSafeMessage: string;
  pickupInstructions?: string;
};
