import type { ReactNode } from "react";
import { FreshnessLabel } from "@/components/FreshnessLabel";

type StockGPTViewProps = {
  judgement: string;
  status?: string;
  evidence?: string[];
  risks?: string[];
  updatedAt?: string | Date | null;
  freshnessLabel?: string;
  action?: ReactNode;
  compact?: boolean;
  locked?: boolean;
  className?: string;
};

export function StockGPTView({
  judgement,
  status,
  evidence = [],
  risks = [],
  updatedAt,
  freshnessLabel,
  action,
  compact = false,
  locked = false,
  className = "",
}: StockGPTViewProps) {
  return (
    <section className={`rounded-[22px] border border-[#ddb159]/22 bg-[#0a2a1d] ${compact ? "p-3.5" : "p-4 sm:p-5"} ${className}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ddb159]">StockGPT view</p>
          {status && (
            <span className="mt-2 inline-flex min-h-7 items-center rounded-full border border-[#ddb159]/26 bg-[#ddb159]/10 px-2.5 text-[10px] font-black text-[#f2cf73]">
              {status}
            </span>
          )}
        </div>
        <FreshnessLabel value={updatedAt} label={freshnessLabel} compact />
      </div>

      <p className={`${compact ? "mt-3 text-[13px] leading-5" : "mt-4 text-[15px] leading-6"} font-semibold text-[#faf6f0]/88`}>
        {locked ? "Unlock StockGPT intelligence to see the current model view and supporting evidence." : judgement}
      </p>

      {!locked && (evidence.length > 0 || risks.length > 0) && (
        <div className={`mt-4 grid gap-4 ${evidence.length > 0 && risks.length > 0 ? "sm:grid-cols-2" : ""}`}>
          {evidence.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#faf6f0]/40">Evidence</p>
              <ul className="mt-2 grid gap-1.5 text-[12px] font-semibold leading-5 text-[#faf6f0]/66">
                {evidence.slice(0, 3).map((item) => <li key={item}>— {item}</li>)}
              </ul>
            </div>
          )}
          {risks.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#faf6f0]/40">Watch</p>
              <ul className="mt-2 grid gap-1.5 text-[12px] font-semibold leading-5 text-[#faf6f0]/66">
                {risks.slice(0, 3).map((item) => <li key={item}>— {item}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}
