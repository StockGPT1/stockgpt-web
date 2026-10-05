import { NextResponse } from "next/server";
import { sendAPNSNotification, type APNSEnvironment } from "@/lib/apns";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type DeviceRow = {
  token: string;
  environment: string | null;
};

function normaliseEnvironment(value: string | null | undefined): APNSEnvironment {
  return value === "production" ? "production" : "sandbox";
}

function alternateEnvironment(environment: APNSEnvironment): APNSEnvironment {
  return environment === "sandbox" ? "production" : "sandbox";
}

function hasAPNSCredentials() {
  return Boolean(
    process.env.APNS_TEAM_ID?.trim() &&
      process.env.APNS_KEY_ID?.trim() &&
      process.env.APNS_PRIVATE_KEY?.trim(),
  );
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in before testing notifications." }, { status: 401 });
  }

  if (!hasAPNSCredentials()) {
    return NextResponse.json(
      { ok: false, error: "APNs provider credentials are not configured on the server." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("ios_push_devices")
    .select("token,environment")
    .eq("user_id", user.id)
    .eq("enabled", true)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[ios-push-test] device lookup failed", error);
    return NextResponse.json({ ok: false, error: "Could not read this iPhone registration." }, { status: 500 });
  }

  const device = data as DeviceRow | null;
  if (!device?.token) {
    return NextResponse.json(
      { ok: false, error: "No enabled iPhone push token is registered for this account." },
      { status: 404 },
    );
  }

  const send = (environment: APNSEnvironment) =>
    sendAPNSNotification({
      token: device.token,
      title: "StockGPT notifications are working",
      body: "This test was sent directly to your iPhone through Apple Push Notification service.",
      path: "/notifications",
      alertKey: `push-test:${user.id}:${Date.now()}`,
      environment,
    });

  try {
    let environment = normaliseEnvironment(device.environment);
    let result = await send(environment);

    if (!result.ok && result.reason === "BadDeviceToken") {
      const fallbackEnvironment = alternateEnvironment(environment);
      const retry = await send(fallbackEnvironment);
      if (retry.ok) {
        environment = fallbackEnvironment;
        result = retry;
        await supabase
          .from("ios_push_devices")
          .update({ environment, updated_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("token", device.token);
      } else {
        result = retry;
      }
    }

    if (!result.ok) {
      console.warn(
        `[ios-push-test] APNs rejected token status=${result.status} reason=${result.reason ?? "unknown"}`,
      );
      return NextResponse.json(
        {
          ok: false,
          error: `Apple rejected the test notification (${result.reason ?? `status ${result.status}`}).`,
          reason: result.reason,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, environment });
  } catch (error) {
    console.error("[ios-push-test] send failed", error);
    return NextResponse.json(
      { ok: false, error: "Could not send the test notification through APNs." },
      { status: 502 },
    );
  }
}
