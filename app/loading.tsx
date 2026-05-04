export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#072116]">
      <div className="flex flex-col items-center gap-4">
        {/* Pulsing logo placeholder */}
        <div className="relative">
          <div className="size-12 animate-pulse rounded-2xl bg-[#ddb159]/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="size-6 animate-spin text-[#ddb159]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
        </div>

        <p className="text-[12px] font-bold text-[#faf6f0]/40">
          Loading…
        </p>
      </div>
    </div>
  );
}
