import { useEffect } from "react";
import { LayerId, useStore } from "../store";
import { getActiveItems } from "./activeCounts";

/**
 * On first mount, if the URL contains `?focus=<layer>:<id>`, look up that
 * feature in the active-items index and pin its tooltip + fly to it. This
 * lets the share button transmit the user's focused feature, not just the
 * year/layers/projection/theme.
 */
export function useFocusFromUrl() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const focus = params.get("focus");
    if (!focus) return;
    const [layer, ...rest] = focus.split(":");
    const id = rest.join(":");
    if (!layer || !id) return;

    // Defer enough for layer hooks to mount and data to be available.
    const t = window.setTimeout(() => {
      const store = useStore.getState();
      const items = getActiveItems(store.year);
      const hit = items.find(
        (it) => it.layer === (layer as LayerId) && it.id === id,
      );
      if (!hit) return;
      window.dispatchEvent(
        new CustomEvent("hs:flyto", {
          detail: { center: [hit.lng, hit.lat], zoom: 4.5 },
        }),
      );
      store.setLocked({
        layer: hit.layer,
        id: hit.id,
        name: hit.name,
        detail: hit.detail,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        rangeStart: hit.rangeStart,
        rangeEnd: hit.rangeEnd,
        pointYear: hit.pointYear,
        wikipedia: hit.wikipedia,
        lng: hit.lng,
        lat: hit.lat,
      });
    }, 600);
    return () => window.clearTimeout(t);
  }, []);
}
