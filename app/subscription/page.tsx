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
          <div className="absolute -left-28 top-8 h-80 w-80 rounded-full bg-[#ddb159]/10 blur-3xl" />
          <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-emerald-400/8 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#faf6f0]/5 blur-3xl" />
        </div>

        <div className="relative flex h-full min-h-0 flex-col overflow-y-auto pr-1 lg:overflow-hidden">
          <div className="shrink-0">
            <Link
              href="/settings"
              className="text-[11px] font-black uppercase tracking-[0.16em] text-[#ddb159]/75 transition hover:text-[#ddb159]"
            >
              ← Back to settings
            </Link>

            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ddb159]">
                  ✦ StockGPT Membership
                </p>

                <h1 className="mt-1 text-[32px] font-black leading-none tracking-[-0.05em] text-[#faf6f0] sm:text-[42px]">
                  Subscription options
                </h1>

                <p className="mt-2 max-w-2xl text-[13px] font-medium leading-6 text-[#faf6f0]/55">
                  Review your current StockGPT tier, manage billing through
                  Stripe, or join the waitlist for the upcoming Executive tier.
                </p>
              </div>

              <div className="w-fit rounded-full border border-[#ddb159]/25 bg-[#061b12]/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#ddb159] shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
                Current plan · {plan}
              </div>
            </div>
          </div>

          <section className="mt-4 grid min-h-0 flex-1 gap-4 pb-6 lg:grid-cols-2 lg:pb-0">
            <article className="relative flex min-h-0 flex-col overflow-hidden rounded-3xl border border-[#ddb159]/24 bg-[#0b2b1d]/72 p-5 shadow-[0_22px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#ddb159]/10 blur-3xl" />

              <div className="relative flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
                      Your current tier
                    </p>

                    <h2 className="mt-2 text-[30px] font-black tracking-[-0.045em] text-[#faf6f0]">
                      {plan}
                    </h2>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                      activePlan
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-[#faf6f0]/10 text-[#faf6f0]/45"
                    }`}
                  >
                    {activePlan ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="mt-3 text-[13px] font-medium leading-6 text-[#faf6f0]/58">
                  This is the plan currently linked to your StockGPT account.
                  Billing, payment method, renewal and cancellation are handled
                  securely through Stripe.
                </p>

                <div className="mt-5 grid gap-2">
                  {[
                    "AI stock rankings and scoring",
                    "Individual stock pages and trade plans",
                    "Watchlist tools and market intelligence",
                    "Billing and invoices managed by Stripe",
                  ].map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-2 rounded-2xl border border-[#ddb159]/12 bg-[#061b12]/55 px-3 py-2"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ddb159]/15 text-[11px] font-black text-[#ddb159]">
                        ✓
                      </span>
                      <span className="text-[12px] font-semibold text-[#faf6f0]/68">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-5">
                  {canManageSubscription ? (
                    <form action="/api/create-billing-portal-session" method="post">
                      <button
                        type="submit"
                        className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#ddb159] px-5 text-[12px] font-black uppercase tracking-[0.14em] text-[#061b12] transition hover:brightness-110"
                      >
                        Manage current plan
                      </button>
                    </form>
                  ) : (
                    <Link
                      href="/pricing"
                      className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#ddb159] px-5 text-[12px] font-black uppercase tracking-[0.14em] text-[#061b12] transition hover:brightness-110"
                    >
                      View available plans
                    </Link>
                  )}

                  <p className="mt-2 text-center text-[10px] font-medium text-[#faf6f0]/34">
                    Opens Stripe only after this confirmation step.
                  </p>
                </div>
              </div>
            </article>

            <article className="relative flex min-h-0 flex-col overflow-hidden rounded-3xl border border-[#ddb159]/32 bg-[#0b2b1d]/72 p-5 shadow-[0_22px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl">
              <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#ddb159]/16 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />

              <div className="relative flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
                      Pending premium tier
                    </p>

                    <h2 className="mt-2 text-[30px] font-black tracking-[-0.045em] text-[#faf6f0]">
                      Executive
                    </h2>
                  </div>

                  <span className="rounded-full border border-[#ddb159]/30 bg-[#ddb159]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#ddb159]">
                    Waitlist
                  </span>
                </div>

                <p className="mt-3 text-[13px] font-medium leading-6 text-[#faf6f0]/58">
                  Executive is the upcoming higher-tier StockGPT experience for
                  users who want earlier access to deeper intelligence,
                  priority features and a more premium research workflow.
                </p>

                <div className="mt-5 grid gap-2">
                  {[
                    "Priority access to future premium tools",
                    "Early access to higher-conviction intelligence features",
                    "Designed for more active portfolio decision-making",
                    "Waitlist stored securely on your StockGPT account",
                  ].map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-2 rounded-2xl border border-[#ddb159]/12 bg-[#061b12]/55 px-3 py-2"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ddb159]/15 text-[11px] font-black text-[#ddb159]">
                        ✦
                      </span>
                      <span className="text-[12px] font-semibold text-[#faf6f0]/68">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-5">
                  <ExecutiveWaitlistButton
                    initialJoined={Boolean(waitlistEntry) || isExecutive}
                    disabled={isExecutive}
                  />

                  <p className="mt-2 text-center text-[10px] font-medium text-[#faf6f0]/34">
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
