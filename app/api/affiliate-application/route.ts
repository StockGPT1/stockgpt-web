import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendTransactionalEmail } from "@/lib/transactional-email";

function cleanText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function cleanEmail(value: FormDataEntryValue | null) {
  return cleanText(value).toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function redirectTo(request: Request, status: string) {
  return NextResponse.redirect(
    new URL(`/affiliate?application=${status}`, request.url),
    { status: 303 },
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const fullName = cleanText(formData.get("full_name"));
    const email = cleanEmail(formData.get("email"));
    const platform = cleanText(formData.get("platform"));
    const audienceSize = cleanText(formData.get("audience_size"));
    const audience = cleanText(formData.get("audience"));
    const message = cleanText(formData.get("message"));

    if (!fullName || !email || !platform || !isValidEmail(email)) {
      return redirectTo(request, "missing");
    }

    const admin = createAdminClient();

    const { error } = await admin.from("affiliate_applications").insert({
      full_name: fullName,
      email,
      platform,
      audience_size: audienceSize || null,
      audience: audience || null,
      message: message || null,
      status: "new",
      source: "affiliate_page",
    });

    if (error) {
      console.error("[affiliate-application] Supabase insert failed:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      return redirectTo(request, "storage-error");
    }

    try {
      await sendTransactionalEmail({
        to: email,
        subject: "StockGPT affiliate application received",
        preview:
          "Your StockGPT affiliate application has been received and will be reviewed.",
        eyebrow: "Affiliate Program",
        heading: "Your application has been received.",
        body: [
          "Thank you for applying to become a StockGPT affiliate partner.",
          "We review affiliate applications manually to protect the quality and credibility of the StockGPT brand.",
          "If approved, you will receive next steps and your partner tracking link.",
        ],
        ctaLabel: "Return to StockGPT",
        ctaUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://stockgpt.pro"}/landing`,
        secondaryNote:
          "StockGPT is an AI-powered research and ranking platform. Affiliate content must be educational and must not imply financial advice or guaranteed investment returns.",
      });
    } catch (emailError) {
      console.error("[affiliate-application] Applicant email failed:", emailError);
    }

    const notifyEmail = process.env.AFFILIATE_NOTIFY_EMAIL;

    if (notifyEmail && isValidEmail(notifyEmail)) {
      try {
        await sendTransactionalEmail({
          to: notifyEmail,
          subject: "New StockGPT affiliate application",
          preview: `${fullName} applied to become a StockGPT affiliate.`,
          eyebrow: "Affiliate Application",
          heading: "New affiliate application.",
          body: [
            `Name: ${fullName}`,
            `Email: ${email}`,
            `Platform: ${platform}`,
            `Audience size: ${audienceSize || "Not provided"}`,
            `Audience: ${audience || "Not provided"}`,
            `Message: ${message || "Not provided"}`,
          ],
          ctaLabel: "Open StockGPT",
          ctaUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://stockgpt.pro"}/affiliate`,
        });
      } catch (notifyError) {
        console.error(
          "[affiliate-application] Internal notification failed:",
          notifyError,
        );
      }
    }

    return redirectTo(request, "submitted");
  } catch (error) {
    console.error("[affiliate-application] Unexpected failure:", error);
    return redirectTo(request, "error");
  }
}
