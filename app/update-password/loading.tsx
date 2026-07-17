/* Force-dynamic route (per-request CSP nonce): the loading boundary keeps
   navigation instant instead of blocking on the server round-trip. */
export default function Loading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-[#020806]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ddb159]/25 border-t-[#ddb159]" />
    </div>
  );
}
