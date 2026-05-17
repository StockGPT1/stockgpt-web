import Link from "next/link";

export function LegalConsentLine({
  dark = false,
  className = "",
}: {
  dark?: boolean;
  className?: string;
}) {
  return (
    <p
      className={[
        "text-[11px] font-medium leading-5",
        dark ? "text-[#072116]/52" : "text-[#faf6f0]/42",
        className,
      ].join(" ")}
    >
      By subscribing, you agree to the{" "}
      <Link
        href="/legal#terms"
        className={dark ? "font-bold text-[#072116] underline" : "font-bold text-[#ddb159] hover:underline"}
      >
        Terms
      </Link>
      ,{" "}
      <Link
        href="/legal#subscription"
        className={dark ? "font-bold text-[#072116] underline" : "font-bold text-[#ddb159] hover:underline"}
      >
        Subscription Agreement
      </Link>
      ,{" "}
      <Link
        href="/legal#privacy"
        className={dark ? "font-bold text-[#072116] underline" : "font-bold text-[#ddb159] hover:underline"}
      >
        Privacy Policy
      </Link>{" "}
      and{" "}
      <Link
        href="/legal#disclaimer"
        className={dark ? "font-bold text-[#072116] underline" : "font-bold text-[#ddb159] hover:underline"}
      >
        AI Research Disclaimer
      </Link>
      .
    </p>
  );
}
