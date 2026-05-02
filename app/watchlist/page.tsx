"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { AppShell } from "@/components/AppShell";
import { PaywallCard } from "@/components/PaywallCard";
import { createClient } from "@/utils/supabase/client";

type WatchRow = { ticker: string; created_at: string };
type StockRow = { ticker: string; company: string | null; rank: number | null; score: number | null; price: number | null };
type WatchlistItem = WatchRow & { stock?: StockRow };
type ViewState = { loading: boolean; hasAccess: boolean; rows: WatchlistItem[]; user: User | null };

export default function WatchlistPage() {
  const [state, setState] = useState<ViewState>({ loading: true, hasAccess: false, rows: [], user: null });

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setState({ loading: false, user: null, hasAccess: false, rows: [] });

      const { data: profile } = await supabase.from("profiles").select("subscription_status").eq("id", user.id).single();
      const hasAccess = profile?.subscription_status === "basic";

      const { data: watch } = await supabase.from("user_watchlist").select("ticker,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
      const rows = (watch ?? []) as WatchRow[];
      const tickers = rows.map((w) => w.ticker);

      const stockResponse = tickers.length
        ? await supabase.from("stock_rankings").select("ticker,company,rank,score,price").in("ticker", tickers)
        : { data: [] as StockRow[] };

      const map = new Map((stockResponse.data ?? []).map((s) => [s.ticker, s as StockRow]));
      setState({ loading: false, user, hasAccess, rows: rows.map((w) => ({ ...w, stock: map.get(w.ticker) })) });
    })();
  }, []);

  async function removeTicker(ticker: string) {
    if (!state.user) return;
    await createClient().from("user_watchlist").delete().eq("user_id", state.user.id).eq("ticker", ticker);
    setState((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.ticker !== ticker) }));
  }

  return (
    <AppShell activePath="/watchlist">
      <main className="rounded-2xl bg-[#FFFDF5] p-6 text-[#0F2A1F]">
        {state.loading ? (
          "Loading..."
        ) : !state.user ? (
          <p>
            Please <Link href="/login" className="underline">log in</Link> to manage watchlist.
          </p>
        ) : !state.hasAccess ? (
          <PaywallCard />
        ) : (
          <div>
            <h2 className="text-2xl font-semibold">My Watchlist</h2>
            <div className="mt-4 space-y-3">
              {state.rows.map((r) => (
                <div key={r.ticker} className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <p className="font-semibold">{r.ticker}{r.stock?.company ? ` · ${r.stock.company}` : ""}</p>
                    <p className="text-sm text-slate-500">Rank #{r.stock?.rank ?? "—"} · Score {r.stock?.score ?? "—"} · ${Number(r.stock?.price ?? 0).toFixed(2)}</p>
                  </div>
                  <button onClick={() => removeTicker(r.ticker)} className="rounded-lg border px-3 py-1">Remove</button>
                </div>
              ))}
              {!state.rows.length && <p className="text-slate-500">No stocks saved yet.</p>}
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
