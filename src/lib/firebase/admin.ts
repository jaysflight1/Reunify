import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { StudentReport, TeacherRoomReport } from "./types";
import { mapTeacherDoc } from "./teacher-reports";
import { ACTIVE_DRILL_ID } from "./config";

function parseServiceAccount(): Record<string, unknown> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch {
    return null;
  }
}

function getAdminApp(): App | null {
  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) return null;

  try {
    if (getApps().length) return getApps()[0]!;
    return initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
    });
  } catch {
    return null;
  }
}

export function isFirebaseAdminConfigured(): boolean {
  return parseServiceAccount() !== null;
}

function getAdminDb(): Firestore | null {
  const app = getAdminApp();
  if (!app) return null;
  return getFirestore(app);
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
  if (!db) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON not configured");

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
