"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { StockIcon, type StockIconName } from "@/components/StockIcon";
import { nativeHaptic } from "@/lib/ios-native";
import { ElasticBubble, LiquidNavigation } from "./LiquidNavigation";
import { StockGPTFlame as Flame } from "./StockGPTFlame";
import { AskDesignPreview } from "./AskDesignPreview";
import styles from "./NavigationDesignPreview.module.css";

const tabs: Array<{ key: string; label: string; icon: StockIconName }> = [
  { key: "home", label: "Home", icon: "dashboard" },
  { key: "rankings", label: "Rankings", icon: "rankings" },
  { key: "portfolio", label: "Portfolio", icon: "portfolio" },
  { key: "scanner", label: "Scanner", icon: "camera" },
];
const stocks = [
  { ticker: "NVDA", name: "NVIDIA", price: "$182.64", move: "+2.81%", score: "48,210", color: "#8bc653", initial: "N" },
  { ticker: "MSFT", name: "Microsoft", price: "$524.18", move: "+1.24%", score: "36,842", color: "#75bfff", initial: "M" },
  { ticker: "AAPL", name: "Apple", price: "$259.62", move: "−0.42%", score: "29,614", color: "#f7f3eb", initial: "a" },
  { ticker: "META", name: "Meta Platforms", price: "$724.04", move: "+1.62%", score: "28,921", color: "#82a9ff", initial: "∞" },
];
const series = Array.from({ length: 64 }, (_, i) => 10012 + i * 16 + Math.sin(i * .49) * 93 + Math.cos(i * .92) * 31 + (i > 36 ? 92 : 0));
const last = series[series.length - 1];
const money = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(value);
const menuItems: Array<{ key: string; title: string; detail: string; icon: StockIconName }> = [
  { key: "watchlist", title: "Watchlist", detail: "Your next move, on your radar", icon: "watchlist" },
  { key: "news", title: "World news", detail: "The stories behind the market", icon: "news" },
  { key: "alerts", title: "Alerts", detail: "Updates that need your attention", icon: "alerts" },
  { key: "settings", title: "Settings", detail: "Account, preferences & membership", icon: "settings" },
];

function Chevron() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>;
}

