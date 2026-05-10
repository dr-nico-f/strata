import type { GeoJSONSource, Map as MaplibreMap, MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { LANGUAGE_FAMILIES, activeLanguageStage } from "../data/languages";
import { useStore } from "../store";
import { useDeferredYear } from "../utils/useDeferredYear";

const SOURCE_ID = "languages-src";
const FILL_LAYER_ID = "languages-fill";
const LINE_LAYER_ID = "languages-line";
const LABEL_LAYER_ID = "languages-label";

const close = (poly: Array<[number, number]>): Array<[number, number]> =>
  poly.length &&
  (poly[0][0] !== poly[poly.length - 1][0] || poly[0][1] !== poly[poly.length - 1][1])
    ? [...poly, poly[0]]
    : poly;

function bboxArea(ring: Array<[number, number]>): number {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  if (!isFinite(minLng)) return 0;
  return (maxLng - minLng) * (maxLat - minLat);
}

function buildFeatures(year: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const lang of LANGUAGE_FAMILIES) {
    const stage = activeLanguageStage(lang, year);
    if (!stage) continue;
    const closed = close(stage.polygon);
    features.push({
      type: "Feature",
      id: lang.id,
      geometry: { type: "Polygon", coordinates: [closed] },
      properties: {
        id: lang.id,
        name: lang.name,
        note: lang.note ?? "",
        wikipedia: lang.wikipedia ?? lang.name,
        stageStart: stage.startYear,
        _color: lang.color,
        _area: bboxArea(closed),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function useLanguagesLayer(map: MaplibreMap | null) {
  const year = useDeferredYear(80);
  const visible = useStore((s) => s.layers.languages);
  const theme = useStore((s) => s.theme);
  const setHover = useStore((s) => s.setHover);
  const setupForMap = useRef<MaplibreMap | null>(null);

  useEffect(() => {
    if (!map || setupForMap.current === map) return;
    setupForMap.current = map;

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": ["coalesce", ["get", "_color"], "#888"],
        "fill-opacity": 0.16,
      },
    });
    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": ["coalesce", ["get", "_color"], "#888"],
        "line-width": 1.2,
        "line-opacity": 0.6,
      },
    });

    // Language family labels — italic + tracked, very low priority
    // (lowest of the four label-bearing layers). Reads as background
    // atlas context rather than foreground political info.
    map.addLayer({
      id: LABEL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        "text-field": ["coalesce", ["get", "name"], ""],
        "text-font": ["literal", ["Noto Sans Italic"]],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "_area"], 0],
            0,
            0,
            10,
            10,
            100,
            12,
            1000,
            15,
            5000,
            18,
          ],
          4,
          [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "_area"], 0],
            0,
            11,
            10,
            13,
            100,
            15,
            1000,
            19,
            5000,
            23,
          ],
        ],
        "text-letter-spacing": 0.22,
        "text-transform": "uppercase",
        "text-max-width": 7,
        "text-padding": 4,
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "symbol-sort-key": ["*", -1, ["coalesce", ["get", "_area"], 0]],
      },
      paint: {
        "text-color": ["coalesce", ["get", "_color"], "rgba(220, 220, 240, 0.8)"],
        "text-opacity": 0.45,
        "text-halo-color": "rgba(15, 12, 8, 0.75)",
        "text-halo-width": 1.4,
        "text-halo-blur": 0.8,
        "text-opacity-transition": { duration: 320, delay: 0 },
      },
    });

    const onMove = (e: MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [FILL_LAYER_ID],
      });
      const top = feats[0];
      if (!top) return;
      const props = top.properties as Record<string, string>;
      setHover({
        layer: "languages",
        id: props.id,
        name: props.name,
        detail: props.note,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        wikipedia: props.wikipedia,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      });
    };
    map.on("mousemove", FILL_LAYER_ID, onMove);
    map.on("mouseleave", FILL_LAYER_ID, () => setHover(null));

    map.on("click", FILL_LAYER_ID, (e) => {
      const top = e.features?.[0];
      if (!top) return;
      // Defer to the boundaries layer when a country is also under this click —
      // otherwise the language tooltip overwrites the country tooltip and the
      // "Show country details" button is hidden.
      if (useStore.getState().layers.boundaries && map.getLayer("boundaries-fill")) {
        try {
          const bf = map.queryRenderedFeatures(e.point, { layers: ["boundaries-fill"] });
          if (bf.length > 0) return;
        } catch {
          /* layer not yet ready — fall through */
        }
      }
      const props = top.properties as Record<string, string>;
      useStore.getState().setLocked({
        layer: "languages",
        id: props.id,
        name: props.name,
        detail: props.note,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        wikipedia: props.wikipedia,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      });
    });
  }, [map, setHover]);

  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    const v = visible ? "visible" : "none";
    for (const id of [FILL_LAYER_ID, LINE_LAYER_ID, LABEL_LAYER_ID]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    }
  }, [map, visible]);

  // Theme-aware language label paint. Mirror the religions layer.
  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    if (!map.getLayer(LABEL_LAYER_ID)) return;
    if (theme === "light") {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", "rgba(50, 40, 60, 0.82)");
      map.setPaintProperty(LABEL_LAYER_ID, "text-halo-color", "rgba(252, 250, 240, 0.92)");
    } else if (theme === "sepia") {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", "rgba(60, 35, 18, 0.82)");
      map.setPaintProperty(LABEL_LAYER_ID, "text-halo-color", "rgba(248, 232, 198, 0.92)");
    } else {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", [
        "coalesce",
        ["get", "_color"],
        "rgba(220, 220, 240, 0.8)",
      ]);
      map.setPaintProperty(LABEL_LAYER_ID, "text-halo-color", "rgba(15, 12, 8, 0.75)");
    }
  }, [map, theme]);

  useEffect(() => {
    if (!map || setupForMap.current !== map || !visible) return;
    const fc = buildFeatures(year);
    (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(fc);
  }, [map, year, visible]);
}

// HMR: this file installs MapLibre event listeners and layers via a
// setup-once pattern. Hot-replacing the module would leave stale closures
// attached to the map, so accept the update by triggering a full page
// reload instead. URL/localStorage state restores year, layers, theme, etc.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
