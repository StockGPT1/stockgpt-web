export function DemoPortfolioBuildView() {
  const preferences = [
    ["Starting amount", "£1,000"],
    ["Risk level", "Balanced"],
    ["Goal", "Long-term growth"],
    ["Sectors", "Technology, Healthcare, Consumer"],
    ["Portfolio style", "Diversified"],
  ];

  return (
    <div className="grid min-w-0 gap-3">
      <section className="rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(160deg,#0d3420,#082519)] p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Portfolio Draft builder</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">Build a draft around your preferences.</h1>
        <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-white/55">
          Review allocation and trade-offs before deciding whether any holding fits your own circumstances.
        </p>
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-2xl bg-[#faf6f0] p-5 text-[#072116]">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Your preferences</p>
          <div className="mt-4 grid gap-2">
            {preferences.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[#072116]/9 bg-white p-3">
                <p className="text-[9px] font-black uppercase text-[#072116]/42">{label}</p>
                <p className="mt-1 text-sm font-black">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid h-12 place-items-center rounded-full bg-[#ddb159] text-sm font-black">
            Generate Portfolio Draft
          </div>
        </section>

        <section className="rounded-2xl bg-[#faf6f0] p-5 text-[#072116]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Illustrative draft</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">Balanced research draft</h2>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-800">Diversification 78/100</span>
          </div>
          <div className="mt-4 flex h-4 overflow-hidden rounded-full">
            <span className="w-[38%] bg-[#ddb159]" />
            <span className="w-[32%] bg-emerald-500" />
            <span className="w-[20%] bg-orange-500" />
            <span className="w-[10%] bg-slate-400" />
          </div>
          <div className="mt-4 grid gap-2">
            {[
              ["Technology", "38%", "Growth exposure with concentration risk."],
              ["Healthcare", "32%", "Mixes growth and defensive demand."],
              ["Consumer", "20%", "Adds business-model diversification."],
              ["Cash", "10%", "Leaves room for review and changes."],
            ].map(([sector, allocation, detail]) => (
              <div key={sector} className="grid grid-cols-[minmax(0,1fr)_54px] gap-3 rounded-2xl border border-[#072116]/8 bg-white p-3">
                <div>
                  <p className="font-black">{sector}</p>
                  <p className="mt-1 text-[10px] font-semibold text-[#072116]/48">{detail}</p>
                </div>
                <p className="text-right text-lg font-black">{allocation}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] font-semibold leading-5 text-[#072116]/48">
            Portfolio Drafts are starting points for research, not personalised recommendations.
          </p>
        </section>
      </div>
    </div>
  );
}
