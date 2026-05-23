import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teacher roll call",
  description: "Staff room roll call for evacuation drill",
  robots: { index: false, follow: false },
};

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
