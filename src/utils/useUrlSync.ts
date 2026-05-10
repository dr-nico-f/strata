import { useEffect, useRef } from "react";
import { useStore } from "../store";
import { readUrlState, writeUrlState } from "./urlState";
import { readLocalState, writeLocalState } from "./localState";

/**
 * Sync the year, layer toggles, projection, and theme to/from the URL query
 * string, and persist a fallback copy of the same to localStorage so a fresh
 * tab with no URL params still remembers your last view.
 *
 * Read precedence on mount: URL > localStorage > defaults.
 */
export function useUrlSync() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const url = readUrlState();
    const local = readLocalState();
    const store = useStore.getState();

    const year = url.year ?? local.year;
    const layers = url.layers ?? local.layers;
    const projection = url.projection ?? local.projection;
    const theme = url.theme ?? local.theme;

    if (layers !== undefined) store.setLayers(layers);
    if (projection !== undefined) store.setProjection(projection);
    if (theme !== undefined) store.setTheme(theme);
    // If the URL declares a tour, defer year to the chapter (which sets it
    // synchronously when StoryPlayer's effect fires). Otherwise restore.
    if (url.tour) {
      store.startTour(url.tour.storyId, url.tour.chapterIndex);
    } else if (year !== undefined) {
      store.setYear(year);
    }
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastSig = "";
    const unsub = useStore.subscribe((s) => {
      // The store fires on every set() — hover/locked/toast/etc. would
      // otherwise repaint the URL on every mouse pixel. Skip when no field we
      // actually persist has changed.
      const sig = JSON.stringify([s.year, s.layers, s.projection, s.theme, s.tour]);
      if (sig === lastSig) return;
      lastSig = sig;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const payload = {
          year: s.year,
          layers: s.layers,
          projection: s.projection,
          theme: s.theme,
          tour: s.tour,
        };
        writeUrlState(payload);
        // localState doesn't need to persist the tour — leaving the picker
        // open across refreshes is more confusing than helpful.
        writeLocalState({
          year: payload.year,
          layers: payload.layers,
          projection: payload.projection,
          theme: payload.theme,
        });
      });
    });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      unsub();
    };
  }, []);
}
