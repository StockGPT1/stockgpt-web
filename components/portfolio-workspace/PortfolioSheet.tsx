"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { PortfolioIcon } from "@/components/portfolio-workspace/PortfolioIcon";

const FOCUSABLE =
  'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function PortfolioSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  closeConfirmation,
  widthClass = "lg:max-w-[480px]",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  closeConfirmation?: string | null;
  widthClass?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const subtitleId = useId();

  const requestClose = useCallback(() => {
    if (closeConfirmation && !window.confirm(closeConfirmation)) return;
    onClose();
  }, [closeConfirmation, onClose]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const focusable = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (node) => node.offsetParent !== null,
      );

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => focusable()[0]?.focus({ preventScroll: true }), 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, requestClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-[2px] lg:items-stretch lg:justify-end">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={requestClose}
        className="absolute inset-0 cursor-default"
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        className={`relative z-[101] flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-[#ddb159]/18 bg-[#061b12] shadow-[0_-22px_56px_rgba(0,0,0,0.44)] lg:h-full lg:max-h-none ${widthClass} lg:rounded-none lg:border-y-0 lg:border-r-0`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[#faf6f0]/16 lg:hidden" />
        <header className="flex min-h-[76px] shrink-0 items-center justify-between gap-4 border-b border-[#faf6f0]/8 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="truncate text-[20px] font-black tracking-[-0.03em] text-[#faf6f0]"
            >
              {title}
            </h2>
            {subtitle && (
              <p
                id={subtitleId}
                className="mt-1 truncate text-[11px] font-semibold text-[#faf6f0]/45"
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-[#ddb159]/20 text-[#faf6f0] transition hover:bg-[#faf6f0]/6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
          >
            <PortfolioIcon name="close" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(28px+env(safe-area-inset-bottom))] pt-5 sm:px-6">
          {children}
        </div>
      </section>
    </div>,
    document.body,
  );
}
