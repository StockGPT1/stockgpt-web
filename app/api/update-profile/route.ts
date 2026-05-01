import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const formData = await request.formData();

  const full_name = String(formData.get("full_name") || "");
  const date_of_birth = String(formData.get("date_of_birth") || "");
  const phone = String(formData.get("phone") || "");

  await supabase
    .from("profiles")
    .update({
      full_name,
      date_of_birth: date_of_birth || null,
      phone,
    })
    .eq("id", user.id);

  return NextResponse.redirect(new URL("/account?updated=true", request.url));
}