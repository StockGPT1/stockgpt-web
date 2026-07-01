import Link from "next/link";

export function PortfolioCreationSuccess({
  portfolioId,
}: {
  portfolioId: string;
}) {
  return (
    <section
      role="status"
      className="rounded-3xl border border-emerald-300/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(6,27,18,0.84))] p-4 text-[#faf6f0] shadow-[0_14px_34px_rgba(0,0,0,0.2)] sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
            Portfolio created
          </p>
          <h2 className="mt-1 text-[23px] font-black tracking-[-0.04em]">
            Your manual Portfolio Draft is ready.
          </h2>
          <p className="mt-1 max-w-2xl text-[12px] font-semibold leading-5 text-[#faf6f0]/60">
            Run the Portfolio Check below to review allocation, concentration,
            risks and trade-offs before making your own decisions.
          </p>
        </div>
        <Link
          href={`/portfolio?portfolio=${encodeURIComponent(portfolioId)}#portfolio-check`}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#ddb159] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#072116] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-white"
        >
          Run Portfolio Check
        </Link>
      </div>
    </section>
  );
}
