"use client";

import { ModuleState } from "@/components/ModuleState";

export default function WorldNewsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-3 sm:p-5">
      <ModuleState
        eyebrow="News"
        title="The market briefing could not load"
        description="No empty or stale feed is being presented as current. Retry the briefing when you are ready."
        tone="error"
        action={<button type="button" onClick={reset} className="min-h-10 rounded-full bg-[#ddb159] px-4 text-[11px] font-black text-[#07170f]">Try again</button>}
      />
    </div>
  );
}
