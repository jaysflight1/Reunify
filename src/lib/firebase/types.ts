import type { Status } from "@/lib/demo-data";

export type GeoLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export type StudentReport = {
  id: string;
  drillId: string;
  studentUid: string;
  studentName: string;
  studentId: string;
  grade: string;
  status: Status;
  offCampus: boolean;
  shooterNearby: boolean;
  roomNumber: string;
  teacherName: string;
  location: GeoLocation | null;
  note: string | null;
  createdAt: number;
  updatedAt: number;
};

export type StudentReportInput = {
  studentName: string;
  studentId: string;
  grade: string;
  status: Status;
  offCampus: boolean;
  shooterNearby?: boolean;
  roomNumber: string;
  teacherName: string;
  location: GeoLocation | null;
  note?: string;
};

export type TeacherReportInputMode = "voice" | "checkbox";

export type TeacherRoomReport = {
  id: string;
  drillId: string;
  teacherUid: string;
  roomNumber: string;
  /** Room explicitly stated in voice, if different from dropdown selection. */
  spokenRoomNumber: string | null;
  teacherName: string;
  presentIds: string[];
  missingIds: string[];
  /** Names from voice that didn't match roster (staff follow-up). */
  unmatchedMissing: string[];
  allAccounted: boolean;
  note: string | null;
  transcript: string | null;
  inputMode: TeacherReportInputMode;
  createdAt: number;
  updatedAt: number;
};

export type TeacherReportSubmit = {
  roomNumber: string;
  spokenRoomNumber?: string | null;
  teacherName: string;
  presentIds: string[];
  missingIds: string[];
  unmatchedMissing?: string[];
  allAccounted: boolean;
  note?: string | null;
  transcript?: string | null;
  inputMode: TeacherReportInputMode;
};
