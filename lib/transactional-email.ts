type SendEmailInput = {
  to: string;
  subject: string;
  preview: string;
  heading: string;
  eyebrow?: string;
  body: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryNote?: string;
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stockgpt.pro";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paragraphHtml(paragraphs: string[]) {
  return paragraphs
    .map(
      (paragraph) => `
        <p style="margin:0 0 16px 0;color:rgba(250,246,240,0.78);font-size:15px;line-height:1.65;font-weight:500;">
          ${escapeHtml(paragraph)}
        </p>
      `,
    )
    .join("");
}

function luxuryEmailTemplate(input: SendEmailInput) {
  const eyebrow = input.eyebrow ?? "StockGPT";
  const safePreview = escapeHtml(input.preview);
  const safeHeading = escapeHtml(input.heading);
  const safeEyebrow = escapeHtml(eyebrow);
  const safeCtaLabel = input.ctaLabel ? escapeHtml(input.ctaLabel) : "";
  const safeCtaUrl = input.ctaUrl ?? siteUrl;
  const safeSecondaryNote = input.secondaryNote
    ? escapeHtml(input.secondaryNote)
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${safeHeading}</title>
  </head>

  <body style="margin:0;padding:0;background:#061b12;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${safePreview}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#061b12;margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:28px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid rgba(221,177,89,0.28);border-radius:28px;overflow:hidden;background:#082519;box-shadow:0 24px 80px rgba(0,0,0,0.35);">
            <tr>
              <td style="padding:0;background:linear-gradient(135deg,#0d3420,#082519 58%,#061b12);">
                <div style="height:4px;background:linear-gradient(90deg,transparent,#ddb159,transparent);"></div>

                <div style="padding:34px 34px 26px 34px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td>
                        <div style="font-size:24px;font-weight:900;letter-spacing:-0.04em;color:#faf6f0;">
                          Stock<span style="color:#ddb159;">GPT</span>
                        </div>
                        <div style="margin-top:4px;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#ddb159;font-weight:800;">
                          AI-Powered Investing
                        </div>
                      </td>
                      <td align="right" style="vertical-align:top;">
                        <div style="display:inline-block;border:1px solid rgba(221,177,89,0.28);border-radius:999px;padding:7px 11px;color:#ddb159;font-size:11px;font-weight:800;">
                          Private Intelligence
                        </div>
                      </td>
                    </tr>
                  </table>

                  <div style="margin-top:34px;">
                    <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#ddb159;font-weight:900;">
                      ${safeEyebrow}
                    </div>

                    <h1 style="margin:12px 0 0 0;color:#faf6f0;font-size:34px;line-height:0.98;letter-spacing:-0.055em;font-weight:900;">
                      ${safeHeading}
                    </h1>
                  </div>

                  <div style="margin-top:24px;">
                    ${paragraphHtml(input.body)}
                  </div>

                  ${
                    input.ctaLabel
                      ? `
                        <div style="margin-top:28px;">
                          <a href="${safeCtaUrl}" style="display:inline-block;background:#ddb159;color:#072116;text-decoration:none;border-radius:999px;padding:14px 24px;font-size:14px;font-weight:900;box-shadow:0 12px 30px rgba(221,177,89,0.22);">
                            ${safeCtaLabel}
                          </a>
                        </div>
                      `
                      : ""
                  }

                  ${
                    input.secondaryNote
                      ? `
                        <div style="margin-top:26px;border:1px solid rgba(221,177,89,0.16);border-radius:18px;background:rgba(4,24,15,0.55);padding:15px 16px;color:rgba(250,246,240,0.58);font-size:12px;line-height:1.6;font-weight:600;">
                          ${safeSecondaryNote}
                        </div>
                      `
                      : ""
                  }
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 34px;background:#04180f;border-top:1px solid rgba(221,177,89,0.14);">
                <p style="margin:0;color:rgba(250,246,240,0.45);font-size:11px;line-height:1.6;font-weight:600;">
                  StockGPT provides AI-generated rankings and market intelligence for informational purposes only. This is not financial advice.
                </p>
                <p style="margin:10px 0 0 0;color:rgba(250,246,240,0.35);font-size:11px;line-height:1.6;">
                  © ${new Date().getFullYear()} StockGPT. You are receiving this because you used StockGPT.
                </p>
              </td>
            </tr>
          </table>

          <div style="max-width:640px;margin-top:14px;color:rgba(250,246,240,0.35);font-size:11px;line-height:1.5;text-align:center;">
            <a href="${siteUrl}" style="color:#ddb159;text-decoration:none;">stockgpt.pro</a>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendTransactionalEmail(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "StockGPT <notifications@stockgpt.pro>";

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY is missing. Email skipped:", input.subject);
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: luxuryEmailTemplate(input),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[email] Resend failed:", response.status, errorText);
    return { error: errorText };
  }

  return response.json();
}

