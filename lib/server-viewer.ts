import "server-only";
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";

// React's cache lasts for one server render, never across users or requests.
export const getServerViewer = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
});

export const getViewerProfile = cache(async () => {
  const { supabase, user } = await getServerViewer();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("subscription_status").eq("id", user.id).maybeSingle();
  return data as { subscription_status: string | null } | null;
});
