import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { brokerConnectionsEnabled } from "@/lib/brokerage/capability";
import { discoverSnapTradeConnections } from "@/lib/brokerage/connection-service";

export async function GET(request: Request) {
  const target = new URL("/portfolio/connections", request.url);
  if (!brokerConnectionsEnabled()) {
    target.searchParams.set("state", "unavailable");
    return NextResponse.redirect(target);
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const admin = createAdminClient();
  const provider = await admin.from("broker_providers").select("id").eq("provider_key", "snaptrade").single();
  if (provider.error) {
    target.searchParams.set("state", "error");
    return NextResponse.redirect(target);
  }
  try {
    // Provider state is discovered from the authenticated server credential.
    // Callback query parameters are intentionally ignored.
    await discoverSnapTradeConnections(admin, { userId: user.id, providerId: provider.data.id });
    target.searchParams.set("state", "syncing");
  } catch {
    target.searchParams.set("state", "error");
  }
  return NextResponse.redirect(target);
}
