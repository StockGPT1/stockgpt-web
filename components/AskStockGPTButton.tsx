import Link from "next/link";
import { StockIcon } from "@/components/StockIcon";
import { buildAskHref, type AskContext } from "@/lib/ask-context";

type AskStockGPTButtonProps = {
  canUseAskStockGPT?: boolean;
  isAuthenticated?: boolean;
  label?: string;
  context?: AskContext | null;
  compact?: boolean;
  className?: string;
};

export function AskStockGPTButton({
  canUseAskStockGPT = false,
  isAuthenticated = false,
  label = "Ask StockGPT",
  context,
  compact = false,
  className = "",
}: AskStockGPTButtonProps) {
  const askHref = buildAskHref(context);
  const href = canUseAskStockGPT
    ? askHref
    : isAuthenticated
      ? "/subscription"
      : `/login?next=${encodeURIComponent(askHref)}`;
  const accessibleLabel = canUseAskStockGPT
    ? label
    : isAuthenticated
      ? `Unlock ${label}`
      : `Sign in to ${label}`;

  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={accessibleLabel}
      data-locked={canUseAskStockGPT ? "false" : "true"}
      className={`group relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full border border-[#ddb159]/35 bg-[#ddb159] font-black text-[#07170f] shadow-[0_10px_30px_rgba(221,177,89,0.18)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(221,177,89,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2d27a] [&_*]:text-[#07170f] ${compact ? "h-10 px-3 text-[11px]" : "h-11 px-4 text-[12px]"} ${className}`}
    >
      <StockIcon name="ask" className="relative size-4" />
      <span className="relative whitespace-nowrap">{canUseAskStockGPT ? label : accessibleLabel}</span>
    </Link>
  );
}
