import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron, unauthorizedCron } from "@/lib/security/cron";
import { APPROVED_STAGE22B_PROOFS, prepareStage22bProof } from "@/lib/brokerage/stage22b-proof";

export const runtime = "nodejs";
export const maxDuration = 240;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return unauthorizedCron();
  const readiness = prepareStage22bProof(process.env, APPROVED_STAGE22B_PROOFS, Date.now());
  if (!readiness.ok) {
    console.warn("[stage22b-proof]", { code: readiness.code });
    return NextResponse.json({ error: "Sandbox proof is not activated.", code: readiness.code }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  // Registry remains empty. The implementation is imported only AFTER cron auth
  // and complete runtime/identity/TEST receipt validation, never from request IDs.
  const { runStage22bProof } = await import("@/lib/brokerage/stage22b-execution");
  const result = await runStage22bProof(process.env, APPROVED_STAGE22B_PROOFS);
  console.info("[stage22b-proof]", { status: result.status, claimed: result.claimed });
  return NextResponse.json(result, { status: ["succeeded", "not_claimed"].includes(result.status) ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
