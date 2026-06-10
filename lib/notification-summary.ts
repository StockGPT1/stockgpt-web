import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

const NOTIFICATION_SUMMARY_TTL_MS = Number(
  process.env.NOTIFICATION_SUMMARY_TTL_MS ?? 15 * 60 * 1000,
);

type NotificationSummaryRow = {
  unread_count: number | string | null;
  updated_at: string | null;
};

function isFresh(updatedAt: string | null) {
  if (!updatedAt) return false;
  const time = new Date(updatedAt).getTime();
  return Number.isFinite(time) && Date.now() - time < NOTIFICATION_SUMMARY_TTL_MS;
}

export async function saveUnreadNotificationSummary(userId: string, unreadCount: number) {
  try {
    const supabase = createAdminClient();
    await supabase.from("user_notification_summaries").upsert(
      {
        user_id: userId,
        unread_count: Math.max(0, Math.round(unreadCount)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  } catch (err) {
    console.warn("Could not persist notification summary", err);
  }
}

export async function getUnreadNotificationCountFast(): Promise<number> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return 0;

    const { data, error } = await supabase
      .from("user_notification_summaries")
      .select("unread_count,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) return 0;

    const row = data as NotificationSummaryRow;
    if (!isFresh(row.updated_at)) return 0;

    const count = Number(row.unread_count);
    return Number.isFinite(count) && count > 0 ? Math.round(count) : 0;
  } catch {
    return 0;
  }
}
