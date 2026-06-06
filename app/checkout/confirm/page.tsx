import type { Metadata } from "next";
import Link from "next/link";
import { EndorselyReferralInput } from "@/components/EndorselyReferralInput";
import { LegalFooterLinks } from "@/components/LegalFooterLinks";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Confirm Core Subscription | StockGPT",
  description: "Review your StockGPT Core subscription before Stripe checkout.",
};

type CheckoutConfirmSearchParams = {
  legal?: string;
};

const includedFeatures = [
  "Full S&P 500 AI rankings and scores",
  "Portfolio tools, watchlist and alerts",
  "Ask StockGPT research assistant",
  "World news and stock impact context",
];

export default async function CheckoutConfirmPage({
  searchParams,
}: {
  searchParams?: Promise<CheckoutConfirmSearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#072116] px-4 py-5 text-[#faf6f0] sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,rgba(221,177,89,0.16),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(16,185,129,0.10),transparent_28%),linear-gradient(135deg,#04180f,#072116_52%,#04180f)]" />
        <div className="absolute right-[-180px] top-10 h-[420px] w-[420px] rounded-full border border-[#ddb159]/10" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-5xl flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3">
          <Link
            href="/pricing"
            className="text-[12px] font-black uppercase tracking-[0.16em] text-[#ddb159] transition hover:text-[#f0c867]"
          >
            ← Back to pricing
          </Link>

          <Link
            href="/legal"
            className="text-[11px] font-black uppercase tracking-[0.16em] text-[#faf6f0]/52 transition hover:text-[#ddb159]"
          >
            Legal
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-5 py-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-7 lg:py-10">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ddb159]/28 bg-[#ddb159]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
              <span className="size-1.5 rounded-full bg-[#ddb159] shadow-[0_0_12px_rgba(221,177,89,0.8)]" />
              Secure Stripe checkout
            </div>

            <h1 className="mt-5 max-w-2xl text-[38px] font-black leading-[0.94] tracking-[-0.06em] sm:text-[54px] lg:text-[64px]">
              Review Core before continuing.
            </h1>

            <p className="mt-5 max-w-xl text-[14px] font-medium leading-7 text-[#faf6f0]/62 sm:text-[16px] sm:leading-8">
              Confirm the subscription summary, then continue to Stripe to complete
              payment securely.
            </p>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {includedFeatures.map((feature) => (
                <div
                  key={feature}
                  className="rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.045] px-4 py-3 text-[12px] font-bold leading-5 text-[#faf6f0]/76"
                >
                  <span className="mr-2 text-[#ddb159]">✓</span>
                  {feature}
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[32px] border border-[#ddb159]/45 bg-[#0b2b1d]/78 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:p-6">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#ddb159]/14 blur-3xl" />

            <div className="relative">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
                Core subscription
              </p>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <h2 className="text-[42px] font-black leading-none tracking-[-0.05em]">
                  £18.99
                </h2>
                <p className="pb-1 text-[13px] font-bold text-[#faf6f0]/52">
                  / month
                </p>
              </div>

              <p className="mt-3 rounded-2xl border border-[#ddb159]/16 bg-[#061b12]/55 px-4 py-3 text-[12px] font-semibold leading-6 text-[#faf6f0]/62">
                You will be redirected to Stripe. StockGPT does not store your card details.
              </p>

              {params.legal === "missing" && (
                <p className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-[12px] font-bold leading-5 text-amber-100">
                  Please tick the confirmation box before continuing.
                </p>
              )}

              {!user ? (
                <div className="mt-5 rounded-2xl border border-[#ddb159]/18 bg-[#061b12]/50 p-4">
                  <p className="text-[13px] font-bold leading-6 text-[#faf6f0]/72">
                    Log in or create an account before subscribing so Core access is linked correctly.
                  </p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Link
                      href="/signup"
                      className="inline-flex h-11 items-center justify-center rounded-full bg-[#ddb159] px-5 text-[12px] font-black uppercase tracking-[0.14em] text-[#072116] transition hover:brightness-110"
                    >
                      Create account
                    </Link>
                    <Link
                      href="/login"
                      className="inline-flex h-11 items-center justify-center rounded-full border border-[#ddb159]/35 px-5 text-[12px] font-black uppercase tracking-[0.14em] text-[#ddb159] transition hover:bg-[#ddb159]/10"
                    >
                      Log in
                    </Link>
                  </div>
                </div>
              ) : (
                <form action="/api/create-checkout-session" method="post" className="mt-5">
                  <EndorselyReferralInput />

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#ddb159]/20 bg-[#061b12]/60 p-4 text-left transition hover:border-[#ddb159]/40 hover:bg-[#061b12]/80">
                    <input
                      type="checkbox"
                      name="legal_acknowledgement"
                      value="accepted"
                      required
                      className="mt-1 size-4 shrink-0 accent-[#ddb159]"
                    />
                    <span className="text-[12px] font-semibold leading-6 text-[#faf6f0]/68">
                      I understand StockGPT is research software for informational purposes only.
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-[#ddb159] px-6 text-[13px] font-black uppercase tracking-[0.14em] text-[#072116] shadow-[0_14px_34px_rgba(221,177,89,0.22)] transition hover:brightness-110"
                  >
                    Continue to Stripe
                  </button>

                  <p className="mt-3 text-center text-[10px] font-medium leading-5 text-[#faf6f0]/38">
                    By continuing, you agree to the StockGPT terms, subscription terms, privacy policy and disclaimer.
                  </p>
                </form>
              )}

              <div className="mt-4 flex justify-center">
                <LegalFooterLinks className="justify-center text-[#faf6f0]/42" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}