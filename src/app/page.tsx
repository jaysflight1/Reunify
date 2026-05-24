import { RoleSelector } from "@/components/layout/role-selector";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070a10] text-slate-100">
      <BackgroundDecor />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-10">
        <a href="/" className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7 text-sky-400" />
          <span className="text-base font-semibold tracking-tight text-white">
            Reunify
          </span>
        </a>
        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-slate-300 backdrop-blur sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Los Altos High School · Drill mode
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-10 sm:px-10 sm:pt-20">
        <section className="mx-auto max-w-3xl text-center">
          <p className="mb-5 inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">
            Emergency Reunification Platform
          </p>
          <h1 className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-[64px] font-semibold leading-[0.95] tracking-tight text-transparent sm:text-[88px] md:text-[104px]">
            Reunify
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
            Account for every student in the first 60 seconds of an emergency.
            Coordinate staff, responders, and families from a single live picture
            of the campus.
          </p>
        </section>

        <section className="mt-16 sm:mt-20">
          <div className="mb-5 px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Choose your role
            </p>
          </div>
          <RoleSelector />
        </section>
      </main>

      <footer className="relative z-10 mx-auto max-w-7xl px-6 pb-8 sm:px-10">
        <div className="flex flex-col items-start justify-between gap-2 border-t border-white/[0.06] pt-6 text-[11px] text-slate-500 sm:flex-row sm:items-center">
          <p>Reunify · staff-facing tool. Demo data for evaluation.</p>
          <p className="font-mono tabular-nums">v0.1 · build · LAHS</p>
        </div>
      </footer>
    </div>
  );
}

function BackgroundDecor() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Top centered cool glow */}
      <div
        className="absolute left-1/2 top-[-260px] h-[640px] w-[1180px] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(56,189,248,0.18), rgba(99,102,241,0.10) 45%, transparent 80%)",
        }}
      />
      {/* Warm accent in bottom right */}
      <div
        className="absolute right-[-160px] bottom-[-200px] h-[520px] w-[680px] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(168,85,247,0.12), transparent 70%)",
        }}
      />
      {/* Faint grid */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          maskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#070a10_85%)]" />
    </div>
  );
}

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M16 3.5 27 9.5v13L16 28.5 5 22.5v-13z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M11 15.5 14.8 19l6.2-7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
