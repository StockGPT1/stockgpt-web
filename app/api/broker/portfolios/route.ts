import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { brokerConnectionsEnabled } from "@/lib/brokerage/capability";

export async function POST(request: Request) {
  if (!brokerConnectionsEnabled()) return NextResponse.json({ error: "Broker connections are unavailable." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const form = await request.formData();
  const accountId = form.get("accountId");
  if (typeof accountId !== "string" || !accountId) {
    return NextResponse.json({ error: "Account is required." }, { status: 400 });
  }
  const created = await supabase.rpc("create_connected_portfolio", { p_account_id: accountId });
  if (created.error || !created.data?.[0]?.portfolio_id) {
    return NextResponse.json({ error: "Unable to add this account yet." }, { status: 400 });
  }
  return NextResponse.redirect(new URL(`/portfolio/modern?portfolio=${created.data[0].portfolio_id}`, request.url), 303);
}
