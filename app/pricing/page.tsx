import { createClient } from "@/utils/supabase/server";

export default async function PricingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-[#0F2A1F] p-8 text-white">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold">Unlock StockGPT</h1>

        <p className="mt-4 text-white/70">
          Access the full ranking engine, insights and market intelligence.
        </p>

        <div className="mt-10 rounded-2xl bg-white p-8 text-[#0F2A1F]">
          <h2 className="text-3xl font-bold">Basic</h2>
          <p className="mt-2 text-slate-600">Full access to the platform</p>

          <ul className="mt-6 space-y-2 text-left text-sm">
            <li>Full stock rankings</li>
            <li>World news + stock impact</li>
            <li>Live updates</li>
          </ul>

          {user ? (
            <form action="/api/create-checkout-session" method="POST">
              <button className="mt-6 w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-bold">
                Subscribe
              </button>
            </form>
          ) : (
            <a
              href="/login"
              className="mt-6 block w-full rounded-xl bg-[#D4AF37] px-4 py-3 text-center font-bold"
            >
              Log in to subscribe
            </a>
          )}
        </div>

        <div className="mt-10">
          <p className="text-sm text-white/60">
            Pro tier coming soon
          </p>

          <a
            href="/pro-waitlist"
            className="mt-4 inline-block text-[#D4AF37]"
          >
            Join waitlist
          </a>
        </div>
      </div>
    </main>
  );
}