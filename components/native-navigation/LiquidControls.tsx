"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode, type RefObject } from "react";
import { nativeHaptic } from "@/lib/ios-native";
import styles from "./LiquidControls.module.css";

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

type Deformation = { a: number; b: number; c: number; d: number; x: number; y: number };
const identity = (): Deformation => ({ a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 });
const axes: (keyof Deformation)[] = ["a", "b", "c", "d", "x", "y"];

function deformation(x: number, y: number, navigation = false): Deformation {
  const distance = Math.hypot(x, y);
  if (distance < 0.001) return identity();
  const strength = Math.tanh(distance / 90);
  const cosine = x / distance;
  const sine = y / distance;
  const along = 1 + strength * (navigation ? 0.02 : 0.035);
  const across = 1 - strength * (navigation ? 0.008 : 0.014);
  const travel = navigation ? 2.5 : 4;
  // R(theta) * scale(along, across) * R(-theta): diagonal drags produce
  // genuine diagonal deformation, with no discontinuity at angle wraparound.
  return {
    a: along * cosine * cosine + across * sine * sine,
    b: (along - across) * cosine * sine,
    c: (along - across) * cosine * sine,
    d: along * sine * sine + across * cosine * cosine,
    x: cosine * strength * travel,
    y: sine * strength * travel,
  };
}

function writeDeformation(element: HTMLElement, current: Deformation) {
  element.style.setProperty("--bubble-transform", `matrix(${current.a},${current.b},${current.c},${current.d},${current.x},${current.y})`);
  element.style.setProperty("--pull-x", `${current.x}px`);
  element.style.setProperty("--pull-y", `${current.y}px`);
}

function useLiquidMotion(element: RefObject<HTMLElement | null>, navigation = false) {
  const motion = useRef({
    current: identity(), target: identity(),
    velocity: { a: 0, b: 0, c: 0, d: 0, x: 0, y: 0 } as Deformation,
    frame: 0, lastTime: 0, dragging: false, reduced: false,
    listener: null as ((time: number) => void) | null,
  });

  useEffect(() => {
    const state = motion.current;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const preference = () => {
      state.reduced = media.matches;
      if (!state.reduced) return;
      cancelAnimationFrame(state.frame);
      state.frame = 0;
      state.lastTime = 0;
      state.current = identity();
      state.target = identity();
      axes.forEach((axis) => { state.velocity[axis] = 0; });
      if (element.current) writeDeformation(element.current, state.current);
    };
    preference();
    media.addEventListener("change", preference);
    return () => {
      cancelAnimationFrame(state.frame);
      state.frame = 0;
      state.lastTime = 0;
      state.listener = null;
      media.removeEventListener("change", preference);
    };
  }, [element]);

  function animate(time: number) {
    const state = motion.current;
    const elapsed = state.lastTime ? clamp((time - state.lastTime) / 1000, 1 / 240, 0.032) : 1 / 60;
    state.lastTime = time;
    let moving = false;
    // Smaller integration steps keep the same soft spring stable on 60/120 Hz
    // screens and after an occasional dropped frame.
    const steps = Math.ceil(elapsed / (1 / 240));
    const delta = elapsed / steps;
    const stiffness = state.dragging ? 700 : 280;
    const damping = state.dragging ? 45 : 25;
    for (let step = 0; step < steps; step += 1) {
      for (const axis of axes) {
        state.velocity[axis] += ((state.target[axis] - state.current[axis]) * stiffness - state.velocity[axis] * damping) * delta;
        state.current[axis] += state.velocity[axis] * delta;
      }
    }
    for (const axis of axes) {
      const tolerance = axis === "x" || axis === "y" ? 0.008 : 0.00004;
      if (Math.abs(state.target[axis] - state.current[axis]) > tolerance || Math.abs(state.velocity[axis]) > tolerance * 10) moving = true;
    }
    if (!moving) {
      state.current = { ...state.target };
      axes.forEach((axis) => { state.velocity[axis] = 0; });
    }
    if (element.current) writeDeformation(element.current, state.current);
    state.listener?.(time);
    state.frame = moving ? requestAnimationFrame(animate) : 0;
    if (!moving) state.lastTime = 0;
  }

  function target(x: number, y: number, dragging: boolean) {
    const state = motion.current;
    state.dragging = dragging;
    state.target = state.reduced ? identity() : deformation(x, y, navigation);
    if (element.current) element.current.dataset.dragging = dragging ? "true" : "false";
    if (!state.frame) state.frame = requestAnimationFrame(animate);
  }

  return {
    move: (x: number, y: number) => target(x, y, true),
    reset: () => target(0, 0, false),
    matrix: () => motion.current.current,
    onFrame: (listener: ((time: number) => void) | null) => { motion.current.listener = listener; },
  };
}

type BubbleGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  capture: HTMLElement;
};

/** Bubble wrapper: surface and contents share one smooth deformation. */
export function ElasticBubble({ children, className = "", label }: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const motion = useLiquidMotion(element);
  const gesture = useRef<BubbleGesture | null>(null);
  const suppressClickUntil = useRef(0);

  function finish(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (current.moved || cancelled) suppressClickUntil.current = event.timeStamp + 450;
    motion.reset();
    if (current.capture.hasPointerCapture(event.pointerId)) current.capture.releasePointerCapture(event.pointerId);
  }

  return (
    <div
      ref={element}
      className={`${styles.scope} sg-liquid-bubble ${className}`.trim()}
      aria-label={label}
      role={label ? "group" : undefined}
      style={{ touchAction: "none" }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0 || gesture.current) return;
        suppressClickUntil.current = 0;
        const target = event.target instanceof Element ? event.target.closest("button, a, [role='button']") : null;
        const capture = target instanceof HTMLElement ? target : event.currentTarget;
        gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, capture };
        motion.move(0, 0);
        capture.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const x = event.clientX - current.startX;
        const y = event.clientY - current.startY;
        if (Math.hypot(x, y) > 7) current.moved = true;
        motion.move(x, y);
      }}
      onPointerUp={(event) => finish(event)}
      onPointerCancel={(event) => finish(event, true)}
      onLostPointerCapture={(event) => finish(event, true)}
      onClickCapture={(event) => {
        if (event.detail !== 0 && event.timeStamp < suppressClickUntil.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <span className="sg-liquid-surface" aria-hidden="true" />
      <div className="sg-liquid-content">{children}</div>
    </div>
  );
}

export type LiquidNavigationItem = { key: string; label: string; icon: ReactNode };

type NavigationGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  candidate: number;
  clientX: number;
  clientY: number;
  geometry: NavigationGeometry;
};

type NavigationGeometry = {
  left: number; top: number; width: number; height: number;
  tabs: { left: number; width: number; center: number }[];
};

function localPointer(clientX: number, clientY: number, geometry: NavigationGeometry, matrix: Deformation) {
  const x = clientX - geometry.left - geometry.width / 2 - matrix.x;
  const y = clientY - geometry.top - geometry.height / 2 - matrix.y;
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  return {
    x: (matrix.d * x - matrix.c * y) / determinant + geometry.width / 2,
    y: (-matrix.b * x + matrix.a * y) / determinant + geometry.height / 2,
  };
}

function nearestTab(x: number, geometry: NavigationGeometry) {
  let index = 0;
  let distance = Infinity;
  geometry.tabs.forEach((tab, candidate) => {
    const next = Math.abs(x - tab.center);
    if (next < distance) { distance = next; index = candidate; }
  });
  return index;
}

