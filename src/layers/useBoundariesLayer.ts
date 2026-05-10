import type {
  GeoJSONSource,
  Map as MaplibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import {
  BOUNDARY_SNAPSHOT_YEARS,
  fileForYear,
} from "../data/boundariesManifest";
import { useStore } from "../store";
import { colorFromName } from "../utils/colorHash";
import { pickSnapshotYear } from "../utils/pickSnapshot";

const SOURCE_ID = "boundaries-src";
const FILL_LAYER_ID = "boundaries-fill";
const LINE_LAYER_ID = "boundaries-line";
const HOVER_LINE_ID = "boundaries-hover-line";
const LABEL_LAYER_ID = "boundaries-label";

// Cross-fade companions. The "ghost" source/layers always hold the *other*
// neighbouring snapshot (the one we're scrubbing toward), and we fade them
// in proportional to year-position between the two snapshots so political
// boundaries feel like they morph instead of popping. Hover/click stay on
// the primary layers — the closer snapshot is the canonical truth.
const GHOST_SOURCE_ID = "boundaries-src-ghost";
const GHOST_FILL_LAYER_ID = "boundaries-fill-ghost";
const GHOST_LINE_LAYER_ID = "boundaries-line-ghost";

// Base fill opacities (idle / hover) that primary fill-opacity scales from.
// Pulled out so the cross-fade math reads cleanly.
const FILL_OPACITY_IDLE = 0.35;
const FILL_OPACITY_HOVER = 0.65;
const LINE_WIDTH_BASE = 0.6;

// Below this approximate bbox area (in degrees²) we shorten the label so a
// long name like "Bosnia and Herzegovina" doesn't overflow a tiny polygon.
// Labels for everything still appear; just compact for visual cleanliness.
const SMALL_COUNTRY_AREA_THRESHOLD = 12;
const MAX_SHORT_LABEL_LEN = 12;
// Above this bbox area (in degrees²) a country is treated as a "major
// empire" and gets ALL-CAPS + spaced-out lettering for visual weight.
// 800 deg² ≈ India-sized territory; covers historical empires (Roman,
// Mongol, Russian, USSR, USA, China) without including merely large
// countries like France or Spain.
const MAJOR_EMPIRE_AREA_THRESHOLD = 800;

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function bboxFromSource(
  map: MaplibreMap,
  name: string,
): [number, number, number, number] | null {
  // querySourceFeatures returns every feature in the loaded boundary source
  // (not just the one under the cursor). Aggregating across all matching
  // features gives a country its full bbox (e.g. all of Russia, not just the
  // tile containing the click).
  const feats = map.querySourceFeatures(SOURCE_ID, {
    filter: ["==", ["get", "NAME"], name],
  });
  if (!feats.length) return null;
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const f of feats) {
    const b = bboxOfGeometry(f.geometry as GeoJSON.Geometry);
    if (!b) continue;
    if (b[0] < minLng) minLng = b[0];
    if (b[1] < minLat) minLat = b[1];
    if (b[2] > maxLng) maxLng = b[2];
    if (b[3] > maxLat) maxLat = b[3];
  }
  if (!isFinite(minLng)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Pick the right bbox to feed into `map.fitBounds`. For most countries this
 * is just the full bbox, but countries that cross the antimeridian (Russia,
 * Fiji, USA with Alaska/Hawaii via Aleutians) end up with a span > 180° and
 * fitBounds would zoom all the way out. In that case, fall back to the bbox
 * of the largest contiguous part by area.
 */
function fitBoundsBbox(
  geom: GeoJSON.Geometry | null,
  fullBbox: [number, number, number, number],
): [number, number, number, number] {
  const span = fullBbox[2] - fullBbox[0];
  if (!geom || span <= 200 || geom.type !== "MultiPolygon") return fullBbox;

  let bestBbox: [number, number, number, number] | null = null;
  let bestArea = 0;
  for (const part of geom.coordinates) {
    const partBbox = bboxOfGeometry({ type: "Polygon", coordinates: part });
    if (!partBbox) continue;
    const area = (partBbox[2] - partBbox[0]) * (partBbox[3] - partBbox[1]);
    if (area > bestArea) {
      bestArea = area;
      bestBbox = partBbox;
    }
  }
  return bestBbox ?? fullBbox;
}

function geometryFromSource(
  snapshotYear: number,
  name: string,
): GeoJSON.Geometry | null {
  // Pull the full unclipped MultiPolygon from our cached snapshot so the focus
  // mask traces the real country outline (not the tile-clipped fragment under
  // the cursor).
  const fc = cache.get(snapshotYear);
  if (!fc) return null;
  const polys: GeoJSON.Position[][][] = [];
  for (const f of fc.features) {
    const p = f.properties as BoundaryProps;
    if (p.NAME !== name) continue;
    if (f.geometry.type === "Polygon") {
      polys.push(f.geometry.coordinates);
    } else if (f.geometry.type === "MultiPolygon") {
      for (const part of f.geometry.coordinates) polys.push(part);
    }
  }
  if (!polys.length) return null;
  return { type: "MultiPolygon", coordinates: polys };
}

function bboxOfGeometry(
  geom: GeoJSON.Geometry,
): [number, number, number, number] | null {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  const visit = (lng: number, lat: number) => {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  };
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates) {
      for (const [lng, lat] of ring) visit(lng, lat);
    }
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) {
      for (const ring of poly) {
        for (const [lng, lat] of ring) visit(lng, lat);
      }
    }
  } else {
    return null;
  }
  if (!isFinite(minLng)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

interface BoundaryProps {
  NAME?: string;
  SUBJECTO?: string;
  PARTOF?: string;
  wikipedia?: string;
  _color?: string;
  _key?: string;
  // Bbox area in degrees² (lng span × lat span). Cheap proxy for visual
  // size — drives label sizing and the long-name truncation rule. Real
  // geodesic area would be a lot of compute for marginal gain.
  _area?: number;
  // The label MapLibre actually renders. For small polygons with long
  // names we truncate to MAX_SHORT_LABEL_LEN + "…" so the text stays
  // inside the country shape; otherwise it's identical to NAME.
  _label?: string;
  // Major historical empires (area above MAJOR_EMPIRE_AREA_THRESHOLD).
  // Triggers ALL-CAPS + extra letter-spacing in the label paint expr.
  _isMajor?: boolean;
  // Vassal / subordinate state — has a SUBJECTO that differs from its
  // own name (e.g. "Bohemia" subject to "Habsburg"). Renders italic +
  // dimmed so the political map shows hierarchy at a glance.
  _isVassal?: boolean;
  // Font stack the label layer uses for this feature. Vassals get
  // italic; everyone else regular. text-font supports per-feature
  // expressions in MapLibre, so storing it on the feature avoids
  // splitting the layer in two.
  _font?: string[];
  // Per-feature label color. Computed from `_color` so the text reads
  // as a visually-related shade of the country's fill — quick at-a-
  // glance political grouping. The halo + opacity carry legibility.
  _textColor?: string;
}

function shortenLabel(name: string): string {
  if (name.length <= MAX_SHORT_LABEL_LEN) return name;
  // Try to truncate at a word boundary first so we don't end mid-word.
  const slice = name.slice(0, MAX_SHORT_LABEL_LEN);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 4 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
}

/**
 * Derive a high-contrast text colour from a fill colour by keeping the hue
 * but locking luminance to a band that reads as bright/light over the
 * basemap. We deliberately pick something near-white-ish-tinted rather
 * than fully matching, because colour-matched text on a similarly-tinted
 * basemap loses readability fast. The halo carries the rest of the
 * legibility.
 *
 * Accepts hex (#rgb / #rrggbb) and rgb(...) inputs; returns rgba string.
 */
function deriveTextColor(fill: string | undefined): string {
  // Fallback: nearly-white. Always legible against a halo of any colour.
  const fallback = "rgba(245, 247, 252, 0.95)";
  if (!fill) return fallback;
  let r: number;
  let g: number;
  let b: number;
  if (fill.startsWith("#")) {
    const hex = fill.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      return fallback;
    }
  } else if (fill.startsWith("rgb")) {
    const m = fill.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) return fallback;
    r = +m[1];
    g = +m[2];
    b = +m[3];
  } else {
    return fallback;
  }
  // Pull each channel up toward white, preserving the relative tint.
  // (255 - c) * 0.7 + c → approaches white but keeps the original direction.
  const lift = (c: number) => Math.round(c + (255 - c) * 0.72);
  return `rgba(${lift(r)}, ${lift(g)}, ${lift(b)}, 0.95)`;
}

