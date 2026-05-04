import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/utils/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Watchlist count for the stats summary
  const { count: watchlistCount } = await supabase
    .from("watchlist")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <AppShell activePath="/settings">
      <main className="h-full min-h-0 overflow-y-auto pr-1">
        <h1 className="text-[28px] font-black tracking-[-0.03em] text-[#faf6f0]">
          Settings
        </h1>
        <p className="mt-1 text-[13px] font-medium text-[#faf6f0]/50">
          Manage your account, preferences, and security.
        </p>

        <div className="mt-6 grid max-w-2xl gap-4">
          {/* ── Account ── */}
          <section className="rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <h2 className="text-[15px] font-black tracking-[-0.02em]">
              Account
            </h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">
              Your account details
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#072116]/10 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/45">
                  Email
                </p>
                <p className="mt-0.5 truncate text-[13px] font-bold">
                  {user.email ?? "—"}
                </p>
              </div>
              <div className="rounded-xl border border-[#072116]/10 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/45">
                  Member since
                </p>
                <p className="mt-0.5 text-[13px] font-bold">
                  {user.created_at
                    ? new Date(user.created_at).toLocaleDateString([], {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-[#072116]/10 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/45">
                  Plan
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="text-[13px] font-bold">Basic</p>
                  <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                    Active
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-[#072116]/10 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/45">
                  Watchlist
                </p>
                <p className="mt-0.5 text-[13px] font-bold">
                  {watchlistCount ?? 0} stock
                  {(watchlistCount ?? 0) !== 1 ? "s" : ""} tracked
                </p>
              </div>
            </div>
          </section>

          {/* ── Preferences ── */}
          <section className="rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <h2 className="text-[15px] font-black tracking-[-0.02em]">
              Preferences
            </h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">
              Customise your experience
            </p>
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#072116]/10 px-4 py-3 transition hover:border-[#ddb159]/40">
                <div>
                  <p className="text-[13px] font-bold">Email news digests</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/50">
                    Receive a daily summary of top-ranked stocks and market
                    news.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[#ddb159]"
                  defaultChecked
                />
              </label>
            </div>
          </section>

          {/* ── Security ── */}
          <section className="rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <h2 className="text-[15px] font-black tracking-[-0.02em]">
              Security
            </h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">
              Keep your account secure
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-[#072116]/10 px-4 py-3">
                <div>
                  <p className="text-[13px] font-bold">Password</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/50">
                    Change your account password
                  </p>
                </div>
                {/* ✦ Fixed button — gold filled with dark text, no transparency tricks */}
                <Link
                  href="/forgot-password"
                  style={{
                    backgroundColor: "#ddb159",
                    color: "#072116",
                  }}
                  className="shrink-0 rounded-full px-4 py-2 text-[12px] font-black transition hover:opacity-90"
                >
                  Change password
                </Link>
              </div>

              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center justify-between rounded-xl border border-[#072116]/10 px-4 py-3 text-left transition hover:border-[#ddb159]/40"
                >
                  <div>
                    <p className="text-[13px] font-bold">Sign out</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/50">
                      End your current session
                    </p>
                  </div>
                  <span className="text-[12px] font-black text-[#072116]/40">
                    →
                  </span>
                </button>
              </form>
            </div>
          </section>

          {/* ── Danger Zone ── */}
          <section className="rounded-2xl border-2 border-red-200 bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <h2 className="text-[15px] font-black tracking-[-0.02em] text-red-600">
              Danger Zone
            </h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">
              Irreversible actions
            </p>
            <div className="mt-4">
              <div className="flex items-center justify-between rounded-xl border border-red-200 px-4 py-3">
                <div>
                  <p className="text-[13px] font-bold">Delete account</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/50">
                    Permanently remove your account and all associated data.
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-red-400 px-3 py-1.5 text-[11px] font-bold text-red-600 transition hover:bg-red-50"
                  disabled
                >
                  Delete
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
