import { isFirebaseConfigured } from "@/lib/firebase/config";

/** True when Firebase client env is missing — student/teacher submit via local API. */
export function isLocalCheckInMode(): boolean {
  return !isFirebaseConfigured();
}
