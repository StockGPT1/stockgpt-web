import fs from "node:fs";

const file = "app/dashboard/page.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceAll(search, replacement) {
  if (!source.includes(search)) return;
  source = source.split(search).join(replacement);
}

replaceAll(
  'className="min-h-full overflow-visible lg:h-full lg:min-h-0 lg:overflow-hidden"',
  'className="h-full min-h-0 overflow-visible lg:overflow-hidden"',
);

replaceAll(
  'className="grid gap-3 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_clamp(318px,29vw,430px)] lg:gap-3"',
  'className="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_clamp(318px,29vw,440px)] lg:gap-3"',
);

source = source.replace(
  /lg:grid-rows-\[clamp\(118px,17dvh,150px\)_clamp\(54px,[^\]]+\)_minmax\(0,1fr\)\]/g,
  'lg:grid-rows-[minmax(118px,0.72fr)_minmax(56px,0.34fr)_minmax(0,3fr)]',
);

source = source.replace(
  /lg:grid-rows-\[clamp\(188px,23dvh,220px\)_clamp\(206px,27dvh,252px\)_minmax\(300px,1fr\)\]/g,
  'lg:grid-rows-[minmax(188px,0.9fr)_minmax(206px,1.05fr)_minmax(300px,1.45fr)]',
);

replaceAll(
  'className="overflow-hidden rounded-2xl bg-[#faf6f0] text-[#072116] shadow-[0_18px_42px_rgba(0,0,0,0.22)] ring-1 ring-white/20 lg:min-h-0"',
  'className="overflow-hidden rounded-2xl bg-[#faf6f0] text-[#072116] shadow-[0_18px_42px_rgba(0,0,0,0.22)] ring-1 ring-white/20 lg:h-full lg:min-h-0"',
);

replaceAll(
  'className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.035] p-3 text-[#faf6f0] shadow-[0_12px_30px_rgba(0,0,0,0.16)] backdrop-blur lg:h-full lg:min-h-0"',
  'className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.035] p-3 text-[#faf6f0] shadow-[0_12px_30px_rgba(0,0,0,0.16)] backdrop-blur lg:h-full lg:min-h-0"',
);

fs.writeFileSync(file, source);
