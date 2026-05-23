import type { DocumentData } from "firebase/firestore";

/** Archived reports stay in Firestore but are hidden from the live admin dashboard. */
export function isReportArchived(data: DocumentData | Record<string, unknown>): boolean {
  return (data as { archived?: boolean }).archived === true;
}
