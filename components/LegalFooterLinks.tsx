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
    <div className={["flex flex-wrap gap-3 text-sm font-bold", className].join(" ")}>
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
