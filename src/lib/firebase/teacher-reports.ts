import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { ensureStudentAuth, friendlyFirebaseError } from "./reports";
import {
  ACTIVE_DRILL_ID,
  getClientFirestore,
  isFirebaseConfigured,
} from "./config";
import type { TeacherReportSubmit, TeacherRoomReport } from "./types";

const COLLECTION = "teacherReports";

function mapTeacherDoc(id: string, data: DocumentData): TeacherRoomReport {
  const createdAt = data.createdAt?.toMillis?.() ?? Date.now();
  const updatedAt = data.updatedAt?.toMillis?.() ?? createdAt;
  return {
    id,
    drillId: data.drillId ?? ACTIVE_DRILL_ID,
    teacherUid: data.teacherUid ?? "",
    roomNumber: data.roomNumber ?? "",
    spokenRoomNumber: data.spokenRoomNumber ?? null,
    teacherName: data.teacherName ?? "",
    presentIds: Array.isArray(data.presentIds) ? data.presentIds : [],
    missingIds: Array.isArray(data.missingIds) ? data.missingIds : [],
    unmatchedMissing: Array.isArray(data.unmatchedMissing) ? data.unmatchedMissing : [],
    allAccounted: Boolean(data.allAccounted),
    note: data.note ?? null,
    transcript: data.transcript ?? null,
    inputMode: data.inputMode === "checkbox" ? "checkbox" : "voice",
    createdAt,
    updatedAt,
  };
}

export async function submitTeacherRoomReport(input: TeacherReportSubmit): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured.");
  }

  try {
    const uid = await ensureStudentAuth();
    const db = getClientFirestore();
    const docId = `${ACTIVE_DRILL_ID}_${uid}`;
    const ref = doc(db, COLLECTION, docId);

    const payload = {
      drillId: ACTIVE_DRILL_ID,
      teacherUid: uid,
      roomNumber: input.roomNumber,
      spokenRoomNumber: input.spokenRoomNumber ?? null,
      teacherName: input.teacherName.trim(),
      presentIds: input.presentIds,
      missingIds: input.missingIds,
      unmatchedMissing: input.unmatchedMissing ?? [],
      allAccounted: input.allAccounted,
      note: input.note?.trim() || null,
      transcript: input.transcript?.trim() || null,
      inputMode: input.inputMode,
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

export { mapTeacherDoc };
