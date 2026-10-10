import "server-only";
import { SnaptradeError } from "snaptrade-typescript-sdk";

type DiagnosticPhase = "configuration" | "registration" | "credential_store" | "portal_login";

export class InvalidSnapTradeRegistrationData extends Error {
  constructor() { super("SnapTrade registration response invalid"); }
}

function registrationFailure(error: unknown) {
  if (error instanceof InvalidSnapTradeRegistrationData) {
    return { failureKind: "invalid_registration_data", httpStatus: null };
  }
  // SDK 12.2.7 loses the typed status after its fixed three 429 retries.
  // Exact fixed-literal recognition only; the message is never emitted.
  if (error instanceof Error && error.constructor === Error && error.message === "Request failed after 3 retries due to 429 (rate limit) errors.") {
    return { failureKind: "provider_rejection", httpStatus: 429 };
  }
  if (error instanceof SnaptradeError) {
    // The pinned SDK copies status/code from Axios. Never serialize its message,
    // toJSON(), responseBody, request URL or any other provider-controlled field.
    const status = error.status;
    if (typeof status === "number" && Number.isInteger(status) && status >= 300 && status <= 599) {
      return { failureKind: "provider_rejection", httpStatus: status };
    }
    if (status === undefined && ["ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK", "ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "EAI_AGAIN", "ERR_CANCELED"].includes(error.code ?? "")) {
      return { failureKind: "network_failure", httpStatus: null };
    }
  }
  return { failureKind: "unknown_failure", httpStatus: null };
}

function logPhase(phase: DiagnosticPhase, success: boolean, error?: unknown) {
  // Temporary hosted Sandbox diagnostics: never serialize an error or provider input.
  if (process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX !== "true") return;
  const errorName = success ? null : error instanceof TypeError ? "TypeError"
    : error instanceof RangeError ? "RangeError" : error instanceof Error ? "Error" : "UnknownError";
  console.info("[snaptrade-sandbox-phase]", {
    phase,
    success,
    clientIdPresent: Boolean(process.env.SNAPTRADE_CLIENT_ID),
    consumerKeyPresent: Boolean(process.env.SNAPTRADE_CONSUMER_KEY),
    sandboxOptIn: process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX === "true",
    errorName,
    ...(phase === "registration" && !success ? registrationFailure(error) : {}),
  });
}

export async function runSnapTradeDiagnosticPhase<T>(phase: DiagnosticPhase, operation: () => T | Promise<T>): Promise<T> {
  try {
    const result = await operation();
    logPhase(phase, true);
    return result;
  } catch (error: unknown) {
    logPhase(phase, false, error);
    throw error;
  }
}
