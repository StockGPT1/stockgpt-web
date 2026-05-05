import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { NotificationsList } from "@/components/NotificationsList";
import { createClient } from "@/utils/supabase/server";
import { getUserNotifications } from "@/lib/notifications";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { unread, read } = await getUserNotifications({
    includeDismissed: true,
  });

  return (
    <AppShell activePath="/notifications">
      <main className="h-full min-h-0 overflow-y-auto pr-1">
        <NotificationsList unread={unread} read={read} />
      </main>
    </AppShell>
  );
}
