import { NextRequest, NextResponse } from "next/server";
import { normaliseCurrency } from "@/lib/currency";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const currency = normaliseCurrency(body?.currency);
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be signed in to update currency settings." },
        { status: 401 },
      );
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({
        preferred_currency: currency,
        email: user.email ?? null,
      })
      .eq("id", user.id);

    if (error) {
      console.error("[currency setting]", error);
      return NextResponse.json(
        { error: "Could not update currency setting." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, currency });
  } catch (error) {
    console.error("[currency setting]", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}

