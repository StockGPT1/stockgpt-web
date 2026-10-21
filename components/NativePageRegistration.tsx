"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAppChrome } from "@/components/AppChromeProvider";
import { AppReady } from "@/components/AppBootProvider";
import type { AskContext } from "@/lib/ask-context";

export function NativePageRegistration({ children, context }: { children?: ReactNode; context: AskContext | null }) {
  const path = usePathname();
  const { setPageConfiguration } = useAppChrome();
  const encodedContext = JSON.stringify(context);
  useEffect(() => { setPageConfiguration({ path, context: JSON.parse(encodedContext) as AskContext | null }); }, [path, encodedContext, setPageConfiguration]);
  return <><AppReady />{children}</>;
}
