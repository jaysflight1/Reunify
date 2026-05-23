import { ResponderDashboard } from "@/components/responder/responder-dashboard";

export default function ResponderPage() {
  return (
    <div className="min-h-screen bg-[#06080a] text-[#e2e8f0]">
      <header className="border-b border-[#232a35] px-4 py-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
          Responder view
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[#f8fafc]">
          Factual incident snapshot
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#94a3b8]">
          Reported student status and last-known locations without tactical recommendations.
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-12">
        <ResponderDashboard />
      </main>
    </div>
  );
}
