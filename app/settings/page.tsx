import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell activePath="/settings">
      <main className="h-full min-h-0 overflow-y-auto pr-1">
        <h1 className="text-[28px] font-black tracking-[-0.03em] text-[#faf6f0]">
          Settings
        </h1>
        <p className="mt-1 text-[13px] font-medium text-[#faf6f0]/50">
          Manage your preferences and account security.
        </p>

        <div className="mt-6 grid max-w-2xl gap-4">
          {/* ── Account info ── */}
          <section className="rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <h2 className="text-[15px] font-black tracking-[-0.02em]">
              Account
            </h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">
              Your account details
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-[#072116]/10 px-4 py-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/45">
                    Email
                  </p>
                  <p className="mt-0.5 text-[14px] font-bold">
                    {user.email ?? "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#072116]/10 px-4 py-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/45">
                    Member since
                  </p>
                  <p className="mt-0.5 text-[14px] font-bold">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString([], {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
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
                    Receive a daily summary of top-ranked stocks and market news.
                  </p>
                </div>
                {/* Simple toggle — enhance with a client component if needed */}
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
                <Link
                  href="/forgot-password"
                  className="rounded-full border border-[#ddb159] bg-[#072116] px-3 py-1.5 text-[11px] font-bold text-[#ddb159] transition hover:bg-[#0b2b1d]"
                >
                  Change password
                </Link>
              </div>
            </div>
          </section>

          {/* ── Danger zone ── */}
          <section className="rounded-2xl border border-red-200 bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
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
                    This action cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-red-400 px-3 py-1.5 text-[11px] font-bold text-red-600 transition hover:bg-red-50"
                  disabled
                >
                  Delete account
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
