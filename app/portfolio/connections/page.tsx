import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { brokerConnectionsEnabled } from "@/lib/brokerage/capability";

export default async function BrokerConnectionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [connections, accounts, portfolios, jobs] = await Promise.all([
    supabase.from("broker_connections").select("id,institution_id,status,last_attempted_sync_at,last_successful_sync_at,brokerage_institutions(name)").order("created_at"),
    supabase.from("broker_accounts").select("id,connection_id,name,account_type,base_currency,status,last_successful_sync_at,brokerage_institutions(name)").order("created_at"),
    supabase.from("user_portfolios").select("id,broker_account_id").eq("management_source", "connected"),
    supabase.from("broker_sync_jobs").select("connection_id,status,error_code").order("created_at", { ascending: false }),
  ]);
  const portfolioByAccount = new Map((portfolios.data ?? []).map((row) => [row.broker_account_id, row.id]));
  const latestJob = new Map<string, { status: string; error_code: string | null }>();
  for (const job of jobs.data ?? []) if (!latestJob.has(job.connection_id)) latestJob.set(job.connection_id, job);

  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-10 text-white">
    <div className="mb-8 flex items-center justify-between gap-4">
      <div><p className="text-xs uppercase tracking-[0.18em] text-white/50">Read-only connections</p><h1 className="mt-2 text-3xl font-semibold">Connected accounts</h1></div>
      <Link href="/portfolio/modern" className="text-sm text-white/70 hover:text-white">Back to Portfolio</Link>
    </div>
    {!brokerConnectionsEnabled() ? <section className="rounded-2xl border border-white/10 bg-white/5 p-6"><h2 className="font-semibold">Connections are not available yet</h2><p className="mt-2 text-sm text-white/60">This rollout is currently disabled. No provider request was made.</p></section> : <>
      <form action="/api/broker/connections/start" method="post" className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-semibold">Connect an investment account</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/60">Open the provider portal with read-only access. StockGPT cannot place trades.</p>
        <button className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">Connect account</button>
      </form>
      <div className="space-y-4">
        {(connections.data ?? []).map((connection) => {
          const job = latestJob.get(connection.id);
          const state = connection.status === "active" ? "Connected" : connection.status === "disconnected" ? "Disconnected" : job?.status === "running" ? "Syncing" : job?.status === "terminal_failure" || job?.status === "retryable_failure" ? "Stale / error" : "Awaiting discovery";
          return <section key={connection.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-medium">{connection.brokerage_institutions.name}</h2><p className="text-sm text-white/55">{state}</p></div>{connection.status === "disconnected" && <form action="/api/broker/connections/start" method="post"><input type="hidden" name="connectionId" value={connection.id}/><button className="rounded-full border border-white/20 px-4 py-2 text-sm">Reconnect</button></form>}</div>
            <div className="mt-4 space-y-3">{(accounts.data ?? []).filter((account) => account.connection_id === connection.id).map((account) => {
              const portfolioId = portfolioByAccount.get(account.id);
              return <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/20 p-4"><div><p className="font-medium">{account.name}</p><p className="text-xs text-white/50">{account.account_type ?? "Investment account"} · {account.base_currency ?? "Currency unavailable"} · {account.last_successful_sync_at ? "Synced" : "Sync pending"}</p></div>{portfolioId ? <Link className="text-sm text-white/75" href={`/portfolio/modern?portfolio=${portfolioId}`}>View Portfolio</Link> : account.last_successful_sync_at ? <form action="/api/broker/portfolios" method="post"><input type="hidden" name="accountId" value={account.id}/><button className="rounded-full border border-white/20 px-4 py-2 text-sm">Add to StockGPT</button></form> : <span className="text-xs text-white/45">Waiting for initial sync</span>}</div>;
            })}</div>
          </section>;
        })}
        {(connections.data ?? []).length === 0 && <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-white/55">No provider connection has been discovered yet.</p>}
      </div>
    </>}
  </main>;
}
