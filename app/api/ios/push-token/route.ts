import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    token?: unknown;
    platform?: unknown;
    environment?: unknown;
  } | null;

  const token = typeof payload?.token === "string" ? payload.token.trim().toLowerCase() : "";
  if (!/^[a-f0-9]{32,256}$/.test(token)) {
    return NextResponse.json({ error: "Invalid device token" }, { status: 400 });
  }

  const environment = payload?.environment === "production" ? "production" : "sandbox";
  const now = new Date().toISOString();
  const { error } = await supabase.from("ios_push_devices").upsert(
    {
      user_id: user.id,
      token,
      platform: "ios",
      environment,
      enabled: true,
      updated_at: now,
      last_seen_at: now,
    },
    { onConflict: "token" },
  );

  if (error) {
    console.error("[ios] device token registration failed", error);
    return NextResponse.json({ error: "Could not register this device" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