export async function sendCoreSubscriptionActivatedEmail(to: string) {
  return sendTransactionalEmail({
    to,
    subject: "Your StockGPT Core access is active",
    preview:
      "Your Core subscription is now active. Full AI rankings and StockGPT tools are unlocked.",
    eyebrow: "Core Membership",
    heading: "Your Core access is active.",
    body: [
      "Your StockGPT Core subscription has been activated. You now have access to the full AI ranking table, stock detail pages, watchlist tools, portfolio features and market intelligence available in the Core plan.",
      "The platform ranks S&P 500 stocks using StockGPT’s AI scoring system and supporting market data. Rankings, scores and insights are provided for informational purposes only and should be used alongside your own judgement and research.",
      "You can manage your subscription from the Settings page at any time.",
    ],
    ctaLabel: "Open StockGPT",
    ctaUrl: `${siteUrl}/rankings`,
    secondaryNote:
      "Plan: Core. Price: £12/month. You can manage billing, renewal and cancellation from your StockGPT Settings page.",
  });
}

export async function sendSubscriptionCancelledEmail(to: string) {
  return sendTransactionalEmail({
    to,
    subject: "Your StockGPT subscription has been cancelled",
    preview:
      "Your StockGPT subscription has been cancelled and premium ranking access may now be locked.",
    eyebrow: "Membership Update",
    heading: "Your subscription has been cancelled.",
    body: [
      "This confirms that your StockGPT subscription has been cancelled. If your billing period has ended, premium ranking access may now be locked.",
      "You can still visit StockGPT, but full AI rankings and subscriber tools require an active Core membership.",
      "If this was not expected, you can restart your subscription from the pricing page.",
    ],
    ctaLabel: "View plans",
    ctaUrl: `${siteUrl}/pricing`,
    secondaryNote:
      "If you believe this cancellation was a mistake, check your billing settings or start a new Core subscription.",
  });
}

export async function sendPaymentFailedEmail(to: string) {
  return sendTransactionalEmail({
    to,
    subject: "Payment issue with your StockGPT subscription",
    preview:
      "There was a payment issue with your StockGPT subscription. Please update your billing details.",
    eyebrow: "Billing Notice",
    heading: "Your payment could not be completed.",
    body: [
      "We were unable to complete payment for your StockGPT subscription. If the payment is not updated, access to premium rankings and subscriber tools may be paused.",
      "You can manage your billing details from your StockGPT Settings page.",
      "This email is a billing confirmation notice only. It does not contain financial advice or investment recommendations.",
    ],
    ctaLabel: "Manage subscription",
    ctaUrl: `${siteUrl}/settings`,
    secondaryNote:
      "If you recently changed card or billing details, please check that your Stripe payment method is up to date.",
  });
}

export async function sendPremiumWaitlistEmail(to: string) {
  return sendTransactionalEmail({
    to,
    subject: "You are on the StockGPT Premium waitlist",
    preview:
      "You have joined the StockGPT Premium waitlist. We will email you when Premium becomes available.",
    eyebrow: "Premium Waitlist",
    heading: "You are on the Premium waitlist.",
    body: [
      "You have successfully joined the StockGPT Premium waitlist.",
      "Premium is not live yet. When it becomes available, we will email you with the features, pricing and launch details before opening access.",
      "For now, Core remains the live StockGPT membership tier and unlocks the current AI ranking engine and platform tools.",
    ],
    ctaLabel: "Return to StockGPT",
    ctaUrl: `${siteUrl}/pricing`,
    secondaryNote:
      "This confirms your waitlist registration only. You have not been charged for Premium.",
  });
}
