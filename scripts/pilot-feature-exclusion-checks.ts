import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { evaluatePilotAiAccess, evaluatePilotDraftAccess, PILOT_ASK_UNAVAILABLE, PILOT_DRAFT_UNAVAILABLE, type PilotAiApproval } from "../lib/brokerage/pilot-feature-policy";
import type { BrokerCohortApproval } from "../lib/brokerage/rollout-policy";

let checks = 0;
function check(condition: unknown) { assert.ok(condition); checks += 1; }
const now = new Date("2026-10-22T12:00:00Z");
const participant: BrokerCohortApproval = {
  userId: "synthetic-pilot", approvalReference: "synthetic-pilot-only",
  validFrom: "2026-10-22T11:00:00Z", validUntil: "2026-10-22T13:00:00Z",
  operations: ["connect", "discover", "project"],
};
const approval: PilotAiApproval = { ...participant, approvalReference: "synthetic-separate-review", revokedAt: null, features: ["portfolio_draft"] };
const base = { userId: participant.userId, participants: [participant], draftApprovals: [] as readonly PilotAiApproval[], asOf: now };
check(!evaluatePilotDraftAccess(base).allowed);
check(evaluatePilotDraftAccess({ ...base, participants: [] }).allowed);
check(evaluatePilotDraftAccess({ ...base, userId: "ordinary-owner" }).allowed);
check(!evaluatePilotDraftAccess({ ...base, userId: null }).allowed);
check(evaluatePilotDraftAccess({ ...base, draftApprovals: [approval] }).allowed);
for (const change of [
  { participants: [participant, participant] },
  { participants: [{ ...participant, validUntil: now.toISOString() }] },
  { participants: [{ ...participant, validFrom: "invalid" }] },
  { participants: [{ ...participant, approvalReference: " " }] },
  { draftApprovals: [{ ...approval, userId: "other-owner" }] },
  { draftApprovals: [approval, approval] },
  { draftApprovals: [{ ...approval, approvalReference: " " }] },
  { draftApprovals: [{ ...approval, validUntil: now.toISOString() }] },
  { draftApprovals: [{ ...approval, validFrom: "2026-10-23T00:00:00Z" }] },
  { draftApprovals: [{ ...approval, validFrom: "invalid" }] },
  { draftApprovals: [{ ...approval, revokedAt: "2026-10-22T11:30:00Z" }] },
  { draftApprovals: [{ ...approval, features: [] }] },
  { asOf: new Date("invalid") },
]) check(!evaluatePilotDraftAccess({ ...base, draftApprovals: [approval], ...change }).allowed);
check(!evaluatePilotAiAccess({ ...base, draftApprovals: [approval], feature: "ask_explanations" }).allowed);
check(evaluatePilotAiAccess({ ...base, draftApprovals: [{ ...approval, features: ["ask_explanations"] }], feature: "ask_explanations" }).allowed);

type Scenario = "pilot" | "ordinary" | "anonymous" | "auth_error";
async function actualAction(path: string, action: "generatePortfolioAction" | "savePortfolio", scenario: Scenario) {
  const calls = { generation: 0, mutation: 0 };
  const userId = scenario === "ordinary" ? "ordinary-owner" : scenario === "anonymous" ? null : participant.userId;
  const session = { auth: { getUser: async () => ({
    data: { user: userId ? { id: userId, user_metadata: { pilot: false, approved: true, userId: "ordinary-owner" } } : null },
    error: scenario === "auth_error" ? { message: "synthetic-auth-failure" } : null,
  }) } };
  const draft = { riskTolerance: "moderate", timeHorizon: "long", holdings: [] };
  const modules: Record<string, unknown> = {
    "@/utils/supabase/server": { createClient: async () => session },
    "@/lib/brokerage/pilot-feature-access": { pilotDraftAccess: (id: string | null) => {
      assert.equal(id, userId);
      return evaluatePilotDraftAccess({ ...base, userId: id });
    } },
    "@/lib/brokerage/pilot-feature-policy": { PILOT_DRAFT_UNAVAILABLE },
    "@/lib/portfolio": { generatePortfolio: async () => { calls.generation += 1; return draft; } },
    "@/lib/portfolio-creation-mutation": { createAiPortfolioDraftAtomically: async () => {
      calls.mutation += 1; return { success: true, data: { portfolioId: "synthetic-portfolio" } };
    } },
    "@/lib/portfolio-chart-inputs": { markPortfolioChartInputsChanged: async () => undefined },
    "next/cache": { revalidatePath: () => undefined },
  };
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, (...args: unknown[]) => Promise<{ success?: boolean; portfolio?: unknown; error?: string }>> = {};
  vm.runInNewContext(code, { exports, console: { warn: () => undefined }, require: (name: string) => modules[name] ?? {} });
  const result = action === "savePortfolio" ? await exports[action](draft, { userId: "ordinary-owner", pilot: false })
    : await exports[action]("moderate", "long", 1000);
  if (scenario === "ordinary") {
    check(action === "savePortfolio" ? result.success === true : result.portfolio !== null);
    check(calls[action === "savePortfolio" ? "mutation" : "generation"] === 1);
  } else {
    check(Boolean(result.error));
    check(calls.generation === 0 && calls.mutation === 0);
    if (scenario === "pilot" || (scenario === "auth_error" && action === "savePortfolio")) {
      check(result.error === PILOT_DRAFT_UNAVAILABLE);
    }
  }
}

