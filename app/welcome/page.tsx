import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { WelcomeCarousel } from "./WelcomeCarousel";

export const metadata: Metadata = {
  title: "Welcome to StockGPT",
  description: "Explore StockGPT on iPhone.",
  robots: { index: false, follow: false },
};

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return <WelcomeCarousel />;
}
