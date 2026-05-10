import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { useStore } from "../store";

/**
 * Region-focus dimming. When a country is clicked we punch out the country's
 * actual outline (Polygon/MultiPolygon) so the dim mask traces the real shape.
 * Continent presets only carry a bbox, so for those we fall back to a
 * rectangular cutout. The result is a semi-transparent "everything else"
 * overlay that pushes the focused area forward.
 */

const SOURCE_ID = "focus-mask-src";
const LAYER_ID = "focus-mask";

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const W_MIN_LNG = -179.9;
const W_MAX_LNG = 179.9;
const W_MIN_LAT = -85;
const W_MAX_LAT = 85;

const WORLD_RING: GeoJSON.Position[] = [
  [W_MIN_LNG, W_MIN_LAT],
  [W_MAX_LNG, W_MIN_LAT],
  [W_MAX_LNG, W_MAX_LAT],
  [W_MIN_LNG, W_MAX_LAT],
  [W_MIN_LNG, W_MIN_LAT],
];

function ringFromBbox(bbox: [number, number, number, number]): GeoJSON.Position[] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return [
    [Math.max(W_MIN_LNG, minLng), Math.max(W_MIN_LAT, minLat)],
    [Math.max(W_MIN_LNG, minLng), Math.min(W_MAX_LAT, maxLat)],
    [Math.min(W_MAX_LNG, maxLng), Math.min(W_MAX_LAT, maxLat)],
    [Math.min(W_MAX_LNG, maxLng), Math.max(W_MIN_LAT, minLat)],
    [Math.max(W_MIN_LNG, minLng), Math.max(W_MIN_LAT, minLat)],
  ];
}

function holesFromGeometry(geom: GeoJSON.Geometry): GeoJSON.Position[][] {
  // Use only the outer ring of each part as a hole. Interior rings (lakes
  // etc.) are skipped on purpose -- we don't want to "re-dim" Lake Baikal.
  const out: GeoJSON.Position[][] = [];
  if (geom.type === "Polygon") {
    if (geom.coordinates[0]) out.push(geom.coordinates[0]);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) {
      if (poly[0]) out.push(poly[0]);
    }
  }
  return out;
}

function buildMask(
  geometry: GeoJSON.Geometry | null,
  bbox: [number, number, number, number] | null,
): GeoJSON.FeatureCollection {
  let holes: GeoJSON.Position[][] = [];
  if (geometry) {
    holes = holesFromGeometry(geometry);
  } else if (bbox) {
    holes = [ringFromBbox(bbox)];
  }
  if (!holes.length) return EMPTY_FC;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [WORLD_RING, ...holes],
        },
      },
    ],
  };
}

export function useFocusMaskLayer(map: MaplibreMap | null) {
  const focusBbox = useStore((s) => s.focusBbox);
  const focusGeometry = useStore((s) => s.focusedCountry?.geometry ?? null);
  const setupForMap = useRef<MaplibreMap | null>(null);

  useEffect(() => {
    if (!map || setupForMap.current === map) return;
    setupForMap.current = map;
    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });
    map.addLayer({
      id: LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": "#000",
        "fill-opacity": 0.5,
      },
    });
  }, [map]);

  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(buildMask(focusGeometry, focusBbox));
  }, [map, focusGeometry, focusBbox]);
}

// HMR: this file installs MapLibre event listeners and layers via a
// setup-once pattern. Hot-replacing the module would leave stale closures
// attached to the map, so accept the update by triggering a full page
// reload instead. URL/localStorage state restores year, layers, theme, etc.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
