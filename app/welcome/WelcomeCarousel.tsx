"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./welcome.module.css";

const slides = [
  { id: "rankings", eyebrow: "Daily rankings", title: "See the market\nwith a clear signal.", body: "500+ US stocks scored and ranked every day, so the strongest ideas rise to the top." },
  { id: "portfolio", eyebrow: "Portfolio intelligence", title: "Know what your\nportfolio is doing.", body: "Track performance, concentration and changing rank strength without digging through spreadsheets." },
  { id: "ask", eyebrow: "Ask StockGPT", title: "Ask the question.\nGet the context.", body: "Talk to StockGPT about a stock or your portfolio and get answers grounded in live rankings and your data." },
  { id: "alerts", eyebrow: "Smart alerts", title: "The important moves\nfind you.", body: "Get notified when rankings, portfolio signals or market events deserve your attention." },
] as const;

function RankingsDemo() {
  return (
    <div className={styles.stage} aria-hidden="true">
      <div className={styles.stageTop}><span>StockGPT Rankings</span><span className={styles.live}><i />Live</span></div>
      <div className={styles.rankList}>
        {[
          ["01","NVDA","9,214","+4"],
          ["02","ANET","8,858","+3"],
          ["03","META","8,742","—"],
        ].map((row, i) => (
          <div key={row[1]} className={styles.rankCard} data-row={i + 1}>
            <span>{row[0]}</span><strong>{row[1]}</strong><em>{row[2]}</em><b>{row[3]}</b>
          </div>
        ))}
      </div>
      <div className={styles.scan} />
    </div>
  );
}

function PortfolioDemo() {
  return (
    <div className={styles.stage} aria-hidden="true">
      <div className={styles.stageTop}><span>My Portfolio</span><strong>£24,860</strong></div>
      <div className={styles.chartMeta}><span>Total return</span><strong>+18.4%</strong><b>+£3,862</b></div>
      <svg className={styles.chart} viewBox="0 0 320 140" preserveAspectRatio="none">
        <path className={styles.area} d="M0 116 C28 108 44 92 69 97 C95 101 111 69 135 76 C162 83 178 48 205 57 C230 65 248 33 271 40 C291 45 303 21 320 17 L320 140 L0 140Z"/>
        <path className={styles.line} pathLength="1" d="M0 116 C28 108 44 92 69 97 C95 101 111 69 135 76 C162 83 178 48 205 57 C230 65 248 33 271 40 C291 45 303 21 320 17"/>
      </svg>
      <div className={styles.pills}><span>NVDA 32%</span><span>ANET 24%</span><span>META 18%</span></div>
    </div>
  );
}

function AskDemo() {
  return (
    <div className={styles.stage} aria-hidden="true">
      <div className={styles.stageTop}><span>Ask StockGPT</span><span className={styles.ai}>AI analyst</span></div>
      <div className={styles.chat}>
        <div className={styles.userBubble}>Which holding looks weakest right now?</div>
        <div className={styles.aiBubble}>
          <div><strong>StockGPT</strong><i/><i/><i/></div>
          <p>Among your current holdings, the one to review first is…</p>
          <span/><span/><span/>
        </div>
      </div>
      <div className={styles.context}>Portfolio <i/> Rankings <i/> News</div>
    </div>
  );
}

function AlertsDemo() {
  return (
    <div className={styles.stage} aria-hidden="true">
      <div className={styles.stageTop}><span>Signal Centre</span><span className={styles.alertCount}>3 new</span></div>
      <div className={styles.alerts}>
        <div><b>↗</b><span><strong>Rank breakout</strong><small>ANET moved into the Top 5</small></span><time>Now</time></div>
        <div><b>✓</b><span><strong>Portfolio signal</strong><small>Quality strengthened across 3 holdings</small></span><time>2m</time></div>
        <div><b>●</b><span><strong>Market move</strong><small>Momentum changed in your watchlist</small></span><time>8m</time></div>
      </div>
    </div>
  );
}

function Demo({ id }: { id: (typeof slides)[number]["id"] }) {
  if (id === "rankings") return <RankingsDemo />;
  if (id === "portfolio") return <PortfolioDemo />;
  if (id === "ask") return <AskDemo />;
  return <AlertsDemo />;
}

export function WelcomeCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);

  const syncActive = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const slideElements = Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-welcome-slide]"),
    );
    if (slideElements.length === 0) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const viewportCenter = scrollerRect.left + scrollerRect.width / 2;

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    slideElements.forEach((slide, index) => {
      const rect = slide.getBoundingClientRect();
      const slideCenter = rect.left + rect.width / 2;
      const distance = Math.abs(slideCenter - viewportCenter);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    setActive(nearestIndex);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    function scheduleSync() {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(syncActive);
    }

    // Use native scroll listeners as well as React state so iOS WKWebView
    // updates the indicator continuously during momentum/snap scrolling.
    scroller.addEventListener("scroll", scheduleSync, { passive: true });
    scroller.addEventListener("scrollend", scheduleSync);
    window.addEventListener("resize", scheduleSync);

    const slideElements = Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-welcome-slide]"),
    );
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              const mostVisible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

              if (!mostVisible || mostVisible.intersectionRatio < 0.5) return;

              const index = Number(
                (mostVisible.target as HTMLElement).dataset.welcomeSlide,
              );
              if (Number.isInteger(index)) setActive(index);
            },
            {
              root: scroller,
              threshold: [0.5, 0.65, 0.8, 0.95],
            },
          );

    slideElements.forEach((slide) => observer?.observe(slide));
    scheduleSync();

    return () => {
      scroller.removeEventListener("scroll", scheduleSync);
      scroller.removeEventListener("scrollend", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      observer?.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [syncActive]);

  function goTo(index: number) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * index, behavior: "smooth" });
  }

  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.brand}><img src="/icon.png" alt="" width={34} height={34}/><span>StockGPT</span></div>
        <span className={styles.hint}>Swipe to explore <b>›</b></span>
      </header>

      <div ref={scrollerRef} className={styles.scroller} aria-label="StockGPT feature tour">
        {slides.map((slide, index) => (
          <section key={slide.id} data-welcome-slide={index} className={styles.slide} aria-label={String(index + 1) + " of " + String(slides.length) + ": " + slide.eyebrow}>
            <div className={[styles.demoWrap, active === index ? styles.active : ""].join(" ")}><Demo id={slide.id}/></div>
            <div className={styles.copy}>
              <p className={styles.eyebrow}>{slide.eyebrow}</p>
              <h1>{slide.title.split("\n").map(line => <span key={line}>{line}</span>)}</h1>
              <p className={styles.body}>{slide.body}</p>
            </div>
          </section>
        ))}
      </div>

      <nav className={styles.dots} aria-label="Choose feature slide">
        {slides.map((slide, index) => (
          <button key={slide.id} type="button" aria-label={"Show " + slide.eyebrow} aria-current={active === index ? "true" : undefined}
            className={active === index ? styles.dotActive : styles.dot} onClick={() => goTo(index)} />
        ))}
      </nav>

      <div className={styles.actions}>
        <div>
          <Link href="/signup" className={styles.signup} data-native-haptic="medium">Create account</Link>
          <Link href="/login?faceid=1" className={styles.login} data-native-haptic="light">Log in</Link>
          <p>Research tools and market intelligence. Investing involves risk.</p>
        </div>
      </div>
    </main>
  );
}
