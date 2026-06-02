import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isAuthorizedCron, unauthorizedCron } from "@/lib/security/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Subscriber = {
  id: string;
  email: string | null;
  subscription_status: string | null;
  email_news_digests: boolean | null;
  email_digest_last_sent_on: string | null;
};

type NewsArticle = {
  title: string | null;
  summary: string | null;
  source: string | null;
  url: string | null;
  affected_tickers: string[] | null;
  impact: string | null;
  impact_reason: string | null;
  published_at: string | null;
};

type Ranking = {
  rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatPrice(value: unknown) {
  const n = Number(value);

  if (!Number.isFinite(n) || n <= 0) {
    return "—";
  }

  return `$${n.toFixed(2)}`;
}

function formatScore(value: unknown) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return "—";
  }

  return Math.round(n).toLocaleString();
}

function articleDate(value: string | null) {
  if (!value) return "Recent";

  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getWeeklySubjectDate() {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
  });
}

function getWeekWindow() {
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    now,
    since,
    label: `${formatShortDate(since)} – ${formatShortDate(now)}`,
  };
}

function textToHtml(text: string) {
  return escapeHtml(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 12px;">${line}</p>`)
    .join("");
}

function buildCompactNewsPayload(news: NewsArticle[]) {
  return news.slice(0, 40).map((article) => ({
    title: article.title,
    summary: article.summary,
    source: article.source,
    affected_tickers: article.affected_tickers,
    impact: article.impact,
    impact_reason: article.impact_reason,
    published_at: article.published_at,
  }));
}

function buildCompactRankingPayload(rankings: Ranking[]) {
  return rankings.slice(0, 25).map((stock) => ({
    rank: stock.rank,
    ticker: stock.ticker,
    company: stock.company,
    sector: stock.sector,
    score: stock.score,
    price: stock.price,
  }));
}

async function generateAiDigest({
  news,
  rankings,
  weekLabel,
}: {
  news: NewsArticle[];
  rankings: Ranking[];
  weekLabel: string;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "openrouter/free";

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const prompt = `
You are writing the StockGPT weekly investor newsletter.

This is not a rankings email. It must be a useful extra layer of insight for subscribers.

Write a premium weekly briefing covering:
1. Executive Brief
2. What Mattered Last Week
3. World Events And Macro Signals
4. Company And Sector Developments
5. What To Watch In The Coming Week
6. StockGPT View: Scenarios And Predictions
7. Key Risks

Rules:
- Use only the supplied data.
- Do not invent news, events, prices, rankings, dates, company developments, or economic data.
- You may make clearly labelled analytical interpretations from the supplied news and rankings.
- Do not just repeat the rankings table.
- Do not write generic filler.
- Focus on why events matter, second-order effects, likely beneficiaries/losers, and what readers should monitor.
- Include politics, world events, central bank/inflation themes, company news and sector rotation if the supplied news supports it.
- Predictions must be framed as scenarios, not certainties.
- No personalised financial advice.
- Do not tell users to buy or sell.
- Mention if the supplied news is limited.

Tone:
- Premium, intelligent, practical.
- Concise but genuinely analytical.
- Written for a reader who wants to understand the market, not just see prices.

Week covered:
${weekLabel}

News from the past week:
${JSON.stringify(buildCompactNewsPayload(news), null, 2)}

Current StockGPT ranking context:
${JSON.stringify(buildCompactRankingPayload(rankings), null, 2)}
`.trim();

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://stockgpt.pro",
        "X-Title": "StockGPT",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.35,
        max_tokens: 1500,
      }),
    },
  );

  const data = (await response.json().catch(() => null)) as
    | OpenRouterResponse
    | null;

  if (!response.ok) {
    console.error("[weekly digest] OpenRouter error", data);
    throw new Error(data?.error?.message ?? "OpenRouter request failed");
  }

  const text = data?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("OpenRouter returned an empty weekly digest");
  }

  return text;
}

