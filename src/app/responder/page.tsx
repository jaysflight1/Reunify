import { ResponderDashboard } from "@/components/responder/responder-dashboard";
import { HomeLogoLink } from "@/components/layout/home-logo-link";

export default function ResponderPage() {
  return (
    <div className="min-h-screen bg-[#06080a] text-[#e2e8f0]">
      <header className="border-b border-[#232a35] px-4 py-4">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center">
          <HomeLogoLink className="shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
              Responder view
            </p>
            <h1 className="mt-0.5 text-xl font-semibold text-[#f8fafc]">
              Factual incident snapshot
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#94a3b8]">
              Reported student status and last-known locations without tactical recommendations.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-col px-4 py-6 pb-12">
        <ResponderDashboard />
      </main>
    </div>
  );
}
