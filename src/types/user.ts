export type UserRole = "admin" | "teacher" | "student" | "parent" | "responder";

export type AppUser = {
  id: string;
  schoolId: string;
  role: UserRole;
  displayName: string;
  email?: string;
  phone?: string;
  linkedStudentId?: string;
  linkedStudentIds?: string[];
  assignedClassIds?: string[];
  isDemoUser: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuthContext = {
  uid: string;
  schoolId: string;
  role: UserRole;
  user: AppUser;
};
