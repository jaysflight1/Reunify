import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { ACTIVE_DRILL_ID, getClientFirestore, isFirebaseConfigured } from "@/lib/firebase/config";
import { ensureStudentAuth } from "@/lib/firebase/reports";

export type StudentBroadcastPriority = "emergency" | "update" | "all-clear";

export type StudentBroadcast = {
  id: string;
  priority: StudentBroadcastPriority;
  title: string;
  message: string;
  createdAt: number;
};

const STUDENT_BROADCASTS = "studentBroadcasts";

const priorityRank: Record<StudentBroadcastPriority, number> = {
  emergency: 0,
  update: 1,
  "all-clear": 2,
};

export const fallbackStudentBroadcasts: StudentBroadcast[] = [
  {
    id: "demo-emergency-instruction",
    priority: "emergency",
    title: "Shelter in place",
    message: "Lock doors. Stay quiet. Move away from windows and wait for staff instructions.",
    createdAt: 3,
  },
  {
    id: "demo-campus-update",
    priority: "update",
    title: "Staff are responding",
    message: "Do not leave your room unless a staff member or first responder directs you.",
    createdAt: 2,
  },
  {
    id: "demo-report-reminder",
    priority: "update",
    title: "Send your status",
    message: "Use this page to tell staff if you are safe or need help.",
    createdAt: 1,
  },
];

function normalizePriority(value: unknown): StudentBroadcastPriority {
  if (value === "all-clear") return "all-clear";
  if (value === "update") return "update";
  return "emergency";
}

export function sortStudentBroadcasts(
  broadcasts: readonly StudentBroadcast[],
): StudentBroadcast[] {
  return [...broadcasts].sort((a, b) => {
    const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
    return priorityDelta || b.createdAt - a.createdAt;
  });
}

export function mapStudentBroadcastDoc(id: string, data: DocumentData): StudentBroadcast | null {
  if (data.active === false) return null;
  if (data.audience && data.audience !== "students") return null;

  const title = typeof data.title === "string" ? data.title.trim() : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";
  if (!title || !message) return null;

  return {
    id,
    priority: normalizePriority(data.priority),
    title,
    message,
    createdAt: data.createdAt?.toMillis?.() ?? 0,
  };
}

export async function subscribeToStudentBroadcasts(
  onData: (broadcasts: StudentBroadcast[]) => void,
  onError: (error: Error) => void,
): Promise<() => void> {
  if (!isFirebaseConfigured()) {
    onData(fallbackStudentBroadcasts);
    return () => {};
  }

  try {
    await ensureStudentAuth();
    const db = getClientFirestore();
    const q = query(
      collection(db, STUDENT_BROADCASTS),
      where("drillId", "==", ACTIVE_DRILL_ID),
      where("active", "==", true),
      where("audience", "==", "students"),
      orderBy("createdAt", "desc"),
    );

    return onSnapshot(
      q,
      (snap) => {
        const broadcasts = snap.docs
          .map((doc) => mapStudentBroadcastDoc(doc.id, doc.data()))
          .filter((entry): entry is StudentBroadcast => entry !== null);
        onData(broadcasts.length > 0 ? sortStudentBroadcasts(broadcasts) : fallbackStudentBroadcasts);
      },
      (err) => {
        onData(fallbackStudentBroadcasts);
        onError(err instanceof Error ? err : new Error("Could not load student broadcasts."));
      },
    );
  } catch (err) {
    onData(fallbackStudentBroadcasts);
    onError(err instanceof Error ? err : new Error("Could not load student broadcasts."));
    return () => {};
  }
}
