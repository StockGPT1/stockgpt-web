import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function SettingsPage() {
  return <AppShell activePath="/settings"><main className="space-y-4"><section className="rounded-2xl bg-[#FFFDF5] p-6 text-[#0F2A1F]"><h2 className="text-2xl font-semibold">Preferences</h2><label className="mt-4 flex items-center gap-2"><input type="checkbox" defaultChecked /> Email news digests</label></section><section className="rounded-2xl bg-[#FFFDF5] p-6 text-[#0F2A1F]"><h3 className="text-xl font-semibold">Security</h3><Link href="/forgot-password" className="mt-2 inline-block underline">Change password</Link></section><section className="rounded-2xl border border-red-300 bg-[#FFFDF5] p-6 text-[#0F2A1F]"><h3 className="text-xl font-semibold text-red-700">Delete account</h3><p className="mt-2 text-sm text-slate-600">Safe implementation should use a secure server route with service role key, plus recent-auth verification before deletion.</p></section></main></AppShell>;
}
