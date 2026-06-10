import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

function redact(value: string) {
  return value.replace(/[A-Za-z0-9_\-.]{24,}/g, "[redacted]").slice(0, 180);
}

async function runRestPipeline(endpoint: string, token: string) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["PING"],
        ["SET", "stockgpt:live-test", "ok", "EX", 30],
        ["GET", "stockgpt:live-test"],
        ["DEL", "stockgpt:live-test"],
      ]),
      cache: "no-store",
    });

    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      latencyMs: Date.now() - startedAt,
      body: redact(text),
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

export async function GET() {
  const endpoint = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";

  let host: string | null = null;
  try {
    host = endpoint ? new URL(endpoint).host : null;
  } catch {
    host = "invalid-url";
  }

  const result = endpoint && token ? await runRestPipeline(endpoint, token) : null;

  return NextResponse.json({
    configured: Boolean(endpoint && token),
    endpointHost: host,
    endpointStartsWithHttps: endpoint.startsWith("https://"),
    tokenPresent: Boolean(token),
    tokenLength: token.length,
    result,
  });
}
