import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProfileWorkspace } from "@/components/ProfileWorkspace";
import { getServerViewer } from "@/lib/server-viewer";
import { userProfile } from "@/lib/user-profile";

export const metadata: Metadata = { title: "Your profile | StockGPT", robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const { user } = await getServerViewer();
  if (!user) redirect("/login");
  return <AppShell activePath="/profile"><ProfileWorkspace initialProfile={userProfile(user)} /></AppShell>;
}
