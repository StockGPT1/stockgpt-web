import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendPremiumWaitlistEmail } from "@/lib/transactional-email";

function cleanEmail(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const submittedEmail = cleanEmail(formData.get("email"));

  if (!submittedEmail) {
    return NextResponse.redirect(
      new URL("/pricing?waitlist=missing-email", request.url),
      { status: 303 },
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase() ?? submittedEmail;
  const admin = createAdminClient();

  const { error } = await admin.from("premium_waitlist").upsert(
    {
      user_id: user?.id ?? null,
      email,
      source: "pricing_page",
    },
    {
      onConflict: "email",
    },
  );

  if (error) {
    console.error("[premium-waitlist]", error);

    return NextResponse.redirect(new URL("/pricing?waitlist=error", request.url), {
      status: 303,
    });
  }

  await sendPremiumWaitlistEmail(email);

  return NextResponse.redirect(new URL("/pricing?waitlist=joined", request.url), {
    status: 303,
  });
}
