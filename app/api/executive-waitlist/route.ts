import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        message: "You must be logged in to join the Executive waitlist.",
      },
      { status: 401 }
    );
  }

  const { error } = await supabase.from("executive_waitlist").upsert(
    {
      user_id: user.id,
      email: user.email ?? null,
      status: "joined",
      joined_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "You have joined the Executive waitlist.",
  });
}
