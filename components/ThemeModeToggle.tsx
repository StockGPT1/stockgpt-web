"use client";

import { useEffect, useState } from "react";

type ThemeMode = "dark" | "light";

const STORAGE_KEY = "stockgpt:theme-mode";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;

  root.dataset.sgTheme = mode;
  root.classList.toggle("sg-light-mode", mode === "light");

  const metaTheme = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );

  if (metaTheme) {
    metaTheme.content = mode === "light" ? "#fbfaf6" : "#072116";
  }

  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
}

export function ThemeModeToggle() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    let storedMode: ThemeMode = "dark";

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") storedMode = saved;
    } catch {}

    setMode(storedMode);
    applyTheme(storedMode);
  }, []);

  function selectMode(nextMode: ThemeMode) {
    setMode(nextMode);
    applyTheme(nextMode);
  }

  return (
    <div className="rounded-xl border border-[#072116]/10 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] font-bold">Appearance</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/50">
            Choose between the classic dark StockGPT interface and the lighter
            landing-page colour scheme.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Theme mode"
          className="grid grid-cols-2 rounded-full border border-[#072116]/10 bg-[#072116]/5 p-1"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === "dark"}
            onClick={() => selectMode("dark")}
            className={[
              "rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] transition",
              mode === "dark"
                ? "bg-[#072116] text-white shadow-[0_8px_18px_rgba(7,33,22,0.16)]"
                : "text-[#072116]/55 hover:text-[#072116]",
            ].join(" ")}
          >
            Dark
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={mode === "light"}
            onClick={() => selectMode("light")}
            className={[
              "rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] transition",
              mode === "light"
                ? "bg-[#ddb159] text-[#072116] shadow-[0_8px_18px_rgba(221,177,89,0.22)]"
                : "text-[#072116]/55 hover:text-[#072116]",
            ].join(" ")}
          >
            Light
          </button>
        </div>
      </div>
    </div>
  );
}
