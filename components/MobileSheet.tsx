"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useFocusedFlow } from "@/components/AppChromeProvider";

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
  const generatedId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const flowId = `mobile-sheet-${generatedId}`;
  const titleId =
    labelledById ?? `${flowId}-title`;

  useFocusedFlow(flowId, open);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const backgroundNodes = Array.from(document.body.children).filter(
      (node) => !node.classList.contains("stockgpt-mobile-sheet-root"),
    ) as HTMLElement[];
    const inertState = backgroundNodes.map((node) => ({
      node,
      inert: node.inert,
      ariaHidden: node.getAttribute("aria-hidden"),
    }));

    backgroundNodes.forEach((node) => {
      node.inert = true;
      node.setAttribute("aria-hidden", "true");
    });

    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((node) => node.offsetParent !== null);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const nodes = focusable();
      if (nodes.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => {
      const preferred = dialog?.querySelector<HTMLElement>("[data-sheet-initial-focus]");
      (preferred ?? focusable()[0] ?? dialog)?.focus({ preventScroll: true });
    }, 0);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
      inertState.forEach(({ node, inert, ariaHidden }) => {
        node.inert = inert;
        if (ariaHidden === null) node.removeAttribute("aria-hidden");
        else node.setAttribute("aria-hidden", ariaHidden);
      });
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const isFull = variant === "full";
  const isConfirm = variant === "confirm";

  const sheetClass = isFull
    ? "h-[100dvh] max-h-[100dvh] rounded-none border-0 bg-[#07170f]"
    : isConfirm
      ? "max-h-[72dvh] rounded-t-[28px] border border-b-0 border-[#ddb159]/24 bg-[#07170f]"
      : "max-h-[82dvh] rounded-t-[28px] border border-b-0 border-[#ddb159]/24 bg-[#07170f]";

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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[
          "stockgpt-mobile-sheet relative z-10 ml-auto mt-auto grid w-full max-w-full min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden shadow-[0_-24px_80px_rgba(0,0,0,0.62)]",
          sheetClass,
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
            aria-label={isFull ? "Back" : "Close"}
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-[#ddb159]/18 bg-[#faf6f0]/[0.045] text-[20px] font-black leading-none text-[#ddb159]"
          >
            {isFull ? <span aria-hidden="true">&larr;</span> : <span aria-hidden="true">&times;</span>}
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
