import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { StudentReport, TeacherRoomReport } from "./types";
import { mapTeacherDoc } from "./teacher-reports";
import { ACTIVE_DRILL_ID, OFF_CAMPUS_ROOM } from "./config";

function parseJsonServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as ServiceAccount & { private_key?: string };
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseSplitServiceAccount(): ServiceAccount | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

function parseServiceAccount(): ServiceAccount | null {
  return parseSplitServiceAccount() ?? parseJsonServiceAccount();
}

export function firebaseAdminConfigError(): string {
  return "Firebase Admin credentials are missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY, or set FIREBASE_SERVICE_ACCOUNT_JSON for the current proof of concept.";
}

export function getAdminApp(): App | null {
  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) return null;

  try {
    if (getApps().length) return getApps()[0]!;
    return initializeApp({
      credential: cert(serviceAccount),
    });
  } catch {
    return null;
  }
}

export function isFirebaseAdminConfigured(): boolean {
  return parseServiceAccount() !== null;
}

export function getAdminDb(): Firestore | null {
  const app = getAdminApp();
  if (!app) return null;
  return getFirestore(app);
}

export function getAdminAuth(): Auth | null {
  const app = getAdminApp();
  if (!app) return null;
  return getAuth(app);
}

export function requireAdminDb(): Firestore {
  const db = getAdminDb();
  if (!db) throw new Error(firebaseAdminConfigError());
  return db;
}

export function requireAdminAuth(): Auth {
  const auth = getAdminAuth();
  if (!auth) throw new Error(firebaseAdminConfigError());
  return auth;
}

export async function fetchDrillReportsAdmin(
  drillId: string = ACTIVE_DRILL_ID,
): Promise<StudentReport[]> {
  const db = getAdminDb();
  if (!db) return [];

  // Single-field filter — no composite index required (sort in memory).
  const snap = await db.collection("reports").where("drillId", "==", drillId).get();

  const reports = snap.docs.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt?.toMillis?.() ?? Date.now();
    const updatedAt = data.updatedAt?.toMillis?.() ?? createdAt;
    return {
      id: d.id,
      drillId: data.drillId ?? drillId,
      studentUid: data.studentUid ?? "",
      studentName: data.studentName ?? "Unknown",
      studentId: data.studentId ?? "",
      grade: data.grade ?? "",
      status: data.status === "unsafe" ? "unsafe" : "safe",
      offCampus: Boolean(data.offCampus) || data.roomNumber === OFF_CAMPUS_ROOM,
      shooterNearby: Boolean(data.shooterNearby),
      roomNumber: data.roomNumber ?? "",
      teacherName: data.teacherName ?? "",
      location: data.location ?? null,
      note: data.note ?? null,
      createdAt,
      updatedAt,
    } satisfies StudentReport;
  });

  return reports.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function fetchTeacherReportsAdmin(
  drillId: string = ACTIVE_DRILL_ID,
): Promise<TeacherRoomReport[]> {
  const db = getAdminDb();
  if (!db) return [];

  const snap = await db.collection("teacherReports").where("drillId", "==", drillId).get();

  return snap.docs
    .map((d) => mapTeacherDoc(d.id, d.data()))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export type RoomRecord = {
  number: string;
  label: string;
  building: string;
  teacher: string;
};

export async function seedFirestoreCatalog(
  drillId: string = ACTIVE_DRILL_ID,
  rooms: RoomRecord[],
): Promise<{ rooms: number; drill: boolean }> {
  const db = getAdminDb();
  if (!db) throw new Error(firebaseAdminConfigError());

  const batch = db.batch();
  for (const room of rooms) {
    const ref = db.collection("rooms").doc(room.number);
    batch.set(ref, {
      number: room.number,
      label: room.label,
      building: room.building,
      teacher: room.teacher,
      updatedAt: new Date(),
    });
  }

  batch.set(db.collection("drills").doc(drillId), {
    id: drillId,
    name: "Active evacuation drill",
    active: true,
    school: "Los Altos High School",
    updatedAt: new Date(),
  });

  await batch.commit();
  return { rooms: rooms.length, drill: true };
}

const FIRESTORE_BATCH_LIMIT = 500;

async function deleteQueryDocs(
  db: Firestore,
  collectionName: string,
  drillId: string,
): Promise<number> {
  let deleted = 0;

  while (true) {
    const snap = await db
      .collection(collectionName)
      .where("drillId", "==", drillId)
      .limit(FIRESTORE_BATCH_LIMIT)
      .get();

    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snap.docs.length;

    if (snap.size < FIRESTORE_BATCH_LIMIT) break;
  }

  return deleted;
}

/** Remove all student and teacher check-ins for a drill (demo reset). */
export async function clearDrillReportsAdmin(
  drillId: string = ACTIVE_DRILL_ID,
): Promise<{ studentReports: number; teacherReports: number }> {
  const db = requireAdminDb();

  const [studentReports, teacherReports] = await Promise.all([
    deleteQueryDocs(db, "reports", drillId),
    deleteQueryDocs(db, "teacherReports", drillId),
  ]);

  return { studentReports, teacherReports };
}
