import type { Status } from "@/lib/demo-data";

export type AdminStudentRecord = {
  id: string;
  name: string;
  grade: string;
  status: Status | "unaccounted";
  roomNumber?: string;
  teacherName?: string;
  note?: string;
  updatedAt?: string;
};

export type AdminAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
};
