import { deleteCacheKey, getJsonCache, setJsonCache } from "@/lib/redis-cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

const NOTIFICATION_SUMMARY_TTL_MS = Number(
  process.env.NOTIFICATION_SUMMARY_TTL_MS ?? 15 * 60 * 1000,
);
const NOTIFICATION_SUMMARY_TTL_SECONDS = Math.max(
  60,
  Math.round(NOTIFICATION_SUMMARY_TTL_MS / 1000),
);

type NotificationSummaryRow = {
  unread_count: number | string | null;
  updated_at: string | null;
};

function notificationCountKey(userId: string) {
  return `notification:count:${userId}`;
}

function isFresh(updatedAt: string | null) {
  if (!updatedAt) return false;
  const time = new Date(updatedAt).getTime();
  return Number.isFinite(time) && Date.now() - time < NOTIFICATION_SUMMARY_TTL_MS;
}

function normaliseCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.round(count) : 0;
}

export async function clearUnreadNotificationSummary(userId: string) {
  await deleteCacheKey(notificationCountKey(userId));
}

export async function saveUnreadNotificationSummary(userId: string, unreadCount: number) {
  const normalised = Math.max(0, Math.round(unreadCount));

  await setJsonCache(
    notificationCountKey(userId),
    normalised,
    NOTIFICATION_SUMMARY_TTL_SECONDS,
  );

  try {
    const supabase = createAdminClient();
    await supabase.from("user_notification_summaries").upsert(
      {
        user_id: userId,
        unread_count: normalised,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  } catch (err) {
    console.warn("Could not persist notification summary", err);
  }
}

export async function getUnreadNotificationCountForUser(userId: string): Promise<number> {
  try {
    const redisCount = await getJsonCache<number>(notificationCountKey(userId));
    if (typeof redisCount === "number") return normaliseCount(redisCount);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_notification_summaries")
      .select("unread_count,updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return 0;

    const row = data as NotificationSummaryRow;
    if (!isFresh(row.updated_at)) return 0;

    const count = normaliseCount(row.unread_count);
    await setJsonCache(
      notificationCountKey(userId),
      count,
      NOTIFICATION_SUMMARY_TTL_SECONDS,
    );
    return count;
  } catch {
    return 0;
  }
}

export async function getUnreadNotificationCountFast(): Promise<number> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return 0;
    return getUnreadNotificationCountForUser(user.id);
  } catch {
    return 0;
  }
}
