"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Option = {
  value: string;
  label: string;
  description?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type Props = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
};

export function StockGPTSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  buttonClassName = "",
  menuClassName = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  );

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const gap = 8;
    const preferredHeight = Math.min(288, Math.max(180, viewportHeight - 32));
    const roomBelow = viewportHeight - rect.bottom - gap - 12;
    const roomAbove = rect.top - gap - 12;
    const openUp = roomBelow < 180 && roomAbove > roomBelow;
    const maxHeight = Math.max(150, Math.min(preferredHeight, openUp ? roomAbove : roomBelow));
    const menuWidth = Math.min(Math.max(rect.width, 240), viewportWidth - 24);
    const left = Math.min(Math.max(12, rect.left), viewportWidth - menuWidth - 12);
    const top = openUp
      ? Math.max(12, rect.top - maxHeight - gap)
      : Math.min(rect.bottom + gap, viewportHeight - maxHeight - 12);

    setPosition({ top, left, width: menuWidth, maxHeight });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !wrapRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function handleReposition() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, updatePosition]);

  const menu =
    open && mounted && position
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            className={[
              "z-[9999] overflow-y-auto rounded-2xl border border-[#ddb159]/32 bg-[#04180f] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.52)] ring-1 ring-black/15",
              menuClassName,
            ].join(" ")}
          >
            {options.map((option) => {
              const active = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={[
                    "grid w-full min-w-0 gap-0.5 rounded-xl px-3 py-2.5 text-left transition",
                    active
                      ? "bg-[#ddb159] text-[#072116]"
                      : "text-[#faf6f0] hover:bg-[#ddb159]/10 hover:text-[#ddb159]",
                  ].join(" ")}
                >
                  <span className="truncate text-[11px] font-black uppercase tracking-[0.08em] sm:text-[12px]">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span
                      className={[
                        "truncate text-[8.5px] font-bold uppercase tracking-[0.06em] sm:text-[9px]",
                        active ? "text-[#072116]/58" : "text-[#faf6f0]/42",
                      ].join(" ")}
                    >
                      {option.description}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapRef} className={`relative min-w-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={[
          "group flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-full border border-[#ddb159]/35 bg-[#04180f] px-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition hover:border-[#ddb159]/65 focus:border-[#ddb159] focus:ring-2 focus:ring-[#ddb159]/18",
          buttonClassName,
        ].join(" ")}
      >
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="block truncate text-[11px] font-black uppercase tracking-[0.08em] text-[#faf6f0] sm:text-[12px]">
            {selected?.label ?? "Select"}
          </span>
          {selected?.description ? (
            <span className="mt-0.5 block truncate text-[8.5px] font-bold uppercase tracking-[0.06em] text-[#ddb159]/72 sm:text-[9px]">
              {selected.description}
            </span>
          ) : null}
        </span>

        <span
          className={[
            "grid size-7 shrink-0 place-items-center rounded-full border border-[#ddb159]/22 bg-[#072116] text-[13px] font-black text-[#ddb159] transition",
            open ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      {menu}
    </div>
  );
}
