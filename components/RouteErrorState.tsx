"use client";

import { ModuleState } from "@/components/ModuleState";

export function RouteErrorState({ title, description, reset }: { title: string; description: string; reset: () => void }) {
  return (
    <div className="min-h-full bg-[#072116] p-3 text-[#faf6f0] sm:p-5">
      <ModuleState
        eyebrow="StockGPT"
        title={title}
        description={description}
        tone="error"
        action={<button type="button" onClick={reset} className="min-h-10 rounded-full bg-[#ddb159] px-4 text-[11px] font-black text-[#07170f]">Try again</button>}
      />
    </div>
  );
}
