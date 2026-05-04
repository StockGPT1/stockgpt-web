"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type WatchlistResult = {
  success: boolean;
  inWatchlist?: boolean;
  error?: string;
};

export async function toggleWatchlist(ticker: string): Promise<WatchlistResult> {
  if (!ticker) return { success: false, error: "Missing ticker" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  // Is it already in the watchlist?
  const { data: existing } = await supabase
    .from("watchlist")
    .select("id")
    .eq("user_id", user.id)
    .eq("ticker", ticker)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("watchlist")
      .delete()
      .eq("id", existing.id);
    if (error) return { success: false, error: error.message };

    revalidatePath("/watchlist");
    revalidatePath(`/stock/${ticker}`);
    return { success: true, inWatchlist: false };
  } else {
    const { error } = await supabase
      .from("watchlist")
      .insert({ user_id: user.id, ticker });
    if (error) return { success: false, error: error.message };

    revalidatePath("/watchlist");
    revalidatePath(`/stock/${ticker}`);
    return { success: true, inWatchlist: true };
  }
}

export async function removeFromWatchlist(
  ticker: string
): Promise<WatchlistResult> {
  if (!ticker) return { success: false, error: "Missing ticker" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("ticker", ticker);

  if (error) return { success: false, error: error.message };

  revalidatePath("/watchlist");
  revalidatePath(`/stock/${ticker}`);
  return { success: true, inWatchlist: false };
}
