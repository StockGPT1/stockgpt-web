"use client";

import { ModuleState } from "@/components/ModuleState";

export default function NotificationsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-3 sm:p-5">
      <ModuleState eyebrow="Alerts" title="The alert inbox could not load" description="Your data has not been replaced or shown as all clear. Retry the inbox when you are ready." tone="error" action={<button type="button" onClick={reset} className="min-h-10 rounded-full bg-[#ddb159] px-4 text-[11px] font-black text-[#07170f]">Try again</button>} />
    </div>
  );
}
