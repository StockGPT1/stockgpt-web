"use client";

import Link from "next/link";
import Image from "next/image";
import type { ProfileDetails } from "@/components/ProfileWorkspace";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { useAppChrome } from "@/components/AppChromeProvider";
import { StockIcon, type StockIconName } from "@/components/StockIcon";
import { buildAskHref, type AskContext } from "@/lib/ask-context";
import { ElasticBubble, LiquidNavigation } from "./LiquidControls";
import { StockGPTFlame } from "./StockGPTFlame";
import styles from "./NativeNavigation.module.css";

const destinations = [
  { key: "/dashboard", label: "Home", icon: "dashboard" },
  { key: "/rankings", label: "Rankings", icon: "rankings" },
  { key: "/portfolio", label: "Portfolio", icon: "portfolio" },
  { key: "/chart-scan", label: "Scanner", icon: "camera" },
] as const;
const more = [
  { href: "/watchlist", label: "Watchlist", detail: "Stocks you’re tracking", icon: "watchlist" },
  { href: "/world-news", label: "World news", detail: "The stories behind the market", icon: "news" },
  { href: "/notifications", label: "Alerts", detail: "Updates that need your attention", icon: "alerts" },
  { href: "/settings", label: "Settings", detail: "Account, preferences & membership", icon: "settings" },
] as const;

export function nativeAskContext(path: string): AskContext | null {
  if (path.startsWith("/portfolio")) return { contextType: "portfolio" };
  if (path.startsWith("/rankings") || path.startsWith("/compare")) return { contextType: "rankings" };
  if (path.startsWith("/stock/")) return { contextType: "stock", ticker: decodeURIComponent(path.split("/")[2] ?? "") };
  return { contextType: "dashboard" };
}

export function NativeAppHeader({ title, unreadCount, back = false }: { title: string; unreadCount: number; back?: boolean }) {
  const router = useRouter();
  const { openSearch, openMenu, menuOpen } = useAppChrome();
  return <header className={`${styles.header} sg-native-header`}>
    <ElasticBubble className={styles.menuBubble}><button type="button" aria-label={back ? "Go back" : "Open menu"} aria-expanded={back ? undefined : menuOpen} aria-haspopup={back ? undefined : "dialog"} onClick={() => { if (back) router.back(); else openMenu(); }} className={styles.iconButton}>{back ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 5-7 7 7 7" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 8h14M5 16h14" /></svg>}</button></ElasticBubble>
    <span className={styles.title}>{title || "StockGPT"}</span>
    <ElasticBubble className={styles.tools}><button type="button" aria-label="Search StockGPT" onClick={openSearch} className={styles.iconButton}><StockIcon name="search" /></button><span className={styles.divider} /><Link href="/notifications" prefetch={false} aria-label={unreadCount ? `Alerts, ${unreadCount} unread` : "Alerts"} className={styles.iconButton}><StockIcon name="alerts" />{unreadCount > 0 && <span className={styles.dot} />}</Link></ElasticBubble>
  </header>;
}

function NativeProfileLink({ open, onSelect }: { open: boolean; onSelect: () => void }) {
  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (open) void fetch("/api/profile", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (response.ok) setProfile((await response.json()).profile);
    }).catch(() => {});
    return () => controller.abort();
  }, [open]);
  useEffect(() => {
    const update = (event: Event) => setProfile((event as CustomEvent<ProfileDetails>).detail);
    window.addEventListener("stockgpt:profile-updated", update);
    return () => window.removeEventListener("stockgpt:profile-updated", update);
  }, []);
  const initials = (profile?.displayName || "You").trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  return <Link href="/profile" prefetch={false} onClick={onSelect} className={styles.profileLink}><span className={styles.profileAvatar}>{profile?.avatarUrl ? <Image src={profile.avatarUrl} alt="" width={46} height={46} unoptimized onError={() => setProfile(current => current ? { ...current, avatarUrl: null } : current)} /> : initials}</span><span><strong>{profile?.displayName || "Your profile"}</strong><small>View and edit your profile</small></span><span aria-hidden="true">›</span></Link>;
}

