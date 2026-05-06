import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const enabled = Boolean(body?.enabled);

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be signed in to update this setting." },
        { status: 401 },
      );
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from("profiles")
      .update({
        email_news_digests: enabled,
        email: user.email ?? null,
      })
      .eq("id", user.id);

    if (error) {
      console.error("[email-news-digest setting]", error);

      return NextResponse.json(
        { error: "Could not update email digest setting." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, enabled });
  } catch (error) {
    console.error("[email-news-digest setting]", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
