import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);

  // Just redirect to homepage — client will handle session
  return NextResponse.redirect(new URL("/", url.origin));
}