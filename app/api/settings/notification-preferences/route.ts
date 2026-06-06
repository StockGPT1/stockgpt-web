import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function booleanOrDefault(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be signed in to update notification settings." },
        { status: 401 },
      );
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({
        email_news_digests: booleanOrDefault(body?.digest, false),
        email_portfolio_alerts: booleanOrDefault(body?.portfolioAlerts, true),
        email_watchlist_alerts: booleanOrDefault(body?.watchlistAlerts, true),
        email: user.email ?? null,
      })
      .eq("id", user.id);

    if (error) {
      console.error("[notification-preferences setting]", error);
      return NextResponse.json(
        { error: "Could not update notification settings." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[notification-preferences setting]", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
