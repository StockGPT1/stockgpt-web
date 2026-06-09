import fs from "node:fs";

const file = "components/PortfolioCommandCentreRevolut.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceAll(search, replacement) {
  if (!source.includes(search)) return;
  source = source.split(search).join(replacement);
}

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
      className="relative left-1/2 grid w-[calc(100vw-28px)] max-w-[calc(100vw-28px)] -translate-x-1/2 grid-cols-6 gap-1 overflow-hidden rounded-[22px] border border-white/8 bg-black/16 p-1 sm:hidden"
    >
      {items.map((item) => (
        <button
          key={item.section}
          type="button"
          aria-label={item.label}
          title={item.label}
          onClick={() => setSection(item.section)}
          className={[
            "grid h-11 min-w-0 place-items-center rounded-[16px] transition",
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

const mobileHeroClass = 'className="relative left-1/2 w-screen -translate-x-1/2 overflow-visible rounded-none border-0 bg-transparent text-[#faf6f0] shadow-none sm:left-auto sm:w-auto sm:translate-x-0 sm:overflow-hidden sm:rounded-[28px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"';
const mobileHeroClassLarge = 'className="relative left-1/2 w-screen -translate-x-1/2 overflow-visible rounded-none border-0 bg-transparent text-[#faf6f0] shadow-none sm:left-auto sm:w-auto sm:translate-x-0 sm:overflow-hidden sm:rounded-[32px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"';

const refinedMobileHeroClass = 'className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden rounded-none border-0 bg-[radial-gradient(circle_at_52%_14%,rgba(212,175,55,0.10),transparent_34%),radial-gradient(circle_at_18%_62%,rgba(16,185,129,0.14),transparent_42%),linear-gradient(180deg,rgba(5,42,28,0.54)_0%,rgba(2,23,15,0.28)_58%,rgba(2,23,15,0)_100%)] text-[#faf6f0] shadow-none sm:left-auto sm:w-auto sm:translate-x-0 sm:rounded-[28px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"';
const refinedMobileHeroClassLarge = 'className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden rounded-none border-0 bg-[radial-gradient(circle_at_52%_14%,rgba(212,175,55,0.10),transparent_34%),radial-gradient(circle_at_18%_62%,rgba(16,185,129,0.14),transparent_42%),linear-gradient(180deg,rgba(5,42,28,0.54)_0%,rgba(2,23,15,0.28)_58%,rgba(2,23,15,0)_100%)] text-[#faf6f0] shadow-none sm:left-auto sm:w-auto sm:translate-x-0 sm:rounded-[32px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"';

replaceAll(mobileHeroClass, refinedMobileHeroClass);
replaceAll(mobileHeroClassLarge, refinedMobileHeroClassLarge);

replaceAll(
  'className="relative left-1/2 h-[270px] w-screen -translate-x-1/2 overflow-visible sm:hidden"',
  'className="relative left-1/2 h-[270px] w-screen -translate-x-1/2 overflow-visible sm:hidden"',
);

replaceAll(
  'className="relative mt-1 sm:mx-0"',
  'className="relative mt-1 sm:mx-0"',
);

replaceAll(
  'className="relative left-1/2 grid w-[calc(100vw-28px)] max-w-[calc(100vw-28px)] -translate-x-1/2 grid-cols-6 gap-1 overflow-hidden rounded-[22px] border border-white/8 bg-black/16 p-1 sm:hidden"',
  'className="relative left-1/2 grid w-[calc(100vw-28px)] max-w-[calc(100vw-28px)] -translate-x-1/2 grid-cols-6 gap-1 overflow-hidden rounded-[22px] border border-white/8 bg-black/16 p-1 sm:hidden"',
);

fs.writeFileSync(file, source);
