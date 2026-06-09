import fs from "node:fs";

const file = "components/PortfolioCommandCentreRevolut.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceAll(search, replacement) {
  if (!source.includes(search)) return;
  source = source.split(search).join(replacement);
}

replaceAll(
  'const widthPct = maxAllocation > 0 ? Math.max(4, Math.min(100, (holding.currentAllocationPct / maxAllocation) * 100)) : 0;',
  'const widthPct = Math.max(0, Math.min(100, holding.currentAllocationPct));',
);

replaceAll(
  'const widthPct = Math.max(4, Math.min(100, holding.currentAllocationPct));',
  'const widthPct = Math.max(0, Math.min(100, holding.currentAllocationPct));',
);

replaceAll(
  '"h-10 shrink-0 rounded-full px-4 text-[11px] font-black transition",',
  '"h-9 shrink-0 rounded-full px-3.5 text-[10.5px] font-black transition",',
);

replaceAll(
  'className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/8 bg-black/18 p-2.5 backdrop-blur sm:flex-row sm:items-center sm:justify-between"',
  'className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/8 bg-black/18 p-2 backdrop-blur sm:flex-row sm:items-center sm:justify-between"',
);

replaceAll(
  'className="inline-flex h-10 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[11px] font-black text-[#072116] transition hover:brightness-105"',
  'className="inline-flex h-9 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[10.5px] font-black text-[#072116] transition hover:brightness-105"',
);

replaceAll(
  'className="relative overflow-hidden rounded-[28px] border border-[#ddb159]/18 bg-[#050706] text-[#faf6f0] shadow-[0_18px_48px_rgba(0,0,0,0.30)] sm:rounded-[32px]"',
  'className="relative overflow-hidden rounded-[24px] border border-[#ddb159]/18 bg-[#050706] text-[#faf6f0] shadow-[0_18px_48px_rgba(0,0,0,0.30)] sm:rounded-[28px]"',
);

replaceAll(
  'className="relative px-5 pb-3 pt-5 text-center sm:px-6 sm:pt-6 lg:text-left"',
  'className="relative px-4 pb-1 pt-4 text-center sm:px-5 sm:pt-4 lg:text-left"',
);

replaceAll(
  'className="mt-3 text-[42px] font-black leading-none tracking-[-0.07em] sm:text-[58px] lg:text-[64px]"',
  'className="mt-1.5 text-[32px] font-black leading-none tracking-[-0.065em] sm:text-[42px] lg:text-[46px]"',
);

replaceAll(
  '"mt-2 text-[14px] font-black tabular-nums sm:text-[16px]",',
  '"mt-1 text-[12.5px] font-black tabular-nums sm:text-[14px]",',
);

replaceAll(
  'className="flex shrink-0 flex-col items-end gap-2"',
  'className="flex shrink-0 flex-col items-end gap-1"',
);

replaceAll(
  'className="rounded-full bg-[#ddb159] px-3 py-1.5 text-[11px] font-black text-[#072116]"',
  'className="rounded-full bg-[#ddb159] px-3 py-1 text-[10.5px] font-black text-[#072116]"',
);

replaceAll(
  'className="mt-4 flex items-center justify-between gap-3"',
  'className="mt-2 flex items-center justify-between gap-3"',
);

replaceAll(
  'className="hidden text-[11px] font-semibold text-[#faf6f0]/46 sm:block"',
  'className="hidden text-[10.5px] font-semibold text-[#faf6f0]/46 sm:block"',
);

replaceAll(
  'className="h-8 rounded-full px-3 text-[10px] font-black transition"',
  'className="h-7 rounded-full px-2.5 text-[9.5px] font-black transition"',
);

replaceAll('height={260}', 'height={190}');
replaceAll('height={220}', 'height={190}');

replaceAll('className="px-4 py-3"', 'className="px-4 py-2"');
replaceAll('className="mt-1 text-[18px] font-black"', 'className="mt-0.5 text-[15px] font-black"');
replaceAll('className="mt-1 text-[18px] font-black text-[#ddb159]"', 'className="mt-0.5 text-[15px] font-black text-[#ddb159]"');

replaceAll(
  'className="group relative overflow-hidden rounded-2xl border border-[#072116]/8 bg-[#faf6f0] text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:border-[#ddb159]/45 hover:bg-white"',
  'className="group relative overflow-hidden rounded-[22px] border border-[#072116]/8 bg-[#faf6f0] text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:border-[#ddb159]/45 hover:bg-white"',
);

const columnTemplate = 'sm:grid-cols-[minmax(330px,1fr)_130px_130px_82px_102px_128px]';
const oldColumnTemplates = [
  'sm:grid-cols-[minmax(210px,1.6fr)_110px_125px_90px_80px_94px]',
  'sm:grid-cols-[minmax(280px,1fr)_120px_130px_90px_105px_112px]',
  'sm:grid-cols-[minmax(330px,1.35fr)_140px_140px_90px_110px_130px]',
];
oldColumnTemplates.forEach((template) => replaceAll(template, columnTemplate));

replaceAll(
  `className="relative grid gap-3 px-3 py-3 ${columnTemplate} sm:items-center sm:px-4"`,
  `className="relative grid gap-3 px-3 py-2.5 ${columnTemplate} sm:items-center sm:px-4"`,
);

replaceAll(
  `className="relative grid gap-3 px-3 py-2.5 ${columnTemplate} sm:items-center sm:px-4"`,
  `className="relative grid gap-3 px-3 py-2.5 ${columnTemplate} sm:items-center sm:px-4"`,
);

replaceAll(
  `className="hidden ${columnTemplate} px-4 text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38 sm:grid"`,
  `className="hidden ${columnTemplate} px-4 text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/44 sm:grid"`,
);

replaceAll(
  `<div className="hidden ${columnTemplate} px-4 text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/44 sm:grid">
            <span>Asset</span><span className="text-right">Value</span><span className="text-right">Net P/L</span><span className="text-right">%</span><span className="text-right">AI</span><span className="text-right">Action</span>
          </div>`,
  `<div className="hidden ${columnTemplate} px-4 text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/44 sm:grid">
            <span className="pl-[56px]">Asset</span>
            <span className="justify-self-end text-right">Value</span>
            <span className="justify-self-end text-right">Net P/L</span>
            <span className="justify-self-end text-right">%</span>
            <span className="justify-self-end text-right">AI</span>
            <span className="justify-self-center text-center">Action</span>
          </div>`,
);

replaceAll(
  `<div className="hidden ${columnTemplate} px-4 text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38 sm:grid">
            <span>Asset</span><span className="text-right">Value</span><span className="text-right">Net P/L</span><span className="text-right">%</span><span className="text-right">AI</span><span className="text-right">Action</span>
          </div>`,
  `<div className="hidden ${columnTemplate} px-4 text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/44 sm:grid">
            <span className="pl-[56px]">Asset</span>
            <span className="justify-self-end text-right">Value</span>
            <span className="justify-self-end text-right">Net P/L</span>
            <span className="justify-self-end text-right">%</span>
            <span className="justify-self-end text-right">AI</span>
            <span className="justify-self-center text-center">Action</span>
          </div>`,
);

replaceAll(
  'className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.045] p-3 text-[#faf6f0] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"',
  'className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.045] p-3 text-[#faf6f0] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"',
);

replaceAll(
  'className="sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] text-[#072116]"',
  'className="sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] text-[#072116]"',
);

replaceAll(
  'className="sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] !text-[#072116]"',
  'className="sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] text-[#072116]"',
);

replaceAll(
  'className="flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-black/18 p-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"',
  'className="flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-black/18 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"',
);

fs.writeFileSync(file, source);
