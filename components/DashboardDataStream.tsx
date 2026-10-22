"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";

function ResolvedData<T>({ source, onReady }: { source: Promise<T>; onReady: (value: T) => void }) {
  const value = use(source);
  useEffect(() => { onReady(value); }, [value, onReady]);
  return null;
}

/** Optional streamed panels never suspend the already-visible account data. */
export function useDashboardData<T>(source?: Promise<T>) {
  const [resolved, setResolved] = useState<{ source: Promise<T>; value: T } | null>(null);
  const onReady = useCallback((value: T) => {
    if (source) setResolved({ source, value });
  }, [source]);
  const matched = !!source && resolved?.source === source;
  return {
    value: matched ? resolved.value : undefined,
    pending: !!source && !matched,
    bridge: source ? <Suspense fallback={null}><ResolvedData source={source} onReady={onReady} /></Suspense> : null,
  };
}
