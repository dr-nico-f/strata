import type {
  GeoJSONSource,
  Map as MaplibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import { CITIES, cityPopulationAt } from "../data/cities";
import { useStore } from "../store";
import { useDeferredYear } from "../utils/useDeferredYear";

const SOURCE_ID = "cities-src";
const HALO_LAYER_ID = "cities-halo";
const CAPITAL_LAYER_ID = "cities-capital";
const CIRCLE_LAYER_ID = "cities-circle";
const LABEL_LAYER_ID = "cities-label";

// Transient ring shown when a city's founding/abandonment year is crossed.
const PULSE_SOURCE_ID = "cities-pulse-src";
const PULSE_LAYER_ID = "cities-pulse";

const PULSE_DURATION_MS = 900;
const PULSE_MAX_RADIUS = 28;

// If the user clicks a city while zoomed out further than this, fly the camera
// in to make the pin more readable. At higher zooms we leave the camera alone.
const FLY_TO_THRESHOLD_ZOOM = 5.0;
const FLY_TO_TARGET_ZOOM = 5.5;

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

type CityProps = {
  id: string;
  name: string;
  founded: number;
  abandoned: number | null;
  note: string;
  wikipedia: string;
  cc: string;
  capital: boolean;
  lng: number;
  lat: number;
  pop: number;
  isRuin: boolean;
  ruinAge: number;
};

function buildFeatures(year: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const c of CITIES) {
    if (year < c.founded) continue;
    // Note: we deliberately do NOT filter on abandonment. Cities linger as
    // faded "ruin" markers after they're abandoned (see paint expressions
    // below) so users can still see Pompeii / Babylon / Persepolis as muted
    // amber dots through later eras.
    const abandonedAt = c.abandoned;
    const isRuin = abandonedAt !== undefined && year > abandonedAt;
    const ruinAge = isRuin ? year - (abandonedAt as number) : 0;
    const pop = c.populationCurve ? cityPopulationAt(c, year) : 0;
    features.push({
      type: "Feature",
      id: c.id,
      geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      properties: {
        id: c.id,
        name: c.name,
        founded: c.founded,
        abandoned: abandonedAt ?? null,
        note: c.note ?? "",
        wikipedia: c.wikipedia ?? c.name,
        cc: c.cc ?? "",
        capital: c.capital ?? false,
        lng: c.lng,
        lat: c.lat,
        pop,
        isRuin,
        ruinAge,
      } satisfies CityProps,
    });
  }
  // Sort ascending by population so megacity dots draw on top of small towns.
  // MapLibre renders features in source order; later == on top.
  features.sort((a, b) => {
    const ap = (a.properties as CityProps).pop ?? 0;
    const bp = (b.properties as CityProps).pop ?? 0;
    return ap - bp;
  });
  return { type: "FeatureCollection", features };
}

type Pulse = {
  startTime: number;
  lng: number;
  lat: number;
  kind: "born" | "died";
  name: string;
};

