import type { ReactNode } from "react";

export function SkeletonBlock({ className = "h-16" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-2xl bg-[#faf6f0]/[0.07] ${className}`} />;
}

export function ModuleState({
  eyebrow,
  title,
  description,
  action,
  tone = "neutral",
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "neutral" | "review" | "error" | "locked";
}) {
  const border = tone === "error" ? "border-[#b9504d]/36" : tone === "review" ? "border-[#ddb159]/34" : "border-[#ddb159]/18";
  return (
    <section className={`rounded-[22px] border ${border} bg-[#0a271b] p-4 text-[#faf6f0]`}>
      {eyebrow && <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ddb159]">{eyebrow}</p>}
      <h3 className="mt-1 text-[16px] font-black tracking-[-0.025em]">{title}</h3>
      <p className="mt-2 text-[12px] font-semibold leading-5 text-[#faf6f0]/58">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </section>
  );
}
