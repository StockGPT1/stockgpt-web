"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { trackClientEvent } from "@/lib/analytics/client-events";

const STORAGE_KEY = "stockgpt.activationChecklist";

type StoredState = {
  dismissed?: boolean;
  collapsed?: boolean;
  clicked?: string[];
};

export function ActivationChecklist({
  planComplete,
  portfolioComplete,
}: {
  planComplete: boolean;
  portfolioComplete: boolean;
}) {
  const [stored, setStored] = useState<StoredState>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        setStored(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as StoredState);
      } catch {
        setStored({});
      }
      setLoaded(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  function save(next: StoredState) {
    setStored(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function markClicked(id: string, href: string) {
    const clicked = Array.from(new Set([...(stored.clicked ?? []), id]));
    save({ ...stored, clicked });
    trackClientEvent("activation_task_clicked", { task: id, href });
  }

  if (!loaded || stored.dismissed) return null;

  const tasks = [
    {
      id: "plan",
      title: "Choose your plan",
      description: "Start with your free access, then unlock the research tools when ready.",
      cta: "View plan",
      href: "/pricing",
      complete: planComplete || stored.clicked?.includes("plan") === true,
    },
    {
      id: "portfolio",
      title: "Build your first Portfolio Draft",
      description: "Create a draft from your preferences and review the allocation before making decisions.",
      cta: "Build draft",
      href: "/portfolio?builder=1",
      complete: portfolioComplete || stored.clicked?.includes("portfolio") === true,
    },
    {
      id: "check",
      title: "Run one StockGPT Check",
      description: "Pressure-test a stock idea before relying on hype or someone else's confidence.",
      cta: "Run check",
      href: "/ask-stockgpt",
      complete: stored.clicked?.includes("check") === true,
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-[#ddb159]/24 bg-[#061b12]/78 shadow-[0_10px_26px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-3 px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            Finish setting up StockGPT
          </p>
          <p className="mt-1 text-[11px] font-semibold text-white/48">
            Three quick steps to turn your account into a research workflow.
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => save({ ...stored, collapsed: !stored.collapsed })}
            aria-expanded={!stored.collapsed}
            className="grid size-8 place-items-center rounded-full border border-white/10 text-sm text-white/55 transition hover:border-[#ddb159]/35 hover:text-[#ddb159]"
          >
            {stored.collapsed ? "+" : "−"}
            <span className="sr-only">{stored.collapsed ? "Expand checklist" : "Collapse checklist"}</span>
          </button>
          <button
            type="button"
            onClick={() => save({ ...stored, dismissed: true })}
            className="grid size-8 place-items-center rounded-full border border-white/10 text-base text-white/55 transition hover:border-[#ddb159]/35 hover:text-[#ddb159]"
          >
            ×<span className="sr-only">Dismiss checklist</span>
          </button>
        </div>
      </div>

      {!stored.collapsed && (
        <div className="grid gap-1.5 border-t border-white/8 p-2 sm:grid-cols-3">
          {tasks.map((task) => (
            <div key={task.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/7 bg-white/[0.035] p-2.5">
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-black ${task.complete ? "bg-emerald-500/16 text-emerald-300" : "bg-[#ddb159]/12 text-[#ddb159]"}`}>
                {task.complete ? "✓" : "·"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[10px] font-black leading-4 text-white sm:text-[11px]">{task.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[9px] font-semibold leading-4 text-white/42">{task.description}</p>
              </div>
              <Link
                href={task.href}
                onClick={() => markClicked(task.id, task.href)}
                className="shrink-0 rounded-full bg-[#ddb159] px-2.5 py-1.5 text-[9px] font-black text-[#072116]"
              >
                {task.complete ? "Review" : task.cta}
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
