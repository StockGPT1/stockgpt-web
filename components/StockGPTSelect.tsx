"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
  description?: string;
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
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  );

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={[
        "relative min-w-0",
        open ? "z-[120]" : "z-20",
        className,
      ].join(" ")}
    >
      <button
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

      {open && (
        <div
          role="listbox"
          className={[
            "absolute left-0 right-0 top-[calc(100%+8px)] z-[130] max-h-72 min-w-full overflow-y-auto rounded-2xl border border-[#ddb159]/32 bg-[#04180f] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.48)] ring-1 ring-black/15",
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
        </div>
      )}
    </div>
  );
}
