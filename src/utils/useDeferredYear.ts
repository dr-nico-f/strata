import { useEffect, useState } from "react";
import { useStore } from "../store";

/**
 * Returns a year value that lags behind the live `store.year` by `delayMs`,
 * resetting the timer on every fresh change. Heavy layers (population dots,
 * city/event/battle GeoJSON rebuilds) consume this instead of `store.year`
 * so a fast slider drag doesn't trigger ~10 redundant rebuilds per second.
 *
 * The slider readout, tooltip year line, etc. should keep using the live
 * `store.year` so the UI always reflects the cursor position.
 */
export function useDeferredYear(delayMs = 80): number {
  const live = useStore((s) => s.year);
  const [deferred, setDeferred] = useState(live);
  useEffect(() => {
    if (live === deferred) return;
    const t = window.setTimeout(() => setDeferred(live), delayMs);
    return () => window.clearTimeout(t);
  }, [live, delayMs, deferred]);
  return deferred;
}
