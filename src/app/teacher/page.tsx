import { TeacherCheckIn } from "@/components/teacher/teacher-check-in";
import { HomeLogoLink } from "@/components/layout/home-logo-link";

export default function TeacherPage() {
  return (
    <div className="min-h-screen bg-[#06080a] text-[#e2e8f0]">
      <header className="border-b border-[#232a35] px-4 py-5">
        <HomeLogoLink className="mb-4" />
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
          General High School
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[#f8fafc]">Teacher roll call</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">
          Speak naturally or tap your roster. Staff see this combined with student check-ins.
        </p>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 pb-12">
        <TeacherCheckIn />
      </main>
    </div>
  );
}
