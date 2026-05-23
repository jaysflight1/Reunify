import { DEMO_SCHOOL_ID } from "@/lib/demo/constants";
import { getAdminDb, requireAdminAuth } from "@/lib/firebase/admin";
import type { AppUser, AuthContext, UserRole } from "@/types/user";
import { DEMO_AUTH_HEADER, demoUserById } from "./demo-users";

type RequireUserOptions = {
  roles?: UserRole[];
  schoolId?: string;
};

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function demoAuthAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_AUTH === "true";
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}

function assertRole(user: AppUser, roles?: UserRole[]) {
  if (!roles || roles.length === 0) return;
  if (!roles.includes(user.role)) {
    throw new AuthError(`Role ${user.role} is not allowed for this route.`, 403);
  }
}

function assertSchool(user: AppUser, schoolId?: string) {
  if (!schoolId) return;
  if (user.schoolId !== schoolId) {
    throw new AuthError("User does not belong to this school.", 403);
  }
}

function userFromFirestoreData(uid: string, data: FirebaseFirestore.DocumentData): AppUser {
  return {
    id: typeof data.id === "string" ? data.id : uid,
    schoolId: typeof data.schoolId === "string" ? data.schoolId : DEMO_SCHOOL_ID,
    role: data.role as UserRole,
    displayName: typeof data.displayName === "string" ? data.displayName : "Unknown user",
    email: typeof data.email === "string" ? data.email : undefined,
    phone: typeof data.phone === "string" ? data.phone : undefined,
    linkedStudentId: typeof data.linkedStudentId === "string" ? data.linkedStudentId : undefined,
    linkedStudentIds: Array.isArray(data.linkedStudentIds) ? data.linkedStudentIds : undefined,
    assignedClassIds: Array.isArray(data.assignedClassIds) ? data.assignedClassIds : undefined,
    isDemoUser: Boolean(data.isDemoUser),
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
  };
}

async function loadAppUser(uid: string, schoolId: string): Promise<AppUser> {
  const db = getAdminDb();
  if (!db) {
    throw new AuthError("Firebase Admin is not configured for authenticated routes.", 503);
  }

  const snap = await db.doc(`schools/${schoolId}/users/${uid}`).get();
  if (!snap.exists) {
    throw new AuthError("Authenticated user is not registered in this school.", 403);
  }

  return userFromFirestoreData(uid, snap.data() ?? {});
}

export async function requireUser(
  request: Request,
  options: RequireUserOptions = {},
): Promise<AuthContext> {
  const demoUserId = request.headers.get(DEMO_AUTH_HEADER);
  const demoUser = demoAuthAllowed() ? demoUserById(demoUserId) : null;
  if (demoUser) {
    assertRole(demoUser, options.roles);
    assertSchool(demoUser, options.schoolId);
    return {
      uid: demoUser.id,
      schoolId: demoUser.schoolId,
      role: demoUser.role,
      user: demoUser,
    };
  }

  const token = bearerToken(request);
  if (!token) {
    throw new AuthError("Missing Authorization bearer token.", 401);
  }

  const auth = requireAdminAuth();
  const decoded = await auth.verifyIdToken(token);
  const schoolId = options.schoolId ?? request.headers.get("x-school-id") ?? DEMO_SCHOOL_ID;
  const user = await loadAppUser(decoded.uid, schoolId);

  assertRole(user, options.roles);
  assertSchool(user, options.schoolId);

  return {
    uid: decoded.uid,
    schoolId: user.schoolId,
    role: user.role,
    user,
  };
}
