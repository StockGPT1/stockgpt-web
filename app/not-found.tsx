import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#072116] px-6 text-center">
      {/* Large rank number as visual */}
      <div className="relative">
        <p className="text-[140px] font-black leading-none tracking-[-0.06em] text-[#ddb159]/15 sm:text-[200px]">
          404
        </p>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            className="size-16 text-[#ddb159]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
            <path d="M8 11h6" />
          </svg>
        </div>
      </div>

      <h1 className="mt-2 text-[28px] font-black tracking-[-0.03em] text-[#faf6f0]">
        Stock not found
      </h1>
      <p className="mt-2 max-w-md text-[15px] font-medium text-[#faf6f0]/55">
        The page you&apos;re looking for doesn&apos;t exist, or the ticker
        isn&apos;t in our database. Try searching from the dashboard or browse
        the full rankings.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-full border border-[#ddb159] bg-[#ddb159] px-5 py-2.5 text-[13px] font-bold text-[#072116] transition hover:bg-[#c9a04f]"
        >
          Back to Dashboard
        </Link>
        <Link
          href="/rankings"
          className="rounded-full border border-[#ddb159]/40 px-5 py-2.5 text-[13px] font-bold text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10"
        >
          View Rankings
        </Link>
      </div>
    </div>
  );
}
