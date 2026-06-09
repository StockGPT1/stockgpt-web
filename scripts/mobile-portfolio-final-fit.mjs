import fs from "node:fs";

const file = "components/PortfolioCommandCentreRevolut.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceAll(search, replacement) {
  if (!source.includes(search)) return;
  source = source.split(search).join(replacement);
}

source = source.replace(
  /function buildRangeData\([\s\S]*?\n}\n\nfunction preferredInitialRange/,
  `function buildRangeData(
  source: Partial<Record<TimeRange, ChartPoint[]>>,
  createdAt?: string | null,
): Partial<Record<TimeRange, ChartPoint[]>> {
  const maxPoints = source.MAX ?? [];
  const data: Partial<Record<TimeRange, ChartPoint[]>> = { ...source };

  if (maxPoints.length < 2) return data;

  const createdMs = createdAt ? new Date(createdAt).getTime() : new Date(maxPoints[0].date).getTime();
  const nowMs = Date.now();

  RANGE_LABELS.forEach(({ range, days }) => {
    if (range === "MAX" || days == null) return;
    if ((source[range]?.length ?? 0) > 1) return;
    if (range === "1D") return;

    const startMs = Math.max(createdMs, nowMs - days * 86_400_000);
    const points = maxPoints.filter((point) => new Date(point.date).getTime() >= startMs);
    if (points.length > 1) data[range] = points;
  });

  return data;
}

function preferredInitialRange`,
);

source = source.replace(
  /function MobileSectionNav\({ active, setSection }: \{ active: Section; setSection: \(section: Section\) => void \}\) \{[\s\S]*?\n}\n\nfunction PortfolioTopBar/,
  `function MobileSectionNav({ active, setSection }: { active: Section; setSection: (section: Section) => void }) {
  const items: Array<{ section: Section; label: string }> = [
    { section: "overview", label: "Overview" },
    { section: "holdings", label: "Holdings" },
    { section: "add", label: "Add or import" },
    { section: "news", label: "News" },
    { section: "activity", label: "Activity" },
    { section: "manage", label: "Manage" },
  ];

  return (
    <nav
      aria-label="Portfolio sections"
      className="grid w-full max-w-full min-w-0 grid-cols-6 gap-1 overflow-hidden rounded-[22px] border border-white/8 bg-black/16 p-1 sm:hidden"
    >
      {items.map((item) => (
        <button
          key={item.section}
          type="button"
          aria-label={item.label}
          title={item.label}
          onClick={() => setSection(item.section)}
          className={[
            "grid h-11 min-w-0 place-items-center rounded-[15px] transition",
            active === item.section
              ? "bg-[#ddb159] text-[#072116] shadow-[0_10px_24px_rgba(221,177,89,0.16)]"
              : "bg-white/[0.055] text-[#faf6f0]/58 hover:bg-white/[0.08] hover:text-[#faf6f0]",
          ].join(" ")}
        >
          <SectionIcon section={item.section} />
        </button>
      ))}
    </nav>
  );
}

function PortfolioTopBar`,
);

const refinedHero = 'className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden rounded-none border-0 bg-[radial-gradient(circle_at_52%_14%,rgba(212,175,55,0.10),transparent_34%),radial-gradient(circle_at_18%_62%,rgba(16,185,129,0.14),transparent_42%),linear-gradient(180deg,rgba(5,42,28,0.54)_0%,rgba(2,23,15,0.28)_58%,rgba(2,23,15,0)_100%)] text-[#faf6f0] shadow-none sm:left-auto sm:w-auto sm:translate-x-0 sm:rounded-[28px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"';
const refinedHeroLarge = 'className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden rounded-none border-0 bg-[radial-gradient(circle_at_52%_14%,rgba(212,175,55,0.10),transparent_34%),radial-gradient(circle_at_18%_62%,rgba(16,185,129,0.14),transparent_42%),linear-gradient(180deg,rgba(5,42,28,0.54)_0%,rgba(2,23,15,0.28)_58%,rgba(2,23,15,0)_100%)] text-[#faf6f0] shadow-none sm:left-auto sm:w-auto sm:translate-x-0 sm:rounded-[32px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"';
const safeHero = 'className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden rounded-none border-0 bg-[radial-gradient(circle_at_52%_14%,rgba(212,175,55,0.10),transparent_34%),radial-gradient(circle_at_18%_62%,rgba(16,185,129,0.14),transparent_42%),linear-gradient(180deg,rgba(5,42,28,0.54)_0%,rgba(2,23,15,0.28)_58%,rgba(2,23,15,0)_100%)] text-[#faf6f0] shadow-none sm:left-auto sm:w-auto sm:max-w-none sm:translate-x-0 sm:rounded-[28px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"';
const safeHeroLarge = 'className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden rounded-none border-0 bg-[radial-gradient(circle_at_52%_14%,rgba(212,175,55,0.10),transparent_34%),radial-gradient(circle_at_18%_62%,rgba(16,185,129,0.14),transparent_42%),linear-gradient(180deg,rgba(5,42,28,0.54)_0%,rgba(2,23,15,0.28)_58%,rgba(2,23,15,0)_100%)] text-[#faf6f0] shadow-none sm:left-auto sm:w-auto sm:max-w-none sm:translate-x-0 sm:rounded-[32px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"';
replaceAll(refinedHero, safeHero);
replaceAll(refinedHeroLarge, safeHeroLarge);

replaceAll(
  'className="relative left-1/2 h-[270px] w-screen -translate-x-1/2 overflow-visible sm:hidden"',
  'className="relative left-1/2 h-[270px] w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden sm:hidden"',
);
replaceAll(
  'className="h-full w-full overflow-visible"',
  'className="h-full w-full overflow-hidden"',
);

replaceAll(
  'className="grid min-w-0 max-w-full gap-3 overflow-x-hidden"',
  'className="grid w-full min-w-0 max-w-full gap-3 overflow-x-clip sm:overflow-x-hidden"',
);

replaceAll(
  'className="grid gap-3"',
  'className="grid w-full max-w-full min-w-0 gap-3 overflow-hidden"',
);
replaceAll(
  'className="grid w-full max-w-full min-w-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_310px]"',
  'className="grid w-full max-w-full min-w-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_310px]"',
);

replaceAll(
  'className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.045] p-3 text-[#faf6f0] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"',
  'className="grid w-full max-w-full min-w-0 gap-3 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.045] p-3 text-[#faf6f0] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"',
);

replaceAll(
  'className="mt-1 text-[12px] font-semibold text-[#faf6f0]/45"',
  'className="mt-1 max-w-full truncate text-[12px] font-semibold text-[#faf6f0]/45 sm:whitespace-normal"',
);

replaceAll(
  'className="grid gap-2 sm:flex sm:justify-end"',
  'className="grid w-full min-w-0 gap-2 sm:flex sm:justify-end"',
);

replaceAll(
  'className="sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] !text-[#072116]"',
  'className="w-full min-w-0 sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] !text-[#072116]"',
);
replaceAll(
  'className="sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] text-[#072116]"',
  'className="w-full min-w-0 sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] !text-[#072116]"',
);

replaceAll(
  'className="group relative overflow-hidden rounded-[22px] border border-[#072116]/8 bg-[#faf6f0] text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:border-[#ddb159]/45 hover:bg-white"',
  'className="group relative w-full max-w-full overflow-hidden rounded-[22px] border border-[#072116]/8 bg-[#faf6f0] text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:border-[#ddb159]/45 hover:bg-white"',
);

fs.writeFileSync(file, source);
