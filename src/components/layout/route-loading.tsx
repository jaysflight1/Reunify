type RouteLoadingProps = {
  title: string;
  subtitle: string;
  rows?: number;
};

export function RouteLoading({ title, subtitle, rows = 3 }: RouteLoadingProps) {
  return (
    <div className="min-h-screen bg-[#06080a] text-[#e2e8f0]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col px-4 py-6">
        <div className="rounded-xl border border-[#232a35] bg-[#0c0f13] p-4">
          <div className="h-3 w-24 animate-pulse rounded bg-[#1e293b]" />
          <div className="mt-3 h-7 w-72 max-w-full animate-pulse rounded bg-[#1e293b]" />
          <div className="mt-2 h-4 w-[28rem] max-w-full animate-pulse rounded bg-[#111827]" />
          <div className="mt-3 text-sm text-[#94a3b8]">
            <span className="font-medium text-[#f8fafc]">{title}</span>
            <span className="ml-2">{subtitle}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(12rem,0.55fr)_minmax(12rem,0.55fr)_minmax(12rem,0.55fr)]">
          <div className="min-h-[28rem] rounded-lg border border-[#232a35] bg-[#0c0f13] p-4">
            <div className="h-full min-h-[24rem] animate-pulse rounded bg-[#10151d]" />
          </div>
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="min-h-[12rem] rounded-lg border border-[#232a35] bg-[#0c0f13] p-4"
            >
              <div className="h-4 w-28 animate-pulse rounded bg-[#1e293b]" />
              <div className="mt-4 space-y-3">
                <div className="h-10 animate-pulse rounded bg-[#10151d]" />
                <div className="h-10 animate-pulse rounded bg-[#10151d]" />
                <div className="h-10 animate-pulse rounded bg-[#10151d]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
