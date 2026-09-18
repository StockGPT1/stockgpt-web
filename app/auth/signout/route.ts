import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function signedOutDestination(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  return userAgent.includes("StockGPTApp") ? "/login" : "/";
}

function externalOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

async function signOut(request: Request) {
  const supabase = await createClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(
    new URL(signedOutDestination(request), `${externalOrigin(request)}/`),
    { status: 303 },
  );
}

export async function POST(request: Request) {
  return signOut(request);
}

export async function GET(request: Request) {
  return signOut(request);
}
