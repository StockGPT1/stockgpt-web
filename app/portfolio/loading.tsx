export default function PortfolioLoading() {
  return (
    <main className="min-h-full overflow-hidden bg-[#072116] p-3 text-[#faf6f0]">
      <div className="grid gap-4">
        <div className="rounded-3xl border border-[#ddb159]/20 bg-[#061b12] p-4">
          <div className="h-3 w-36 rounded-full bg-[#ddb159]/20" />
          <div className="mt-4 h-7 max-w-md rounded-2xl bg-[#faf6f0]/10" />
          <div className="mt-3 h-4 max-w-xl rounded-full bg-[#faf6f0]/8" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-24 rounded-2xl border border-[#ddb159]/12 bg-[#04180f]" />
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-[#ddb159]/22 bg-[#0b2b1d] p-5">
          <div className="h-3 w-44 rounded-full bg-[#ddb159]/22" />
          <div className="mt-4 h-9 max-w-lg rounded-2xl bg-[#faf6f0]/10" />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-20 rounded-2xl bg-[#04180f]/70" />
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-3xl bg-[#faf6f0] p-4">
            <div className="h-5 w-48 rounded-xl bg-[#072116]/12" />
            <div className="mt-4 grid gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-16 rounded-2xl bg-[#072116]/8" />
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-32 rounded-2xl bg-[#faf6f0]" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
