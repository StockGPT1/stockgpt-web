import "server-only";
import { Snaptrade, SnaptradeAuth } from "snaptrade-typescript-sdk";
import sdkPackage from "snaptrade-typescript-sdk/package.json";
import type { AxiosAdapter } from "axios";
import type { Stage22bApproval } from "../../stage22b-proof";
import { snapTradeProviderUserId } from "./normalize";

export const PROOF_PROVIDER_LIMITS = {
  requests: 32, totalMs: 120_000, requestMs: 10_000,
  responseBytes: 4 * 1024 * 1024, totalBytes: 16 * 1024 * 1024,
} as const;

// These fixed errors are deliberately NOT AxiosErrors: SDK 12.2.7 retries only
// AxiosError HTTP 429. No provider body/config/URL is ever attached to an error.
const denied = () => new Error("proof_provider_rejected");
export function createProofSnapTradeClient(input: {
  approval: Stage22bApproval; clientId: string; consumerKey: string;
  signal: AbortSignal; deadline: number; now?: () => number; fetcher?: typeof fetch;
}) {
  if (sdkPackage.version !== "12.2.7" || input.approval.broker !== "SANDBOX"
    || input.approval.permission !== "read" || input.approval.keyClassification !== "commercial_test") throw denied();
  const now = input.now ?? Date.now;
  const fetcher = input.fetcher ?? fetch;
  const end = Math.min(input.deadline, now() + PROOF_PROVIDER_LIMITS.totalMs);
  let requests = 0; let bytes = 0;
  let connectionVerified = false; let accountsVerified = false;
  const expectedAccounts = new Set(input.approval.externalAccountIds);
  const adapter: AxiosAdapter = async (config) => {
    try {
      const url = new URL(config.url ?? "");
      if (input.signal.aborted || now() >= end || requests >= PROOF_PROVIDER_LIMITS.requests
        || url.origin !== "https://api.snaptrade.com" || url.hash || url.username || url.password
        || config.method?.toUpperCase() !== "GET" || config.data != null
        || url.searchParams.get("userId") !== snapTradeProviderUserId(input.approval.userId)) throw denied();
      const path = url.pathname;
      if (path === "/authorizations") {
        if (requests !== 0) throw denied();
      } else if (path === "/accounts") {
        if (!connectionVerified || accountsVerified) throw denied();
      } else {
        const match = /^\/accounts\/([^/]+)\/(positions\/all|balances|activities)$/.exec(path);
        if (!accountsVerified || !match || !expectedAccounts.has(decodeURIComponent(match[1]))) throw denied();
      }
      requests++;
      const headers = new Headers();
      for (const [key, value] of Object.entries(config.headers.toJSON())) {
        if (value != null) headers.set(key, String(value));
      }
      const signal = AbortSignal.any([input.signal, AbortSignal.timeout(Math.max(1, Math.min(PROOF_PROVIDER_LIMITS.requestMs, end - now())))]);
      const response = await fetcher(url, { method: "GET", headers, signal, redirect: "manual", cache: "no-store" });
      if (!response.ok || response.redirected) { await response.body?.cancel(); throw denied(); }
      const reader = response.body?.getReader();
      if (!reader) throw denied();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const item = await reader.read();
          if (item.done) break;
          size += item.value.byteLength; bytes += item.value.byteLength;
          if (size > PROOF_PROVIDER_LIMITS.responseBytes || bytes > PROOF_PROVIDER_LIMITS.totalBytes || now() >= end || signal.aborted) throw denied();
          chunks.push(item.value);
        }
      } catch { await reader.cancel().catch(() => {}); throw denied(); }
      const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (path === "/authorizations") {
        if (!Array.isArray(data)) throw denied();
        const matches = data.filter((c) => c?.id === input.approval.externalConnectionId);
        if (matches.length !== 1 || matches[0].type !== "read" || matches[0].disabled !== false
          || matches[0].brokerage?.id !== input.approval.externalInstitutionId || matches[0].brokerage?.slug !== "SANDBOX") throw denied();
        connectionVerified = true;
      }
      if (path === "/accounts") {
        if (!Array.isArray(data)) throw denied();
        const accounts = data.filter((a) => a?.brokerage_authorization === input.approval.externalConnectionId);
        if (accounts.length !== expectedAccounts.size || new Set(accounts.map((a) => a.id)).size !== expectedAccounts.size
          || accounts.some((a) => !expectedAccounts.has(a.id))) throw denied();
        accountsVerified = true;
      }
      if (now() >= end || signal.aborted) throw denied();
      return { data, status: response.status, statusText: "", headers: {}, config };
    } catch { throw denied(); }
  };
  // SDK signing/normalization is reused. Its default Node transport is replaced,
  // not wrapped; neither Axios redirects nor the SDK's 429 retry branch can run.
  return new Snaptrade({
    auth: SnaptradeAuth.commercialApiKey({ clientId: input.clientId, consumerKey: input.consumerKey }),
    basePath: "https://api.snaptrade.com",
    baseOptions: { adapter, maxRedirects: 0, timeout: PROOF_PROVIDER_LIMITS.requestMs },
  });
}
