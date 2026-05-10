import type {
  GeoJSONSource,
  Map as MaplibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import { BATTLES } from "../data/battles";
import { CURATED_BATTLES } from "../data/battles.curated";
import { useStore } from "../store";
import { useDeferredYear } from "../utils/useDeferredYear";

const SOURCE_ID = "battles-src";
const GLOW_LAYER_ID = "battles-glow";
const HOVER_RING_LAYER_ID = "battles-hover-ring";
const SHOCKWAVE_SOURCE_ID = "battles-shockwave-src";
const SHOCKWAVE_LAYER_ID = "battles-shockwave";
const SPARK_SOURCE_ID = "battles-spark-src";
const SPARK_LAYER_ID = "battles-spark";
const ICON_LAYER_ID = "battles-icon";
const LABEL_LAYER_ID = "battles-label";
const SWORDS_ICON_ID = "battles-crossed-swords";

// Curated battles are the hand-picked, narrative-rich set — i.e., the ones
// worth labeling. We treat membership in this set as the proxy for "major
// battle" since the dataset doesn't carry a separate prominence flag.
const MAJOR_BATTLE_IDS: ReadonlySet<string> = new Set(
  CURATED_BATTLES.map((b) => b.id),
);

// Battles within ±WINDOW_YEARS of the current year are visible. Beyond that
// they're hidden entirely so the map doesn't clutter with every skirmish in
// history at once.
const WINDOW_YEARS = 15;

// One-time shockwave parameters (fires when the slider crosses a battle year).
const SHOCKWAVE_DURATION_MS = 1300;
const SHOCKWAVE_MAX_RADIUS = 64;

// Sparks: continuous low-rate emission while battle is in window, with a
// dramatic burst at the exact year crossing.
const SPARK_LIFE_MIN_MS = 600;
const SPARK_LIFE_RANGE_MS = 700;
const SPARK_SPAWN_RATE_PER_FRAME = 0.22; // probability/frame, scaled by proximity
const SPARK_BURST_COUNT = 14;
const SPARK_MAX = 90;

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

type BattleProps = {
  id: string;
  name: string;
  year: number;
  description: string;
  proximity: number;
  isPeak: boolean;
  isMajor: boolean;
  wikipedia: string;
  lng: number;
  lat: number;
};

function buildFeatures(year: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const b of BATTLES) {
    const dist = Math.abs(year - b.year);
    if (dist > WINDOW_YEARS) continue;
    const proximity = 1 - dist / WINDOW_YEARS;
    features.push({
      type: "Feature",
      id: b.id,
      geometry: { type: "Point", coordinates: [b.lng, b.lat] },
      properties: {
        id: b.id,
        name: b.name,
        year: b.year,
        description: b.description,
        proximity,
        isPeak: dist <= 1,
        isMajor: MAJOR_BATTLE_IDS.has(b.id),
        wikipedia: b.wikipedia ?? b.name,
        lng: b.lng,
        lat: b.lat,
      } satisfies BattleProps,
    });
  }
  // Higher-proximity battles draw on top so the user's "now" marker doesn't
  // get hidden under fading neighbors.
  features.sort((a, b) => {
    const ap = (a.properties as BattleProps).proximity ?? 0;
    const bp = (b.properties as BattleProps).proximity ?? 0;
    return ap - bp;
  });
  return { type: "FeatureCollection", features };
}

/**
 * Draws a small crossed-swords icon onto a canvas with baked-in colors and
 * a bright outline. Registering as a plain (non-SDF) icon keeps it visible
 * across every theme without depending on MapLibre's SDF tint pipeline,
 * which was unreliable when feeding it an HTMLCanvasElement directly.
 */
function makeSwordsCanvas(): HTMLCanvasElement {
  // Internal canvas is 2x the logical icon size so it renders crisp at
  // pixelRatio:2 on retina displays.
  const logical = 64;
  const dpr = 2;
  const size = logical * dpr;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.scale(dpr, dpr);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const drawSword = (rotation: number) => {
    ctx.save();
    ctx.translate(logical / 2, logical / 2);
    ctx.rotate(rotation);

    // Helper: paint a path with a bright outline + colored fill.
    const stamp = (color: string) => {
      ctx.strokeStyle = "rgba(255, 248, 230, 0.95)";
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fill();
    };

    // Blade — dark slate, points up, slight taper at the tip.
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(3, -21);
    ctx.lineTo(3, 11);
    ctx.lineTo(-3, 11);
    ctx.lineTo(-3, -21);
    ctx.closePath();
    stamp("#2a2e3a");

    // Crossguard — crimson, wider than the blade.
    ctx.beginPath();
    ctx.rect(-11, 11, 22, 4);
    stamp("#c41e3a");

    // Grip — dark slate, between crossguard and pommel.
    ctx.beginPath();
    ctx.rect(-3, 15, 6, 7);
    stamp("#2a2e3a");

    // Pommel — crimson disc.
    ctx.beginPath();
    ctx.arc(0, 24, 3.2, 0, Math.PI * 2);
    stamp("#c41e3a");

    ctx.restore();
  };

  drawSword(-Math.PI / 4);
  drawSword(Math.PI / 4);
  return c;
}

