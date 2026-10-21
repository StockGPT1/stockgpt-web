"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const AppBootContext = createContext({ nativeApp: false, ready: false, markReady: () => {} });

export function AppBootProvider({ nativeApp, children }: { nativeApp: boolean; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const path = usePathname();
  if (ready && ["/login", "/welcome", "/logout", "/signup"].includes(path)) setReady(false);
  const value = useMemo(() => ({ nativeApp, ready, markReady: () => setReady(true) }), [nativeApp, ready]);
  return <AppBootContext.Provider value={value}>{children}</AppBootContext.Provider>;
}

export function useAppBoot() { return useContext(AppBootContext); }

export function AppReady() {
  const { markReady } = useAppBoot();
  useEffect(() => { markReady(); }, [markReady]);
  return null;
}