async function actualAsk(scenario: "pilot" | "ordinary" | "anonymous") {
  const userId = scenario === "ordinary" ? "ordinary-owner" : scenario === "pilot" ? participant.userId : null;
  const calls = { rate: 0, provider: 0, body: 0, history: 0 };
  const query = {
    select: () => query, eq: () => query,
    maybeSingle: async () => ({ data: { subscription_status: "core" }, error: null }),
  };
  const session = { auth: { getUser: async () => ({ data: { user: userId ? { id: userId, user_metadata: { pilot: false } } : null } }) }, from: (table: string) => {
    if (table !== "profiles") calls.history += 1;
    return query;
  } };
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: unknown, options: ResponseInit) => Response.json(body, options) } },
    "@/utils/supabase/server": { createClient: async () => session },
    "@/lib/subscription": { hasActiveSubscription: (status: string) => status === "core" },
    "@/lib/brokerage/pilot-feature-access": { pilotAiAccess: (id: string | null, feature: "ask_explanations") => {
      assert.equal(id, userId); assert.equal(feature, "ask_explanations");
      return evaluatePilotAiAccess({ ...base, userId: id, feature });
    } },
    "@/lib/brokerage/pilot-feature-policy": { PILOT_ASK_UNAVAILABLE },
    "@/lib/security/rate-limit": { rateKey: () => "synthetic", checkRateLimit: async () => {
      calls.rate += 1; return { allowed: false, retryAfterSeconds: 60 };
    } },
  };
  const code = ts.transpileModule(readFileSync("app/api/ask-stockgpt/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, (request: unknown) => Promise<Response>> = {};
  vm.runInNewContext(code, {
    exports, process: { env: {} }, console: { error: () => undefined },
    fetch: () => { calls.provider += 1; throw new Error("provider_not_permitted"); },
    require: (name: string) => modules[name] ?? {},
  });
  const result = await exports.POST({ json: async () => { calls.body += 1; return { question: "buy my holding", pilot: false }; } });
  check(result.status === (scenario === "pilot" ? 403 : scenario === "anonymous" ? 401 : 429));
  check(calls.provider === 0 && calls.body === 0 && calls.history === 0);
  check(calls.rate === (scenario === "ordinary" ? 1 : 0));
  if (scenario === "pilot") check((await result.json()).answer === PILOT_ASK_UNAVAILABLE);
}

async function main() {
  for (const scenario of ["pilot", "ordinary", "anonymous", "auth_error"] as const) {
    await actualAction("lib/actions/portfolio.ts", "generatePortfolioAction", scenario);
    await actualAction("lib/actions/portfolio-management.ts", "savePortfolio", scenario);
  }
  for (const scenario of ["pilot", "ordinary", "anonymous"] as const) await actualAsk(scenario);
  const server = readFileSync("lib/brokerage/pilot-feature-access.ts", "utf8");
  check(server.startsWith('import "server-only";'));
  check(/APPROVED_PILOT_AI[^=]*= Object\.freeze\(\[\]\)/u.test(server));
  check(!/user_metadata|process\.env|request\.|JSON\.parse/u.test(server.replace(/\/\/[^\n]*/gu, "")));
  const ask = readFileSync("lib/ask-stockgpt-portfolio-context.ts", "utf8");
  check(ask.includes("do not make that transaction decision"));
  check(ask.includes("Do not recommend a transaction amount or percentage"));
  // No approval in this policy enables personalized instructions. Accepted Ask
  // safeguards remain global, independent of brokerage enrollment or Draft review.
  check(!/personalizedInstructions|personalisedInstructions|tradeInstructions/u.test(server));
  console.log(`Pilot feature exclusions: ${checks} checks passed (pure policy, actual mocked Server Actions and Ask handler; no database/provider transport).`);
}
main().catch(() => { console.error("pilot_feature_exclusion_checks_failed"); process.exitCode = 1; });