function buildEmailHtml({
  aiDigest,
  news,
  rankings,
  settingsUrl,
  weekLabel,
}: {
  aiDigest: string;
  news: NewsArticle[];
  rankings: Ranking[];
  settingsUrl: string;
  weekLabel: string;
}) {
  const today = formatDate(new Date());

  const headlinesHtml =
    news.length > 0
      ? news
          .slice(0, 10)
          .map((article) => {
            const title = escapeHtml(article.title ?? "Untitled article");
            const source = escapeHtml(article.source ?? "Market news");
            const impact = escapeHtml(article.impact ?? "neutral");
            const when = escapeHtml(articleDate(article.published_at));
            const summary = article.summary
              ? `<p style="margin:8px 0 0;color:#5f6f67;font-size:13px;line-height:1.55;">${escapeHtml(
                  article.summary,
                )}</p>`
              : "";
            const reason = article.impact_reason
              ? `<p style="margin:8px 0 0;color:#0b2418;font-size:13px;line-height:1.55;"><strong>Why it matters:</strong> ${escapeHtml(
                  article.impact_reason,
                )}</p>`
              : "";
            const url = article.url ? escapeHtml(article.url) : "";

            return `
              <tr>
                <td style="padding:16px 0;border-bottom:1px solid #e6decd;">
                  <p style="margin:0 0 5px;color:#0b2418;font-size:15px;line-height:1.35;font-weight:800;">
                    ${url ? `<a href="${url}" style="color:#0b2418;text-decoration:none;">${title}</a>` : title}
                  </p>
                  <p style="margin:0;color:#b4913e;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">
                    ${source} · ${when} · ${impact}
                  </p>
                  ${summary}
                  ${reason}
                </td>
              </tr>
            `;
          })
          .join("")
      : `
        <tr>
          <td style="padding:16px 0;color:#5f6f67;font-size:14px;">
            No saved news articles were found for the past week. The AI briefing may therefore be limited.
          </td>
        </tr>
      `;

  const rankingsHtml =
    rankings.length > 0
      ? rankings
          .slice(0, 8)
          .map((stock) => {
            return `
              <tr>
                <td style="padding:10px 8px;border-bottom:1px solid #e6decd;color:#0b2418;font-size:13px;font-weight:800;">
                  ${stock.rank ?? "—"}
                </td>
                <td style="padding:10px 8px;border-bottom:1px solid #e6decd;color:#0b2418;font-size:13px;font-weight:900;">
                  ${escapeHtml(stock.ticker ?? "—")}
                </td>
                <td style="padding:10px 8px;border-bottom:1px solid #e6decd;color:#5f6f67;font-size:13px;">
                  ${escapeHtml(stock.company ?? "—")}
                </td>
                <td style="padding:10px 8px;border-bottom:1px solid #e6decd;color:#5f6f67;font-size:13px;">
                  ${escapeHtml(stock.sector ?? "—")}
                </td>
                <td style="padding:10px 8px;border-bottom:1px solid #e6decd;color:#0b2418;font-size:13px;font-weight:800;text-align:right;">
                  ${formatPrice(stock.price)}
                </td>
                <td style="padding:10px 8px;border-bottom:1px solid #e6decd;text-align:right;">
                  <span style="display:inline-block;background:#ddb159;color:#072116;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:900;">
                    ${formatScore(stock.score)}
                  </span>
                </td>
              </tr>
            `;
          })
          .join("")
      : "";

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>StockGPT Weekly Brief</title>
  </head>

  <body style="margin:0;padding:0;background:#061b12;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Your weekly StockGPT market briefing for ${weekLabel}.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#061b12;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#faf6f0;border-radius:28px;overflow:hidden;border:1px solid rgba(221,177,89,0.45);box-shadow:0 24px 70px rgba(0,0,0,0.35);">
            <tr>
              <td style="background:linear-gradient(135deg,#082519,#0d3420 55%,#1f2d18);padding:30px 30px 26px;">
                <p style="margin:0;color:#ddb159;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0.16em;">
                  ✦ StockGPT Weekly Brief
                </p>

                <h1 style="margin:10px 0 0;color:#faf6f0;font-size:34px;line-height:1.05;letter-spacing:-0.04em;">
                  The week behind. The week ahead.
                </h1>

                <p style="margin:12px 0 0;color:rgba(250,246,240,0.72);font-size:15px;line-height:1.6;">
                  ${today} · Covering ${escapeHtml(weekLabel)}.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 30px 10px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="border-radius:20px;background:#0b2418;padding:22px;border:1px solid rgba(221,177,89,0.32);">
                      <p style="margin:0 0 12px;color:#ddb159;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0.14em;">
                        Weekly Intelligence Note
                      </p>

                      <div style="color:#faf6f0;font-size:14px;line-height:1.65;">
                        ${textToHtml(aiDigest)}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 30px 6px;">
                <h2 style="margin:0;color:#0b2418;font-size:22px;letter-spacing:-0.03em;">
                  Key stories from the past week
                </h2>

                <p style="margin:6px 0 0;color:#5f6f67;font-size:13px;line-height:1.55;">
                  These are not just headlines. They are the events the AI used as context for the weekly analysis.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:6px;">
                  ${headlinesHtml}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 30px 10px;">
                <h2 style="margin:0 0 8px;color:#0b2418;font-size:22px;letter-spacing:-0.03em;">
                  Ranking context, not the whole story
                </h2>

                <p style="margin:0 0 12px;color:#5f6f67;font-size:13px;line-height:1.55;">
                  The table below gives a quick snapshot of current StockGPT leaders. The main value this week is the analysis above.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#fffdf8;border-radius:18px;overflow:hidden;border:1px solid #e6decd;">
                  <thead>
                    <tr style="background:#0b2418;">
                      <th align="left" style="padding:10px 8px;color:#faf6f0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">#</th>
                      <th align="left" style="padding:10px 8px;color:#faf6f0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Ticker</th>
                      <th align="left" style="padding:10px 8px;color:#faf6f0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Company</th>
                      <th align="left" style="padding:10px 8px;color:#faf6f0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Sector</th>
                      <th align="right" style="padding:10px 8px;color:#faf6f0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Price</th>
                      <th align="right" style="padding:10px 8px;color:#faf6f0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rankingsHtml}
                  </tbody>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:28px 30px 34px;">
                <a href="${escapeHtml(settingsUrl)}" style="display:inline-block;background:#ddb159;color:#072116;text-decoration:none;border-radius:999px;padding:13px 22px;font-size:14px;font-weight:900;">
                  Open StockGPT
                </a>

                <p style="margin:18px 0 0;color:#6b756f;font-size:12px;line-height:1.55;">
                  You are receiving this because Email news digests are enabled in your StockGPT settings.
                  This email is informational only and is not personalised financial advice.
                </p>

                <p style="margin:8px 0 0;color:#6b756f;font-size:12px;">
                  Manage preferences: <a href="${escapeHtml(settingsUrl)}" style="color:#b4913e;font-weight:800;">Settings</a>
                </p>
              </td>
            </tr>
          </table>

          <p style="margin:16px 0 0;color:rgba(250,246,240,0.45);font-size:11px;">
            © ${new Date().getFullYear()} StockGPT
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  if (!from) {
    throw new Error("Missing DIGEST_FROM_EMAIL");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("[weekly digest] Resend error", data);
    throw new Error("Resend email failed");
  }

  return data;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return unauthorizedCron();
  }
}

  const admin = createAdminClient();
  const todayKey = getTodayKey();
  const { since, label: weekLabel } = getWeekWindow();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stockgpt.pro";

  try {
    const [
      { data: subscribersData, error: subscribersError },
      { data: newsData },
      { data: rankingsData },
    ] = await Promise.all([
      admin
        .from("profiles")
        .select(
          "id,email,subscription_status,email_news_digests,email_digest_last_sent_on",
        )
        .eq("subscription_status", "basic")
        .eq("email_news_digests", true)
        .not("email", "is", null)
        .limit(100),

      admin
        .from("news_articles")
        .select(
          "title,summary,source,url,affected_tickers,impact,impact_reason,published_at",
        )
        .gte("published_at", since.toISOString())
        .order("published_at", { ascending: false })
        .limit(60),

      admin
        .from("stock_rankings")
        .select("rank,ticker,company,sector,score,price")
        .order("rank", { ascending: true })
        .limit(25),
    ]);

    if (subscribersError) {
      console.error("[weekly digest] Subscriber query error", subscribersError);

      return NextResponse.json(
        { error: "Could not fetch subscribers." },
        { status: 500 },
      );
    }

    const subscribers = ((subscribersData ?? []) as Subscriber[]).filter(
      (subscriber) =>
        subscriber.email &&
        subscriber.email_news_digests &&
        subscriber.subscription_status === "basic" &&
        subscriber.email_digest_last_sent_on !== todayKey,
    );

    const news = (newsData ?? []) as NewsArticle[];
    const rankings = (rankingsData ?? []) as Ranking[];

    if (subscribers.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No eligible subscribers to email.",
        sent: 0,
      });
    }

    const aiDigest = await generateAiDigest({
      news,
      rankings,
      weekLabel,
    });

    const html = buildEmailHtml({
      aiDigest,
      news,
      rankings,
      settingsUrl: `${siteUrl}/settings`,
      weekLabel,
    });

    const subject = `StockGPT Weekly Brief — ${getWeeklySubjectDate()}`;

    const results: Array<{
      email: string;
      status: "sent" | "failed";
      error?: string;
    }> = [];

    for (const subscriber of subscribers) {
      if (!subscriber.email) continue;

      try {
        await sendEmail({
          to: subscriber.email,
          subject,
          html,
        });

        await admin
          .from("profiles")
          .update({
            email_digest_last_sent_on: todayKey,
            email_digest_last_sent_at: new Date().toISOString(),
          })
          .eq("id", subscriber.id);

        results.push({
          email: subscriber.email,
          status: "sent",
        });
      } catch (error) {
        console.error("[weekly digest] Failed subscriber", subscriber.email, error);

        results.push({
          email: subscriber.email,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      type: "weekly",
      week: weekLabel,
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    });
  } catch (error) {
    console.error("[weekly digest]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected weekly digest error.",
      },
      { status: 500 },
    );
  }
}