function NativeMoreMenu({ unreadCount }: { unreadCount: number }) {
  const { menuOpen, closeMenu } = useAppChrome();
  const panel = useRef<HTMLElement>(null);
  const path = usePathname();
  useEffect(() => {
    if (!menuOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const background = Array.from(document.querySelectorAll<HTMLElement>(".sg-app-content, .sg-native-header, .sg-native-dock"));
    const previousInert = background.map(element => element.inert);
    background.forEach(element => { element.inert = true; });
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>("button")?.focus());
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
      if (event.key !== "Tab") return;
      const nodes = panel.current?.querySelectorAll<HTMLElement>("button,a[href]");
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", key);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", key); background.forEach((element, index) => { element.inert = previousInert[index]; }); previousFocus?.focus(); };
  }, [menuOpen, closeMenu]);
  if (!menuOpen) return null;
  return <div className={styles.menuLayer} role="dialog" aria-modal="true" aria-label="StockGPT menu"><button className={styles.scrim} aria-label="Close menu" tabIndex={-1} onClick={closeMenu} /><aside ref={panel} className={styles.menuPanel}><div className={styles.menuTop}><span className={styles.wordmark}><StockGPTFlame />StockGPT</span><ElasticBubble><button className={styles.iconButton} aria-label="Close menu" onClick={closeMenu}><StockIcon name="close" /></button></ElasticBubble></div><NativeProfileLink open={menuOpen} onSelect={closeMenu} /><p className={styles.menuLabel}>YOUR STOCKGPT</p><nav aria-label="More StockGPT sections">{more.map(item => <Link key={item.href} href={item.href} prefetch={false} onClick={closeMenu} aria-current={path.startsWith(item.href) ? "page" : undefined} className={styles.menuItem}><StockIcon name={item.icon as StockIconName} /><span><strong>{item.label}</strong><small>{item.detail}</small></span>{item.href === "/notifications" && unreadCount > 0 ? <i>{unreadCount > 99 ? "99+" : unreadCount}</i> : <span aria-hidden="true">›</span>}</Link>)}</nav><div className={styles.menuBottom}><StockGPTFlame /><p>A little clarity.<br /><strong>A lot more possibility.</strong></p></div></aside></div>;
}

export function NativeBottomNavigation({ unreadCount, askHref }: { unreadCount: number; askHref: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { focusedFlowCount, keyboardOpen, pageConfiguration } = useAppChrome();
  const [pending, setPending] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const current = destinations.find(item => pathname === item.key || pathname.startsWith(`${item.key}/`))?.key ?? "";
  const hidden = pathname.startsWith("/ask-stockgpt") || pathname.startsWith("/compare") || pathname.includes("/fullscreen") || focusedFlowCount > 0 || keyboardOpen;
  const context = pageConfiguration?.path === pathname ? pageConfiguration.context : nativeAskContext(pathname);
  const actualAskHref = askHref.startsWith("/ask-stockgpt") ? buildAskHref(context) : askHref;
  useEffect(() => {
    // AUTO skips dynamic page data without a leaf loading boundary in Next 16.
    // FULL warms the real route, rather than just its shared frame.
    const queue = destinations.filter(item => item.key !== current)
      .sort((a, b) => Number(b.key === "/chart-scan") - Number(a.key === "/chart-scan"));
    let cancelled = false;
    let timer = window.setTimeout(warmNext, 200);
    function warmNext() { if (cancelled) return; const item = queue.shift(); if (!item) return; router.prefetch(item.key, { kind: PrefetchKind.FULL }); timer = window.setTimeout(warmNext, 350); }
    return () => { cancelled = true; clearTimeout(timer); };
  }, [current, router]);
  return <><NativeMoreMenu unreadCount={unreadCount} />{!hidden && <div className={`${styles.dock} sg-native-dock`}>
    <ElasticBubble className={styles.askBubble}><Link href={actualAskHref} prefetch={false} aria-label="Ask StockGPT" className={styles.askLink}><span className={styles.ember} /><StockGPTFlame className={styles.smallFlame} /></Link></ElasticBubble>
    <LiquidNavigation items={destinations.map(item => ({ ...item, icon: <StockIcon name={item.icon} /> }))} activeKey={isPending && pending ? pending : current} onSelect={key => { if (key === current) return; setPending(key); startTransition(() => router.push(key)); }} />
    <span className="sr-only" role="status">{isPending ? "Opening page" : ""}</span>
  </div>}</>;
}
