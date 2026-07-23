"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type AppChromeContextValue = {
  focusedFlowCount: number;
  keyboardOpen: boolean;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  setFocusedFlow: (id: string, open: boolean) => void;
};

const AppChromeContext = createContext<AppChromeContextValue | null>(null);

export function AppChromeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [focusedFlows, setFocusedFlows] = useState<Set<string>>(() => new Set());
  const [searchOpenPath, setSearchOpenPath] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const setFocusedFlow = useCallback((id: string, open: boolean) => {
    setFocusedFlows((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    const baseline = window.innerHeight;

    function updateKeyboardState() {
      const active = document.activeElement as HTMLElement | null;
      const isEditable =
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA" ||
        active?.getAttribute("contenteditable") === "true";
      const visibleHeight = viewport?.height ?? window.innerHeight;
      setKeyboardOpen(Boolean(isEditable && baseline - visibleHeight > 120));
    }

    viewport?.addEventListener("resize", updateKeyboardState);
    window.addEventListener("focusin", updateKeyboardState);
    window.addEventListener("focusout", updateKeyboardState);
    return () => {
      viewport?.removeEventListener("resize", updateKeyboardState);
      window.removeEventListener("focusin", updateKeyboardState);
      window.removeEventListener("focusout", updateKeyboardState);
    };
  }, []);

  const value = useMemo<AppChromeContextValue>(
    () => ({
      focusedFlowCount: focusedFlows.size,
      keyboardOpen,
      searchOpen: searchOpenPath === pathname,
      openSearch: () => setSearchOpenPath(pathname),
      closeSearch: () => setSearchOpenPath(null),
      setFocusedFlow,
    }),
    [focusedFlows, keyboardOpen, pathname, searchOpenPath, setFocusedFlow],
  );

  return <AppChromeContext.Provider value={value}>{children}</AppChromeContext.Provider>;
}

export function useAppChrome() {
  const value = useContext(AppChromeContext);
  if (!value) {
    throw new Error("useAppChrome must be used inside AppChromeProvider");
  }
  return value;
}

export function useFocusedFlow(id: string, open: boolean) {
  const { setFocusedFlow } = useAppChrome();

  useEffect(() => {
    setFocusedFlow(id, open);
    return () => setFocusedFlow(id, false);
  }, [id, open, setFocusedFlow]);
}
