import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const categories = new Set([
  "wrong_data",
  "confusing_ai_answer",
  "billing_issue",
  "bug",
  "feature_request",
  "other",
]);

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function sendFounderEmail(payload: {
  email: string | null;
  category: string;
  message: string;
  pagePath: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SUPPORT_EMAIL_FROM ?? "StockGPT <sales@stockgpt.pro>";

  if (!apiKey) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: "sales@stockgpt.pro",
        subject: `StockGPT feedback: ${payload.category.replaceAll("_", " ")}`,
        text: [
          `Email: ${payload.email ?? "unknown"}`,
          `Category: ${payload.category}`,
          `Page: ${payload.pagePath ?? "unknown"}`,
          "",
          payload.message,
        ].join("\n"),
      }),
    });
  } catch (error) {
    console.warn("[support-feedback] email notification skipped", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const category = cleanText(body?.category, 64);
    const message = cleanText(body?.message, 2000);
    const pagePath = cleanText(body?.pagePath, 300) || null;
    const userAgent = cleanText(body?.userAgent, 500) || null;

    if (!categories.has(category)) {
      return NextResponse.json({ error: "Invalid feedback category." }, { status: 400 });
    }

    if (message.length < 8) {
      return NextResponse.json({ error: "Please add more detail." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "You must be signed in to send feedback." }, { status: 401 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("support_feedback").insert({
      user_id: user.id,
      email: user.email ?? null,
      category,
      message,
      page_path: pagePath,
      user_agent: userAgent,
    });

    if (error) {
      console.error("[support-feedback] insert failed", error);
      return NextResponse.json({ error: "Could not save feedback." }, { status: 500 });
    }

    await sendFounderEmail({
      email: user.email ?? null,
      category,
      message,
      pagePath,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[support-feedback]", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
