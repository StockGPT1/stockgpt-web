import * as http2 from "node:http2";
import { createHash, createPrivateKey, sign } from "node:crypto";

export type APNSEnvironment = "sandbox" | "production";

export type APNSMessage = {
  token: string;
  title: string;
  body: string;
  path: string;
  alertKey: string;
  environment: APNSEnvironment;
};

type APNSResult = {
  ok: boolean;
  status: number;
  reason: string | null;
};

let cachedJWT: { value: string; expiresAt: number } | null = null;

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function providerToken() {
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const keyId = process.env.APNS_KEY_ID?.trim();
  const rawPrivateKey = process.env.APNS_PRIVATE_KEY;

  if (!teamId || !keyId || !rawPrivateKey) {
    throw new Error("APNs provider credentials are not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedJWT && cachedJWT.expiresAt > now + 60) return cachedJWT.value;

  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = base64Url(JSON.stringify({ iss: teamId, iat: now }));
  const signingInput = `${header}.${payload}`;
  const privateKey = createPrivateKey(rawPrivateKey.replace(/\\n/g, "\n"));
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  const value = `${signingInput}.${base64Url(signature)}`;

  cachedJWT = { value, expiresAt: now + 50 * 60 };
  return value;
}

function apnsHost(environment: APNSEnvironment) {
  return environment === "sandbox"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
}

function collapseId(alertKey: string) {
  return createHash("sha256").update(alertKey).digest("base64url").slice(0, 48);
}

export async function sendAPNSNotification(message: APNSMessage): Promise<APNSResult> {
  const bundleId = process.env.APNS_BUNDLE_ID?.trim() || "pro.stockgpt.app";
  const authorization = `bearer ${providerToken()}`;
  const session = http2.connect(apnsHost(message.environment));

  return await new Promise<APNSResult>((resolve, reject) => {
    let settled = false;
    let status = 0;
    let responseBody = "";

    const finish = (result: APNSResult) => {
      if (settled) return;
      settled = true;
      session.close();
      resolve(result);
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      session.destroy();
      reject(error);
    };

    session.once("error", fail);
    session.setTimeout(12_000, () => fail(new Error("APNs request timed out.")));

    const request = session.request({
      ":method": "POST",
      ":path": `/3/device/${message.token}`,
      authorization,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": "0",
      "apns-collapse-id": collapseId(message.alertKey),
      "content-type": "application/json",
    });

    request.setEncoding("utf8");
    request.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    request.on("data", (chunk: string) => {
      responseBody += chunk;
    });
    request.once("error", fail);
    request.on("end", () => {
      let reason: string | null = null;
      if (responseBody) {
        try {
          const parsed = JSON.parse(responseBody) as { reason?: string };
          reason = parsed.reason ?? null;
        } catch {
          reason = responseBody.slice(0, 180);
        }
      }
      finish({ ok: status === 200, status, reason });
    });

    request.end(
      JSON.stringify({
        aps: {
          alert: {
            title: message.title,
            body: message.body,
          },
          sound: "default",
        },
        path: message.path,
        alertKey: message.alertKey,
      }),
    );
  });
}
