import Link from "next/link";

type AskStockGPTButtonProps = {
  canUseAskStockGPT?: boolean;
  isAuthenticated?: boolean;
};

export function AskStockGPTButton(_props: AskStockGPTButtonProps) {
  return (
    <Link
      href="/ask-stockgpt"
      prefetch={false}
      className="group relative inline-flex h-10 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full border border-[#ddb159]/35 bg-[#ddb159] px-4 text-[12px] font-black text-[#07170f] shadow-[0_10px_30px_rgba(221,177,89,0.18)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(221,177,89,0.25)] [&_*]:text-[#07170f]"
    >
      <span className="relative text-[12px]" aria-hidden="true">✦</span>
      <span className="relative whitespace-nowrap">Ask StockGPT</span>
    </Link>
  );
}
