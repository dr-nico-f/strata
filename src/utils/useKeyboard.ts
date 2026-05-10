import { useEffect } from "react";
import { BOUNDARY_SNAPSHOT_YEARS } from "../data/boundariesManifest";
import type { LayerId } from "../store";
import { MAX_YEAR, MIN_YEAR, useStore } from "../store";
import { getActiveItems } from "./activeCounts";
import { pickSnapshotYear } from "./pickSnapshot";

const LAYER_KEYS: Record<string, LayerId> = {
  b: "boundaries",
  p: "peoples",
  c: "cities",
  e: "events",
  n: "connections",
  x: "battles",
  o: "population",
  y: "sealevel",
  i: "religions",
  l: "languages",
  d: "disasters",
  f: "people",
  m: "migrations",
};

export function useKeyboard() {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      const store = useStore.getState();

      // Never swallow browser shortcuts. Cmd/Ctrl + key is reserved for the
      // browser (reload, save, new tab, dev tools, etc.) — bail out so things
      // like Cmd+Shift+R (hard refresh) work normally. The arrow-key handler
      // below intentionally consults ctrlKey/metaKey as a "big step" modifier,
      // so we let arrow keys through this guard.
      if ((ev.metaKey || ev.ctrlKey) && ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") {
        return;
      }

      if (ev.key === "Escape") {
        if (store.helpOpen) {
          store.setHelpOpen(false);
          return;
        }
        if (store.storyPickerOpen) {
          store.setStoryPickerOpen(false);
          return;
        }
        if (store.detailPanelOpen) {
          store.setDetailPanelOpen(false);
          return;
        }
        if (store.tour) {
          store.exitTour();
          return;
        }
        if (store.pendingChoice) {
          store.setPendingChoice(null);
          return;
        }
        if (store.focusedCountry) {
          store.setFocusedCountry(null);
          store.setFocusBbox(null);
          return;
        }
        if (store.locked) {
          store.setLocked(null);
          return;
        }
        if (store.focusBbox) {
          store.setFocusBbox(null);
          return;
        }
      }

      if (ev.key === "t" || ev.key === "T") {
        ev.preventDefault();
        store.setStoryPickerOpen(!store.storyPickerOpen);
        return;
      }

      if (ev.key === "?") {
        ev.preventDefault();
        store.setHelpOpen(!store.helpOpen);
        return;
      }

      if (ev.key === "h" || ev.key === "H") {
        ev.preventDefault();
        store.setHideUi(!store.hideUi);
        return;
      }

      if (ev.key === "s" || ev.key === "S") {
        ev.preventDefault();
        const url = new URL(window.location.href);
        if (store.locked && store.locked.id) {
          url.searchParams.set("focus", `${store.locked.layer}:${store.locked.id}`);
        }
        const text = url.toString();
        if (navigator.clipboard?.writeText) {
          navigator.clipboard
            .writeText(text)
            .then(() => store.setToast("Link copied"))
            .catch(() => store.setToast("Couldn't copy link"));
        } else {
          store.setToast("Couldn't copy link");
        }
        setTimeout(() => {
          if (useStore.getState().toast) useStore.getState().setToast(null);
        }, 2400);
        return;
      }

      // [ and ] cycle through active features in the locked layer (or the
      // first available layer if nothing is pinned).
      if (ev.key === "[" || ev.key === "]") {
        ev.preventDefault();
        const items = getActiveItems(store.year);
        if (items.length === 0) return;
        const visibleItems = items.filter((it) => store.layers[it.layer]);
        if (visibleItems.length === 0) return;
        let pool = visibleItems;
        let curIdx = -1;
        if (store.locked) {
          // Restrict to same-layer features when something is pinned
          pool = visibleItems.filter((it) => it.layer === store.locked!.layer);
          if (pool.length === 0) pool = visibleItems;
          if (store.locked.id) {
            curIdx = pool.findIndex((it) => it.id === store.locked!.id);
          }
        }
        const dir = ev.key === "]" ? 1 : -1;
        const next = pool[(curIdx + dir + pool.length) % pool.length];
        if (!next) return;
        window.dispatchEvent(
          new CustomEvent("hs:flyto", {
            detail: { center: [next.lng, next.lat], zoom: 4.5 },
          }),
        );
        store.setLocked({
          layer: next.layer,
          id: next.id,
          name: next.name,
          detail: next.detail,
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          rangeStart: next.rangeStart,
          rangeEnd: next.rangeEnd,
          pointYear: next.pointYear,
          wikipedia: next.wikipedia,
          lng: next.lng,
          lat: next.lat,
        });
        return;
      }

      if (ev.key === "End") {
        ev.preventDefault();
        store.setPlaying(false);
        store.setYear(MAX_YEAR);
        return;
      }

      if (ev.key === "Home") {
        ev.preventDefault();
        store.setPlaying(false);
        store.setYear(MIN_YEAR);
        return;
      }

      if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
        ev.preventDefault();
        const dir = ev.key === "ArrowRight" ? 1 : -1;
        // While a tour is active, arrows advance chapters instead of years.
        // Hold shift/alt/cmd to bypass and scrub years anyway.
        if (store.tour && !ev.shiftKey && !ev.altKey && !ev.ctrlKey && !ev.metaKey) {
          store.advanceTour(dir > 0 ? 1 : -1);
          return;
        }
        const step = ev.shiftKey ? 100 : ev.altKey ? 10 : ev.ctrlKey || ev.metaKey ? 500 : 1;
        store.setPlaying(false);
        store.setYear(store.year + dir * step);
        return;
      }

      if (ev.code === "Space") {
        ev.preventDefault();
        store.setPlaying(!store.playing);
        return;
      }

      if (ev.key === "g" || ev.key === "G") {
        ev.preventDefault();
        store.setProjection(store.projection === "globe" ? "flat" : "globe");
        return;
      }

      if (ev.key === "r" || ev.key === "R") {
        ev.preventDefault();
        store.setPlaying(false);
        const r = Math.random();
        const y =
          r < 0.7
            ? Math.floor(-3000 + Math.random() * (MAX_YEAR + 3000))
            : Math.floor(MIN_YEAR + Math.random() * (MAX_YEAR - MIN_YEAR));
        store.setYear(y);
        return;
      }

      // 'n' is also a layer key (connections); we use shift+N for snap to disambiguate
      if (ev.key === "N" && ev.shiftKey) {
        ev.preventDefault();
        const s = pickSnapshotYear(BOUNDARY_SNAPSHOT_YEARS, store.year);
        store.setYear(s);
        return;
      }

      const id = LAYER_KEYS[ev.key.toLowerCase()];
      if (id) {
        ev.preventDefault();
        store.toggleLayer(id);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