type Spark = {
  battleId: string;
  lng: number;
  lat: number;
  vx: number; // deg / ms
  vy: number;
  startTime: number;
  lifeMs: number;
};

type Shockwave = {
  startTime: number;
  lng: number;
  lat: number;
};

export function useBattlesLayer(map: MaplibreMap | null) {
  const year = useDeferredYear(80);
  const visible = useStore((s) => s.layers.battles);
  const theme = useStore((s) => s.theme);
  const setHover = useStore((s) => s.setHover);
  const setupForMap = useRef<MaplibreMap | null>(null);
  const sparksRef = useRef<Spark[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const hoveredIdRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const prevYearRef = useRef<number | null>(null);
  // Live mirror of the current source's features so the rAF loop knows which
  // battles are "active" (within the proximity window) without consulting
  // BATTLES + year on every frame.
  const activeBattlesRef = useRef<BattleProps[]>([]);

  const ensureLoop = (mapInstance: MaplibreMap) => {
    if (rafRef.current !== null) return;
    lastFrameTimeRef.current = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(now - lastFrameTimeRef.current, 64); // clamp huge gaps
      lastFrameTimeRef.current = now;

      // Continuous spark emission while battles are in window.
      const active = activeBattlesRef.current;
      if (active.length > 0 && sparksRef.current.length < SPARK_MAX) {
        for (const b of active) {
          if (sparksRef.current.length >= SPARK_MAX) break;
          // Higher proximity = higher chance of spawning; battles fading out
          // taper off naturally.
          if (
            Math.random() <
            SPARK_SPAWN_RATE_PER_FRAME * b.proximity * (dt / 16.6)
          ) {
            sparksRef.current.push(makeSpark(b.id, b.lng, b.lat, now));
          }
        }
      }

      // Advance + cull existing sparks.
      const aliveSparks: Spark[] = [];
      for (const s of sparksRef.current) {
        const age = now - s.startTime;
        if (age >= s.lifeMs) continue;
        s.lng += s.vx * dt;
        s.lat += s.vy * dt;
        aliveSparks.push(s);
      }
      sparksRef.current = aliveSparks;

      // Shockwaves age out on their own; we just cull expired ones.
      shockwavesRef.current = shockwavesRef.current.filter(
        (w) => now - w.startTime < SHOCKWAVE_DURATION_MS,
      );

      // Push particle features.
      const sparkSrc = mapInstance.getSource(SPARK_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      if (sparkSrc) {
        const features: GeoJSON.Feature[] = [];
        for (const s of sparksRef.current) {
          const age = (now - s.startTime) / s.lifeMs;
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [s.lng, s.lat] },
            properties: {
              age,
              opacity: Math.max(0, (1 - age) * 0.85),
              radius: 0.8 + age * 1.6,
            },
          });
        }
        sparkSrc.setData({ type: "FeatureCollection", features });
      }

      const waveSrc = mapInstance.getSource(SHOCKWAVE_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      if (waveSrc) {
        const features: GeoJSON.Feature[] = [];
        for (const w of shockwavesRef.current) {
          const age = (now - w.startTime) / SHOCKWAVE_DURATION_MS;
          // Ease-out: fast initial expansion, slow tail.
          const eased = 1 - Math.pow(1 - age, 2);
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [w.lng, w.lat] },
            properties: {
              radius: 6 + eased * (SHOCKWAVE_MAX_RADIUS - 6),
              opacity: Math.max(0, (1 - age) * 0.9),
            },
          });
        }
        waveSrc.setData({ type: "FeatureCollection", features });
      }

      const stillBusy =
        sparksRef.current.length > 0 ||
        shockwavesRef.current.length > 0 ||
        activeBattlesRef.current.length > 0;
      if (stillBusy) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (!map || setupForMap.current === map) return;
    setupForMap.current = map;

    // Register the crossed-swords icon. Non-SDF, colors baked in.
    // MapLibre 5.x's `addImage` typings accept ImageBitmap / ImageData /
    // HTMLImageElement but reject HTMLCanvasElement directly, so extract
    // ImageData first — that's the most reliable cross-version path.
    if (!map.hasImage(SWORDS_ICON_ID)) {
      const canvas = makeSwordsCanvas();
      const ctx = canvas.getContext("2d");
      if (ctx) {
        try {
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
          map.addImage(SWORDS_ICON_ID, data, { pixelRatio: 2 });
        } catch {
          // Worst case: icon never registers. The glow + sparks still
          // convey the battle visually.
        }
      }
    }

    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });
    map.addSource(SPARK_SOURCE_ID, { type: "geojson", data: EMPTY_FC });
    map.addSource(SHOCKWAVE_SOURCE_ID, { type: "geojson", data: EMPTY_FC });

    // ── Glow halo: soft red aura that intensifies near the exact year ──
    map.addLayer({
      id: GLOW_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          0, [
            "interpolate", ["linear"], ["coalesce", ["get", "proximity"], 0],
            0, 5, 1, 11,
          ],
          3, [
            "interpolate", ["linear"], ["coalesce", ["get", "proximity"], 0],
            0, 9, 1, 18,
          ],
          6, [
            "interpolate", ["linear"], ["coalesce", ["get", "proximity"], 0],
            0, 14, 1, 28,
          ],
          9, [
            "interpolate", ["linear"], ["coalesce", ["get", "proximity"], 0],
            0, 22, 1, 44,
          ],
        ],
        "circle-color": "#ff4d28",
        "circle-opacity": [
          "interpolate", ["linear"], ["coalesce", ["get", "proximity"], 0],
          0, 0.05,
          0.5, 0.20,
          1, 0.45,
        ],
        "circle-blur": 0.85,
      },
    });

    // ── Hover ring: thin gold halo on the hovered battle, driven by
    // MapLibre feature-state. Sits above the glow but below the icon so
    // the swords stay legible. Stroke width and opacity gate on
    // ['feature-state', 'hover'] === true; otherwise both go to 0 and
    // the layer is effectively invisible. ──
    map.addLayer({
      id: HOVER_RING_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          0, 12,
          3, 16,
          6, 22,
          9, 30,
        ],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": "#ffd86b",
        "circle-stroke-width": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          2.4,
          0,
        ],
        "circle-stroke-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.95,
          0,
        ],
        "circle-blur": 0.05,
      },
    });

    // ── Shockwave ring: expanding red outline at year crossing ──
    map.addLayer({
      id: SHOCKWAVE_LAYER_ID,
      type: "circle",
      source: SHOCKWAVE_SOURCE_ID,
      paint: {
        "circle-radius": ["coalesce", ["get", "radius"], 6],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": "#ff7a4a",
        "circle-stroke-width": 2.4,
        "circle-stroke-opacity": ["coalesce", ["get", "opacity"], 0],
        "circle-blur": 0.05,
      },
    });

    // ── Sparks: small bright particles flying outward ──
    map.addLayer({
      id: SPARK_LAYER_ID,
      type: "circle",
      source: SPARK_SOURCE_ID,
      paint: {
        "circle-radius": ["coalesce", ["get", "radius"], 1],
        "circle-color": "#ffd06b",
        "circle-stroke-color": "#fff7d0",
        "circle-stroke-width": 0.4,
        "circle-opacity": ["coalesce", ["get", "opacity"], 0],
        "circle-blur": 0.25,
      },
    });

    // ── Crossed-swords icon: the interactive bullseye ──
    // Canvas is rendered at 64 logical px (with pixelRatio:2 for sharpness),
    // so an icon-size of 1.0 = 64 CSS px. 0.5 ≈ 32 px feels right at zoom 6.
    map.addLayer({
      id: ICON_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        "icon-image": SWORDS_ICON_ID,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotation-alignment": "viewport",
        "icon-size": [
          "interpolate", ["linear"], ["zoom"],
          0, [
            "interpolate", ["linear"], ["coalesce", ["get", "proximity"], 0],
            0, 0.32, 1, 0.46,
          ],
          3, [
            "interpolate", ["linear"], ["coalesce", ["get", "proximity"], 0],
            0, 0.42, 1, 0.62,
          ],
          6, [
            "interpolate", ["linear"], ["coalesce", ["get", "proximity"], 0],
            0, 0.55, 1, 0.82,
          ],
          9, [
            "interpolate", ["linear"], ["coalesce", ["get", "proximity"], 0],
            0, 0.72, 1, 1.05,
          ],
        ],
        "symbol-sort-key": [
          "*", -1, ["coalesce", ["get", "proximity"], 0],
        ],
      },
      paint: {
        "icon-opacity": [
          "interpolate", ["linear"], ["coalesce", ["get", "proximity"], 0],
          0, 0.45,
          1, 1,
        ],
      },
    });

    // ── Battle name labels (curated/major battles only) ──
    // Only "major" battles get text — labeling every Wikidata-derived
    // skirmish would clutter the map. Opacity is tied to proximity so
    // labels appear only during the peak of each battle's timeline window.
    map.addLayer({
      id: LABEL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["boolean", ["coalesce", ["get", "isMajor"], false], false],
      layout: {
        "text-field": ["coalesce", ["get", "name"], ""],
        "text-font": ["literal", ["Noto Sans Bold"]],
        "text-size": [
          "interpolate", ["linear"], ["zoom"],
          0, 10,
          3, 11,
          6, 13,
          9, 15,
        ],
        "text-anchor": "top",
        // Push label below the swords icon. Offset grows with zoom so the
        // label always clears the (zoom-scaling) icon.
        "text-offset": [
          "interpolate", ["linear"], ["zoom"],
          0, ["literal", [0, 1.2]],
          6, ["literal", [0, 1.7]],
          9, ["literal", [0, 2.1]],
        ],
        "text-letter-spacing": 0.04,
        "text-max-width": 9,
        "text-padding": 2,
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        // Higher proximity = higher placement priority, so the closest-to-
        // current-year battle wins any label collision.
        "symbol-sort-key": ["*", -1, ["coalesce", ["get", "proximity"], 0]],
      },
      paint: {
        "text-color": "#ffd6c2",
        "text-halo-color": "rgba(0, 0, 0, 0.85)",
        "text-halo-width": 1.4,
        "text-halo-blur": 0.4,
        // Labels fade in only when the battle is near its peak years.
        "text-opacity": [
          "interpolate", ["linear"], ["coalesce", ["get", "proximity"], 0],
          0.0, 0.0,
          0.55, 0.0,
          0.85, 0.95,
          1.0, 1.0,
        ],
      },
    });

    // ── Hover / click interaction (icon layer is the hit target) ──
    // hoveredIdRef tracks the feature currently lit up via feature-state so
    // we can clear it when the cursor moves to a different battle or
    // leaves the layer entirely.
    const setHoveredFeature = (id: string | null) => {
      const prev = hoveredIdRef.current;
      if (prev === id) return;
      if (prev !== null) {
        try {
          map.setFeatureState({ source: SOURCE_ID, id: prev }, { hover: false });
        } catch {
          /* feature may have rolled out of the active window — ignore */
        }
      }
      if (id !== null) {
        try {
          map.setFeatureState({ source: SOURCE_ID, id }, { hover: true });
        } catch {
          /* same — feature may have just disappeared */
        }
      }
      hoveredIdRef.current = id;
    };

    const onMove = (e: MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [ICON_LAYER_ID],
      });
      const top = feats[0];
      if (!top) {
        setHoveredFeature(null);
        return;
      }
      const props = top.properties as unknown as BattleProps;
      setHoveredFeature(props.id);
      setHover({
        layer: "battles",
        id: props.id,
        name: props.name,
        detail: props.description,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        pointYear: props.year,
        wikipedia: props.wikipedia,
        lng: props.lng,
        lat: props.lat,
      });
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      setHoveredFeature(null);
      setHover(null);
      map.getCanvas().style.cursor = "";
    };
    const onClick = (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const top = e.features?.[0];
      if (!top) return;
      const props = top.properties as unknown as BattleProps;
      useStore.getState().setLocked({
        layer: "battles",
        id: props.id,
        name: props.name,
        detail: props.description,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        pointYear: props.year,
        wikipedia: props.wikipedia,
        lng: props.lng,
        lat: props.lat,
      });
    };

    map.on("mousemove", ICON_LAYER_ID, onMove);
    map.on("mouseleave", ICON_LAYER_ID, onLeave);
    map.on("click", ICON_LAYER_ID, onClick);

    return () => {
      map.off("mousemove", ICON_LAYER_ID, onMove);
      map.off("mouseleave", ICON_LAYER_ID, onLeave);
      map.off("click", ICON_LAYER_ID, onClick);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [map, setHover]);

  // Visibility: hide every sub-layer together. Animation loop self-stops
  // when activeBattlesRef empties (handled by the year effect below).
  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    const v = visible ? "visible" : "none";
    for (const id of [
      GLOW_LAYER_ID,
      HOVER_RING_LAYER_ID,
      SHOCKWAVE_LAYER_ID,
      SPARK_LAYER_ID,
      ICON_LAYER_ID,
      LABEL_LAYER_ID,
    ]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    }
    if (!visible) {
      // Drop in-flight particles immediately so toggling back on doesn't
      // flash a stale frame.
      sparksRef.current = [];
      shockwavesRef.current = [];
      activeBattlesRef.current = [];
      prevYearRef.current = null;
      // Also clear any lingering hover-state so toggling back on doesn't
      // resurrect a gold ring on a battle no longer under the cursor.
      if (hoveredIdRef.current !== null) {
        try {
          map.setFeatureState(
            { source: SOURCE_ID, id: hoveredIdRef.current },
            { hover: false },
          );
        } catch {
          /* ignore */
        }
        hoveredIdRef.current = null;
      }
    }
  }, [map, visible]);

  // Icon colors are baked into the canvas with a bright outline that reads
  // on every theme, so the icon needs no per-theme update. Labels still
  // need theme-aware text/halo colors.
  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    if (!map.getLayer(LABEL_LAYER_ID)) return;
    if (theme === "dark") {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", "#ffd6c2");
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-halo-color",
        "rgba(0, 0, 0, 0.85)",
      );
    } else if (theme === "light") {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", "#7a1414");
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-halo-color",
        "rgba(255, 255, 255, 0.95)",
      );
    } else {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", "#5a2410");
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-halo-color",
        "rgba(248, 232, 198, 0.92)",
      );
    }
  }, [map, theme]);

  // Year change → refresh icon source + active-battles mirror used by the
  // animation loop. Crossings (year passing through a battle.year) trigger
  // shockwaves and burst sparks.
  useEffect(() => {
    if (!map || setupForMap.current !== map || !visible) return;
    const fc = buildFeatures(year);
    (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(fc);

    activeBattlesRef.current = fc.features.map(
      (f) => f.properties as BattleProps,
    );

    const prev = prevYearRef.current;
    prevYearRef.current = year;

    // Detect year crossings. Skip the very first render and absurdly large
    // jumps (would flood with effects).
    if (prev !== null && prev !== year) {
      const delta = Math.abs(year - prev);
      if (delta > 0 && delta <= 400) {
        const lo = Math.min(prev, year) + 1;
        const hi = Math.max(prev, year);
        const now = performance.now();
        for (const b of BATTLES) {
          if (b.year < lo || b.year > hi) continue;
          shockwavesRef.current.push({
            startTime: now,
            lng: b.lng,
            lat: b.lat,
          });
          for (let i = 0; i < SPARK_BURST_COUNT; i++) {
            if (sparksRef.current.length >= SPARK_MAX) break;
            sparksRef.current.push(makeSpark(b.id, b.lng, b.lat, now));
          }
        }
        // Cap shockwaves so a fast scrub through a busy century doesn't
        // explode the loop's per-frame work.
        if (shockwavesRef.current.length > 24) {
          shockwavesRef.current = shockwavesRef.current.slice(-24);
        }
      }
    }

    if (
      activeBattlesRef.current.length > 0 ||
      sparksRef.current.length > 0 ||
      shockwavesRef.current.length > 0
    ) {
      ensureLoop(map);
    }
  }, [map, year, visible]);

  // Final unmount: kill the loop and drop refs.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      sparksRef.current = [];
      shockwavesRef.current = [];
      activeBattlesRef.current = [];
    };
  }, []);
}

function makeSpark(
  battleId: string,
  lng: number,
  lat: number,
  now: number,
): Spark {
  const angle = Math.random() * Math.PI * 2;
  // Geographic speed: ~0.0001–0.0004 deg/ms ≈ 10–45 m/ms at the equator. Looks
  // like 30–120 px/s of motion at zoom 5–6, which is the sweet spot for
  // "reading" battles. Faster than that turns into streaks; slower feels limp.
  const speed = 0.00012 + Math.random() * 0.00038;
  return {
    battleId,
    lng,
    lat,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    startTime: now,
    lifeMs: SPARK_LIFE_MIN_MS + Math.random() * SPARK_LIFE_RANGE_MS,
  };
}

// HMR: this file installs MapLibre event listeners and layers via a
// setup-once pattern. Hot-replacing the module would leave stale closures
// attached to the map, so accept the update by triggering a full page
// reload instead. URL/localStorage state restores year, layers, theme, etc.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
