import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { hasActiveSubscription } from "@/lib/subscription";
import { brokerConnectionsEnabled, brokerReturnUrl } from "@/lib/brokerage/capability";
import { ensureSnapTradeRegistration } from "@/lib/brokerage/connection-service";
import { createReadOnlySnapTradePortalLink } from "@/lib/brokerage/providers/snaptrade/service";

export async function POST(request: Request) {
  if (!brokerConnectionsEnabled()) return NextResponse.json({ error: "Broker connections are unavailable." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const profile = await supabase.from("profiles").select("subscription_status").eq("id", user.id).maybeSingle();
  if (!hasActiveSubscription(profile.data?.subscription_status)) {
    return NextResponse.json({ error: "An active subscription is required." }, { status: 403 });
  }

  const admin = createAdminClient();
  const provider = await admin.from("broker_providers").select("id").eq("provider_key", "snaptrade").single();
  if (provider.error) return NextResponse.json({ error: "Broker connections are unavailable." }, { status: 503 });
  try {
    await ensureSnapTradeRegistration(admin, { userId: user.id, providerId: provider.data.id });
    const form = await request.formData();
    const reconnectId = typeof form.get("connectionId") === "string" ? String(form.get("connectionId")) : null;
    let reconnect: string | undefined;
    if (reconnectId) {
      const owned = await admin.from("broker_connections")
        .select("external_connection_id")
        .eq("id", reconnectId).eq("user_id", user.id).eq("provider_id", provider.data.id).maybeSingle();
      if (!owned.data) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
      reconnect = owned.data.external_connection_id;
    }
    const redirect = await createReadOnlySnapTradePortalLink(admin, {
      userId: user.id,
      providerId: provider.data.id,
      customRedirect: brokerReturnUrl(),
      reconnect,
    });
    return NextResponse.redirect(redirect, 303);
  } catch {
    return NextResponse.json({ error: "Unable to open the connection portal." }, { status: 503 });
  }
}
