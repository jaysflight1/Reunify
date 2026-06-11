import { CheckInForm } from "@/components/student/check-in-form";
import { HomeLogoLink } from "@/components/layout/home-logo-link";

export default function CheckInPage() {
  return (
    <div className="min-h-screen bg-[#06080a] text-[#e2e8f0]">
      <header className="border-b border-[#232a35] px-4 py-5">
        <HomeLogoLink className="mb-4" />
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
          General High School
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[#f8fafc]">Emergency check-in</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">
          Tell staff where you are. This page does not show maps or other students.
        </p>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 pb-10">
        <CheckInForm />
      </main>

      <footer className="px-4 pb-8 text-center text-[10px] text-[#475569]">
        For staff only: evacuation command dashboard is on a separate link.
      </footer>
    </div>
  );
}
