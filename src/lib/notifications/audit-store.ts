import type { Firestore } from "firebase-admin/firestore";
import type { NotificationAuditDoc, NotificationKey } from "./types";

export type StudentSummary = {
  firstName: string;
  lastName: string;
  parentGuardianIds: string[];
};

export type ParentSummary = {
  phone?: string;
  linkedStudentIds: string[];
};

/**
 * Narrow data-access surface for the parent-safe notification flow. Keeps the
 * orchestrator unaware of Firestore so it stays unit-testable with an
 * in-memory fake. The Firestore-backed implementation lives below and is the
 * only place that imports `firebase-admin`.
 */
export interface NotificationStore {
  loadStudent(schoolId: string, studentId: string): Promise<StudentSummary | null>;
  loadParent(schoolId: string, parentId: string): Promise<ParentSummary | null>;
  loadSchoolName(schoolId: string): Promise<string | null>;
  /**
   * Atomic create-if-absent for the audit doc. Returns `true` when this call
   * persisted the queued entry, `false` when the doc already existed (the
   * dedupe signal — caller must skip without sending).
   */
  tryCreateAudit(initial: NotificationAuditDoc): Promise<boolean>;
  updateAudit(key: NotificationKey, patch: Partial<NotificationAuditDoc>): Promise<void>;
}

function auditDocId(key: NotificationKey): string {
  return `${key.studentId}_${key.parentId}_${key.notificationType}`;
}

function auditRefPath(key: NotificationKey): string {
  return (
    `schools/${key.schoolId}/incidents/${key.incidentId}/parentNotifications/` + auditDocId(key)
  );
}

export function createFirestoreNotificationStore(db: Firestore): NotificationStore {
  return {
    async loadStudent(schoolId, studentId) {
      const snap = await db.doc(`schools/${schoolId}/students/${studentId}`).get();
      if (!snap.exists) return null;
      const data = snap.data() ?? {};
      return {
        firstName: typeof data.firstName === "string" ? data.firstName : "",
        lastName: typeof data.lastName === "string" ? data.lastName : "",
        parentGuardianIds: Array.isArray(data.parentGuardianIds)
          ? data.parentGuardianIds.filter((id): id is string => typeof id === "string")
          : [],
      };
    },

    async loadParent(schoolId, parentId) {
      const snap = await db.doc(`schools/${schoolId}/users/${parentId}`).get();
      if (!snap.exists) return null;
      const data = snap.data() ?? {};
      return {
        phone: typeof data.phone === "string" ? data.phone : undefined,
        linkedStudentIds: Array.isArray(data.linkedStudentIds)
          ? data.linkedStudentIds.filter((id): id is string => typeof id === "string")
          : [],
      };
    },

    async loadSchoolName(schoolId) {
      const snap = await db.doc(`schools/${schoolId}`).get();
      if (!snap.exists) return null;
      const data = snap.data() ?? {};
      if (typeof data.displayName === "string" && data.displayName.trim().length > 0) {
        return data.displayName;
      }
      if (typeof data.name === "string" && data.name.trim().length > 0) return data.name;
      return null;
    },

    async tryCreateAudit(initial) {
      const ref = db.doc(auditRefPath(initial));
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) return false;
        tx.set(ref, initial);
        return true;
      });
    },

    async updateAudit(key, patch) {
      const ref = db.doc(auditRefPath(key));
      await ref.set(patch, { merge: true });
    },
  };
}
