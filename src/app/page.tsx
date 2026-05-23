import { RoleSelector } from "@/components/layout/role-selector";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#06080a] px-4 py-10 text-[#e2e8f0]">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
        Reunify · Los Altos High School
      </p>
      <h1 className="mt-2 text-center text-3xl font-semibold text-[#f8fafc]">
        Emergency accountability dashboard
      </h1>
      <p className="mt-3 max-w-xl text-center text-sm leading-relaxed text-[#94a3b8]">
        Role-specific views for school emergency status, verification, reunification, and communication.
      </p>
      <div className="mt-8 w-full">
        <RoleSelector />
      </div>
      <p className="mt-6 max-w-xl text-center text-[11px] leading-relaxed text-[#64748b]">
        The legacy proof-of-concept student form remains available at /check-in for comparison.
      </p>
    </div>
  );
}
