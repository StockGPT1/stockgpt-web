function Pulse({ className = "" }: { className?: string }) {
  return (
    <div
      className={["animate-pulse rounded-full bg-[#faf6f0]/10", className].join(" ")}
    />
  );
}

export default function RankingsLoading() {
  return (
    <main className="min-h-full overflow-hidden bg-[#072116] p-3 text-[#faf6f0]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pulse className="h-10 w-48 rounded-2xl" />
        <Pulse className="h-10 w-32 rounded-2xl" />
        <Pulse className="h-10 w-32 rounded-2xl" />
        <div className="ml-auto">
          <Pulse className="h-10 w-40 rounded-2xl" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]">
        <div className="flex items-center gap-3 border-b border-[#072116]/8 px-4 py-3">
          <Pulse className="h-4 w-8 bg-[#072116]/10" />
          <Pulse className="h-4 w-20 bg-[#072116]/10" />
          <Pulse className="h-4 flex-1 bg-[#072116]/10" />
          <Pulse className="h-4 w-16 bg-[#072116]/10" />
          <Pulse className="h-4 w-16 bg-[#072116]/10" />
          <Pulse className="h-4 w-20 bg-[#072116]/10" />
        </div>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-[#072116]/5 px-4 py-3 last:border-0"
          >
            <Pulse className="h-4 w-6 bg-[#072116]/8" />
            <Pulse className="h-8 w-8 rounded-full bg-[#ddb159]/15" />
            <Pulse className="h-4 w-12 bg-[#072116]/8" />
            <Pulse className="h-4 flex-1 bg-[#072116]/8" />
            <Pulse className="h-4 w-14 bg-[#072116]/8" />
            <Pulse className="h-4 w-14 bg-[#072116]/8" />
            <Pulse className="h-6 w-20 rounded-full bg-[#ddb159]/15" />
          </div>
        ))}
      </div>
    </main>
  );
}
