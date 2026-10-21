"use client";

import { useEffect, useState } from "react";
import { AppBootProvider } from "@/components/AppBootProvider";
import { AppChromeProvider } from "@/components/AppChromeProvider";
import { AskStockGPTWorkspace } from "@/components/AskStockGPTWorkspace";
import { GlobalSearchOverlay } from "@/components/GlobalSearchOverlay";
import { NativePageRegistration } from "@/components/NativePageRegistration";
import { StockChart, type ChartPoint } from "@/components/StockChart";
import { NativeAppHeader, NativeBottomNavigation } from "@/components/native-navigation/NativeNavigation";

const closes = [10540, 10590, 10565, 10635, 10618, 10710, 10680, 10762, 10744, 10810, 10782, 10875, 10852, 10912, 10890, 10955, 10930, 11029];
const points: ChartPoint[] = closes.map((close, index) => ({
  date: new Date(Date.UTC(2026, 9, 21, 13, 30 + index * 10)).toISOString(),
  close,
}));

export default function NativeAppReviewPreview() {
  const [showAsk, setShowAsk] = useState(false);
  useEffect(() => {
    const previous = document.documentElement.getAttribute("data-app-shell");
    document.documentElement.setAttribute("data-app-shell", "true");
    return () => {
      if (previous === null) document.documentElement.removeAttribute("data-app-shell");
      else document.documentElement.setAttribute("data-app-shell", previous);
    };
  }, []);

  return (
    <AppBootProvider nativeApp>
      <AppChromeProvider>
        {showAsk ? <>
          {/* Local visual fixture only. Real API authentication remains required. */}
          <AskStockGPTWorkspace isAuthenticated={false} canUseAskStockGPT />
          <button type="button" onClick={() => setShowAsk(false)} className="fixed bottom-5 right-5 z-[100] rounded-full border border-[#edc772]/40 bg-[#0b2d1f] px-4 py-3 text-xs text-[#edc772]">Back to preview</button>
        </> : <div className="sg-app-shell flex h-[100dvh] flex-col overflow-hidden text-[#faf7ee]">
          <NativeAppHeader title="Home" unreadCount={2} />
          <main className="sg-app-content relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <NativePageRegistration context={{ contextType: "dashboard" }}>
              <div className="sg-route-content mx-auto max-w-xl px-2 pb-6">
                <section className="px-2 pt-2">
                  <p className="text-[11px] text-[#acbda2]">Wednesday, 21 October</p>
                  <h1 className="mt-2 text-[29px] font-medium tracking-[-.045em]">Good afternoon, Joe</h1>
                  <p className="mt-2 text-xs leading-5 text-[#b5c5aa]">A little clarity on your day in the market.</p>
                </section>
                <section className="mt-8 px-2">
                  <p className="text-xs text-[#acbda2]">Your portfolio · illustrative preview</p>
                  <p className="mt-2 text-[42px] font-semibold leading-tight tracking-[-.055em]">$11,029.00</p>
                  <p className="mt-2 text-sm font-medium text-[#7ad8ad]">+$489.00 · +4.64% today</p>
                  <div className="mt-5">
                    <StockChart ticker="Portfolio" data={{ "1D": points, "1M": points }} initialRange="1D" rangeOrder={["1D", "1M"]} height={180} compact appearance="portfolio" interaction="stock" showScrubDate color="#edc772" />
                  </div>
                </section>
                <section className="mt-7 border-t border-[#d3dec6]/10 px-2 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[17px] font-medium">On your radar</h2>
                    <span className="text-[10px] text-[#adbd9f]">Illustrative data</span>
                  </div>
                  {[{ ticker: "AAPL", name: "Apple", change: "+0.57%" }, { ticker: "NVDA", name: "NVIDIA", change: "+1.68%" }].map(stock => <div key={stock.ticker} className="flex items-center gap-3 border-b border-[#d3dec6]/[.07] py-4"><span className="grid size-9 place-items-center rounded-full bg-[#e7edce]/[.06] text-[9px] text-[#e3d7a9]">{stock.ticker}</span><span className="flex-1"><strong className="block text-xs font-medium">{stock.name}</strong><small className="mt-1 block text-[10px] text-[#a5b69b]">{stock.ticker}</small></span><span className="text-xs text-[#7ad8ad]">{stock.change}</span></div>)}
                  <button type="button" onClick={() => setShowAsk(true)} className="mt-6 rounded-full border border-[#edc772]/25 bg-[#edc772]/[.04] px-4 py-3 text-xs text-[#e9d493]">Review real Ask StockGPT screen</button>
                  <p className="mt-3 text-[10px] leading-5 text-[#9cae93]">Development fixture. Illustrative data; real pages and chat APIs still require your account.</p>
                </section>
              </div>
            </NativePageRegistration>
          </main>
          <GlobalSearchOverlay showRankingData={false} />
          <NativeBottomNavigation unreadCount={2} askHref="/ask-stockgpt" />
        </div>}
      </AppChromeProvider>
    </AppBootProvider>
  );
}
