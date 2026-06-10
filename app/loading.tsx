function SkeletonBar({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "animate-pulse rounded-full bg-[#faf6f0]/14",
        className,
      ].join(" ")}
    />
  );
}

function SkeletonCard({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={["min-h-0 rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.035] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.16)]", className].join(" ")}>
      {children ?? (
        <div className="space-y-3">
          <SkeletonBar className="h-3 w-24" />
          <SkeletonBar className="h-7 w-2/3" />
          <SkeletonBar className="h-3 w-full" />
          <SkeletonBar className="h-3 w-4/5" />
        </div>
      )}
    </div>
  );
}

export default function Loading() {
  return (
    <main aria-busy="true" className="flex h-[100dvh] flex-col overflow-hidden bg-[#072116] text-[#faf6f0]">
      <header className="flex h-[64px] shrink-0 items-center gap-4 border-b border-[#ddb159]/18 bg-[#04180f] px-4 sm:px-5">
        <SkeletonBar className="h-9 w-36 bg-[#ddb159]/18" />
        <div className="hidden flex-1 justify-center md:flex">
          <SkeletonBar className="h-10 w-full max-w-[520px]" />
        </div>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <SkeletonBar className="h-10 w-28" />
          <SkeletonBar className="h-10 w-10" />
          <SkeletonBar className="h-10 w-10" />
        </div>
      </header>

      <div className="h-[36px] shrink-0 border-b border-[#ddb159]/18 bg-[#061b12] px-4 py-2">
        <SkeletonBar className="h-4 w-full bg-[#ddb159]/10" />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden h-full w-[178px] shrink-0 border-r border-[#ddb159]/16 bg-[#061b12] p-4 lg:block">
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <SkeletonBar key={index} className="h-10 w-full" />
            ))}
          </div>
        </aside>

        <section className="min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,#072116,#051a11)] p-3 pb-[84px] lg:pb-3">
          <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_clamp(318px,29vw,440px)]">
            <div className="grid min-h-0 gap-3 lg:grid-rows-[minmax(118px,0.72fr)_minmax(56px,0.34fr)_minmax(0,3fr)]">
              <SkeletonCard />

              <div className="grid min-h-[112px] grid-cols-2 gap-[1px] overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#072116]/10 ring-1 ring-white/15 sm:min-h-[118px] lg:min-h-0 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonCard key={index} className="rounded-none border-0 bg-[#faf6f0] shadow-none">
                    <SkeletonBar className="h-3 w-20 bg-[#072116]/12" />
                    <SkeletonBar className="mt-3 h-6 w-16 bg-[#ddb159]/20" />
                    <SkeletonBar className="mt-2 h-3 w-24 bg-[#072116]/10" />
                  </SkeletonCard>
                ))}
              </div>

              <SkeletonCard className="overflow-hidden bg-[#faf6f0] text-[#072116] lg:h-full">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <SkeletonBar className="h-3 w-28 bg-[#072116]/12" />
                    <SkeletonBar className="mt-3 h-7 w-56 max-w-full bg-[#072116]/12" />
                  </div>
                  <SkeletonBar className="h-9 w-24 bg-[#ddb159]/22" />
                </div>

                <div className="grid h-[calc(100%-64px)] min-h-0 gap-2 overflow-hidden">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <div
                      key={index}
                      className="grid min-h-0 grid-cols-[40px_90px_minmax(0,1fr)_80px] items-center gap-3 rounded-xl bg-[#072116]/[0.045] p-3"
                    >
                      <SkeletonBar className="h-4 w-6 bg-[#072116]/10" />
                      <SkeletonBar className="h-4 w-14 bg-[#072116]/10" />
                      <SkeletonBar className="h-4 w-full bg-[#072116]/10" />
                      <SkeletonBar className="h-4 w-14 bg-[#ddb159]/22" />
                    </div>
                  ))}
                </div>
              </SkeletonCard>
            </div>

            <aside className="hidden min-h-0 gap-3 lg:grid lg:grid-rows-[minmax(188px,0.9fr)_minmax(206px,1.05fr)_minmax(300px,1.45fr)]">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
