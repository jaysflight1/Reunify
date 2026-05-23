import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import {
  ACTIVE_DRILL_ID,
  OFF_CAMPUS_ROOM,
  getClientAuth,
  getClientFirestore,
  isFirebaseConfigured,
} from "./config";
import { isReportArchived } from "./report-archive";
import type { StudentReport, StudentReportInput } from "./types";

const REPORTS = "reports";

function mapDoc(id: string, data: DocumentData): StudentReport {
  const createdAt = data.createdAt?.toMillis?.() ?? Date.now();
  const updatedAt = data.updatedAt?.toMillis?.() ?? createdAt;
  return {
    id,
    drillId: data.drillId ?? ACTIVE_DRILL_ID,
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
  };
}

function authConsoleUrl(): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "your-project";
  return `https://console.firebase.google.com/project/${projectId}/authentication/providers`;
}

export function friendlyFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const message = err instanceof Error ? err.message : "";

  if (
    code === "auth/configuration-not-found" ||
    message.includes("CONFIGURATION_NOT_FOUND")
  ) {
    return (
      "Firebase Authentication is not set up for this project. In Firebase Console open Authentication → Get started, then enable Anonymous sign-in. " +
      authConsoleUrl()
    );
  }
  if (code === "auth/operation-not-allowed") {
    return `Anonymous sign-in is disabled. Enable it under Authentication → Sign-in method → Anonymous. ${authConsoleUrl()}`;
  }
  if (code === "auth/unauthorized-domain") {
    return "This site is not authorized. Add localhost to Authentication → Settings → Authorized domains.";
  }
  if (code === "permission-denied") {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "your-project";
    return (
      "Permission denied — Firestore rules may be missing or outdated. Run: npm run firebase:deploy " +
      `(or deploy firestore.rules in Console for project ${projectId}).`
    );
  }
  if (err instanceof Error) return err.message;
  return "Could not connect to Firebase.";
}

/** Anonymous auth — students never get admin/read tokens. */
export async function ensureStudentAuth(): Promise<string> {
  const auth = getClientAuth();
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
  if (!auth.currentUser) {
    throw new Error("Could not establish anonymous session.");
  }
  return auth.currentUser.uid;
}

/** Upsert this device's report (one doc per uid per drill). */
export async function submitStudentReport(input: StudentReportInput): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured.");
  }

  try {
    const uid = await ensureStudentAuth();
    const db = getClientFirestore();
    const docId = `${ACTIVE_DRILL_ID}_${uid}`;
    const ref = doc(db, REPORTS, docId);
    const offCampus = input.offCampus && input.status === "safe";
    const needHelp = input.status === "unsafe";
    const payload = {
      drillId: ACTIVE_DRILL_ID,
      studentUid: uid,
      studentName: input.studentName.trim(),
      studentId: input.studentId.trim(),
      grade: input.grade,
      status: input.status,
      offCampus,
      shooterNearby: needHelp ? Boolean(input.shooterNearby) : false,
      roomNumber: offCampus ? OFF_CAMPUS_ROOM : input.roomNumber.trim(),
      teacherName: offCampus ? "" : input.teacherName.trim(),
      location: input.location,
      note: input.note?.trim() || null,
      archived: false,
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDoc(ref, payload);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "not-found") throw e;
      await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
    }
  } catch (err) {
    throw new Error(friendlyFirebaseError(err));
  }
}

/** Admin listener — dev rules or Admin SDK required for reads. */
export function subscribeToDrillReports(
  drillId: string,
  onData: (reports: StudentReport[]) => void,
  onError: (error: Error) => void,
): () => void {
  const db = getClientFirestore();
  const q = query(
    collection(db, REPORTS),
    where("drillId", "==", drillId),
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .filter((d) => !isReportArchived(d.data()))
          .map((d) => mapDoc(d.id, d.data())),
      );
    },
    (err) => onError(err),
  );
}

export { isFirebaseConfigured };
