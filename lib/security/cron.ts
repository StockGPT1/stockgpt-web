import { NextRequest, NextResponse } from "next/server";

export function isAuthorizedCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization");
  const userAgent = req.headers.get("user-agent") ?? "";
  const schedule = req.headers.get("x-vercel-cron-schedule");
  const isVercelCron =
    process.env.VERCEL === "1" &&
    process.env.VERCEL_ENV === "production" &&
    userAgent.includes("vercel-cron/1.0") &&
    Boolean(schedule);

  if (secret && authorization === `Bearer ${secret}`) return true;

  if (isVercelCron) {
    console.info(
      [
        "[cron-auth]",
        "mode=vercel-cron",
        `hasSecret=${Boolean(secret)}`,
        `userAgent=${userAgent}`,
        `schedule=${schedule}`,
      ].join(" "),
    );
    return true;
  }

  console.warn(
    [
      "[cron-auth]",
      "mode=rejected",
      `hasSecret=${Boolean(secret)}`,
      `hasAuthorization=${Boolean(authorization)}`,
      `userAgent=${userAgent || "none"}`,
      `schedule=${schedule ?? "none"}`,
    ].join(" "),
  );

  if (!secret) {
    console.error("[cron-auth] CRON_SECRET is not set for manual secured cron calls.");
  }

  return false;
}

export function unauthorizedCron() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
