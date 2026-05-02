import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/utils/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  return <AppShell activePath="/account"><main className="grid gap-4 xl:grid-cols-2"><section className="rounded-2xl border border-[#D4AF37]/20 bg-[#FFFDF5] p-6 text-[#0F2A1F]"><h2 className="text-2xl font-semibold">Personal Details</h2><form action="/api/update-profile" method="POST" className="mt-5 space-y-3">{[["full_name","Full name",profile?.full_name || ""],["date_of_birth","Date of birth",profile?.date_of_birth || ""],["phone","Phone number",profile?.phone || ""]].map(([name,label,val])=><div key={String(name)}><label className="text-sm font-semibold">{label}</label><input name={String(name)} type={name==="date_of_birth"?"date":"text"} defaultValue={String(val)} className="mt-1 w-full rounded-xl border border-slate-300 p-3"/></div>)}<div><label className="text-sm font-semibold">Email</label><input value={user.email || ""} disabled className="mt-1 w-full rounded-xl border bg-slate-100 p-3"/></div><button className="w-full rounded-xl bg-[#0F2A1F] px-4 py-3 font-semibold text-[#D4AF37]">Save personal details</button></form></section>
<section className="rounded-2xl border border-[#D4AF37]/20 bg-[#061d14] p-6"><h2 className="text-2xl font-semibold">Subscription</h2><p className="mt-3 text-[#F8F3E7]/80">Current plan: <span className="text-[#D4AF37]">{profile?.subscription_status === "basic" ? "Basic" : "No active plan"}</span></p>{profile?.stripe_customer_id ? <form action="/api/create-billing-portal" method="POST"><button className="mt-4 w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-semibold text-[#0F2A1F]">Manage billing portal</button></form> : <a href="/pricing" className="mt-4 block rounded-xl bg-[#D4AF37] px-4 py-3 text-center font-semibold text-[#0F2A1F]">Subscribe now</a>}<div className="mt-6 space-y-2"><a href="/forgot-password" className="block underline">Change password</a><a href="/logout" className="block underline">Log out</a></div></section></main></AppShell>;
}
