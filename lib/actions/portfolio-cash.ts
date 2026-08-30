"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { invalidatePortfolioPageSnapshot } from "@/lib/portfolio-speed-cache";
import { mutatePortfolioCash } from "@/lib/portfolio-cash-mutation";

export type PortfolioCashActionResult = {
  success: boolean;
  error?: string;
};

export async function withdrawPortfolioCash({
  portfolioId,
  amount,
}: {
  portfolioId: string;
  amount: number;
}): Promise<PortfolioCashActionResult> {
  if (!portfolioId) return { success: false, error: "Choose a portfolio." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Enter a positive withdrawal amount." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "not_authenticated" };

  const mutation = await mutatePortfolioCash(supabase, {
    portfolioId,
    operation: "withdrawal",
    amount,
  });
  if (!mutation.success) return mutation;

  try {
    await invalidatePortfolioPageSnapshot({ portfolioId, ownerId: user.id });
    revalidatePath("/portfolio");
    revalidatePath(`/portfolio?portfolio=${portfolioId}`);
  } catch {
    console.warn("[portfolio-cash] Post-commit Portfolio refresh failed.");
  }
  return { success: true };
}
