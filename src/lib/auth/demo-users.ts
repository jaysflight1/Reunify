import {
  DEMO_APP_USERS,
  DEMO_CLASS_47_ID,
  DEMO_PARENT_ANN_ROY_ID,
  DEMO_SCHOOL_ID,
  DEMO_STUDENT_JAY_ROY_ID,
} from "@/lib/demo/constants";
import type { AppUser, UserRole } from "@/types/user";

const NOW = "2026-05-23T12:00:00.000Z";

export const DEMO_AUTH_HEADER = "x-demo-user-id";
export const DEMO_USER_STORAGE_KEY = "reunify.demoUserId";

export const DEMO_USERS: Record<string, AppUser> = {
  [DEMO_APP_USERS.admin]: {
    id: DEMO_APP_USERS.admin,
    schoolId: DEMO_SCHOOL_ID,
    role: "admin",
    displayName: "Demo Admin",
    isDemoUser: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  [DEMO_APP_USERS.teacher]: {
    id: DEMO_APP_USERS.teacher,
    schoolId: DEMO_SCHOOL_ID,
    role: "teacher",
    displayName: "Ms. Rivera",
    assignedClassIds: [DEMO_CLASS_47_ID],
    isDemoUser: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  [DEMO_APP_USERS.student]: {
    id: DEMO_APP_USERS.student,
    schoolId: DEMO_SCHOOL_ID,
    role: "student",
    displayName: "Lydia Chen",
    linkedStudentId: "student-lydia-chen",
    isDemoUser: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  [DEMO_APP_USERS.parent]: {
    id: DEMO_APP_USERS.parent,
    schoolId: DEMO_SCHOOL_ID,
    role: "parent",
    displayName: "Alyssa Wang Parent",
    linkedStudentIds: ["student-alyssa-wang"],
    isDemoUser: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  [DEMO_APP_USERS.responder]: {
    id: DEMO_APP_USERS.responder,
    schoolId: DEMO_SCHOOL_ID,
    role: "responder",
    displayName: "Demo Responder",
    isDemoUser: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  [DEMO_STUDENT_JAY_ROY_ID]: {
    id: DEMO_STUDENT_JAY_ROY_ID,
    schoolId: DEMO_SCHOOL_ID,
    role: "student",
    displayName: "Jay Roy",
    linkedStudentId: "student-jay-roy",
    isDemoUser: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  [DEMO_PARENT_ANN_ROY_ID]: {
    id: DEMO_PARENT_ANN_ROY_ID,
    schoolId: DEMO_SCHOOL_ID,
    role: "parent",
    displayName: "Ann Roy",
    linkedStudentIds: ["student-jay-roy"],
    isDemoUser: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
};

export const DEMO_ROLE_OPTIONS: Array<{
  role: UserRole;
  userId: string;
  label: string;
  href: string;
}> = [
  { role: "admin", userId: DEMO_APP_USERS.admin, label: "Admin", href: "/admin" },
  { role: "teacher", userId: DEMO_APP_USERS.teacher, label: "Teacher", href: "/teacher" },
  { role: "student", userId: DEMO_APP_USERS.student, label: "Student", href: "/student" },
  { role: "parent", userId: DEMO_APP_USERS.parent, label: "Parent", href: "/parent" },
  { role: "responder", userId: DEMO_APP_USERS.responder, label: "Responder", href: "/responder" },
  { role: "student", userId: DEMO_STUDENT_JAY_ROY_ID, label: "Jay Roy", href: "/student" },
  { role: "parent", userId: DEMO_PARENT_ANN_ROY_ID, label: "Ann Roy", href: "/parent" },
];

export function demoUserById(userId: string | null): AppUser | null {
  if (!userId) return null;
  return DEMO_USERS[userId] ?? null;
}
