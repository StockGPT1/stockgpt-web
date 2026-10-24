import { notFound } from "next/navigation";
import { AppChromeProvider } from "@/components/AppChromeProvider";
import { ProfileWorkspace } from "@/components/ProfileWorkspace";
import { NativeAppHeader, NativeBottomNavigation } from "@/components/native-navigation/NativeNavigation";

export const metadata = { title: "StockGPT profile preview", robots: { index: false, follow: false } };

export default function ProfileReviewPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AppChromeProvider><div style={{ background: "#0b2d1f", minHeight: "100dvh", paddingBottom: 95 }}><NativeAppHeader title="Your profile" unreadCount={0} /><ProfileWorkspace initialProfile={{ displayName: "Your name", email: "you@example.com", avatarUrl: null, memberSince: "2026-10-24T00:00:00Z" }} /><NativeBottomNavigation unreadCount={0} askHref="/ask-stockgpt" /></div></AppChromeProvider>;
}
