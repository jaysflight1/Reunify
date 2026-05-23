import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Evacuation Command · Admin",
  description: "Staff evacuation command center",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
