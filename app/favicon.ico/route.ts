import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/logo.png?v=3", request.url), {
    status: 308,
  });
}