export function useCitiesLayer(map: MaplibreMap | null) {
  // Deferred so a fast slider drag doesn't rebuild ~2.7k city features per
  // frame. Pulse logic still works because it reads prev/cur off this same
  // deferred value, so crossings are still detected correctly.
  const year = useDeferredYear(80);
  const visible = useStore((s) => s.layers.cities);
  const theme = useStore((s) => s.theme);
  const setHover = useStore((s) => s.setHover);
  const setupForMap = useRef<MaplibreMap | null>(null);
  const prevYearRef = useRef<number | null>(null);
  const pulsesRef = useRef<Pulse[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || setupForMap.current === map) return;
    setupForMap.current = map;

    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });

    // ── Halo: soft outer aura, grows with zoom + population ──
    // Ruin halos are weaker so abandoned cities don't blob the map.
    map.addLayer({
      id: HALO_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          0, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 2.6, 50, 3.6, 500, 5.0, 5000, 7.5, 20000, 10.0,
          ],
          3, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 3.8, 50, 5.5, 500, 8.0, 5000, 13.0, 20000, 18.0,
          ],
          6, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 5.0, 50, 8.0, 500, 12.0, 5000, 22.0, 20000, 32.0,
          ],
          9, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 6.5, 50, 11.0, 500, 18.0, 5000, 36.0, 20000, 56.0,
          ],
        ],
        "circle-color": [
          "case",
          ["boolean", ["get", "isRuin"], false],
          "#c89060",
          "#5fd1a0",
        ],
        // MapLibre requires the zoom interpolation to be the outermost
        // expression whenever a paint property mixes zoom and feature data,
        // hence the zoom-outer / case-inner shape. Each stop picks between
        // the alive-city aura and the gently age-fading ruin aura.
        "circle-opacity": [
          "interpolate", ["linear"], ["zoom"],
          0, [
            "case",
            ["boolean", ["get", "isRuin"], false],
            ["interpolate", ["linear"], ["coalesce", ["get", "ruinAge"], 0],
              0, 0.10, 500, 0.06, 2000, 0.03, 5000, 0.02,
            ],
            0.14,
          ],
          3, [
            "case",
            ["boolean", ["get", "isRuin"], false],
            ["interpolate", ["linear"], ["coalesce", ["get", "ruinAge"], 0],
              0, 0.13, 500, 0.08, 2000, 0.04, 5000, 0.03,
            ],
            0.20,
          ],
          6, [
            "case",
            ["boolean", ["get", "isRuin"], false],
            ["interpolate", ["linear"], ["coalesce", ["get", "ruinAge"], 0],
              0, 0.16, 500, 0.10, 2000, 0.05, 5000, 0.04,
            ],
            0.26,
          ],
          9, [
            "case",
            ["boolean", ["get", "isRuin"], false],
            ["interpolate", ["linear"], ["coalesce", ["get", "ruinAge"], 0],
              0, 0.20, 500, 0.12, 2000, 0.06, 5000, 0.05,
            ],
            0.32,
          ],
        ],
        "circle-blur": 0.7,
      },
    });

    // ── Capital ring: thin gold ring around national capitals only ──
    // Sits between the halo and the dot so the dot's stroke still reads.
    map.addLayer({
      id: CAPITAL_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: [
        "all",
        ["boolean", ["get", "capital"], false],
        // Hide the capital ring on ruins; an abandoned capital is more "site"
        // than "capital".
        ["!", ["boolean", ["get", "isRuin"], false]],
      ],
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          0, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 2.6, 50, 3.2, 500, 4.0, 5000, 5.2, 20000, 6.5,
          ],
          3, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 3.4, 50, 4.4, 500, 5.6, 5000, 7.5, 20000, 10.0,
          ],
          6, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 4.6, 50, 6.0, 500, 8.0, 5000, 12.0, 20000, 16.0,
          ],
          9, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 6.0, 50, 8.0, 500, 11.5, 5000, 18.0, 20000, 25.0,
          ],
        ],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": "#f5b942",
        "circle-stroke-width": [
          "interpolate", ["linear"], ["zoom"],
          0, 0.6,
          3, 1.0,
          6, 1.4,
          9, 1.8,
        ],
        "circle-stroke-opacity": [
          "interpolate", ["linear"], ["zoom"],
          0, 0.65,
          3, 0.78,
          6, 0.85,
          9, 0.9,
        ],
      },
    });

    // ── Inner dot ──
    // - radius scales with zoom and population.
    // - alive cities are green, abandoned cities tint amber and fade with age.
    // - hover state (set via feature-state) re-tints the stroke gold so the
    //   user knows what's about to be pinned.
    map.addLayer({
      id: CIRCLE_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          0, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 1.6, 50, 2.0, 500, 2.6, 5000, 3.4, 20000, 4.2,
          ],
          3, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 2.2, 50, 2.8, 500, 3.6, 5000, 5.0, 20000, 6.5,
          ],
          6, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 3.0, 50, 4.0, 500, 5.5, 5000, 8.0, 20000, 11.0,
          ],
          9, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 4.0, 50, 5.5, 500, 8.0, 5000, 13.0, 20000, 18.0,
          ],
        ],
        "circle-color": [
          "case",
          ["boolean", ["get", "isRuin"], false],
          // Ruin: warm amber, drifting toward dusty ochre with age.
          ["interpolate", ["linear"], ["coalesce", ["get", "ruinAge"], 0],
            0, "#c89060",
            500, "#a87750",
            2000, "#8a6240",
            5000, "#705034",
          ],
          "#5fd1a0",
        ],
        "circle-stroke-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#ffd86b",
          "#082018",
        ],
        // Zoom-outer / case-inner: same shape rule as circle-opacity above.
        // Hovered features get +1 px of stroke at every zoom stop.
        "circle-stroke-width": [
          "interpolate", ["linear"], ["zoom"],
          0, ["case", ["boolean", ["feature-state", "hover"], false], 1.6, 0.6],
          3, ["case", ["boolean", ["feature-state", "hover"], false], 2.0, 1.0],
          6, ["case", ["boolean", ["feature-state", "hover"], false], 2.5, 1.5],
          9, ["case", ["boolean", ["feature-state", "hover"], false], 3.0, 2.0],
        ],
        "circle-opacity": [
          "case",
          ["boolean", ["get", "isRuin"], false],
          ["interpolate", ["linear"], ["coalesce", ["get", "ruinAge"], 0],
            0, 0.85,
            200, 0.55,
            800, 0.35,
            2000, 0.22,
            5000, 0.18,
          ],
          0.95,
        ],
        "circle-radius-transition": { duration: 220, delay: 0 },
        "circle-stroke-width-transition": { duration: 220, delay: 0 },
        "circle-stroke-color-transition": { duration: 160, delay: 0 },
      },
    });

    // ── City labels ──
    // - text-field formats the city name with an optional muted CC chip.
    // - text-offset grows with zoom so the label clears the (now larger) dot
    //   without sitting on it at high zoom.
    // - symbol-sort-key on -pop lets megacity labels win collisions.
    map.addLayer({
      id: LABEL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        "text-field": [
          "format",
          ["coalesce", ["get", "name"], ""],
          {},
          [
            "case",
            [
              "all",
              ["has", "cc"],
              ["!=", ["get", "cc"], ""],
            ],
            ["concat", "  ", ["get", "cc"]],
            "",
          ],
          { "font-scale": 0.7 },
        ],
        "text-font": ["literal", ["Noto Sans Medium"]],
        "text-anchor": "left",
        "text-offset": [
          "interpolate", ["linear"], ["zoom"],
          0, ["literal", [0.7, 0]],
          3, ["literal", [0.95, 0]],
          6, ["literal", [1.3, 0]],
          9, ["literal", [1.7, 0]],
        ],
        "text-size": [
          "interpolate", ["linear"], ["zoom"],
          0, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 0,
            500, 0,
            1500, 10,
            5000, 12,
            20000, 13,
          ],
          3, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 0,
            50, 9,
            500, 11,
            5000, 13,
            20000, 15,
          ],
          6, [
            "interpolate", ["linear"], ["coalesce", ["get", "pop"], 0],
            0, 9,
            50, 11,
            500, 13,
            5000, 16,
            20000, 18,
          ],
        ],
        "text-letter-spacing": 0.02,
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "text-padding": 2,
        "symbol-sort-key": ["*", -1, ["coalesce", ["get", "pop"], 0]],
      },
      paint: {
        "text-color": "rgba(220, 250, 235, 0.95)",
        "text-halo-color": "rgba(0, 25, 18, 0.85)",
        "text-halo-width": 1.2,
        "text-halo-blur": 0.4,
        "text-opacity-transition": { duration: 240, delay: 0 },
      },
    });

    map.addSource(PULSE_SOURCE_ID, { type: "geojson", data: EMPTY_FC });

    map.addLayer({
      id: PULSE_LAYER_ID,
      type: "circle",
      source: PULSE_SOURCE_ID,
      paint: {
        "circle-radius": ["coalesce", ["get", "radius"], 6],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 2,
        "circle-stroke-color": [
          "case",
          ["==", ["get", "kind"], "died"],
          "#ff7a90",
          "#ffd86b",
        ],
        "circle-stroke-opacity": ["coalesce", ["get", "opacity"], 0.0],
      },
    });

    // ── Hover handling, throttled to one rAF ──
    // queryRenderedFeatures fires on every pixel of mousemove which becomes
    // expensive with thousands of features. Coalescing to a single hit-test
    // per animation frame is invisible to the user but cuts the work an order
    // of magnitude.
    let scheduledFrame: number | null = null;
    let pendingEvent: MapMouseEvent | null = null;
    let hoveredId: string | number | null = null;

    const setHoverState = (newId: string | number | null) => {
      if (newId === hoveredId) return;
      if (hoveredId !== null) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredId },
          { hover: false },
        );
      }
      if (newId !== null) {
        map.setFeatureState(
          { source: SOURCE_ID, id: newId },
          { hover: true },
        );
      }
      hoveredId = newId;
    };

    const processPendingMove = () => {
      scheduledFrame = null;
      const e = pendingEvent;
      pendingEvent = null;
      if (!e) return;
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [CIRCLE_LAYER_ID],
      });
      const top = feats[0];
      if (!top) {
        // Cursor is no longer over the dots layer; mouseleave handles
        // canvas cursor + tooltip clearing.
        return;
      }
      const props = top.properties as unknown as CityProps;
      setHoverState(top.id ?? props.id ?? null);
      setHover({
        layer: "cities",
        id: props.id,
        name: props.name,
        detail: props.note,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        rangeStart: props.founded,
        rangeEnd: props.abandoned ?? 2025,
        wikipedia: props.wikipedia ?? props.name,
        lng: props.lng,
        lat: props.lat,
        pop: props.pop,
        cc: props.cc || undefined,
        capital: props.capital || undefined,
        ruinAge: props.ruinAge || undefined,
      });
      map.getCanvas().style.cursor = "pointer";
    };

    const onMove = (e: MapMouseEvent) => {
      pendingEvent = e;
      if (scheduledFrame !== null) return;
      scheduledFrame = requestAnimationFrame(processPendingMove);
    };

    const onLeave = () => {
      setHoverState(null);
      setHover(null);
      map.getCanvas().style.cursor = "";
    };

    const onClick = (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const top = e.features?.[0];
      if (!top) return;
      const props = top.properties as unknown as CityProps;
      useStore.getState().setLocked({
        layer: "cities",
        id: props.id,
        name: props.name,
        detail: props.note,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        rangeStart: props.founded,
        rangeEnd: props.abandoned ?? 2025,
        wikipedia: props.wikipedia ?? props.name,
        lng: props.lng,
        lat: props.lat,
        pop: props.pop,
        cc: props.cc || undefined,
        capital: props.capital || undefined,
        ruinAge: props.ruinAge || undefined,
      });
      // Click-to-fly: only if the user is currently zoomed out far enough
      // that a fly-in would actually help. Past ~zoom 5 we leave the camera
      // alone so the user can pin without losing their place.
      if (map.getZoom() < FLY_TO_THRESHOLD_ZOOM) {
        map.flyTo({
          center: [props.lng, props.lat],
          zoom: FLY_TO_TARGET_ZOOM,
          duration: 900,
          essential: true,
        });
      }
    };

    map.on("mousemove", CIRCLE_LAYER_ID, onMove);
    map.on("mouseleave", CIRCLE_LAYER_ID, onLeave);
    map.on("click", CIRCLE_LAYER_ID, onClick);

    return () => {
      // Defensive: detach our listeners and any pending rAF when the host
      // map is replaced or the component fully unmounts. Sources / layers
      // are torn down with the MapLibre instance itself.
      map.off("mousemove", CIRCLE_LAYER_ID, onMove);
      map.off("mouseleave", CIRCLE_LAYER_ID, onLeave);
      map.off("click", CIRCLE_LAYER_ID, onClick);
      if (scheduledFrame !== null) {
        cancelAnimationFrame(scheduledFrame);
        scheduledFrame = null;
      }
    };
  }, [map, setHover]);

  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    const v = visible ? "visible" : "none";
    for (const id of [
      HALO_LAYER_ID,
      CAPITAL_LAYER_ID,
      CIRCLE_LAYER_ID,
      PULSE_LAYER_ID,
      LABEL_LAYER_ID,
    ]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", v);
      }
    }
  }, [map, visible]);

  // Theme-aware label paint. Default circle layer styling is dark-mode-
  // tuned, so for light/sepia we flip the text + halo to dark text on a
  // pale halo so labels read against the basemap.
  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    if (!map.getLayer(LABEL_LAYER_ID)) return;
    if (theme === "light") {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", "rgba(20, 32, 24, 0.92)");
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-halo-color",
        "rgba(252, 252, 248, 0.95)",
      );
    } else if (theme === "sepia") {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", "rgba(46, 28, 12, 0.92)");
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-halo-color",
        "rgba(248, 232, 198, 0.92)",
      );
    } else {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", "rgba(220, 250, 235, 0.95)");
      map.setPaintProperty(LABEL_LAYER_ID, "text-halo-color", "rgba(0, 25, 18, 0.85)");
    }
  }, [map, theme]);

  useEffect(() => {
    if (!map || setupForMap.current !== map || !visible) return;
    const fc = buildFeatures(year);
    (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(fc);
  }, [map, year, visible]);

  // When the layer is hidden or the host map is torn down, drop any in-flight
  // pulses + rAF so we don't keep updating an invisible source on every
  // frame and we don't leak the loop past unmount.
  useEffect(() => {
    if (visible && map && setupForMap.current === map) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pulsesRef.current = [];
    // Reset prev-year so toggling the layer back on doesn't replay a huge
    // delta as a single burst.
    prevYearRef.current = null;
  }, [map, visible]);

  // Birth/death pulse: when the year changes, briefly ring cities whose
  // founding/abandonment is freshly crossed.
  useEffect(() => {
    if (!map || setupForMap.current !== map || !visible) return;
    const prev = prevYearRef.current;
    prevYearRef.current = year;
    if (prev === null) return;
    if (prev === year) return;
    // Ignore tiny scrubs (<1 year) and huge jumps (>500 years) -- both cases
    // would either flash nothing or flash hundreds of cities at once.
    const delta = Math.abs(year - prev);
    if (delta === 0 || delta > 500) return;

    const lo = Math.min(prev, year) + 1;
    const hi = Math.max(prev, year);
    const goingForward = year > prev;
    const now = performance.now();
    let added = 0;
    for (const c of CITIES) {
      if (c.founded >= lo && c.founded <= hi) {
        pulsesRef.current.push({
          startTime: now,
          lng: c.lng,
          lat: c.lat,
          kind: goingForward ? "born" : "died",
          name: c.name,
        });
        added++;
      }
      if (
        c.abandoned !== undefined &&
        c.abandoned >= lo &&
        c.abandoned <= hi
      ) {
        pulsesRef.current.push({
          startTime: now,
          lng: c.lng,
          lat: c.lat,
          kind: goingForward ? "died" : "born",
          name: c.name,
        });
        added++;
      }
    }
    // Cap simultaneous pulses to avoid jank when scrubbing a busy century.
    if (pulsesRef.current.length > 60) {
      pulsesRef.current = pulsesRef.current.slice(-60);
    }
    if (added === 0 && pulsesRef.current.length === 0) return;

    const tick = () => {
      const t = performance.now();
      pulsesRef.current = pulsesRef.current.filter(
        (p) => t - p.startTime < PULSE_DURATION_MS,
      );
      const features: GeoJSON.Feature[] = pulsesRef.current.map((p) => {
        const age = (t - p.startTime) / PULSE_DURATION_MS; // 0..1
        const radius = 6 + age * (PULSE_MAX_RADIUS - 6);
        const opacity = (1 - age) * 0.8;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
          properties: {
            kind: p.kind,
            radius,
            opacity,
            name: p.name,
          },
        };
      });
      const source = map.getSource(PULSE_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      if (source) {
        source.setData({ type: "FeatureCollection", features });
      }
      if (pulsesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      // Don't cancel the rAF on year change; the tick keeps running until
      // pulses age out, which is the intended UX. The hide/unmount cleanup
      // above handles the only cases where we actually want to stop early.
    };
  }, [map, year, visible]);

  // Final unmount: stop the loop. The hide-cleanup above covers
  // visibility toggles; this catches a full HMR / map remount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pulsesRef.current = [];
    };
  }, []);
}

// HMR: this file installs MapLibre event listeners and layers via a
// setup-once pattern. Hot-replacing the module would leave stale closures
// attached to the map, so accept the update by triggering a full page
// reload instead. URL/localStorage state restores year, layers, theme, etc.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
