"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from "react";

const FRAME_COUNT = 390;
const LAST_FRAME_INDEX = FRAME_COUNT - 1;
const SOURCE_WIDTH = 1920;
const SOURCE_HEIGHT = 1080;
const MAX_DPR = 2;
const INITIAL_WINDOW_SIZE = 12;
const MAX_CONCURRENT_LOADS = 4;
const MAX_DECODED_FRAMES = 24;
const NEARBY_FRAME_RADIUS = 6;
const DIRECTIONAL_LOOKAHEAD = 16;
const BACKGROUND_LOAD_DELAY_MS = 350;

const CANCELLED_LOAD = Symbol("cancelled frame load");

export type InsideEngineSequenceHandle = {
  setProgress: (progress: number) => void;
};

type InsideEngineSequenceProps = {
  /**
   * Declarative progress is useful outside the landing scroll engine. The
   * landing itself uses the imperative handle so its rAF loop does not need
   * to trigger a React render for every frame.
   */
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

type PendingImage = {
  cancel: () => void;
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function insideEngineFrameForProgress(progress: number) {
  return Math.round(clamp01(progress) * LAST_FRAME_INDEX);
}

export function insideEngineFrameUrl(frameIndex: number) {
  const finiteIndex = Number.isFinite(frameIndex) ? frameIndex : 0;
  const safeIndex = Math.min(LAST_FRAME_INDEX, Math.max(0, Math.round(finiteIndex)));
  return `/landing/inside-engine/desktop/frame-${String(safeIndex).padStart(4, "0")}.webp`;
}

export const InsideEngineSequence = forwardRef<
  InsideEngineSequenceHandle,
  InsideEngineSequenceProps
>(function InsideEngineSequence({ progress, className = "", style }, forwardedRef) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const setProgressRef = useRef<(value: number) => void>(() => undefined);

  useImperativeHandle(
    forwardedRef,
    () => ({
      setProgress(value: number) {
        setProgressRef.current(value);
      },
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;

    let active = true;
    let activeLoads = 0;
    let drawRaf = 0;
    let backgroundTimer = 0;
    let forceNextDraw = true;

    const decoded = new Map<number, HTMLImageElement>();
    const loading = new Set<number>();
    const failed = new Set<number>();
    const queued = new Set<number>();
    const pending = new Map<number, PendingImage>();
    let loadQueue: number[] = [];

    let desiredFrame = 0;
    let previousDesiredFrame = desiredFrame;
    let direction: -1 | 0 | 1 = 0;
    let lastDrawnFrame = -1;

    const touchDecodedFrame = (frameIndex: number) => {
      const image = decoded.get(frameIndex);
      if (!image) return;
      decoded.delete(frameIndex);
      decoded.set(frameIndex, image);
    };

    const trimDecodedCache = () => {
      while (decoded.size > MAX_DECODED_FRAMES) {
        let evictionCandidate: number | undefined;

        for (const frameIndex of decoded.keys()) {
          const nearCurrent = Math.abs(frameIndex - desiredFrame) <= NEARBY_FRAME_RADIUS;
          if (frameIndex !== 0 && frameIndex !== lastDrawnFrame && !nearCurrent) {
            evictionCandidate = frameIndex;
            break;
          }
        }

        if (evictionCandidate === undefined) break;
        decoded.delete(evictionCandidate);
      }
    };

    const nearestDecodedFrame = () => {
      let nearest = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const frameIndex of decoded.keys()) {
        const distance = Math.abs(frameIndex - desiredFrame);
        const isPreferredTie =
          distance === nearestDistance &&
          direction !== 0 &&
          Math.sign(frameIndex - desiredFrame) === direction;

        if (distance < nearestDistance || isPreferredTie) {
          nearest = frameIndex;
          nearestDistance = distance;
        }
      }

      return nearest;
    };

    const draw = () => {
      drawRaf = 0;
      if (!active) return;

      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      if (cssWidth <= 0 || cssHeight <= 0) return;

      /* A backing store larger than the approved source cannot add detail.
         Cap by DPR and by the source dimensions to avoid 4K/Retina canvases
         consuming substantially more GPU memory than a 1080p frame. */
      const sourceDprLimit = Math.min(
        SOURCE_WIDTH / cssWidth,
        SOURCE_HEIGHT / cssHeight,
      );
      const dpr = Math.min(
        Math.max(window.devicePixelRatio || 1, 1),
        MAX_DPR,
        sourceDprLimit,
      );
      const backingWidth = Math.max(1, Math.round(cssWidth * dpr));
      const backingHeight = Math.max(1, Math.round(cssHeight * dpr));
      const resized = canvas.width !== backingWidth || canvas.height !== backingHeight;

      if (resized) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }

      const frameIndex = nearestDecodedFrame();
      if (frameIndex < 0) return;
      if (!resized && !forceNextDraw && frameIndex === lastDrawnFrame) return;

      const image = decoded.get(frameIndex);
      if (!image) return;

      const coverScale = Math.max(cssWidth / SOURCE_WIDTH, cssHeight / SOURCE_HEIGHT);
      const drawWidth = SOURCE_WIDTH * coverScale;
      const drawHeight = SOURCE_HEIGHT * coverScale;
      const drawX = (cssWidth - drawWidth) / 2;
      const drawY = (cssHeight - drawHeight) / 2;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

      forceNextDraw = false;
      lastDrawnFrame = frameIndex;
      touchDecodedFrame(frameIndex);
    };

    const requestDraw = (force = false) => {
      forceNextDraw = forceNextDraw || force;
      if (drawRaf || !active) return;
      drawRaf = requestAnimationFrame(draw);
    };

    const canQueue = (frameIndex: number) =>
      frameIndex >= 0 &&
      frameIndex < FRAME_COUNT &&
      !decoded.has(frameIndex) &&
      !loading.has(frameIndex) &&
      !failed.has(frameIndex);

    const prioritizeFrames = (frameIndices: number[]) => {
      const priority: number[] = [];
      const prioritySet = new Set<number>();

      for (const frameIndex of frameIndices) {
        if (!canQueue(frameIndex) || prioritySet.has(frameIndex)) continue;
        priority.push(frameIndex);
        prioritySet.add(frameIndex);
        queued.add(frameIndex);
      }

      if (priority.length === 0) return;
      loadQueue = priority.concat(loadQueue.filter((frameIndex) => !prioritySet.has(frameIndex)));
    };

    const nearbyPriority = () => {
      const frames = [desiredFrame];
      const preferredDirection = direction === 0 ? 1 : direction;

      for (let distance = 1; distance <= DIRECTIONAL_LOOKAHEAD; distance += 1) {
        frames.push(desiredFrame + preferredDirection * distance);
        if (distance <= NEARBY_FRAME_RADIUS) {
          frames.push(desiredFrame - preferredDirection * distance);
        }
      }

      return frames;
    };

    const loadFrame = async (frameIndex: number) => {
      activeLoads += 1;
      loading.add(frameIndex);
      queued.delete(frameIndex);

      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = frameIndex === 0 ? "high" : "auto";

      let cancelLoad = () => undefined;
      const loaded = new Promise<void>((resolve, reject) => {
        let settled = false;
        const settle = (callback: () => void) => {
          if (settled) return;
          settled = true;
          image.onload = null;
          image.onerror = null;
          callback();
        };

        image.onload = () => settle(resolve);
        image.onerror = () => settle(() => reject(new Error(`Unable to load frame ${frameIndex}`)));
        cancelLoad = () => {
          settle(() => reject(CANCELLED_LOAD));
          image.src = "";
        };
      });

      pending.set(frameIndex, { cancel: cancelLoad });
      image.src = insideEngineFrameUrl(frameIndex);

      try {
        await loaded;
        if (typeof image.decode === "function") {
          try {
            await image.decode();
          } catch (error) {
            if (!image.complete || image.naturalWidth === 0) throw error;
          }
        }

        if (!active) return;
        decoded.set(frameIndex, image);
        trimDecodedCache();
        requestDraw();
      } catch (error) {
        if (active && error !== CANCELLED_LOAD) failed.add(frameIndex);
      } finally {
        pending.delete(frameIndex);
        loading.delete(frameIndex);
        activeLoads -= 1;
        if (active) pumpLoads();
      }
    };

    const pumpLoads = () => {
      while (active && activeLoads < MAX_CONCURRENT_LOADS && loadQueue.length > 0) {
        const frameIndex = loadQueue.shift();
        if (frameIndex === undefined) break;
        queued.delete(frameIndex);
        if (!canQueue(frameIndex)) continue;
        void loadFrame(frameIndex);
      }
    };

    const updateProgress = (value: number) => {
      const nextFrame = insideEngineFrameForProgress(value);
      if (nextFrame === desiredFrame) return;

      previousDesiredFrame = desiredFrame;
      desiredFrame = nextFrame;
      direction = Math.sign(desiredFrame - previousDesiredFrame) as -1 | 0 | 1;

      prioritizeFrames(nearbyPriority());
      pumpLoads();
      requestDraw();
    };

    setProgressRef.current = updateProgress;

    const initialFrames = Array.from({ length: INITIAL_WINDOW_SIZE }, (_, index) => index);
    prioritizeFrames(initialFrames);
    prioritizeFrames(nearbyPriority());
    pumpLoads();

    backgroundTimer = window.setTimeout(() => {
      const remainingFrames = Array.from(
        { length: FRAME_COUNT - INITIAL_WINDOW_SIZE },
        (_, index) => index + INITIAL_WINDOW_SIZE,
      );
      for (const frameIndex of remainingFrames) {
        if (!canQueue(frameIndex) || queued.has(frameIndex)) continue;
        loadQueue.push(frameIndex);
        queued.add(frameIndex);
      }
      pumpLoads();
    }, BACKGROUND_LOAD_DELAY_MS);

    const onResize = () => requestDraw(true);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(canvas);
    window.addEventListener("resize", onResize);

    return () => {
      active = false;
      setProgressRef.current = () => undefined;
      cancelAnimationFrame(drawRaf);
      window.clearTimeout(backgroundTimer);
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      pending.forEach(({ cancel }) => cancel());
      pending.clear();
      decoded.clear();
      loadQueue = [];
      queued.clear();
      loading.clear();
    };
  }, []);

  useEffect(() => {
    if (progress === undefined) return;
    setProgressRef.current(progress);
  }, [progress]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`block h-full w-full bg-[#020806] ${className}`}
      style={style}
    />
  );
});
