import type { Map as MaplibreMap } from "maplibre-gl";

/**
 * Tiny singleton-with-subscribers around the active MapLibre instance so
 * subscribers (e.g. the pinned Tooltip) can listen to map move/zoom events
 * directly instead of round-tripping locked screen coords through the
 * Zustand store on every camera frame. Updating store.locked on every
 * move triggered every consumer of the store to re-render.
 *
 * MapView calls `setMapInstance` once the map's `load` event fires and
 * `setMapInstance(null)` on teardown (HMR / theme swap).
 */
let instance: MaplibreMap | null = null;
const subscribers = new Set<(m: MaplibreMap | null) => void>();

export function setMapInstance(m: MaplibreMap | null): void {
  if (instance === m) return;
  instance = m;
  for (const fn of subscribers) fn(m);
}

export function getMapInstance(): MaplibreMap | null {
  return instance;
}

export function subscribeMapInstance(fn: (m: MaplibreMap | null) => void): () => void {
  subscribers.add(fn);
  fn(instance);
  return () => {
    subscribers.delete(fn);
  };
}