function PreviewChart({ range }: { range: string }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const activePointer = useRef<number | null>(null);
  const lastHaptic = useRef({ index: -1, time: 0 });
  const min = Math.min(...series) - 60;
  const max = Math.max(...series) + 100;
  const x = (index: number) => 8 + index / (series.length - 1) * 344;
  const y = (index: number) => 142 - (series[index] - min) / (max - min) * 116;
  const path = series.map((_, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(i).toFixed(2)}`).join(" ");
  const value = hover === null ? last : series[hover];
  const gain = value - 10000;

  function scrub(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const next = Math.max(0, Math.min(series.length - 1, Math.round(((event.clientX - bounds.left) / bounds.width * 360 - 8) / 344 * (series.length - 1))));
    setHover(next);
    if (activePointer.current !== null && next !== lastHaptic.current.index) {
      const now = performance.now();
      if (now - lastHaptic.current.time > 35) nativeHaptic("light");
      lastHaptic.current = { index: next, time: now };
    }
  }

  return <>
    <div className={styles.portfolioValue} aria-live="off">{money(value)}</div>
    <p className={styles.return}><span>↗</span> +{money(gain)} <span className={styles.returnPercent}>(+{(gain / 100).toFixed(2)}%)</span> <span className={styles.returnPeriod}>{hover === null ? range === "1D" ? "today" : "this period" : "at this point"}</span></p>
    <svg className={styles.chart} viewBox="0 0 360 164" role="img" aria-label="Illustrative portfolio value chart. Drag to explore data points." onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; activePointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); scrub(event); }} onPointerMove={event => { if (activePointer.current === event.pointerId || event.pointerType === "mouse" && activePointer.current === null) scrub(event); }} onPointerUp={event => { if (activePointer.current !== event.pointerId) return; activePointer.current = null; setHover(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { activePointer.current = null; setHover(null); }} onLostPointerCapture={() => { activePointer.current = null; setHover(null); }} onPointerLeave={() => { if (activePointer.current === null) setHover(null); }} onContextMenu={event => event.preventDefault()}>
      <defs><linearGradient id={`chart-fill-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e8c675" stopOpacity=".14" /><stop offset="1" stopColor="#e8c675" stopOpacity="0" /></linearGradient></defs>
      <path d={`${path} L352 164 L8 164Z`} fill={`url(#chart-fill-${id})`} />
      <path d={path} fill="none" stroke="#efc96c" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round" />
      {hover === null ? <circle cx={x(63)} cy={y(63)} r="3.6" fill="#ffdda0" /> : <g pointerEvents="none"><line x1={x(hover)} y1="21" x2={x(hover)} y2="157" stroke="#d8d9bd" strokeWidth=".7" strokeDasharray="2 3" opacity=".6" /><text x={Math.max(41, Math.min(319, x(hover)))} y="11" textAnchor="middle" fill="#c9d6c8" fontSize="9.5">21 Oct · {`${9 + Math.floor(hover / 8)}`.padStart(2, "0")}:{`${Math.floor(hover % 8 * 7.5)}`.padStart(2, "0")}</text><circle cx={x(hover)} cy={y(hover)} r="9" fill="#efc96c" opacity=".12" /><circle cx={x(hover)} cy={y(hover)} r="3.5" fill="#ffdda0" /></g>}
    </svg>
  </>;
}

function StockRows({ onOpen, count = 3 }: { onOpen: (ticker: string) => void; count?: number }) {
  return <div className={styles.stockRows}>{stocks.slice(0, count).map((stock, i) => <button key={stock.ticker} className={styles.stockRow} onClick={() => onOpen(stock.ticker)}>
    <span className={styles.stockRank}>{i + 1}</span><span className={styles.stockMark} style={{ color: stock.color, background: `${stock.color}13` }}>{stock.initial}</span><span className={styles.stockName}><strong>{stock.ticker}</strong><small>{stock.name}</small></span>
    <svg viewBox="0 0 64 28" className={styles.sparkline} aria-hidden="true"><path d={i === 2 ? "M1 8 8 10 14 6 21 16 28 12 35 20 43 16 50 23 58 21 63 24" : `M1 24 7 21 13 23 19 15 25 18 32 11 39 13 45 6 52 10 58 4 63 3`} fill="none" stroke={i === 2 ? "#e88f87" : "#64d4ad"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <span className={styles.stockPrice}><strong>{stock.price}</strong><small data-negative={i === 2}>{stock.move}</small></span>
  </button>)}</div>;
}

export default function NavigationDesignPreview() {
  const [activeTab, setActiveTab] = useState("home");
  const [range, setRange] = useState("1D");
  const [menuOpen, setMenuOpen] = useState(false);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const scrollRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const modalOpen = menuOpen || (overlay !== null && overlay !== "ask");

  useEffect(() => {
    if (!modalOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("button, input, textarea, a[href]")?.focus());
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") { setMenuOpen(false); setOverlay(null); }
      if (event.key !== "Tab") return;
      const elements = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea, a[href]");
      if (!elements?.length) return;
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keyboard);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", keyboard); previousFocus?.focus(); };
  }, [modalOpen, menuOpen, overlay]);

  function openOverlay(key: string) { nativeHaptic("light"); setMenuOpen(false); setOverlay(key); }
  function selectTab(key: string) { setActiveTab(key); setOverlay(null); setMenuOpen(false); scrollRef.current?.scrollTo({ top: 0, behavior: "instant" }); }

  const selectedStock = stocks.find(stock => stock.ticker === overlay);

  return <div className={styles.previewStage}>
    <aside className={styles.reviewNote}><span className={styles.previewEyebrow}>STOCKGPT / INTERACTION STUDY</span><h1>A little more<br /><em>fluid.</em></h1><p>Your familiar green and gold.<br />A new way to move around.</p><div className={styles.reviewFeatures}><span>01 <strong>Slide between tabs</strong><small>The highlight follows your finger.</small></span><span>02 <strong>Pull the bubbles</strong><small>A little stretch. A soft spring back.</small></span><span>03 <strong>Everything in reach</strong><small>Menu above. StockGPT below.</small></span></div><p className={styles.sampleNote}>Interactive design preview · Sample data<br />Live app unchanged</p></aside>

    <div className={styles.device}>
      <div className={styles.statusBar} aria-hidden="true"><span>9:41</span><div className={styles.dynamicIsland} /><span className={styles.statusIcons}><svg width="17" height="12" viewBox="0 0 17 12"><path d="M1 11V8h2v3zm4 0V6h2v5zm4 0V3h2v8zm4 0V0h2v11z" fill="currentColor" /></svg><svg width="16" height="12" viewBox="0 0 18 13" fill="none"><path d="M1 4a12 12 0 0 1 16 0M4 7a8 8 0 0 1 10 0M7 10a3 3 0 0 1 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg><span className={styles.battery} /></span></div>
      <div className={styles.app}>
        {overlay === "ask" ? <AskDesignPreview initialPrompt={prompt || undefined} onBack={() => setOverlay(null)} /> :
        <div className={styles.shellContent} inert={modalOpen}>
          <header className={styles.header}>
            <ElasticBubble className={styles.menuBubble}>
              <button ref={menuButton} className={styles.iconButton} aria-label="Open menu" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => { nativeHaptic("light"); setMenuOpen(true); }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 8h14M5 16h14" /></svg></button>
            </ElasticBubble>
            <span className={styles.headerTitle}>{tabs.find(tab => tab.key === activeTab)?.label}</span>
            <ElasticBubble className={styles.toolsBubble}><button className={styles.iconButton} aria-label="Search StockGPT" onClick={() => openOverlay("search")}><StockIcon name="search" /></button><span className={styles.toolDivider} /><button className={styles.iconButton} aria-label="Alerts, 2 unread" onClick={() => openOverlay("alerts")}><StockIcon name="alerts" /><span className={styles.notificationDot} /></button></ElasticBubble>
          </header>

          <main ref={scrollRef} className={styles.main}>
            {(activeTab === "home" || activeTab === "portfolio") && <>
              <section className={styles.greeting}><p>Good afternoon, Joe <span>✦</span></p><h2>{activeTab === "home" ? "Make today count." : "Your money, in view."}</h2><div className={styles.marketStatus}><span />US market open<span className={styles.marketSeparator}>·</span>S&amp;P 500 <strong>+0.42%</strong></div></section>
              <section className={styles.portfolio} aria-label="Portfolio overview"><div className={styles.sectionTop}><button className={styles.portfolioName} onClick={() => openOverlay("portfolios")}>My portfolio <StockIcon name="chevron-down" className="size-3" /></button><span className={styles.smallLabel}>PORTFOLIO VALUE</span></div><PreviewChart range={range} /><div className={styles.ranges} role="group" aria-label="Chart time frame">{["1D", "1W", "1M", "3M", "1Y", "ALL"].map(item => <button key={item} aria-pressed={range === item} data-active={range === item} onClick={() => { setRange(item); nativeHaptic("light"); }}>{item}</button>)}</div><div className={styles.portfolioFooter}><span><i />6 holdings<span className={styles.footerDot}>·</span>4 sectors</span><button onClick={() => activeTab === "home" ? selectTab("portfolio") : openOverlay("holdings")}>{activeTab === "home" ? "View portfolio" : "Your holdings"}<Chevron /></button></div></section>
            </>}

            {activeTab === "home" && <>
              <section className={styles.marketBrief}><div className={styles.briefIcon}><StockIcon name="news" /></div><div><span>THE DAILY BRIEF</span><p>Tech leads. Keep an eye on earnings.</p></div><button aria-label="Read the daily brief" onClick={() => openOverlay("news")}><Chevron /></button></section>
              <section className={styles.rankings}><div className={styles.sectionHeading}><div><p>ON YOUR RADAR</p><h2>Today’s leaders</h2></div><button onClick={() => selectTab("rankings")}>Rankings<Chevron /></button></div><StockRows onOpen={openOverlay} /></section>
              <button className={styles.scannerCard} onClick={() => selectTab("scanner")}><span className={styles.scanIcon}><StockIcon name="camera" className="size-6" /><i /><i /></span><span><small>A SECOND LOOK, IN SECONDS</small><strong>What’s your chart saying?</strong><span>Scan a chart. See the setup.</span></span><Chevron /></button>
              <div className={styles.exampleLabel}>Design preview · Illustrative figures</div>
            </>}

            {activeTab === "rankings" && <section className={styles.tabContent}><p className={styles.eyebrow}>THE BIGGER PICTURE</p><h2>Find your next<br />watchlist favourite.</h2><p className={styles.muted}>Company fundamentals, momentum and risk, together in one view.</p><div className={styles.statStrip}><div><strong>503</strong><span>Stocks ranked</span></div><div><strong>21</strong><span>Model factors</span></div><div><strong>95.2%</strong><span>Data coverage</span></div></div><div className={styles.sectionHeading}><h3>Top ranked</h3><span className={styles.smallLabel}>SAMPLE ORDER</span></div><StockRows onOpen={openOverlay} count={4} /><p className={styles.exampleLabel}>Sample figures for this design preview</p></section>}

            {activeTab === "portfolio" && <section className={styles.rankings}><div className={styles.sectionHeading}><h2>Your holdings</h2><span className={styles.smallLabel}>SAMPLE POSITIONS</span></div><StockRows onOpen={openOverlay} count={4} /><p className={styles.exampleLabel}>Sample portfolio · No connected accounts</p></section>}

            {activeTab === "scanner" && <section className={`${styles.tabContent} ${styles.scannerView}`}><div className={styles.scannerHalo}><StockIcon name="camera" className="size-12" /></div><p className={styles.eyebrow}>YOUR CHART. A CLEARER VIEW.</p><h2>Spot the setup.</h2><p className={styles.muted}>Bring your chart. Get a breakdown of the trend, patterns and possible trade levels.</p><div className={styles.scanStats}><span><strong>50+</strong>Candle patterns</span><span><strong>100+</strong>Candle lookback</span></div><button className={styles.goldButton} onClick={() => fileInput.current?.click()}><StockIcon name="camera" />Take a photo</button><button className={styles.greenButton} onClick={() => fileInput.current?.click()}><StockIcon name="expand" />Scan my screenshot</button><input ref={fileInput} type="file" accept="image/*" className={styles.hidden} onChange={event => setSelectedFile(event.target.files?.[0]?.name ?? "")} /><p className={styles.exampleLabel}>{selectedFile ? `${selectedFile} selected. Analysis is available in the live scanner.` : "Design preview · Scans are not sent for analysis"}</p></section>}
          </main>

          <footer className={styles.bottomArea}>
            <ElasticBubble className={styles.askBubble}><button aria-label="Ask StockGPT" className={styles.askButton} onClick={() => { setPrompt(""); openOverlay("ask"); }}><span className={styles.askEmber} aria-hidden="true" /><Flame className={styles.brandFlame} /></button></ElasticBubble>
            <LiquidNavigation items={tabs.map(tab => ({ ...tab, icon: <StockIcon name={tab.icon} className="size-5" /> }))} activeKey={activeTab} onSelect={selectTab} />
          </footer>
        </div>}

        {modalOpen && <div className={styles.modalLayer}>
          <div className={styles.scrim} onPointerDown={() => { setMenuOpen(false); setOverlay(null); }} aria-hidden="true" />
          {menuOpen ? <aside ref={dialogRef} className={styles.drawer} role="dialog" aria-modal="true" aria-label="StockGPT menu"><div className={styles.drawerTop}><Image src="/logo.png" width={155} height={45} alt="StockGPT" /><ElasticBubble className={styles.closeBubble}><button className={styles.iconButton} aria-label="Close menu" onClick={() => setMenuOpen(false)}><StockIcon name="close" /></button></ElasticBubble></div><div className={styles.accountCard}><span>JF</span><div><strong>Joe Fisher</strong><small>Your research, all in one place.</small></div></div><p className={styles.menuLabel}>YOUR STOCKGPT</p><nav aria-label="More StockGPT sections">{menuItems.map(item => <button key={item.key} className={styles.menuItem} onClick={() => openOverlay(item.key)}><StockIcon name={item.icon} /><span><strong>{item.title}</strong><small>{item.detail}</small></span>{item.key === "alerts" ? <i className={styles.menuCount}>2</i> : <Chevron />}</button>)}</nav><div className={styles.drawerBottom}><div className={styles.drawerFlame}><Flame /></div><p>A little clarity.<br /><strong>A lot more possibility.</strong></p><span>Design preview · Sample account</span></div></aside> : <section ref={dialogRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label={overlay === "search" ? "Search stocks" : selectedStock ? `${selectedStock.ticker} preview` : menuItems.find(item => item.key === overlay)?.title ?? "Portfolio preview"}>
            <div className={styles.sheetTop}><span className={styles.sheetHandle} /><ElasticBubble className={styles.closeBubble}><button className={styles.iconButton} aria-label="Close panel" onClick={() => setOverlay(null)}><StockIcon name="close" /></button></ElasticBubble></div>
            {overlay === "search" ? <><p className={styles.eyebrow}>FIND YOUR NEXT QUESTION</p><h2>What’s on your radar?</h2><label className={styles.searchInput}><StockIcon name="search" /><input autoComplete="off" aria-label="Search stocks" placeholder="Ticker or company" value={search} onChange={event => setSearch(event.target.value)} /></label><p className={styles.menuLabel}>{search ? "MATCHING SAMPLE STOCKS" : "QUICK PICKS"}</p>{stocks.filter(stock => `${stock.ticker} ${stock.name}`.toLowerCase().includes(search.toLowerCase())).map(stock => <button key={stock.ticker} className={styles.searchResult} onClick={() => openOverlay(stock.ticker)}><span className={styles.stockMark} style={{ color: stock.color }}>{stock.initial}</span><span><strong>{stock.ticker}</strong><small>{stock.name}</small></span><Chevron /></button>)}{!stocks.some(stock => `${stock.ticker} ${stock.name}`.toLowerCase().includes(search.toLowerCase())) && <p className={styles.muted}>No match in the preview’s four sample stocks.</p>}</> : overlay === "alerts" ? <><p className={styles.eyebrow}>JUST THE IMPORTANT THINGS</p><h2>Your alerts.</h2><p className={styles.muted}>Updates you can act on, together in one place.</p><article className={styles.alertItem}><StockIcon name="alerts" /><div><strong>NVDA reached your price alert</strong><p>Your sample $180 target has been crossed.</p><span>Price alert · 12m ago</span></div></article><article className={styles.alertItem}><StockIcon name="portfolio" /><div><strong>Technology exceeds your limit</strong><p>It’s 42% of this sample portfolio. Your limit is 40%.</p><span>Allocation alert · 35m ago</span></div></article><p className={styles.exampleLabel}>Illustrative alerts · No account changes</p></> : selectedStock ? <><p className={styles.eyebrow}>{selectedStock.ticker} · STOCK PREVIEW</p><h2>{selectedStock.name}</h2><div className={styles.stockDetailPrice}>{selectedStock.price}</div><p className={styles.return}>{selectedStock.move} today</p><div className={styles.detailScore}><span>StockGPT score</span><strong>{selectedStock.score}</strong></div><p className={styles.muted}>In the live app, this opens the stock’s full chart, financials and ranking breakdown.</p><button className={styles.goldButton} onClick={() => { setPrompt(`Explain ${selectedStock.ticker}’s ranking`); setOverlay("ask"); }}>Ask about {selectedStock.ticker}<StockIcon name="ask" /></button></> : overlay === "watchlist" || overlay === "holdings" ? <><p className={styles.eyebrow}>YOUR RESEARCH, TOGETHER</p><h2>{overlay === "holdings" ? "Your holdings." : "Your watchlist."}</h2><StockRows onOpen={openOverlay} count={4} /><p className={styles.exampleLabel}>Sample stocks for the design preview</p></> : overlay === "news" ? <><p className={styles.eyebrow}>THE DAILY BRIEF</p><h2>Behind the moves.</h2><article className={styles.newsArticle}><span>MARKET OVERVIEW · SAMPLE STORY</span><h3>Tech leads as investors look ahead to earnings.</h3><p>Technology shares are leading this illustrative session. Upcoming company results could give investors a clearer view of growth and spending.</p><p>Watch reported earnings and guidance alongside price moves to understand what is changing.</p></article></> : overlay === "settings" ? <><p className={styles.eyebrow}>MAKE IT YOURS</p><h2>Settings.</h2>{["Account & security", "Notifications", "Appearance", "Membership"].map(label => <button key={label} className={styles.settingsRow} onClick={() => setOverlay(`settings:${label}`)}>{label}<Chevron /></button>)}<p className={styles.exampleLabel}>Design preview · Settings are not saved</p></> : overlay?.startsWith("settings:") ? <><p className={styles.eyebrow}>SETTINGS PREVIEW</p><h2>{overlay.slice(9)}</h2><p className={styles.muted}>Your existing settings will be accessible here. This preview only demonstrates the new navigation.</p><button className={styles.greenButton} onClick={() => setOverlay("settings")}>Back to settings</button></> : <><p className={styles.eyebrow}>YOUR PORTFOLIOS</p><h2>A place for every plan.</h2>{["My portfolio", "Long-term investing"].map(name => <button key={name} className={styles.settingsRow} onClick={() => setOverlay(null)}>{name}<StockIcon name="check" /></button>)}</>}
          </section>}
        </div>}
      </div>
      <div className={styles.homeIndicator} aria-hidden="true" />
    </div>
  </div>;
}
