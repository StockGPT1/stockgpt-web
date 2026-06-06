export default function DashboardLoading() {
  return (
    <main className="min-h-full overflow-hidden bg-[#072116] p-3 text-[#faf6f0]">
      <div className="grid gap-3 lg:h-full lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="grid gap-3 lg:grid-rows-[150px_68px_176px_minmax(0,1fr)]">
          <div className="relative overflow-hidden rounded-[28px] border border-[#ddb159]/18 bg-[#0b2b1d] p-5">
            <div className="absolute -right-16 -top-16 size-48 rounded-full bg-[#ddb159]/12 blur-3xl" />
            <div className="h-4 w-28 rounded-full bg-[#ddb159]/20" />
            <div className="mt-5 h-9 max-w-xl rounded-2xl bg-[#faf6f0]/10" />
            <div className="mt-3 h-4 max-w-lg rounded-full bg-[#faf6f0]/8" />
            <div className="mt-2 h-4 max-w-sm rounded-full bg-[#faf6f0]/8" />
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-xl bg-[#faf6f0] p-3">
                <div className="h-3 w-16 rounded-full bg-[#072116]/10" />
                <div className="mt-3 h-5 w-24 rounded-xl bg-[#072116]/12" />
                <div className="mt-2 h-3 w-20 rounded-full bg-[#072116]/8" />
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-[#ddb159]/18 bg-[#faf6f0]/[0.05] p-4">
                <div className="h-3 w-36 rounded-full bg-[#ddb159]/20" />
                <div className="mt-4 h-6 w-52 rounded-xl bg-[#faf6f0]/10" />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {Array.from({ length: 4 }).map((__, itemIndex) => (
                    <div key={itemIndex} className="h-12 rounded-2xl bg-[#faf6f0]/8" />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-[#faf6f0] p-4">
            <div className="h-5 w-44 rounded-xl bg-[#072116]/12" />
            <div className="mt-4 grid gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-9 rounded-xl bg-[#072116]/8" />
              ))}
            </div>
          </div>
        </section>

        <aside className="grid gap-3 lg:grid-rows-[180px_minmax(0,1fr)_104px]">
          <div className="rounded-2xl border border-[#ddb159]/18 bg-[#faf6f0]/[0.05] p-4">
            <div className="h-4 w-32 rounded-full bg-[#ddb159]/20" />
            <div className="mt-4 h-24 rounded-xl bg-[#faf6f0]/8" />
          </div>
          <div className="rounded-2xl bg-[#faf6f0] p-4">
            <div className="h-4 w-32 rounded-full bg-[#072116]/12" />
            <div className="mt-4 grid gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 rounded-xl bg-[#072116]/8" />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#ddb159]/18 bg-[#0b2b1d] p-4">
            <div className="h-4 w-40 rounded-full bg-[#ddb159]/20" />
            <div className="mt-3 h-4 w-52 rounded-full bg-[#faf6f0]/8" />
          </div>
        </aside>
      </div>
    </main>
  );
}
