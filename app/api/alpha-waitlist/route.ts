import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.redirect(new URL("/login", request.url), {
      status: 303,
    });
  }

  const admin = createAdminClient();

  const { error } = await admin.from("alpha_waitlist").upsert(
    {
      user_id: user.id,
      email: user.email,
      source: "pricing_page",
    },
    {
      onConflict: "email",
    },
  );

  if (error) {
    console.error("[alpha-waitlist]", error);

    return NextResponse.redirect(new URL("/pricing?waitlist=error", request.url), {
      status: 303,
    });
  }

  return NextResponse.redirect(new URL("/pricing?waitlist=joined", request.url), {
    status: 303,
  });
}
