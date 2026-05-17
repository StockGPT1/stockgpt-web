"use client";

import {
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ScrollMetrics = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getLegalScrollRoot() {
  return document.getElementById("legal-scroll-root") as HTMLElement | null;
}

function scrollToHash() {
  const root = getLegalScrollRoot();
  const hash = window.location.hash;

  if (!root || !hash) return;

  const target = root.querySelector(hash) as HTMLElement | null;

  if (!target) return;

  window.setTimeout(() => {
    target.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, 40);
}

export function LegalCandleScrollbar() {
  const [metrics, setMetrics] = useState<ScrollMetrics>({
    scrollTop: 0,
    scrollHeight: 1,
    clientHeight: 1,
  });

  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startScrollTop: number;
  } | null>(null);

  const updateMetrics = useCallback((root: HTMLElement) => {
    setMetrics({
      scrollTop: root.scrollTop,
      scrollHeight: root.scrollHeight,
      clientHeight: root.clientHeight,
    });
  }, []);

  useEffect(() => {
    const root = getLegalScrollRoot();

    if (!root) return;

    const update = () => {
      updateMetrics(root);
    };

    update();
    scrollToHash();

    root.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("hashchange", scrollToHash);

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(root);

    return () => {
      root.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("hashchange", scrollToHash);
      resizeObserver.disconnect();
    };
  }, [updateMetrics]);

  const geometry = useMemo(() => {
    const buttonSize = 22;
    const trackTop = buttonSize;
    const trackBottom = buttonSize;
    const trackHeight = Math.max(
      1,
      metrics.clientHeight - trackTop - trackBottom,
    );

    const maxScroll = Math.max(1, metrics.scrollHeight - metrics.clientHeight);

    const rawThumbHeight =
      (metrics.clientHeight / Math.max(metrics.scrollHeight, 1)) * trackHeight;

    const thumbHeight = clamp(rawThumbHeight, 80, trackHeight);
    const maxThumbTravel = Math.max(1, trackHeight - thumbHeight);

    const thumbTop =
      trackTop + (metrics.scrollTop / maxScroll) * maxThumbTravel;

    return {
      buttonSize,
      trackTop,
      trackHeight,
      thumbTop,
      thumbHeight,
      maxScroll,
      maxThumbTravel,
    };
  }, [metrics]);

  function scrollBy(delta: number) {
    const root = getLegalScrollRoot();

    if (!root) return;

    root.scrollBy({
      top: delta,
      behavior: "smooth",
    });
  }

  function handleTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    const root = getLegalScrollRoot();

    if (!root) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;

    if (y < geometry.thumbTop - geometry.trackTop) {
      root.scrollBy({
        top: -metrics.clientHeight * 0.85,
        behavior: "smooth",
      });
      return;
    }

    if (y > geometry.thumbTop - geometry.trackTop + geometry.thumbHeight) {
      root.scrollBy({
        top: metrics.clientHeight * 0.85,
        behavior: "smooth",
      });
    }
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    const root = getLegalScrollRoot();

    if (!root) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startScrollTop: root.scrollTop,
    };
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const root = getLegalScrollRoot();
    const drag = dragRef.current;

    if (!root || !drag || drag.pointerId !== e.pointerId) return;

    const deltaY = e.clientY - drag.startY;
    const scrollDelta =
      (deltaY / geometry.maxThumbTravel) * geometry.maxScroll;

    root.scrollTop = drag.startScrollTop + scrollDelta;
  }

  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  }

  if (metrics.scrollHeight <= metrics.clientHeight + 4) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed bottom-0 right-0 top-0 z-[90] w-[22px] select-none bg-[#04180f]"
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={() => scrollBy(-metrics.clientHeight * 0.5)}
        className="absolute left-0 top-0 grid h-[22px] w-[22px] place-items-center border-l border-[#ddb159]/20 border-r border-white/[0.04] bg-[#04180f]"
      >
        <svg viewBox="0 0 10 10" className="h-[9px] w-[9px]">
          <path d="M5 2 L9 8 H1 Z" fill="#ddb159" fillOpacity="0.78" />
        </svg>
      </button>

      <div
        onClick={handleTrackClick}
        className="absolute left-0 w-[22px] cursor-pointer border-l border-[#ddb159]/20 border-r border-white/[0.04]"
        style={{
          top: geometry.trackTop,
          height: geometry.trackHeight,
          backgroundColor: "#04180f",
          backgroundImage: `
            linear-gradient(
              to right,
              transparent 0,
              transparent calc(50% - 1px),
              rgba(221,177,89,0.16) calc(50% - 1px),
              rgba(221,177,89,0.72) 50%,
              rgba(221,177,89,0.16) calc(50% + 1px),
              transparent calc(50% + 1px),
              transparent 100%
            ),
            repeating-linear-gradient(
              to bottom,
              transparent 0,
              transparent 39px,
              rgba(221,177,89,0.075) 39px,
              rgba(221,177,89,0.075) 40px
            ),
            linear-gradient(
              to right,
              rgba(255,255,255,0.035),
              transparent 18%,
              transparent 82%,
              rgba(0,0,0,0.18)
            ),
            linear-gradient(
              to bottom,
              #061b12 0%,
              #04180f 42%,
              #021009 100%
            )
          `,
          boxShadow:
            "inset 1px 0 0 rgba(255,255,255,0.035), inset -1px 0 0 rgba(0,0,0,0.28), inset 0 0 18px rgba(0,0,0,0.28)",
        }}
      />

      <div
        role="scrollbar"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={geometry.maxScroll}
        aria-valuenow={metrics.scrollTop}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute left-[6px] w-[10px] cursor-grab rounded-[2px] active:cursor-grabbing"
        style={{
          top: geometry.thumbTop,
          height: geometry.thumbHeight,
          background:
            "linear-gradient(to right, #fff2bd 0%, #f0c867 18%, #ddb159 48%, #c9973d 72%, #8f6b27 100%)",
          boxShadow:
            "inset 0 0 0 1px rgba(7,33,22,0.52), inset 1px 0 0 rgba(255,248,218,0.62), inset -1px 0 0 rgba(30,18,2,0.35), inset 0 1px 0 rgba(255,245,215,0.55), inset 0 -1px 0 rgba(34,21,3,0.42), 0 0 12px rgba(221,177,89,0.3), 0 0 2px rgba(221,177,89,0.8)",
        }}
      />

      <button
        type="button"
        tabIndex={-1}
        onClick={() => scrollBy(metrics.clientHeight * 0.5)}
        className="absolute bottom-0 left-0 grid h-[22px] w-[22px] place-items-center border-l border-[#ddb159]/20 border-r border-white/[0.04] bg-[#04180f]"
      >
        <svg viewBox="0 0 10 10" className="h-[9px] w-[9px]">
          <path d="M5 8 L9 2 H1 Z" fill="#ddb159" fillOpacity="0.78" />
        </svg>
      </button>
    </div>
  );
}
