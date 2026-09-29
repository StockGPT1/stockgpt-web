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
    const { error } = await supabase.from("user_notification_summaries").upsert(
      {
        user_id: userId,
        unread_count: normalised,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
  } catch (err) {
    console.warn("Could not persist notification summary", err);
  }
}

export type FastNotificationSummary =
  | { status: "ok"; count: number }
  | { status: "unavailable"; count: null }
  | { status: "unauthenticated"; count: 0 };

export async function getUnreadNotificationCountFast(): Promise<FastNotificationSummary> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { status: "unauthenticated", count: 0 };

    const redisCount = await getJsonCache<number>(notificationCountKey(user.id));
    if (typeof redisCount === "number") return { status: "ok", count: normaliseCount(redisCount) };

    const { data, error } = await supabase
      .from("user_notification_summaries")
      .select("unread_count,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) return { status: "unavailable", count: null };

    const row = data as NotificationSummaryRow;
    if (!isFresh(row.updated_at)) return { status: "unavailable", count: null };

    const count = normaliseCount(row.unread_count);
    await setJsonCache(
      notificationCountKey(user.id),
      count,
      NOTIFICATION_SUMMARY_TTL_SECONDS,
    );
    return { status: "ok", count };
  } catch {
    return { status: "unavailable", count: null };
  }
}
