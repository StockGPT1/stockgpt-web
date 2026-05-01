import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen bg-[#0F2A1F] p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-[#D4AF37]">
            Account
          </p>
          <h1 className="mt-2 text-4xl font-bold">Manage your account</h1>
          <p className="mt-3 text-white/70">
            Update your details, manage your subscription, and control your access.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 text-[#0F2A1F]">
            <h2 className="text-2xl font-bold">Personal details</h2>

            <form action="/api/update-profile" method="POST" className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-semibold">Full name</label>
                <input
                  name="full_name"
                  defaultValue={profile?.full_name || ""}
                  className="mt-1 w-full rounded-xl border p-3"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="text-sm font-semibold">Email</label>
                <input
                  value={user.email || ""}
                  disabled
                  className="mt-1 w-full rounded-xl border bg-slate-100 p-3 text-slate-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Email changes can be added later for security.
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold">Date of birth</label>
                <input
                  name="date_of_birth"
                  type="date"
                  defaultValue={profile?.date_of_birth || ""}
                  className="mt-1 w-full rounded-xl border p-3"
                />
              </div>

              <div>
                <label className="text-sm font-semibold">Phone number</label>
                <input
                  name="phone"
                  defaultValue={profile?.phone || ""}
                  className="mt-1 w-full rounded-xl border p-3"
                  placeholder="+44..."
                />
              </div>

              <button className="w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-bold">
                Save personal details
              </button>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-6 text-[#0F2A1F]">
            <h2 className="text-2xl font-bold">Subscription</h2>

            <div className="mt-6 space-y-3 rounded-xl bg-slate-50 p-4">
              <p>
                <strong>Current plan:</strong>{" "}
                {profile?.subscription_status === "basic" ? "Basic" : "No active plan"}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                {profile?.subscription_status || "none"}
              </p>
            </div>

            {profile?.stripe_customer_id ? (
              <form action="/api/create-billing-portal" method="POST">
                <button className="mt-6 w-full rounded-xl bg-[#0F2A1F] px-4 py-3 font-bold text-white">
                  Manage billing, payment method, invoices or cancel
                </button>
              </form>
            ) : (
              <a
                href="/pricing"
                className="mt-6 block w-full rounded-xl bg-[#D4AF37] px-4 py-3 text-center font-bold"
              >
                Subscribe
              </a>
            )}

            <div className="mt-8 border-t pt-6">
              <h3 className="text-lg font-bold">Security</h3>

              <a
                href="/forgot-password"
                className="mt-3 inline-block text-sm underline"
              >
                Change password
              </a>
            </div>

            <a
              href="/logout"
              className="mt-8 inline-block rounded-xl border border-[#0F2A1F] px-4 py-3 font-bold"
            >
              Log out
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}