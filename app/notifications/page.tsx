import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { NotificationsList } from "@/components/NotificationsList";
import { createClient } from "@/utils/supabase/server";
import { getUserNotifications } from "@/lib/notifications";


export const metadata: Metadata = {
  title: "Alerts | StockGPT Portfolio Notifications",
  description:
    "Review StockGPT alerts for portfolio changes, ranking moves, score shifts and market research updates.",
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { unread, read } = await getUserNotifications({
    includeDismissed: true,
    userId: user.id,
  });

  return (
    <AppShell activePath="/notifications" user={user}>
      <main className="h-full min-h-0 overflow-y-auto pr-1">
        <NotificationsList unread={unread} read={read} />
      </main>
    </AppShell>
  );
}
