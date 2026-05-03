import Link from "next/link";

export function PaywallCard() {
  return (
    <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#FFFDF5] p-8 text-center text-[#0F2A1F]">
      <h2 className="text-2xl font-bold">Unlock Basic Access</h2>
      <p className="mt-2 text-slate-600">Subscribe to view full stock rankings, watchlist analytics, and intelligence data.</p>
      <Link href="/pricing" className="mt-5 inline-block rounded-xl bg-[#D4AF37] px-6 py-3 font-semibold">Go to Pricing</Link>
    </div>
  );
}
