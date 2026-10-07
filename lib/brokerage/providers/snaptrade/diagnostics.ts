import "server-only";

type DiagnosticPhase = "configuration" | "registration" | "credential_store" | "portal_login";

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
