import maplibregl, { Map as MaplibreMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useBattlesLayer } from "../layers/useBattlesLayer";
import { useBoundariesLayer } from "../layers/useBoundariesLayer";
import { useCitiesLayer } from "../layers/useCitiesLayer";
import { useConnectionsLayer } from "../layers/useConnectionsLayer";
import { useDisastersLayer } from "../layers/useDisastersLayer";
import { useEventsLayer } from "../layers/useEventsLayer";
import { useFocusMaskLayer } from "../layers/useFocusMaskLayer";
import { useLanguagesLayer } from "../layers/useLanguagesLayer";
import { useMigrationsLayer } from "../layers/useMigrationsLayer";
import { usePeopleLayer } from "../layers/usePeopleLayer";
import { usePeoplesLayer } from "../layers/usePeoplesLayer";
import { usePopulationLayer } from "../layers/usePopulationLayer";
import { useReligionsLayer } from "../layers/useReligionsLayer";
import { useSeaLevelLayer } from "../layers/useSeaLevelLayer";
import { ThemeId, useStore, type LayerId } from "../store";
import { ContinentView } from "../utils/continents";
import { setMapInstance } from "../utils/mapInstance";

const INTERACTIVE_LAYER_IDS = [
  "boundaries-fill",
  "cities-circle",
  "events-circle",
  "battles-icon",
  "peoples-fill",
  "sealevel-fill",
  "connections-trade",
  "connections-migration",
  "religions-fill",
  "languages-fill",
  "disasters-marker",
  "people-marker",
  "migrations-line",
];

function layerIdToType(layerId: string): LayerId | null {
  switch (layerId) {
    case "boundaries-fill":
      return "boundaries";
    case "cities-circle":
      return "cities";
    case "events-circle":
      return "events";
    case "battles-icon":
      return "battles";
    case "peoples-fill":
      return "peoples";
    case "sealevel-fill":
      return "sealevel";
    case "religions-fill":
      return "religions";
    case "languages-fill":
      return "languages";
    case "disasters-marker":
      return "disasters";
    case "people-marker":
      return "people";
    case "migrations-line":
      return "migrations";
    case "connections-trade":
    case "connections-migration":
      return "connections";
    default:
      return null;
  }
}

type ChoiceOption = NonNullable<
  ReturnType<typeof useStore.getState>["pendingChoice"]
>["options"][number];

/**
 * Best-effort extraction of a chooser option from any rendered feature. Each
 * layer's source adds slightly different property keys; this collapses them
 * into the small shape the chooser popup needs.
 */
function featureToChoiceOption(
  f: maplibregl.MapGeoJSONFeature,
  fallbackLng: number,
  fallbackLat: number,
): ChoiceOption | null {
  const layer = layerIdToType(f.layer?.id ?? "");
  if (!layer) return null;
  const props = (f.properties ?? {}) as Record<string, unknown>;

  let lng = fallbackLng;
  let lat = fallbackLat;
  if (f.geometry?.type === "Point") {
    const c = (f.geometry as GeoJSON.Point).coordinates;
    if (Array.isArray(c) && c.length >= 2) {
      lng = c[0] as number;
      lat = c[1] as number;
    }
  } else if (typeof props.lng === "number" && typeof props.lat === "number") {
    lng = props.lng as number;
    lat = props.lat as number;
  }

  const name =
    (props.name as string | undefined) ?? (props.NAME as string | undefined) ?? "Unknown";
  const id = (props.id as string | undefined) ?? undefined;
  const detail = (props.note as string | undefined) ?? undefined;
  const wikipedia = (props.wikipedia as string | undefined) ?? undefined;

  const start = (props.start ?? props.founded ?? props.birth) as number | undefined;
  const end = (props.end ?? props.abandoned ?? props.death) as number | undefined;
  const pointYear = (props.year ?? props.pointYear) as number | undefined;

  return {
    layer,
    id,
    name,
    detail,
    wikipedia,
    lng,
    lat,
    rangeStart: typeof start === "number" ? start : undefined,
    rangeEnd: typeof end === "number" ? end : undefined,
    pointYear: typeof pointYear === "number" ? pointYear : undefined,
  };
}

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// CARTO offers three raster basemaps:
//   - Positron (light_*)  — pale grey/blue, the standard "light" style
//   - Dark Matter (dark_*) — deep navy, the standard "dark" style
//   - Voyager (rastertiles/voyager_*) — warm cream/tan, light-ish
// We map each app theme to the closest one, then nudge it via the
// raster-* paint adjustments in styleFor() (sepia layers warm tones over
// Voyager since Voyager is already cream-toned).
const TILES_BY_THEME: Record<ThemeId, string[]> = {
  dark: [
    "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
    "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
    "https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
  ],
  light: [
    "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
    "https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
    "https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
  ],
  sepia: [
    "https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png",
    "https://b.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png",
    "https://c.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png",
  ],
};

