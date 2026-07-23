import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ModuleState } from "@/components/ModuleState";
import { NotificationsList } from "@/components/NotificationsList";
import { getUserNotifications } from "@/lib/notifications";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Alerts | StockGPT Portfolio Notifications",
  description: "Review StockGPT alerts for portfolio changes, ranking moves, score shifts and market research updates.",
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .maybeSingle();
  const canUseAlerts = hasActiveSubscription(profile?.subscription_status);

  return (
    <AppShell activePath="/notifications" askLabel="Ask about my portfolio" askContext={{ contextType: "dashboard" }}>
      <main className="h-full min-h-0 overflow-y-auto pr-1">
        {canUseAlerts ? (
          <NotificationsContent />
        ) : (
          <div className="grid gap-4">
            <header className="rounded-[24px] border border-[#ddb159]/24 bg-[linear-gradient(135deg,#082519,#0d3420)] p-5">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#ddb159]">Alert inbox</p>
              <h1 className="mt-1 text-[26px] font-black tracking-[-0.04em] text-[#faf6f0]">Portfolio alerts</h1>
            </header>
            <ModuleState
              eyebrow="Subscriber intelligence"
              title="Unlock your organised alert inbox"
              description="Review holding conditions, portfolio changes, rank moves and relevant news in one calm inbox. No personalised alert data is shown in this locked preview."
              tone="locked"
              action={<Link href="/subscription" className="inline-flex min-h-10 items-center rounded-full bg-[#ddb159] px-4 text-[11px] font-black text-[#07170f]">View plans</Link>}
            />
          </div>
        )}
      </main>
    </AppShell>
  );
}

async function NotificationsContent() {
  const result = await getUserNotifications({ includeDismissed: true });
  return <NotificationsList unread={result.unread} read={result.read} status={result.status === "ok" ? "ok" : "error"} />;
}
