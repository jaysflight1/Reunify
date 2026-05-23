import { ParentPortal } from "@/components/parent/parent-portal";

export default function ParentPage() {
  return (
    <div className="min-h-screen bg-[#06080a] text-[#e2e8f0]">
      <header className="border-b border-[#232a35] px-4 py-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
          Reunify
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[#f8fafc]">Parent portal</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">
          View your linked child and parent-safe school messages.
        </p>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 pb-12">
        <ParentPortal />
      </main>
    </div>
  );
}
