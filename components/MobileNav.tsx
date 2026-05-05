"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

type Props = {
  navItems: readonly NavItem[];
  activePath: string;
  unreadCount: number;
};

export function MobileNav({ navItems, activePath, unreadCount }: Props) {
  const [open, setOpen] = useState(false);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [activePath]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="grid size-10 shrink-0 place-items-center rounded-full border border-[#ddb159] text-[#ddb159] transition hover:bg-[#ddb159]/10 lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white ring-2 ring-[#04180f]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[280px] transform bg-[#061b12] transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-[68px] items-center justify-between border-b border-[#ddb159]/18 px-4">
            <p className="text-[14px] font-black tracking-wider text-[#ddb159]">MENU</p>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="grid size-9 place-items-center rounded-full border border-[#ddb159]/40 text-[#ddb159]"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-5">
            {navItems.map((item) => {
              const isActive = activePath === item.href;
              const isAlerts = item.href === "/notifications";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "relative flex h-12 items-center gap-3 rounded-xl border px-3 text-[14px] font-bold transition",
                    isActive
                      ? "border-[#ddb159] bg-[#ddb159]/12 text-[#faf6f0]"
                      : "border-transparent text-[#faf6f0]/82 hover:border-[#ddb159]/40 hover:bg-[#ddb159]/8",
                  ].join(" ")}
                >
                  <span className="w-5 text-center text-lg text-[#ddb159]">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                  {isAlerts && unreadCount > 0 && (
                    <span className="ml-auto grid h-5 min-w-[20px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-[#ddb159]/18 p-4">
            <Link
              href="/settings"
              className="flex h-11 items-center gap-3 rounded-xl border border-transparent px-3 text-[13px] font-bold text-[#faf6f0]/75 transition hover:border-[#ddb159]/40 hover:text-[#faf6f0]"
            >
              <span className="w-5 text-center text-lg text-[#ddb159]">⚙</span>
              <span>Settings</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
