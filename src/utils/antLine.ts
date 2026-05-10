import type { Map as MaplibreMap } from "maplibre-gl";

/**
 * Dash sequence used by the "marching ants" animation. Each entry sums to the
 * same period (7) so the line keeps a constant rendered length while the
 * pattern shifts. Stepping through the sequence one frame at a time creates
 * the appearance of dashes flowing in one direction.
 */
export const ANT_DASH_SEQUENCE: ReadonlyArray<readonly number[]> = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];

/**
 * Drives a marching-ants animation on one or more line layers by setting the
 * `line-dasharray` paint property each frame. Returns a cancel function.
 *
 * The loop self-throttles: it only calls setPaintProperty when the dash step
 * advances (every ~stepMs), and bails silently if the layer is gone (e.g.
 * the map was destroyed by a theme change).
 *
 * @param map        The MapLibre map.
 * @param layerIds   Layer ids to animate. Layers that don't exist are skipped.
 * @param stepMs     How long each dash frame is held. ~60ms feels lively.
 */
export function startAntLineAnimation(
  map: MaplibreMap,
  layerIds: readonly string[],
  stepMs = 60,
): () => void {
  let raf = 0;
  let lastStep = -1;
  const tick = (t: number) => {
    const step = Math.floor((t / stepMs) % ANT_DASH_SEQUENCE.length);
    if (step !== lastStep) {
      lastStep = step;
      const dash = ANT_DASH_SEQUENCE[step] as number[];
      for (const id of layerIds) {
        try {
          if (!map.getLayer(id)) continue;
          if (map.getLayoutProperty(id, "visibility") === "none") continue;
          map.setPaintProperty(id, "line-dasharray", dash);
        } catch {
          // Map was removed mid-frame; bail this tick, the next pass will
          // also bail because getLayer will keep returning undefined.
          return;
        }
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    if (raf) cancelAnimationFrame(raf);
  };
}