/** Primary app destinations; dragging previews, release commits. */
export function LiquidNavigation({ items, activeKey, onSelect }: {
  items: LiquidNavigationItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const nav = useRef<HTMLElement>(null);
  const motion = useLiquidMotion(nav, true);
  const track = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const gesture = useRef<NavigationGesture | null>(null);
  const suppressClickUntil = useRef(0);
  const haptic = useRef({ index: -1, at: -Infinity });
  const activeIndex = items.findIndex((item) => item.key === activeKey);

  function measure(): NavigationGeometry | null {
    const container = nav.current;
    const row = track.current;
    if (!container || !row) return null;
    const bounds = container.getBoundingClientRect();
    // Layout offsets ignore the animated CSS transform. Read once per gesture,
    // never once per pointer sample or animation frame.
    return {
      left: bounds.left + container.clientLeft + row.offsetLeft,
      top: bounds.top + container.clientTop + row.offsetTop,
      width: row.offsetWidth, height: row.offsetHeight,
      tabs: buttons.current.slice(0, items.length).map((button) => ({
        left: button?.offsetLeft ?? 0, width: button?.offsetWidth ?? 0,
        center: (button?.offsetLeft ?? 0) + (button?.offsetWidth ?? 0) / 2,
      })),
    };
  }

  function position(index: number, geometry?: NavigationGeometry, pointerX?: number) {
    const row = track.current;
    const bounds = geometry ?? measure();
    const tab = bounds?.tabs[index];
    if (!row || !bounds || !tab) return;
    const left = pointerX === undefined ? tab.left : clamp(pointerX - tab.width / 2, 0, bounds.width - tab.width);
    row.style.setProperty("--indicator-x", `${left}px`);
    row.style.setProperty("--indicator-width", `${tab.width}px`);
    row.style.setProperty("--indicator-opacity", "1");
  }

  function feedback(index: number, now: number) {
    if (index === haptic.current.index) return;
    haptic.current.index = index;
    if (now - haptic.current.at < 45) return;
    haptic.current.at = now;
    try { nativeHaptic("light"); } catch { /* Browsers without the native bridge continue without feedback. */ }
  }

  function preview(current: NavigationGesture, time: number) {
    const point = localPointer(current.clientX, current.clientY, current.geometry, motion.matrix());
    current.candidate = nearestTab(point.x, current.geometry);
    position(current.candidate, current.geometry, point.x);
    feedback(current.candidate, time);
  }

  useEffect(() => {
    const element = track.current;
    element?.style.setProperty("--indicator-opacity", activeIndex < 0 ? "0" : "1");
    const button = buttons.current[activeIndex];
    if (!element || !button) return;
    const align = () => {
      if (gesture.current) return;
      element.style.setProperty("--indicator-x", `${button.offsetLeft}px`);
      element.style.setProperty("--indicator-width", `${button.offsetWidth}px`);
    };
    align();
    const observer = new ResizeObserver(align);
    observer.observe(element);
    return () => observer.disconnect();
  }, [activeIndex, items.length]);

  function finish(event: PointerEvent<HTMLElement>, cancelled = false) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!cancelled) {
      current.clientX = event.clientX;
      current.clientY = event.clientY;
      preview(current, event.timeStamp);
    }
    const candidate = cancelled ? activeIndex : current.candidate;
    gesture.current = null;
    motion.onFrame(null);
    suppressClickUntil.current = event.timeStamp + 450;
    motion.reset();
    position(candidate, current.geometry);
    if (candidate < 0) track.current?.style.setProperty("--indicator-opacity", "0");
    if (!cancelled && items[candidate]) {
      feedback(candidate, event.timeStamp);
      onSelect(items[candidate].key);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <nav
      ref={nav}
      className={`${styles.scope} sg-liquid-nav`}
      aria-label="Main navigation"
      data-native-haptics="managed"
      style={{ touchAction: "none" }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0 || gesture.current || items.length === 0) return;
        const geometry = measure();
        if (!geometry || !geometry.tabs.length) return;
        const candidate = nearestTab(localPointer(event.clientX, event.clientY, geometry, motion.matrix()).x, geometry);
        const current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, candidate,
          clientX: event.clientX, clientY: event.clientY, geometry };
        gesture.current = current;
        haptic.current.index = activeIndex;
        suppressClickUntil.current = 0;
        event.currentTarget.setPointerCapture(event.pointerId);
        motion.move(0, 0);
        motion.onFrame((time) => {
          const current = gesture.current;
          if (current) preview(current, time);
        });
        preview(current, event.timeStamp);
      }}
      onPointerMove={(event) => {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        current.clientX = event.clientX;
        current.clientY = event.clientY;
        motion.move(event.clientX - current.startX, event.clientY - current.startY);
        preview(current, event.timeStamp);
      }}
      onPointerUp={(event) => finish(event)}
      onPointerCancel={(event) => finish(event, true)}
      onLostPointerCapture={(event) => finish(event, true)}
      onClickCapture={(event) => {
        if (event.detail !== 0 && event.timeStamp < suppressClickUntil.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onKeyDown={(event) => {
        const focused = buttons.current.findIndex((button) => button === document.activeElement);
        const current = focused < 0 ? Math.max(0, activeIndex) : focused;
        let next = current;
        if (event.key === "ArrowRight") next = (current + 1) % items.length;
        else if (event.key === "ArrowLeft") next = (current - 1 + items.length) % items.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = items.length - 1;
        else return;
        if (!items[next]) return;
        event.preventDefault();
        feedback(next, event.timeStamp);
        position(next);
        buttons.current[next]?.focus();
        onSelect(items[next].key);
      }}
    >
      <span className="sg-liquid-surface" aria-hidden="true" />
      <div ref={track} className="sg-liquid-nav-track" style={{ "--tab-count": items.length } as CSSProperties}>
        <span className="sg-liquid-indicator" aria-hidden="true" />
        {items.map((item, index) => (
          <button
            key={item.key}
            ref={(button) => { buttons.current[index] = button; }}
            type="button"
            className="sg-liquid-tab"
            aria-label={item.label}
            aria-current={item.key === activeKey ? "page" : undefined}
            tabIndex={index === Math.max(0, activeIndex) ? 0 : -1}
            onClick={(event) => { feedback(index, event.timeStamp); onSelect(item.key); }}
          >
            <span className="sg-liquid-tab-icon" aria-hidden="true">{item.icon}</span>
            <span className="sg-liquid-tab-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