function decorate(
  fc: GeoJSON.FeatureCollection,
): GeoJSON.FeatureCollection<GeoJSON.Geometry, BoundaryProps> {
  return {
    type: "FeatureCollection",
    features: fc.features.map((f, idx) => {
      const props = (f.properties ?? {}) as BoundaryProps;
      const name = props.NAME?.trim() || props.SUBJECTO?.trim() || "Unknown";
      const bbox = bboxOfGeometry(f.geometry as GeoJSON.Geometry);
      const area = bbox ? (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) : 0;
      const label =
        area < SMALL_COUNTRY_AREA_THRESHOLD ? shortenLabel(name) : name;
      const isMajor = area >= MAJOR_EMPIRE_AREA_THRESHOLD;
      const isVassal = !!(
        props.SUBJECTO && props.SUBJECTO.trim() !== name
      );
      const fill = colorFromName(props.SUBJECTO?.trim() || name);
      return {
        ...f,
        id: idx,
        properties: {
          ...props,
          NAME: name,
          _color: fill,
          _key: `${name}|${props.SUBJECTO ?? ""}|${idx}`,
          _area: area,
          _label: label,
          _isMajor: isMajor,
          _isVassal: isVassal,
          // Italic for vassals; regular otherwise. Both fonts are served
          // by the protomaps glyph endpoint set in the map style.
          _font: isVassal ? ["Noto Sans Italic"] : ["Noto Sans Regular"],
          _textColor: deriveTextColor(fill),
        },
      };
    }),
  };
}

