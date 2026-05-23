import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Student Check-In · LAHS",
  description: "Report your location and status to school staff during a drill.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#06080a",
};

export default function CheckInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
