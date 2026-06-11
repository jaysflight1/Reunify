import Link from "next/link";

type HomeLogoLinkProps = {
  showLabel?: boolean;
  className?: string;
};

export function HomeLogoLink({ showLabel = true, className = "" }: HomeLogoLinkProps) {
  return (
    <Link
      href="/"
      aria-label="Go to Reunify home"
      className={`inline-flex items-center gap-2 rounded-md border border-[#2a3340] bg-[#0c0f13] px-2.5 py-2 text-[#cbd5e1] transition hover:border-[#3d4f63] hover:bg-[#12161d] hover:text-[#f8fafc] ${className}`}
    >
      <LogoMark className="h-4 w-4 text-sky-300" />
      {showLabel ? (
        <span className="text-sm font-semibold tracking-tight">Reunify</span>
      ) : null}
    </Link>
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
