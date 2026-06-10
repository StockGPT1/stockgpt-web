import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PortfolioUserRow = { user_id: string | null };

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>,
) {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn));
  }
}

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_portfolios")
    .select("user_id")
    .is("archived_at", null)
    .limit(Number(process.env.NOTIFICATION_SUMMARY_USER_SCAN_LIMIT ?? 1000));

  if (error) {
    return NextResponse.json(
      { error: "Could not load notification users" },
      { status: 500 },
    );
  }

  const userIds = Array.from(
    new Set(
      ((data ?? []) as PortfolioUserRow[])
        .map((row) => row.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  await runInBatches(
    userIds,
    Number(process.env.NOTIFICATION_SUMMARY_BATCH_SIZE ?? 10),
    async (userId) => {
      await supabase.from("user_notification_summaries").upsert(
        {
          user_id: userId,
          unread_count: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    },
  );

  return NextResponse.json({ ok: true, users: userIds.length });
}
