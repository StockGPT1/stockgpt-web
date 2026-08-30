import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "This legacy combined mutation is retired. Record sales and purchases separately.",
    },
    { status: 410 },
  );
}