// Decoded snapshots can be 500KB-2MB each; with ~50 known snapshot years and
// adaptive prefetch warming neighbours, the unbounded Map this used to be
// could grow well past 100MB on a long session. LRU it.
const MAX_CACHED_SNAPSHOTS = 16;
const cache = new Map<number, GeoJSON.FeatureCollection>();

function touchCache(year: number, fc: GeoJSON.FeatureCollection) {
  // Re-insert to bump to the most-recent end of Map iteration order.
  cache.delete(year);
  cache.set(year, fc);
  while (cache.size > MAX_CACHED_SNAPSHOTS) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

async function loadSnapshot(
  snapshotYear: number,
): Promise<GeoJSON.FeatureCollection> {
  const cached = cache.get(snapshotYear);
  if (cached) {
    // Bump LRU position even on cache hits so prefetched-but-unused snapshots
    // age out before ones the user actually views.
    touchCache(snapshotYear, cached);
    return cached;
  }
  const file = fileForYear(snapshotYear);
  const url = `${import.meta.env.BASE_URL}data/boundaries/${file}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status}`);
  }
  const raw = (await res.json()) as GeoJSON.FeatureCollection;
  const decorated = decorate(raw);
  touchCache(snapshotYear, decorated);
  return decorated;
}

export function useBoundariesLayer(map: MaplibreMap | null) {
  const year = useStore((s) => s.year);
  const visible = useStore((s) => s.layers.boundaries);
  const brightness = useStore((s) => s.boundaryBrightness);
  const theme = useStore((s) => s.theme);
  const setHover = useStore((s) => s.setHover);
  const setLoadingBoundary = useStore((s) => s.setLoadingBoundary);

  const setupForMap = useRef<MaplibreMap | null>(null);
  const hoveredKeyRef = useRef<string | null>(null);
  // Snapshot year currently loaded into the source. Read by the click handler
  // (set up once) so it can look up the unclipped country geometry.
  const snapshotYearRef = useRef<number | null>(null);
  // Track the last requested snapshot index + timestamp to infer the user's
  // scrub direction and speed for adaptive prefetching.
  const lastReqRef = useRef<{ idx: number; t: number } | null>(null);
  // Cross-fade weight in [0, 0.5]. 0 = year is exactly at a snapshot (no
  // ghost contribution); 0.5 = year is the perfect midpoint between two
  // snapshots (50/50 blend). The brightness + data effects both read this
  // when computing the final paint values, so they have to share a ref.
  const ghostWeightRef = useRef(0);
  // Last primary/ghost snapshot years actually pushed to the GeoJSON
  // sources. Tracking these lets the snapshot effect skip `setData` calls
  // when only the cross-fade weight changed — `setData` re-uploads the
  // FeatureCollection to the GPU, which is non-trivial work to do at the
  // 60+ Hz cadence of `year` updates during playback or fast scrubbing.
  const loadedPrimaryRef = useRef<number | null>(null);
  const loadedGhostRef = useRef<number | null>(null);

  // One-time setup of source + layers
  useEffect(() => {
    if (!map || setupForMap.current === map) return;
    setupForMap.current = map;

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: EMPTY_FC,
      promoteId: "_key",
    });

    // Ghost source holds the neighbouring snapshot for the cross-fade.
    // Same geometry contract as primary, but no feature-state interaction.
    map.addSource(GHOST_SOURCE_ID, {
      type: "geojson",
      data: EMPTY_FC,
      promoteId: "_key",
    });

    // Ghost fill goes UNDER the primary fill so it doesn't intercept clicks
    // or hover events. Starts at zero opacity; the snapshot effect below
    // bumps it up when the user is between two snapshot years.
    map.addLayer({
      id: GHOST_FILL_LAYER_ID,
      type: "fill",
      source: GHOST_SOURCE_ID,
      paint: {
        "fill-color": ["coalesce", ["get", "_color"], "#888"],
        "fill-opacity": 0,
        // Smooth the per-tick opacity bumps so we get cinematic morphs even
        // at fast scrub speeds where the rAF tick rate would otherwise
        // produce a stair-step appearance.
        "fill-opacity-transition": { duration: 220, delay: 0 },
      },
    });

    map.addLayer({
      id: GHOST_LINE_LAYER_ID,
      type: "line",
      source: GHOST_SOURCE_ID,
      paint: {
        "line-color": "rgba(20, 20, 28, 0.7)",
        "line-width": 0,
        "line-width-transition": { duration: 220, delay: 0 },
      },
    });

    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": ["coalesce", ["get", "_color"], "#888"],
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          FILL_OPACITY_HOVER,
          FILL_OPACITY_IDLE,
        ],
        "fill-opacity-transition": { duration: 220, delay: 0 },
      },
    });

    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": "rgba(20, 20, 28, 0.7)",
        "line-width": LINE_WIDTH_BASE,
        "line-width-transition": { duration: 220, delay: 0 },
      },
    });

    map.addLayer({
      id: HOVER_LINE_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": "#ffffff",
        "line-width": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          2,
          0,
        ],
      },
    });

    // Country labels. Symbol layer over the same polygon source. MapLibre
    // automatically picks an interior label point for each polygon, so we
    // don't have to compute centroids ourselves.
    //
    //  - text-size scales with both zoom AND polygon area, so big countries
    //    read at low zoom and tiny countries don't shout.
    //  - symbol-sort-key is *negative* area so MapLibre's label collision
    //    pass picks the larger polygon's label first when two would overlap.
    //    (Lower sort-key wins; -area means largest area = most negative.)
    //  - text-allow-overlap stays false so we get clean automatic decluttering.
    //  - Halo + text-padding for legibility against the basemap.
    //  - Initial paint is the dark-theme palette; the theme effect below
    //    swaps colours per active theme.
    map.addLayer({
      id: LABEL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        "text-field": ["coalesce", ["get", "_label"], ["get", "NAME"]],
        // Per-feature font: vassals get Italic, sovereigns get Regular.
        "text-font": [
          "case",
          ["coalesce", ["get", "_isVassal"], false],
          ["literal", ["Noto Sans Italic"]],
          ["literal", ["Noto Sans Regular"]],
        ],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "_area"], 0],
            0, 0,        // hide labels for zero-area features
            2, 9,        // tiny countries: 9px even at world view
            50, 11,
            500, 13,
            5000, 15,
          ],
          4,
          [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "_area"], 0],
            0, 10,
            2, 11,
            50, 13,
            500, 15,
            5000, 17,
          ],
          7,
          [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "_area"], 0],
            0, 12,
            2, 13,
            50, 15,
            500, 18,
            5000, 22,
          ],
        ],
        // Major empires get tracking out so the name spreads across the
        // territory like a National Geographic atlas. Smaller countries
        // stay at a normal letter-spacing.
        "text-letter-spacing": [
          "case",
          ["coalesce", ["get", "_isMajor"], false],
          0.18,
          0.04,
        ],
        "text-max-width": 8,
        "text-padding": 4,
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "symbol-sort-key": [
          "*",
          -1,
          ["coalesce", ["get", "_area"], 0],
        ],
        // ALL CAPS for major empires — visual weight on the great powers.
        "text-transform": [
          "case",
          ["coalesce", ["get", "_isMajor"], false],
          "uppercase",
          "none",
        ],
      },
      paint: {
        // Per-feature text color (derived from the country's fill, lifted
        // toward white so it stays legible). The theme effect below
        // overrides this for light/sepia themes which want darker text.
        "text-color": [
          "coalesce",
          ["get", "_textColor"],
          "rgba(245, 247, 252, 0.95)",
        ],
        "text-halo-color": "rgba(8, 10, 14, 0.85)",
        "text-halo-width": 1.4,
        "text-halo-blur": 0.6,
        // Vassals fade to ~60% opacity so the political hierarchy reads
        // at a glance: sovereigns bold, vassals subdued.
        "text-opacity": [
          "case",
          ["coalesce", ["get", "_isVassal"], false],
          0.6,
          1.0,
        ],
        // Smooth fade when boundaries swap on year scrub — labels glide
        // in/out instead of popping.
        "text-opacity-transition": {
          duration: 280,
          delay: 0,
        },
        "text-color-transition": {
          duration: 280,
          delay: 0,
        },
      },
    });

    const onMove = (e: MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [FILL_LAYER_ID],
      });
      const top = feats[0];
      const key = (top?.properties as BoundaryProps | undefined)?._key ?? null;

      if (hoveredKeyRef.current && hoveredKeyRef.current !== key) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredKeyRef.current },
          { hover: false },
        );
      }
      hoveredKeyRef.current = key;
      if (key) {
        map.setFeatureState({ source: SOURCE_ID, id: key }, { hover: true });
        const props = top!.properties as BoundaryProps;
        const subjectTo =
          props.SUBJECTO && props.SUBJECTO !== props.NAME
            ? `Subject to ${props.SUBJECTO}`
            : undefined;
        setHover({
          layer: "boundaries",
          name: props.NAME ?? "Unknown",
          detail: subjectTo,
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
          wikipedia: props.wikipedia,
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
        });
        map.getCanvas().style.cursor = "pointer";
      } else {
        setHover(null);
        map.getCanvas().style.cursor = "";
      }
    };

    const onLeave = () => {
      if (hoveredKeyRef.current) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredKeyRef.current },
          { hover: false },
        );
        hoveredKeyRef.current = null;
      }
      setHover(null);
      map.getCanvas().style.cursor = "";
    };

    map.on("mousemove", FILL_LAYER_ID, onMove);
    map.on("mouseleave", FILL_LAYER_ID, onLeave);

    map.on("click", FILL_LAYER_ID, (e) => {
      const top = e.features?.[0];
      if (!top) return;
      const props = top.properties as BoundaryProps;
      const name = props.NAME ?? "Unknown";
      const store = useStore.getState();
      store.setLocked({
        layer: "boundaries",
        name,
        detail:
          props.SUBJECTO && props.SUBJECTO !== props.NAME
            ? `Subject to ${props.SUBJECTO}`
            : undefined,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        wikipedia: props.wikipedia,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      });
      // Walk every queryable boundary feature in the source so the bbox
      // covers all islands / multi-tile portions of the same country, not
      // just the rendered tile under the cursor.
      let bbox = bboxFromSource(map, name);
      if (!bbox) bbox = bboxOfGeometry(top.geometry);
      if (!bbox) {
        // Fallback to a small bbox around the click point.
        const r = 4;
        bbox = [
          e.lngLat.lng - r,
          e.lngLat.lat - r,
          e.lngLat.lng + r,
          e.lngLat.lat + r,
        ];
      }
      const snapYear = snapshotYearRef.current;
      const geometry =
        snapYear != null ? geometryFromSource(snapYear, name) : null;
      store.setFocusedCountry({
        name,
        bbox,
        geometry: geometry ?? undefined,
      });
      store.setFocusBbox(bbox);
      store.setToast(`${name} pinned · use the tooltip to show details`);
      // Smoothly fit the camera to the country (or its largest part for
      // antimeridian-crossing geometries). Skip when the user is in globe
      // projection -- fitBounds at globe-low zoom looks jarring.
      const cameraBbox = fitBoundsBbox(geometry, bbox);
      try {
        map.fitBounds(
          [
            [cameraBbox[0], cameraBbox[1]],
            [cameraBbox[2], cameraBbox[3]],
          ],
          { padding: 80, maxZoom: 5, duration: 800 },
        );
      } catch {
        // fitBounds can throw on degenerate bboxes; safe to ignore.
      }
    });
  }, [map, setHover]);

  // Visibility
  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    const v = visible ? "visible" : "none";
    for (const id of [
      FILL_LAYER_ID,
      LINE_LAYER_ID,
      HOVER_LINE_ID,
      LABEL_LAYER_ID,
      GHOST_FILL_LAYER_ID,
      GHOST_LINE_LAYER_ID,
    ]) {
      map.setLayoutProperty(id, "visibility", v);
    }
  }, [map, visible]);

  // Theme-aware label colours. Each basemap has a different luminance
  // floor, so we pick text/halo combos that stay legible whether the
  // label sits on land or ocean.
  //
  // Dark theme: keep the per-feature `_textColor` (each country's fill
  // lifted toward white). The dark basemap makes those tints readable
  // and you get a subtle political-grouping cue from the colour.
  //
  // Light + sepia: those tints are too pale to read against the bright
  // basemaps, so override to a single dark text colour (matched to the
  // theme palette) and put the contrast in the halo.
  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    if (!map.getLayer(LABEL_LAYER_ID)) return;
    if (theme === "light") {
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-color",
        "rgba(28, 32, 44, 0.92)",
      );
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-halo-color",
        "rgba(252, 252, 248, 0.95)",
      );
    } else if (theme === "sepia") {
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-color",
        "rgba(58, 38, 18, 0.92)",
      );
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-halo-color",
        "rgba(248, 232, 198, 0.92)",
      );
    } else {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", [
        "coalesce",
        ["get", "_textColor"],
        "rgba(245, 247, 252, 0.95)",
      ]);
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-halo-color",
        "rgba(8, 10, 14, 0.85)",
      );
    }
  }, [map, theme]);

  // Apply primary + ghost paint values from current ghost weight + brightness.
  // Pulled out so both the brightness effect and the data effect can call it
  // without duplicating the math (brightness scales the *base* opacities,
  // ghostWeight scales primary down and ghost up).
  function applyCrossfadePaint(b: number) {
    if (!map || setupForMap.current !== map) return;
    const ghostW = ghostWeightRef.current;
    const primaryW = 1 - ghostW;
    map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      Math.min(1, FILL_OPACITY_HOVER * b * primaryW),
      Math.min(1, FILL_OPACITY_IDLE * b * primaryW),
    ]);
    map.setPaintProperty(LINE_LAYER_ID, "line-width", LINE_WIDTH_BASE * b * primaryW);
    map.setPaintProperty(
      GHOST_FILL_LAYER_ID,
      "fill-opacity",
      Math.min(1, FILL_OPACITY_IDLE * b * ghostW),
    );
    map.setPaintProperty(
      GHOST_LINE_LAYER_ID,
      "line-width",
      LINE_WIDTH_BASE * b * ghostW,
    );
  }

  // Brightness
  useEffect(() => {
    applyCrossfadePaint(brightness);
    // applyCrossfadePaint reads `map` + `setupForMap` from closure; safe
    // to omit from deps since they're refs/props that the next render
    // will rebuild this closure with anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, brightness]);

  // Snapshot data update
  useEffect(() => {
    if (!map || setupForMap.current !== map || !visible) return;
    const primaryYear = pickSnapshotYear(BOUNDARY_SNAPSHOT_YEARS, year);
    const primaryIdx = BOUNDARY_SNAPSHOT_YEARS.indexOf(primaryYear);

    // Pick the *other* neighbouring snapshot (the one we're scrubbing
    // toward) and a 0..0.5 weight for the cross-fade. We cap at 0.5 so the
    // primary always reads as the dominant truth — the closer snapshot is
    // the one hover/click target. At the exact midpoint, both layers
    // contribute equally; further from the midpoint, ghost fades out.
    let ghostYear: number | null = null;
    let ghostWeight = 0;
    if (year < primaryYear && primaryIdx > 0) {
      const prevYear = BOUNDARY_SNAPSHOT_YEARS[primaryIdx - 1];
      const span = primaryYear - prevYear;
      if (span > 0) {
        ghostYear = prevYear;
        ghostWeight = Math.min(0.5, (primaryYear - year) / span);
      }
    } else if (
      year > primaryYear &&
      primaryIdx < BOUNDARY_SNAPSHOT_YEARS.length - 1
    ) {
      const nextYear = BOUNDARY_SNAPSHOT_YEARS[primaryIdx + 1];
      const span = nextYear - primaryYear;
      if (span > 0) {
        ghostYear = nextYear;
        ghostWeight = Math.min(0.5, (year - primaryYear) / span);
      }
    }
    ghostWeightRef.current = ghostWeight;
    applyCrossfadePaint(brightness);

    let cancelled = false;
    const primaryAlreadyLoaded = loadedPrimaryRef.current === primaryYear;

    if (primaryAlreadyLoaded) {
      // Primary snapshot is unchanged from the last tick — only the
      // cross-fade weight moved. We've already applied it above; nothing
      // else to do for the primary source.
      snapshotYearRef.current = primaryYear;
    } else {
      const wasCached = cache.has(primaryYear);
      if (!wasCached) setLoadingBoundary(true);

      loadSnapshot(primaryYear)
        .then((fc) => {
          if (cancelled) return;
          const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
          src?.setData(fc);
          loadedPrimaryRef.current = primaryYear;
          snapshotYearRef.current = primaryYear;
          // Always clear the loading flag on an uncancelled resolution.
          // The previous code only cleared when `!wasCached`, which left
          // the spinner stuck in a specific race: a prior tick set
          // loading=true, was cancelled mid-fetch (so its .then bailed
          // before clearing), the cache populated, and the next tick saw
          // `wasCached=true` and so didn't clear either. Idempotent
          // unconditional clear is simpler and bug-free.
          setLoadingBoundary(false);
          // Adaptive prefetch: always grab ±1, then if the user is scrubbing
          // fast in one direction (snapshot index changed within ~600ms),
          // pull two more in that direction so the next two hops are warm.
          const now = performance.now();
          const last = lastReqRef.current;
          const wantIdxs = new Set<number>([primaryIdx - 1, primaryIdx + 1]);
          if (last && now - last.t < 600 && last.idx !== primaryIdx) {
            const dir = primaryIdx > last.idx ? 1 : -1;
            wantIdxs.add(primaryIdx + dir * 2);
            wantIdxs.add(primaryIdx + dir * 3);
          }
          lastReqRef.current = { idx: primaryIdx, t: now };
          for (const adjIdx of wantIdxs) {
            if (adjIdx >= 0 && adjIdx < BOUNDARY_SNAPSHOT_YEARS.length) {
              void loadSnapshot(BOUNDARY_SNAPSHOT_YEARS[adjIdx]).catch(() => {});
            }
          }
        })
        .catch((err) => {
          if (!cancelled) setLoadingBoundary(false);
          console.error("Failed to load boundary snapshot", primaryYear, err);
        });
    }

    // Update the ghost source in parallel — it doesn't gate `loading` since
    // the cross-fade is purely cosmetic, and a missing ghost just means the
    // snap-to-nearest behaviour the app shipped with. Only push data when
    // the ghost neighbour actually changed; weight-only updates are paint.
    if (ghostYear !== null) {
      if (loadedGhostRef.current !== ghostYear) {
        const ghostSrc = map.getSource(GHOST_SOURCE_ID) as
          | GeoJSONSource
          | undefined;
        const ghostFc = cache.get(ghostYear);
        if (ghostFc) {
          ghostSrc?.setData(ghostFc);
          loadedGhostRef.current = ghostYear;
        } else {
          const ghostYearForLoad = ghostYear;
          loadSnapshot(ghostYearForLoad)
            .then((fc) => {
              if (cancelled) return;
              // Only paint the ghost if the user's still in the same
              // fade window — otherwise we'd flash a stale neighbour
              // after a long scrub.
              if (loadedGhostRef.current !== ghostYearForLoad) {
                ghostSrc?.setData(fc);
                loadedGhostRef.current = ghostYearForLoad;
              }
            })
            .catch(() => {});
        }
      }
    } else if (loadedGhostRef.current !== null) {
      // No ghost neighbour (year is past the last snapshot or before the
      // first) — clear once so we don't see stale geometry.
      const ghostSrc = map.getSource(GHOST_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      ghostSrc?.setData(EMPTY_FC);
      loadedGhostRef.current = null;
    }

    return () => {
      cancelled = true;
    };
  }, [map, year, visible, brightness, setLoadingBoundary]);
}

// HMR: this file installs MapLibre event listeners and layers via a
// setup-once pattern. Hot-replacing the module would leave stale closures
// attached to the map, so accept the update by triggering a full page
// reload instead. URL/localStorage state restores year, layers, theme, etc.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
