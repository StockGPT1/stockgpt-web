import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ExecutiveWaitlistButton } from "@/components/ExecutiveWaitlistButton";
import { createClient } from "@/utils/supabase/server";
import { displayPlanName, hasActiveSubscription } from "@/lib/subscription";

type Profile = {
  subscription_status: string | null;
  stripe_customer_id: string | null;
};

type ExecutiveWaitlistRow = {
  id: string;
};

function statusLabel(status: string | null | undefined) {
  if (!status) return "No active subscription";
  return displayPlanName(status);
}

const currentTierFeatures = [
  "AI stock rankings and scoring",
  "Individual stock pages and trade plans",
  "Watchlist tools and market intelligence",
  "Billing and invoices managed by Stripe",
];

const executiveFeatures = [
  "Priority access to future premium tools",
  "Early access to higher-conviction intelligence features",
  "Designed for more active portfolio decision-making",
  "Waitlist stored securely on your StockGPT account",
];

export default async function SubscriptionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profileData }, { data: waitlistData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("subscription_status,stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle(),

    supabase
      .from("executive_waitlist")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const profile = profileData as Profile | null;
  const waitlistEntry = waitlistData as ExecutiveWaitlistRow | null;

  const plan = statusLabel(profile?.subscription_status);
  const activePlan = hasActiveSubscription(profile?.subscription_status);
  const canManageSubscription = Boolean(profile?.stripe_customer_id);
  const isExecutive =
    profile?.subscription_status?.toLowerCase() === "premium" ||
    profile?.subscription_status?.toLowerCase() === "executive";

  return (
    <AppShell activePath="/settings">
      <main className="relative h-full min-h-0 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div className="absolute -left-28 top-8 h-72 w-72 rounded-full bg-[#ddb159]/10 blur-3xl" />
          <div className="absolute right-0 top-16 h-80 w-80 rounded-full bg-emerald-400/8 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#faf6f0]/5 blur-3xl" />
          <div className="absolute right-16 top-10 hidden h-[420px] w-[420px] rounded-full border border-[#ddb159]/10 lg:block" />
          <div className="absolute right-24 top-24 hidden h-[280px] w-[280px] rounded-full border border-[#ddb159]/8 lg:block" />
        </div>

        <div className="relative flex h-full min-h-0 flex-col overflow-y-auto pb-[calc(96px+env(safe-area-inset-bottom))] pr-1 lg:overflow-hidden lg:pb-0">
          <header className="shrink-0">
            <Link
              href="/settings"
              className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]/75 transition hover:text-[#ddb159]"
            >
              ← Back to settings
            </Link>

            <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#ddb159]">
                  ✦ StockGPT Membership
                </p>

                <h1 className="mt-1 text-[30px] font-black leading-none tracking-[-0.05em] text-[#faf6f0] sm:text-[38px] lg:text-[40px]">
                  Subscription options
                </h1>

                <p className="mt-1.5 max-w-2xl text-[12px] font-medium leading-5 text-[#faf6f0]/55 sm:text-[13px]">
                  Review your current StockGPT tier, manage billing through
                  Stripe, or join the waitlist for the upcoming Executive tier.
                </p>
              </div>

              <div className="w-fit rounded-full border border-[#ddb159]/25 bg-[#061b12]/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159] shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
                Current plan · {plan}
              </div>
            </div>
          </header>

          <section className="mt-3 grid min-h-0 flex-1 gap-3 pb-4 lg:grid-cols-2 lg:items-stretch lg:pb-0 xl:gap-4">
            <article className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-[#ddb159]/24 bg-[#0b2b1d]/72 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:p-5 lg:p-4 xl:p-5">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#ddb159]/10 blur-3xl" />

              <div className="relative grid min-h-0 flex-1 grid-rows-[auto_auto_1fr_auto]">
                <div className="flex min-h-[60px] shrink-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ddb159] sm:text-[10px]">
                      Your current tier
                    </p>

                    <h2 className="mt-1.5 text-[28px] font-black tracking-[-0.045em] text-[#faf6f0] lg:text-[30px]">
                      {plan}
                    </h2>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider sm:text-[10px] ${
                      activePlan
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-[#faf6f0]/10 text-[#faf6f0]/45"
                    }`}
                  >
                    {activePlan ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="mt-3 min-h-[64px] text-[12px] font-medium leading-5 text-[#faf6f0]/58 sm:text-[13px] sm:leading-6 lg:line-clamp-3">
                  This is the plan currently linked to your StockGPT account.
                  Billing, payment method, renewal and cancellation are handled
                  securely through Stripe.
                </p>

                <div className="mt-4 grid content-start gap-1.5 sm:gap-2 lg:mt-3">
                  {currentTierFeatures.map((feature) => (
                    <div
                      key={feature}
                      className="flex min-h-[38px] items-center gap-2 rounded-2xl border border-[#ddb159]/12 bg-[#061b12]/55 px-3 py-1.5 sm:min-h-[42px] sm:py-2 lg:min-h-[38px] lg:py-1.5 xl:min-h-[42px] xl:py-2"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ddb159]/15 text-[11px] font-black text-[#ddb159]">
                        ✓
                      </span>
                      <span className="min-w-0 text-[12px] font-semibold leading-5 text-[#faf6f0]/68">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 lg:pt-3 xl:pt-4">
                  {canManageSubscription ? (
                    <form action="/api/create-billing-portal-session" method="post">
                      <button
                        type="submit"
                        className="mx-auto flex h-10 w-full max-w-[620px] items-center justify-center rounded-xl bg-[#ddb159] px-5 text-[11px] font-black uppercase tracking-[0.14em] text-[#061b12] transition hover:brightness-110 sm:h-11 sm:text-[11px] xl:h-11"
                      >
                        Manage current plan
                      </button>
                    </form>
                  ) : (
                    <Link
                      href="/pricing"
                      className="mx-auto flex h-10 w-full max-w-[620px] items-center justify-center rounded-xl bg-[#ddb159] px-5 text-[11px] font-black uppercase tracking-[0.14em] text-[#061b12] transition hover:brightness-110 sm:h-11 sm:text-[11px] xl:h-11"
                    >
                      View available plans
                    </Link>
                  )}

                  <p className="mt-1 text-center text-[9px] font-medium text-[#faf6f0]/34 sm:text-[10px]">
                    Opens Stripe only after this confirmation step.
                  </p>
                </div>
              </div>
            </article>

            <article className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-[#ddb159]/32 bg-[#0b2b1d]/72 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:p-5 lg:p-4 xl:p-5">
              <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#ddb159]/16 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />

              <div className="relative grid min-h-0 flex-1 grid-rows-[auto_auto_1fr_auto]">
                <div className="flex min-h-[60px] shrink-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ddb159] sm:text-[10px]">
                      Pending premium tier
                    </p>

                    <h2 className="mt-1.5 text-[28px] font-black tracking-[-0.045em] text-[#faf6f0] lg:text-[30px]">
                      Executive
                    </h2>
                  </div>

                  <span className="shrink-0 rounded-full border border-[#ddb159]/30 bg-[#ddb159]/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#ddb159] sm:text-[10px]">
                    Waitlist
                  </span>
                </div>

                <p className="mt-3 min-h-[64px] text-[12px] font-medium leading-5 text-[#faf6f0]/58 sm:text-[13px] sm:leading-6 lg:line-clamp-3">
                  Executive is the upcoming higher-tier StockGPT experience for
                  users who want earlier access to deeper intelligence, priority
                  features and a more premium research workflow.
                </p>

                <div className="mt-4 grid content-start gap-1.5 sm:gap-2 lg:mt-3">
                  {executiveFeatures.map((feature) => (
                    <div
                      key={feature}
                      className="flex min-h-[38px] items-center gap-2 rounded-2xl border border-[#ddb159]/12 bg-[#061b12]/55 px-3 py-1.5 sm:min-h-[42px] sm:py-2 lg:min-h-[38px] lg:py-1.5 xl:min-h-[42px] xl:py-2"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ddb159]/15 text-[11px] font-black text-[#ddb159]">
                        ✦
                      </span>
                      <span className="min-w-0 text-[12px] font-semibold leading-5 text-[#faf6f0]/68">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 lg:pt-3 xl:pt-4">
                  <ExecutiveWaitlistButton
                    initialJoined={Boolean(waitlistEntry) || isExecutive}
                    disabled={isExecutive}
                  />

                  <p className="mt-1 text-center text-[9px] font-medium text-[#faf6f0]/34 sm:text-[10px]">
                    {isExecutive
                      ? "Your account is already on the Executive tier."
                      : "Joining does not change your current billing plan."}
                  </p>
                </div>
              </div>
            </article>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
