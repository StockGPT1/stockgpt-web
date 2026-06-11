"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type MobileSheetVariant = "bottom" | "full" | "confirm";

type MobileSheetProps = {
  open: boolean;
  title: string;
  eyebrow?: string;
  description?: string;
  variant?: MobileSheetVariant;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  labelledById?: string;
};

export function MobileSheet({
  open,
  title,
  eyebrow,
  description,
  variant = "bottom",
  onClose,
  children,
  footer,
  labelledById,
}: MobileSheetProps) {
  const [mounted, setMounted] = useState(false);
  const titleId = labelledById ?? `mobile-sheet-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;
    const originalTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.body.style.touchAction = "none";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      document.body.style.touchAction = originalTouchAction;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!mounted || !open) return null;

  const isFull = variant === "full";
  const isConfirm = variant === "confirm";

  const sheetClass = isFull
    ? "h-[100dvh] max-h-[100dvh] rounded-none border-0 bg-[#07170f]"
    : isConfirm
      ? "max-h-[72dvh] rounded-t-[28px] border border-b-0 border-[#ddb159]/24 bg-[#07170f]"
      : "max-h-[82dvh] rounded-t-[28px] border border-b-0 border-[#ddb159]/24 bg-[#07170f]";

  const gridRows = isFull
    ? "grid-rows-[auto_minmax(0,1fr)_auto]"
    : "grid-rows-[auto_minmax(0,1fr)_auto]";

  return createPortal(
    <div
      role="presentation"
      className="stockgpt-mobile-sheet-root fixed inset-0 z-[2147483647] hidden overflow-hidden bg-[#020805]/88 text-[#faf6f0] lg:hidden"
      data-variant={variant}
    >
      {!isFull && (
        <button
          type="button"
          aria-label="Close sheet"
          className="absolute inset-0 h-full w-full cursor-default bg-[#020805]/72"
          onClick={onClose}
        />
      )}

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          "stockgpt-mobile-sheet relative z-10 ml-auto mt-auto grid w-full max-w-full min-w-0 overflow-hidden shadow-[0_-24px_80px_rgba(0,0,0,0.62)]",
          sheetClass,
          gridRows,
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        {!isFull && <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-[#faf6f0]/18" />}

        <header className="stockgpt-mobile-sheet-header flex min-w-0 shrink-0 items-start justify-between gap-3 border-b border-[#ddb159]/14 px-4 pb-3 pt-[calc(0.9rem+env(safe-area-inset-top))]">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                {eyebrow}
              </p>
            )}
            <h2 id={titleId} className="mt-1 line-clamp-2 text-[22px] font-black leading-tight tracking-[-0.045em] text-[#faf6f0]">
              {title}
            </h2>
            {description && (
              <p className="mt-2 line-clamp-3 text-[12px] font-semibold leading-5 text-[#faf6f0]/55">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-[#ddb159]/18 bg-[#faf6f0]/[0.045] text-[20px] font-black leading-none text-[#ddb159]"
          >
            {isFull ? "←" : "×"}
          </button>
        </header>

        <div className="stockgpt-mobile-sheet-content min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4">
          {children}
        </div>

        {footer && (
          <footer className="stockgpt-mobile-sheet-footer shrink-0 border-t border-[#ddb159]/14 bg-[#07170f] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}
