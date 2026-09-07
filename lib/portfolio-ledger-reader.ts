import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const PAGE_SIZE = 500;
const MAX_PAGES = 200;

// Exact Portfolio, stable recorded-time ordering, no silent PostgREST row cap.
// Bound memory/work per Portfolio; fail explicitly rather than report partial totals.
export async function readPortfolioLedger(client: SupabaseClient<Database>, portfolioId: string) {
  const rows: Array<Database["public"]["Tables"]["portfolio_transactions"]["Row"]> = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await client.from("portfolio_transactions")
      .select("*").eq("portfolio_id", portfolioId)
      .order("created_at", { ascending: true }).order("id", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw new Error("Portfolio activity could not be loaded.");
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) return rows;
  }
  throw new Error("Portfolio activity exceeds the supported read size; totals have not been calculated from partial history.");
}
