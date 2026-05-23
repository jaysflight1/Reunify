import { StudentCheckIn } from "@/components/student/student-check-in";

export default function StudentPage() {
  return (
    <div className="min-h-screen bg-[#06080a] text-[#e2e8f0]">
      <header className="border-b border-[#232a35] px-4 py-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
          Reunify
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[#f8fafc]">Student check-in</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">
          Send your own status to school staff. This page does not show maps, rosters, or other students.
        </p>
      </header>
      <StudentCheckIn />
    </div>
  );
}
