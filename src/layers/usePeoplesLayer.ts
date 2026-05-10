import type {
  GeoJSONSource,
  Map as MaplibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { People } from "../data/peoples";
import { PEOPLES } from "../data/peoples";
import { useStore } from "../store";
import { colorFromName } from "../utils/colorHash";
import { useDeferredYear } from "../utils/useDeferredYear";

const SOURCE_ID = "peoples-src";
const FILL_LAYER_ID = "peoples-fill";
const LINE_LAYER_ID = "peoples-line";
const LABEL_LAYER_ID = "peoples-label";

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function bboxArea(ring: ReadonlyArray<readonly [number, number]>): number {
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

function buildFeature(p: People): GeoJSON.Feature {
  return {
    type: "Feature",
    id: p.id,
    geometry: { type: "Polygon", coordinates: [p.polygon] },
    properties: {
      id: p.id,
      name: p.name,
      start: p.start,
      end: p.end,
      note: p.note ?? "",
      _color: colorFromName(p.name),
      // Bbox-area proxy used by the label layer to size text and rank
      // collisions (bigger groups win when labels would overlap).
      _area: bboxArea(p.polygon),
    },
  };
}

function buildFeatures(year: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const p of PEOPLES) {
    if (year < p.start || year > p.end) continue;
    features.push(buildFeature(p));
  }
  return { type: "FeatureCollection", features };
}

export function usePeoplesLayer(map: MaplibreMap | null) {
  const year = useDeferredYear(80);
  const visible = useStore((s) => s.layers.peoples);
  const theme = useStore((s) => s.theme);
  const setHover = useStore((s) => s.setHover);

  const setupForMap = useRef<MaplibreMap | null>(null);

  useEffect(() => {
    if (!map || setupForMap.current === map) return;
    setupForMap.current = map;

    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });

    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": ["coalesce", ["get", "_color"], "#f5b942"],
        "fill-opacity": 0.22,
      },
    });

    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": ["coalesce", ["get", "_color"], "#f5b942"],
        "line-width": 1.5,
        "line-opacity": 0.9,
        "line-dasharray": [3, 2],
      },
    });

    // People / culture labels — italic, capitalized, similar to a
    // historical-atlas treatment (e.g. "MONGOLS", "CELTS", "MAYA").
    // Italic differentiates these from political (boundary) labels.
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
            0, 0,
            10, 10,
            100, 12,
            1000, 14,
          ],
          4,
          [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "_area"], 0],
            0, 11,
            10, 12,
            100, 14,
            1000, 16,
          ],
          7,
          [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "_area"], 0],
            0, 13,
            10, 14,
            100, 16,
            1000, 18,
          ],
        ],
        "text-letter-spacing": 0.12,
        "text-transform": "uppercase",
        "text-max-width": 8,
        "text-padding": 4,
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "symbol-sort-key": ["*", -1, ["coalesce", ["get", "_area"], 0]],
      },
      paint: {
        // Tinted version of the culture's _color, on a dark halo for
        // dark theme; the theme effect below recolours for light/sepia.
        "text-color": [
          "coalesce",
          ["get", "_color"],
          "rgba(245, 215, 130, 0.95)",
        ],
        "text-opacity": 0.85,
        "text-halo-color": "rgba(15, 12, 8, 0.85)",
        "text-halo-width": 1.4,
        "text-halo-blur": 0.6,
        "text-opacity-transition": { duration: 280, delay: 0 },
      },
    });

    const onMove = (e: MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [FILL_LAYER_ID],
      });
      const top = feats[0];
      if (top) {
        const props = top.properties as {
          name: string;
          start: number;
          end: number;
          note?: string;
        };
        setHover({
          layer: "peoples",
          name: props.name,
          detail: props.note,
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
          rangeStart: props.start,
          rangeEnd: props.end,
          wikipedia: props.name,
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
        });
      }
    };
    const onLeave = () => setHover(null);

    map.on("mousemove", FILL_LAYER_ID, onMove);
    map.on("mouseleave", FILL_LAYER_ID, onLeave);

    map.on("click", FILL_LAYER_ID, (e) => {
      const top = e.features?.[0];
      if (!top) return;
      // Defer to the boundaries layer when a country is also under this click —
      // otherwise the peoples tooltip overwrites the country tooltip and the
      // "Show country details" button is hidden.
      if (useStore.getState().layers.boundaries && map.getLayer("boundaries-fill")) {
        try {
          const bf = map.queryRenderedFeatures(e.point, { layers: ["boundaries-fill"] });
          if (bf.length > 0) return;
        } catch {
          /* layer not yet ready — fall through */
        }
      }
      const props = top.properties as {
        name: string;
        start: number;
        end: number;
        note?: string;
      };
      useStore.getState().setLocked({
        layer: "peoples",
        name: props.name,
        detail: props.note,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        rangeStart: props.start,
        rangeEnd: props.end,
        wikipedia: props.name,
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

  // Theme-aware label paint — keep the per-feature culture colour on
  // dark theme (reads well against the navy basemap), but flip to a
  // single dark text on the light/sepia themes.
  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    if (!map.getLayer(LABEL_LAYER_ID)) return;
    if (theme === "light") {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", "rgba(40, 30, 18, 0.92)");
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-halo-color",
        "rgba(252, 250, 240, 0.95)",
      );
    } else if (theme === "sepia") {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", "rgba(58, 28, 8, 0.92)");
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-halo-color",
        "rgba(248, 232, 198, 0.92)",
      );
    } else {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", [
        "coalesce",
        ["get", "_color"],
        "rgba(245, 215, 130, 0.95)",
      ]);
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-halo-color",
        "rgba(15, 12, 8, 0.85)",
      );
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
