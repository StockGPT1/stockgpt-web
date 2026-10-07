"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

type Frame = {
  previous: string;
  current: string;
  sequence: number;
};

export function RouletteNumber({
  value,
  className = "",
  spinMs = 118,
  minUpdateMs = 104,
}: {
  value: string;
  className?: string;
  spinMs?: number;
  minUpdateMs?: number;
}) {
  const [frame, setFrame] = useState<Frame>({
    previous: value,
    current: value,
    sequence: 0,
  });
  const latestValueRef = useRef(value);
  const lastCommitRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    latestValueRef.current = value;
    if (value === frame.current || timerRef.current != null) return;

    const elapsed = performance.now() - lastCommitRef.current;
    const delay = Math.max(0, minUpdateMs - elapsed);

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const next = latestValueRef.current;
      if (next === frame.current) return;
      setSpinning(true);

      setFrame((current) => {
        if (next === current.current) return current;
        lastCommitRef.current = performance.now();
        return {
          previous: current.current,
          current: next,
          sequence: current.sequence + 1,
        };
      });
    }, delay);
  }, [frame, minUpdateMs, value]);

  useEffect(() => {
    if (frame.sequence === 0) return;

    if (settleTimerRef.current != null) {
      window.clearTimeout(settleTimerRef.current);
    }

    const maxDigitDelay = Math.min(Math.max(frame.current.length - 1, 0), 10) * 2;
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      setSpinning(false);
    }, spinMs + maxDigitDelay + 18);
  }, [frame, spinMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
      if (settleTimerRef.current != null) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  const sameLength = frame.previous.length === frame.current.length;

  return (
    <span className={`sg-roulette-number ${className}`} aria-label={frame.current}>
      {Array.from(frame.current).map((character, index) => {
        const previousCharacter = sameLength ? frame.previous[index] : null;
        const isDigit = /^\d$/.test(character);
        const previousIsDigit = previousCharacter != null && /^\d$/.test(previousCharacter);
        const shouldSpin =
          spinning && isDigit &&
          (!previousIsDigit || previousCharacter !== character);

        if (!shouldSpin) {
          return (
            <span key={`static-${index}-${character}`} className={isDigit ? "sg-roulette-digit" : undefined} aria-hidden="true">
              {character}
            </span>
          );
        }

        const startDigit = previousIsDigit ? previousCharacter : character;
        const style = {
          "--sg-roulette-duration": `${spinMs}ms`,
          "--sg-roulette-delay": `${Math.min(index, 10) * 2}ms`,
        } as CSSProperties;

        return (
          <span
            key={`slot-${frame.sequence}-${index}-${character}`}
            className="sg-roulette-slot"
            aria-hidden="true"
          >
            <span className="sg-roulette-reel" style={style}>
              <span>{startDigit}</span>
              {DIGITS.map((digit) => (
                <span key={digit}>{digit}</span>
              ))}
              <span>{character}</span>
            </span>
          </span>
        );
      })}
    </span>
  );
}
