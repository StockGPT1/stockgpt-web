function Pulse({ className = "" }: { className?: string }) {
  return (
    <div className={["animate-pulse rounded-full bg-[#faf6f0]/10", className].join(" ")} />
  );
}

export default function StockLoading() {
  return (
    <main className="min-h-full overflow-hidden bg-[#072116] p-3 text-[#faf6f0]">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4 py-2">
          <Pulse className="h-12 w-12 rounded-full bg-[#ddb159]/20" />
          <div className="space-y-2">
            <Pulse className="h-6 w-32" />
            <Pulse className="h-4 w-48" />
          </div>
          <div className="ml-auto flex gap-2">
            <Pulse className="h-9 w-24 rounded-2xl" />
            <Pulse className="h-9 w-24 rounded-2xl" />
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.035] p-4"
            >
              <Pulse className="h-3 w-16 bg-[#faf6f0]/10" />
              <Pulse className="mt-3 h-7 w-24 bg-[#ddb159]/20" />
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div className="h-64 rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.035] p-4">
          <div className="flex gap-2 mb-4">
            {["1D", "5D", "1M", "6M", "1Y"].map((r) => (
              <Pulse key={r} className="h-7 w-10 rounded-full bg-[#faf6f0]/10" />
            ))}
          </div>
          <Pulse className="h-40 w-full rounded-xl bg-[#faf6f0]/5" />
        </div>

        {/* Trade setup + news */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.035] p-4">
            <Pulse className="h-4 w-32" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Pulse className="h-8 w-8 rounded-full bg-[#ddb159]/15" />
                <div className="flex-1 space-y-1">
                  <Pulse className="h-3 w-24 bg-[#faf6f0]/8" />
                  <Pulse className="h-3 w-36 bg-[#faf6f0]/6" />
                </div>
                <Pulse className="h-4 w-16 bg-[#ddb159]/15" />
              </div>
            ))}
          </div>
          <div className="space-y-3 rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.035] p-4">
            <Pulse className="h-4 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2 border-b border-[#faf6f0]/6 pb-3 last:border-0">
                <Pulse className="h-3 w-full bg-[#faf6f0]/8" />
                <Pulse className="h-3 w-4/5 bg-[#faf6f0]/6" />
                <Pulse className="h-3 w-20 bg-[#faf6f0]/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
