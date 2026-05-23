import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#06080a] px-4 text-[#e2e8f0]">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
        Los Altos High School
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-[#f8fafc]">Evacuation system</h1>
      <p className="mt-3 max-w-sm text-center text-sm text-[#94a3b8]">
        Students and staff use separate links. Students never see the command map.
      </p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/student"
          className="rounded-xl bg-[#e2e8f0] py-4 text-center text-base font-semibold text-[#0c0f13]"
        >
          Student check-in
        </Link>
        <Link
          href="/teacher"
          className="rounded-xl border border-sky-900/40 bg-sky-950/20 py-4 text-center text-base font-medium text-sky-200"
        >
          Teacher roll call
        </Link>
        <Link
          href="/admin"
          className="rounded-xl border border-[#2a3340] py-4 text-center text-base font-medium text-[#94a3b8]"
        >
          Staff command center
        </Link>
        <Link
          href="/parent"
          className="rounded-xl border border-[#2a3340] py-4 text-center text-base font-medium text-[#94a3b8]"
        >
          Parent portal
        </Link>
        <Link
          href="/responder"
          className="rounded-xl border border-[#2a3340] py-4 text-center text-base font-medium text-[#94a3b8]"
        >
          Responder view
        </Link>
      </div>
    </div>
  );
}
