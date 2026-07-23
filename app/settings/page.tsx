import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CurrencyPreferenceSelect } from "@/components/CurrencyPreferenceSelect";
import { NotificationPreferenceToggles } from "@/components/NotificationPreferenceToggles";
import { SupportFeedbackForm } from "@/components/SupportFeedbackForm";
import { normaliseCurrency } from "@/lib/currency";
import { createClient } from "@/utils/supabase/server";
import { displayPlanName, hasActiveSubscription } from "@/lib/subscription";

export const metadata: Metadata = {
  title: "Account Settings | StockGPT",
  description:
    "Manage your StockGPT account, subscription and platform settings.",
};

type Profile = {
  subscription_status: string | null;
  email_news_digests: boolean | null;
  email_portfolio_alerts: boolean | null;
  email_watchlist_alerts: boolean | null;
  preferred_currency?: string | null;
  stripe_customer_id: string | null;
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ count: watchlistCount }, { data: profileData }] = await Promise.all([
    supabase
      .from("watchlist")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),

    supabase
      .from("profiles")
      .select("subscription_status,email_news_digests,email_portfolio_alerts,email_watchlist_alerts,preferred_currency,stripe_customer_id")
      .eq("id", user.id)
      .single(),
  ]);

  const profile = profileData as Profile | null;
  const plan = displayPlanName(profile?.subscription_status);
  const activePlan = hasActiveSubscription(profile?.subscription_status);
  const emailDigestEnabled = Boolean(profile?.email_news_digests);
  const portfolioAlertsEnabled = profile?.email_portfolio_alerts !== false;
  const watchlistAlertsEnabled = profile?.email_watchlist_alerts !== false;
  const preferredCurrency = normaliseCurrency(profile?.preferred_currency);

  return (
    <AppShell activePath="/settings">
      <main className="h-full min-h-0 overflow-y-auto pr-1">
        <h1 className="text-[28px] font-black tracking-[-0.03em] text-[#faf6f0]">
          Settings
        </h1>

        <p className="mt-1 text-[13px] font-medium text-[#faf6f0]/50">
          Manage your account, preferences, support and StockGPT access.
        </p>

        <div className="mt-6 grid max-w-2xl gap-4 pb-8">
          <section className="rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <h2 className="text-[15px] font-black tracking-[-0.02em]">Account</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">Your account details</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#072116]/10 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/45">Email</p>
                <p className="mt-0.5 truncate text-[13px] font-bold">{user.email ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-[#072116]/10 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/45">Member since</p>
                <p className="mt-0.5 text-[13px] font-bold">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-[#072116]/10 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/45">Plan</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="text-[13px] font-bold">{plan}</p>
                  {activePlan ? (
                    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">Active</span>
                  ) : (
                    <span className="rounded-full bg-[#072116]/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#072116]/45">Locked</span>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-[#072116]/10 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/45">Watchlist</p>
                <p className="mt-0.5 text-[13px] font-bold">{watchlistCount ?? 0} stock{(watchlistCount ?? 0) !== 1 ? "s" : ""} tracked</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <h2 className="text-[15px] font-black tracking-[-0.02em]">Subscription</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">Review your StockGPT tier before going to billing.</p>
            <div className="mt-4 rounded-xl border border-[#072116]/10 px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[13px] font-bold">Current plan: {plan}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/50">Manage billing, review Core annual/monthly, or join the Executive waitlist.</p>
                </div>
                <Link href="/subscription" style={{ backgroundColor: "#ddb159", color: "#072116" }} className="shrink-0 rounded-full px-4 py-2 text-center text-[12px] font-black transition hover:opacity-90">Manage subscription</Link>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#ddb159]/35 bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[15px] font-black tracking-[-0.02em]">Affiliate Program</h2>
                <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">Apply to become a StockGPT partner and refer subscribers.</p>
              </div>
              <Link href="/affiliate" style={{ backgroundColor: "#072116", color: "#ddb159" }} className="shrink-0 rounded-full border border-[#ddb159]/40 px-4 py-2 text-center text-[12px] font-black transition hover:opacity-90">Apply to be an affiliate →</Link>
            </div>
          </section>

          <section className="rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <h2 className="text-[15px] font-black tracking-[-0.02em]">Emails and notifications</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">Choose which StockGPT emails are useful to you.</p>
            <div className="mt-4">
              <NotificationPreferenceToggles
                initialDigest={emailDigestEnabled}
                initialPortfolioAlerts={portfolioAlertsEnabled}
                initialWatchlistAlerts={watchlistAlertsEnabled}
              />
            </div>
          </section>

          <section className="rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <h2 className="text-[15px] font-black tracking-[-0.02em]">Currency</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">Choose the display currency for portfolio values.</p>
            <div className="mt-4">
              <CurrencyPreferenceSelect initialCurrency={preferredCurrency} />
            </div>
          </section>

          <section className="rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <h2 className="text-[15px] font-black tracking-[-0.02em]">Help and feedback</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">Report wrong data, confusing AI answers, bugs, billing issues or feature requests.</p>
            <div className="mt-4">
              <SupportFeedbackForm />
            </div>
          </section>

          <section className="rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <h2 className="text-[15px] font-black tracking-[-0.02em]">Security</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">Keep your account secure</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-[#072116]/10 px-4 py-3">
                <div>
                  <p className="text-[13px] font-bold">Password</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/50">Change your account password</p>
                </div>
                <Link href="/forgot-password" style={{ backgroundColor: "#ddb159", color: "#072116" }} className="shrink-0 rounded-full px-4 py-2 text-[12px] font-black transition hover:opacity-90">Change password</Link>
              </div>
              <form action="/auth/signout" method="post">
                <button type="submit" className="flex w-full items-center justify-between rounded-xl border border-[#072116]/10 px-4 py-3 text-left transition hover:border-[#ddb159]/40">
                  <div>
                    <p className="text-[13px] font-bold">Sign out</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/50">End your current session</p>
                  </div>
                  <span className="text-[12px] font-black text-[#072116]/40">→</span>
                </button>
              </form>
            </div>
          </section>

          <section className="rounded-2xl border-2 border-red-200 bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <h2 className="text-[15px] font-black tracking-[-0.02em] text-red-600">Danger Zone</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">Irreversible actions</p>
            <div className="mt-4">
              <div className="flex items-center justify-between rounded-xl border border-red-200 px-4 py-3">
                <div>
                  <p className="text-[13px] font-bold">Delete account</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/50">Permanently remove your account and all associated data.</p>
                </div>
                <button type="button" className="shrink-0 rounded-full border border-red-400 px-3 py-1.5 text-[11px] font-bold text-red-600 transition hover:bg-red-50" disabled>Delete</button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
