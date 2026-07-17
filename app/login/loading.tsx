/* /login is force-dynamic (per-request CSP nonce), so without a loading
   boundary every navigation waits on the full server round-trip with no
   feedback — and Next.js skips prefetching the route entirely. This
   boundary makes the transition paint instantly. */
export default function Loading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-[#020806]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ddb159]/25 border-t-[#ddb159]" />
    </div>
  );
}
