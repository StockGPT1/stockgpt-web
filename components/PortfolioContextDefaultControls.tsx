"use client";

import { useState, useTransition } from "react";
import { clearDefaultPortfolioContext, saveDefaultPortfolioContext } from "@/lib/actions/portfolio-context";

export function PortfolioContextDefaultControls({ value }: { value: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return <div className="flex items-center gap-2 text-[10px] text-white/45">
    <button type="button" disabled={pending} onClick={() => startTransition(async () => {
      const result = await saveDefaultPortfolioContext(value);
      setMessage(result.success ? "Default saved" : (result.error ?? "Default could not be saved"));
    })} className="rounded-full border border-white/15 px-3 py-1.5 hover:border-white/30 disabled:opacity-50">Save as default</button>
    <button type="button" disabled={pending} onClick={() => startTransition(async () => {
      const result = await clearDefaultPortfolioContext();
      setMessage(result.success ? "Default cleared" : (result.error ?? "Default could not be cleared"));
    })} className="rounded-full border border-white/10 px-3 py-1.5 hover:border-white/25 disabled:opacity-50">Clear</button>
    {message && <span role="status">{message}</span>}
  </div>;
}
