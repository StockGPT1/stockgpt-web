"use server";

import { revalidatePath } from "next/cache";
import { clearUnreadNotificationSummary } from "@/lib/notification-summary";
import { createClient } from "@/utils/supabase/server";

export async function dismissNotification(
  alertKey: string
): Promise<{ success: boolean; error?: string }> {
  if (!alertKey) return { success: false, error: "Missing key" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("notification_dismissals")
    .upsert(
      { user_id: user.id, alert_key: alertKey },
      { onConflict: "user_id,alert_key" }
    );

  if (error) return { success: false, error: error.message };

  await clearUnreadNotificationSummary(user.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout"); // refresh sidebar badge
  return { success: true };
}

export async function dismissAllNotifications(
  alertKeys: string[]
): Promise<{ success: boolean; error?: string }> {
  if (alertKeys.length === 0) return { success: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "not_authenticated" };

  const rows = alertKeys.map((key) => ({
    user_id: user.id,
    alert_key: key,
  }));

  const { error } = await supabase
    .from("notification_dismissals")
    .upsert(rows, { onConflict: "user_id,alert_key" });

  if (error) return { success: false, error: error.message };

  await clearUnreadNotificationSummary(user.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function restoreNotification(
  alertKey: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("notification_dismissals")
    .delete()
    .eq("user_id", user.id)
    .eq("alert_key", alertKey);

  if (error) return { success: false, error: error.message };

  await clearUnreadNotificationSummary(user.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { success: true };
}
