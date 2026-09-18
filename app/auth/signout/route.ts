import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function signedOutDestination(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  return userAgent.includes("StockGPTApp") ? "/login" : "/";
}

async function signOut(request: Request) {
  const supabase = await createClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(
    new URL(signedOutDestination(request), request.url),
    { status: 303 },
  );
}

export async function POST(request: Request) {
  return signOut(request);
}

export async function GET(request: Request) {
  return signOut(request);
}
