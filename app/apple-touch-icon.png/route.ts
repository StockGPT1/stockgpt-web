import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/og-image.png?v=5", request.url), {
    status: 308,
  });
}
