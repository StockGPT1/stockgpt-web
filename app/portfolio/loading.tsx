function Pulse({ className }: { className: string }) {
  return <span className={`block animate-pulse rounded-full bg-[#faf6f0]/8 ${className}`} />;
}

export default function PortfolioLoading() {
  return (
    <main
      className="min-h-full overflow-x-hidden bg-[#061b12] pb-[calc(120px+env(safe-area-inset-bottom))] text-[#faf6f0] lg:pb-12"
      aria-label="Loading portfolio"
      aria-busy="true"
    >
      <div className="mx-auto w-full max-w-[1480px] lg:px-6 xl:px-8 2xl:px-10">
        <section className="relative isolate min-h-[520px] overflow-hidden border-b border-[#ddb159]/14 px-4 pb-5 pt-5 sm:px-6 lg:mt-5 lg:min-h-[470px] lg:rounded-[28px] lg:border lg:px-8 lg:pb-7 lg:pt-7">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(221,177,89,0.12),transparent_34%),linear-gradient(180deg,#0a2a1d_0%,#061b12_72%)]" />
          <div className="mx-auto max-w-[1180px]">
            <div className="flex items-center justify-between gap-3">
              <Pulse className="h-12 w-[min(72%,280px)]" />
              <div className="flex gap-2"><Pulse className="size-12" /><Pulse className="size-12" /></div>
            </div>

            <div className="mt-8 text-center lg:mt-6 lg:text-left">
              <Pulse className="mx-auto h-3 w-32 lg:mx-0" />
              <Pulse className="mx-auto mt-4 h-14 w-56 lg:mx-0 lg:h-16 lg:w-72" />
              <Pulse className="mx-auto mt-4 h-5 w-40 lg:mx-0" />
            </div>

            <div className="mt-8 h-[300px] border-y border-[#faf6f0]/8 lg:mt-5 lg:h-[280px]">
              <div className="flex h-full items-end gap-2 px-2 pb-7">
                {[34, 46, 39, 61, 54, 72, 66, 81, 74, 88, 83, 91].map((height, index) => (
                  <span key={index} className="block flex-1 animate-pulse rounded-t bg-[#ddb159]/10" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="sticky top-0 z-40 grid h-[52px] grid-cols-3 border-b border-[#ddb159]/14 bg-[#061b12]/94 px-1 backdrop-blur-xl sm:px-4 lg:px-8">
          {Array.from({ length: 3 }).map((_, index) => (
            <span key={index} className="grid place-items-center"><Pulse className="h-3 w-16" /></span>
          ))}
        </div>

        <div className="px-4 pt-7 sm:px-6 lg:px-0 lg:pt-8">
          <Pulse className="h-3 w-28" />
          <Pulse className="mt-3 h-7 w-52" />
          <div className="-mx-4 mt-5 flex gap-3 overflow-hidden px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="w-[166px] shrink-0 border-l border-[#ddb159]/18 px-4 py-2 first:border-l-0 first:pl-0 lg:w-auto lg:first:border-l lg:first:pl-4">
                <Pulse className="h-2.5 w-20" />
                <Pulse className="mt-3 h-7 w-24" />
                <Pulse className="mt-2 h-2.5 w-28" />
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-10 border-y border-[#faf6f0]/8 py-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,.8fr)] lg:border-y-0 lg:py-0">
            <div>
              <Pulse className="h-3 w-24" />
              <Pulse className="mt-3 h-8 w-[min(100%,520px)]" />
              <Pulse className="mt-5 h-4 w-full max-w-2xl" />
              <Pulse className="mt-2 h-4 w-4/5 max-w-xl" />
              <div className="mt-6 flex gap-2"><Pulse className="h-9 w-28" /><Pulse className="h-9 w-28" /><Pulse className="h-9 w-24" /></div>
            </div>
            <div className="grid grid-cols-2 gap-6 border-t border-[#faf6f0]/8 pt-6 lg:border lg:border-[#ddb159]/14 lg:p-6">
              {Array.from({ length: 4 }).map((_, index) => <Pulse key={index} className="h-14 w-full" />)}
            </div>
          </div>

          <div className="mt-12">
            <Pulse className="h-3 w-32" />
            <Pulse className="mt-3 h-7 w-64" />
            <div className="mt-5 h-[390px] animate-pulse border-y border-[#faf6f0]/8 bg-[#faf6f0]/[0.018] lg:h-[510px] lg:rounded-[20px] lg:border lg:border-[#ddb159]/14" />
          </div>
        </div>
      </div>
    </main>
  );
}
