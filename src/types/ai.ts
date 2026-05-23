import type { ReportUrgency } from "./incident";
import type { UserRole } from "./user";

export type ParsedStudentContext =
  | "present"
  | "missing"
  | "injured"
  | "needs_help"
  | "safe"
  | "last_seen"
  | "unknown";

export type ParsedGroupStatus = "safe" | "unsafe" | "needs_help" | "mixed" | "unknown";

export type ParsedEmergencyReport = {
  reporter?: {
    name?: string;
    role?: UserRole;
    confidence: number;
  };
  location?: {
    rawText: string;
    matchedLocationId?: string;
    matchedLocationLabel?: string;
    confidence: number;
  };
  classReferences: Array<{
    rawText: string;
    matchedClassId?: string;
    matchedClassName?: string;
    confidence: number;
  }>;
  studentsMentioned: Array<{
    rawText: string;
    matchedStudentId?: string;
    matchedStudentName?: string;
    confidence: number;
    context: ParsedStudentContext;
  }>;
  groupStatus?: ParsedGroupStatus;
  missingStudents: string[];
  injuredStudents: Array<{
    studentId?: string;
    nameRaw: string;
    injuryDescription?: string;
  }>;
  notes: string;
  safetyDetails: {
    doorLocked?: boolean;
    withAdult?: boolean;
    needsMedical?: boolean;
    needsEvacuation?: boolean;
  };
  ambiguities: string[];
  contradictions: string[];
};

export type ParsedEmergencyReportResult = {
  parsed: ParsedEmergencyReport;
  urgency: ReportUrgency;
  confidenceScore: number;
  needsAdminReview: boolean;
};

export type GeminiSafetyTone = "calm" | "urgent" | "brief";
