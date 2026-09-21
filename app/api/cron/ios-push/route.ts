import { NextRequest, NextResponse } from "next/server";
import { sendAPNSNotification, type APNSEnvironment } from "@/lib/apns";
import { getIOSPushCandidates } from "@/lib/ios-push-candidates";
import { isAuthorizedCron, unauthorizedCron } from "@/lib/security/cron";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ALERTS_PER_USER_PER_RUN = 3;

type DeviceRow = {
  user_id: string;
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

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return unauthorizedCron();
  if (!hasAPNSCredentials()) {
    return NextResponse.json(
      { ok: false, configured: false, error: "APNs provider credentials are missing." },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();
  const { data: devicesData, error: devicesError } = await supabase
    .from("ios_push_devices")
    .select("user_id,token,environment")
    .eq("enabled", true)
    .limit(500);

  if (devicesError) {
    console.error("[ios-push] device read failed", devicesError);
    return NextResponse.json({ ok: false, error: "Could not read iOS devices." }, { status: 500 });
  }

  const devices = (devicesData ?? []) as DeviceRow[];
  const devicesByUser = new Map<string, DeviceRow[]>();
  for (const device of devices) {
    const current = devicesByUser.get(device.user_id) ?? [];
    current.push(device);
    devicesByUser.set(device.user_id, current);
  }

  let usersChecked = 0;
  let attempted = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let disabled = 0;

  for (const [userId, userDevices] of devicesByUser) {
    usersChecked += 1;

    try {
      const candidates = (await getIOSPushCandidates(userId)).slice(0, MAX_ALERTS_PER_USER_PER_RUN);
      if (candidates.length === 0) continue;

      const tokens = userDevices.map((device) => device.token);
      const { data: deliveredRows } = await supabase
        .from("ios_push_deliveries")
        .select("token,alert_key")
        .eq("user_id", userId)
        .in("token", tokens);

      const delivered = new Set(
        (deliveredRows ?? []).map((row) => `${String(row.token)}:${String(row.alert_key)}`),
      );

      for (const candidate of candidates) {
        for (const device of userDevices) {
          const deliveryKey = `${device.token}:${candidate.key}`;
          if (delivered.has(deliveryKey)) {
            skipped += 1;
            continue;
          }

          attempted += 1;
          let environment = normaliseEnvironment(device.environment);
          let result = await sendAPNSNotification({
            token: device.token,
            title: candidate.title,
            body: candidate.body,
            path: candidate.path,
            alertKey: candidate.key,
            environment,
          });

          if (!result.ok && result.reason === "BadDeviceToken") {
            const fallbackEnvironment = alternateEnvironment(environment);
            const retry = await sendAPNSNotification({
              token: device.token,
              title: candidate.title,
              body: candidate.body,
              path: candidate.path,
              alertKey: candidate.key,
              environment: fallbackEnvironment,
            });

            if (retry.ok) {
              environment = fallbackEnvironment;
              result = retry;
              await supabase
                .from("ios_push_devices")
                .update({ environment, updated_at: new Date().toISOString() })
                .eq("token", device.token);
            } else {
              result = retry;
            }
          }

          if (result.ok) {
            sent += 1;
            delivered.add(deliveryKey);
            await supabase.from("ios_push_deliveries").upsert(
              {
                user_id: userId,
                token: device.token,
                alert_key: candidate.key,
                sent_at: new Date().toISOString(),
              },
              { onConflict: "token,alert_key" },
            );
            continue;
          }

          failed += 1;
          console.warn(
            `[ios-push] APNs rejected token status=${result.status} reason=${result.reason ?? "unknown"}`,
          );

          if (
            result.status === 410 ||
            result.reason === "Unregistered" ||
            result.reason === "DeviceTokenNotForTopic"
          ) {
            disabled += 1;
            await supabase
              .from("ios_push_devices")
              .update({ enabled: false, updated_at: new Date().toISOString() })
              .eq("token", device.token);
          }
        }
      }
    } catch (error) {
      failed += 1;
      console.error(`[ios-push] user ${userId} failed`, error);
    }
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    devices: devices.length,
    usersChecked,
    attempted,
    sent,
    skipped,
    failed,
    disabled,
  });
}
