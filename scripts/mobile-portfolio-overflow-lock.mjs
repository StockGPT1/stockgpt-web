import fs from "node:fs";

const file = "components/PortfolioCommandCentreRevolut.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceAll(search, replacement) {
  if (!source.includes(search)) return;
  source = source.split(search).join(replacement);
}

const mobileHeroClass = 'className="relative left-1/2 -mt-3 w-[100svw] max-w-[100svw] -translate-x-1/2 overflow-hidden rounded-none border-0 bg-[radial-gradient(circle_at_50%_18%,rgba(212,175,55,0.11),transparent_34%),radial-gradient(circle_at_22%_52%,rgba(16,185,129,0.16),transparent_42%),radial-gradient(circle_at_78%_68%,rgba(7,87,55,0.16),transparent_38%),linear-gradient(180deg,rgba(5,42,28,0.62)_0%,rgba(3,31,20,0.38)_42%,rgba(2,19,13,0.05)_100%)] text-[#faf6f0] shadow-none sm:left-auto sm:mt-0 sm:w-auto sm:max-w-none sm:translate-x-0 sm:rounded-[32px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"';
const lockedHeroClass = 'className="relative -mx-5 -mt-3 w-[calc(100%+2.5rem)] max-w-none overflow-hidden rounded-none border-0 bg-[radial-gradient(circle_at_50%_18%,rgba(212,175,55,0.11),transparent_34%),radial-gradient(circle_at_22%_52%,rgba(16,185,129,0.16),transparent_42%),radial-gradient(circle_at_78%_68%,rgba(7,87,55,0.16),transparent_38%),linear-gradient(180deg,rgba(5,42,28,0.62)_0%,rgba(3,31,20,0.38)_42%,rgba(2,19,13,0.05)_100%)] text-[#faf6f0] shadow-none sm:mx-0 sm:mt-0 sm:w-auto sm:max-w-none sm:rounded-[32px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"';
replaceAll(mobileHeroClass, lockedHeroClass);

source = source.replace(
  /className="relative left-1\/2 -mt-3 w-\[100svw\][^"]*sm:shadow-\[0_18px_48px_rgba\(0,0,0,0\.30\)\]"/g,
  lockedHeroClass,
);

source = source.replace(
  /className="relative -mx-4 w-\[calc\(100%\+2rem\)\][^"]*sm:shadow-\[0_18px_48px_rgba\(0,0,0,0\.30\)\]"/g,
  lockedHeroClass,
);

replaceAll(
  'className="relative px-4 pb-0 pt-5 text-center sm:px-6 sm:pb-3 sm:pt-6 lg:text-left"',
  'className="relative mx-auto w-full max-w-[100vw] px-5 pb-0 pt-5 text-center sm:px-6 sm:pb-3 sm:pt-6 lg:text-left"',
);

replaceAll(
  'className="mb-3 flex items-center justify-between sm:hidden"',
  'className="mb-3 flex w-full min-w-0 items-center justify-between gap-3 sm:hidden"',
);

replaceAll(
  'className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-[#ddb159]/24 bg-[#061b12]/72 px-3 text-[11px] font-black text-[#ddb159] backdrop-blur"',
  'className="relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[#ddb159]/24 bg-[#061b12]/72 px-3 text-[11px] font-black text-[#ddb159] backdrop-blur"',
);

replaceAll(
  'className="relative h-[270px] w-full max-w-full overflow-hidden sm:hidden"',
  'className="relative h-[270px] w-full max-w-full overflow-hidden sm:hidden"',
);

replaceAll(
  'className="grid w-full max-w-full min-w-0 grid-cols-6 gap-1 overflow-hidden rounded-[22px] border border-white/8 bg-black/16 p-1 sm:hidden"',
  'className="grid w-full max-w-full min-w-0 grid-cols-6 gap-1 overflow-hidden rounded-[22px] border border-white/8 bg-black/16 p-1 sm:hidden"',
);

replaceAll(
  'className="grid min-w-0 max-w-full gap-3 overflow-x-hidden"',
  'className="grid w-full min-w-0 max-w-full gap-3 overflow-x-clip sm:overflow-x-hidden"',
);
replaceAll(
  'className="grid w-full min-w-0 max-w-full gap-3 overflow-x-clip sm:overflow-x-hidden"',
  'className="grid w-full min-w-0 max-w-full gap-3 overflow-x-clip sm:overflow-x-hidden"',
);

replaceAll(
  'className="grid w-full max-w-full min-w-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_310px]"',
  'className="grid w-full max-w-full min-w-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_310px]"',
);

// Remove any mobile-only visual frame introduced by prior patches while keeping desktop card styling.
source = source.replace(/border-0 bg-\[radial-gradient/g, 'border-0 bg-[radial-gradient');

fs.writeFileSync(file, source);
