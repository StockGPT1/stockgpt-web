import Link from "next/link";

export function LegalFooterLinks({
  gold = "#ddb159",
  includeAffiliate = false,
  className = "",
}: {
  gold?: string;
  includeAffiliate?: boolean;
  className?: string;
}) {
  const links = [
    ["Terms", "/legal#terms"],
    ["Subscription", "/legal#subscription"],
    ["Privacy", "/legal#privacy"],
    ["Cookies", "/legal#cookies"],
    ["Disclaimer", "/legal#disclaimer"],
    ...(includeAffiliate ? [["Affiliate Terms", "/legal#affiliate-terms"]] : []),
  ] as const;

  return (
    <div className={["flex flex-wrap items-center justify-center gap-3 text-sm font-bold", className].join(" ")}>
      <span className="font-semibold opacity-70">
        StockGPT LLC
      </span>

      {links.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          className="transition-colors hover:opacity-100"
          style={{ color: gold }}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
