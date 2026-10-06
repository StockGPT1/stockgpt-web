import "server-only";

export function brokerConnectionsEnabled() {
  return process.env.STOCKGPT_BROKER_CONNECTIONS_ENABLED === "true";
}

export function brokerPortalSandboxRestriction(): "SANDBOX" | undefined {
  return process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX === "true" ? "SANDBOX" : undefined;
}

export function brokerReturnUrl() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) throw new Error("Broker connection configuration unavailable");
  const url = new URL("/portfolio/connections/return", origin);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Broker connection configuration unavailable");
  }
  return url.toString();
}