// Paint tweaks applied on top of the base tiles for each theme. Sepia
// uses Voyager (already warm) and pushes saturation + hue toward the
// classic browning sepia tone; dark and light render their tiles as-is.
const PAINT_BY_THEME: Record<ThemeId, Record<string, number | number[] | string>> = {
  dark: {},
  light: {},
  sepia: {
    "raster-hue-rotate": -15,
    "raster-saturation": 0.15,
    "raster-contrast": 0.05,
    "raster-brightness-max": 0.92,
  },
};

function styleFor(theme: ThemeId): StyleSpecification {
  return {
    version: 8,
    // Required for any symbol/text layer to render. Without this MapLibre
    // silently no-ops on `text-field`. Protomaps hosts a public Noto Sans
    // glyph PBF endpoint that's free, CDN-backed, and supports the font
    // stacks our boundary labels reference.
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sources: {
      carto: {
        type: "raster",
        tiles: TILES_BY_THEME[theme],
        tileSize: 256,
        attribution: ATTRIBUTION,
      },
    },
    layers: [
      {
        id: "carto-tiles",
        type: "raster",
        source: "carto",
        minzoom: 0,
        maxzoom: 22,
        paint: PAINT_BY_THEME[theme],
      },
    ],
  };
}

const IDLE_BEFORE_SPIN_MS = 120_000; // 2 minutes of inactivity before resuming
const SPIN_DEG_PER_SEC = 3;

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const projection = useStore((s) => s.projection);
  const theme = useStore((s) => s.theme);
  const autoSpin = useStore((s) => s.autoSpin);
  const setLocked = useStore((s) => s.setLocked);

  // Map is constructed ONCE. Theme changes used to recreate the entire
  // MapLibre instance — tearing down all GeoJSON sources, layers, event
  // listeners, and re-fetching every boundary snapshot. Now we just swap
  // the carto basemap source in place via the theme effect below.
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: styleFor(useStore.getState().theme),
      center: [20, 30],
      zoom: 2.2,
      maxZoom: 7,
      minZoom: 0.5,
      attributionControl: { compact: true },
      // Required so getCanvas().toDataURL() captures content for PNG export.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });

    instance.addControl(new maplibregl.NavigationControl({}), "bottom-left");

    instance.on("load", () => {
      if (!cancelled) {
        setMap(instance);
        setMapInstance(instance);
      }
    });

    // Centralised click handler. Runs after every per-layer click handler.
    // Three responsibilities:
    //   1. If the click hit no interactive features, unpin the tooltip.
    //   2. If the click hit features in 2+ distinct layers, undo what the
    //      individual handlers just did and open the chooser instead.
    //   3. Otherwise leave the per-layer handler's setLocked alone.
    instance.on("click", (e) => {
      const present = INTERACTIVE_LAYER_IDS.filter((id) => instance.getLayer(id));
      const feats = present.length
        ? instance.queryRenderedFeatures(e.point, { layers: present })
        : [];
      if (feats.length === 0) {
        setLocked(null);
        return;
      }
      // Deduplicate options by (layer, id|name) so the same feature returned
      // from a fill + outline + halo doesn't appear three times.
      const byKey = new Map<string, ChoiceOption>();
      for (const f of feats) {
        const opt = featureToChoiceOption(
          f as maplibregl.MapGeoJSONFeature,
          e.lngLat.lng,
          e.lngLat.lat,
        );
        if (!opt) continue;
        const key = `${opt.layer}:${opt.id ?? opt.name}`;
        if (!byKey.has(key)) byKey.set(key, opt);
      }
      const options = Array.from(byKey.values());
      if (options.length <= 1) return;

      // Multi-layer click: clear whatever the layer handlers may have just
      // pinned + focused, and let the user pick. fitBounds (boundaries) has
      // already started animating; that's an acceptable consequence — the
      // chooser is the right UX, even if the camera is already moving.
      const store = useStore.getState();
      store.setLocked(null);
      store.setFocusedCountry(null);
      store.setFocusBbox(null);
      store.setDetailPanelOpen(false);
      store.setPendingChoice({
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        options,
      });
    });

    return () => {
      cancelled = true;
      setMapInstance(null);
      instance.remove();
      setMap(null);
    };
    // Mount-once effect — map instance created and torn down exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply theme by swapping just the carto basemap source — keeps all of
  // our GeoJSON sources, layers, hover state, and the camera position
  // intact across theme changes.
  useEffect(() => {
    if (!map) return;
    if (!map.getSource("carto")) return;
    const layers = map.getStyle().layers ?? [];
    const cartoIdx = layers.findIndex((l) => l.id === "carto-tiles");
    const beforeId =
      cartoIdx >= 0 && cartoIdx < layers.length - 1 ? layers[cartoIdx + 1].id : undefined;
    if (map.getLayer("carto-tiles")) map.removeLayer("carto-tiles");
    map.removeSource("carto");
    map.addSource("carto", {
      type: "raster",
      tiles: TILES_BY_THEME[theme],
      tileSize: 256,
      attribution: ATTRIBUTION,
    });
    map.addLayer(
      {
        id: "carto-tiles",
        type: "raster",
        source: "carto",
        minzoom: 0,
        maxzoom: 22,
        paint: PAINT_BY_THEME[theme],
      },
      beforeId,
    );
  }, [map, theme]);

  useEffect(() => {
    if (!map) return;
    map.setProjection({
      type: projection === "globe" ? "globe" : "mercator",
    });
  }, [map, projection]);

  // Auto-spin: starts immediately on load, stops on any interaction,
  // resumes after IDLE_BEFORE_SPIN_MS of inactivity.
  useEffect(() => {
    if (!map) return;
    if (projection !== "globe" || !autoSpin) return;

    let interacted = false;
    let lastInteract = 0;
    let raf = 0;
    let lastFrame = performance.now();

    const onInteract = () => {
      interacted = true;
      lastInteract = performance.now();
    };

    const mapEvents = ["mousedown", "touchstart", "wheel", "dragstart", "click"] as const;
    for (const ev of mapEvents) map.on(ev, onInteract);

    const onWindowInteract = () => onInteract();
    window.addEventListener("keydown", onWindowInteract);

    const loop = (t: number) => {
      const dt = (t - lastFrame) / 1000;
      lastFrame = t;
      const idle = !interacted || t - lastInteract > IDLE_BEFORE_SPIN_MS;
      if (idle) {
        const c = map.getCenter();
        map.jumpTo({ center: [c.lng + SPIN_DEG_PER_SEC * dt, c.lat] });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      for (const ev of mapEvents) map.off(ev, onInteract);
      window.removeEventListener("keydown", onWindowInteract);
    };
  }, [map, projection, autoSpin]);

  // Listen for flyto / save-png events from the rest of the UI
  useEffect(() => {
    if (!map) return;
    const onFlyto = (e: Event) => {
      const detail = (
        e as CustomEvent<
          ContinentView | { center: [number, number]; zoom?: number; duration?: number }
        >
      ).detail;
      if (!detail) return;
      map.flyTo({
        center: detail.center,
        zoom: detail.zoom ?? map.getZoom(),
        duration:
          "duration" in detail && typeof detail.duration === "number" ? detail.duration : 900,
        essential: true,
      });
    };
    const onSavePng = () => {
      try {
        // Need to render once with preserve so the canvas has data
        map.triggerRepaint();
        requestAnimationFrame(() => {
          const url = map.getCanvas().toDataURL("image/png");
          const a = document.createElement("a");
          const y = useStore.getState().year;
          const yearLabel = y < 0 ? `bc${Math.abs(y)}` : `ce${y}`;
          a.download = `strata-${yearLabel}.png`;
          a.href = url;
          a.click();
        });
      } catch (err) {
        console.error("PNG export failed:", err);
      }
    };
    window.addEventListener("hs:flyto", onFlyto);
    window.addEventListener("hs:savepng", onSavePng);
    return () => {
      window.removeEventListener("hs:flyto", onFlyto);
      window.removeEventListener("hs:savepng", onSavePng);
    };
  }, [map]);

  // The pinned tooltip leader-line anchor used to be repositioned by writing
  // {x, y} back into store.locked on every map move/zoom/rotate frame. That
  // re-rendered every component subscribed to the store. The Tooltip itself
  // now subscribes directly to the map via subscribeMapInstance() and
  // reprojects locked.lng/lat to screen coords locally — no store cascade.

  useSeaLevelLayer(map);
  useBoundariesLayer(map);
  useReligionsLayer(map);
  useLanguagesLayer(map);
  usePeoplesLayer(map);
  useConnectionsLayer(map);
  useMigrationsLayer(map);
  useCitiesLayer(map);
  useEventsLayer(map);
  useBattlesLayer(map);
  useDisastersLayer(map);
  usePeopleLayer(map);
  usePopulationLayer(map);
  useFocusMaskLayer(map);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        // Transparent so the StarField (in globe mode) shows through the
        // areas outside the planet's silhouette. The canvas itself paints
        // the entire viewport in mercator mode, and html/body fall back to
        // var(--bg) any time both are absent.
        background: "transparent",
      }}
    />
  );
}

// HMR: MapView constructs the MapLibre instance and wires the projection /
// theme / interaction listeners imperatively. Hot-replacing it would orphan
// those handlers on the live map, so trigger a full reload on update.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
