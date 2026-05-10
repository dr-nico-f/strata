import type {
  GeoJSONSource,
  Map as MaplibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import { PALEO_LAND } from "../data/sealevel";
import { useStore } from "../store";

const SOURCE_ID = "sealevel-src";
const FILL_LAYER_ID = "sealevel-fill";
const LINE_LAYER_ID = "sealevel-line";

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function close(p: Array<[number, number]>): Array<[number, number]> {
  if (p.length === 0) return p;
  const [a, b] = p[0];
  const [c, d] = p[p.length - 1];
  return a === c && b === d ? p : [...p, p[0]];
}

function buildFeatures(year: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const land of PALEO_LAND) {
    if (year >= land.submergedBy) continue;
    features.push({
      type: "Feature",
      id: land.id,
      geometry: {
        type: "Polygon",
        coordinates: [close(land.polygon as Array<[number, number]>)],
      },
      properties: {
        id: land.id,
        name: land.name,
        submergedBy: land.submergedBy,
        note: land.note ?? "",
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function useSeaLevelLayer(map: MaplibreMap | null) {
  const year = useStore((s) => s.year);
  const visible = useStore((s) => s.layers.sealevel);
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
        "fill-color": "#3da9c7",
        "fill-opacity": 0.45,
      },
    });

    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": "#aee0ee",
        "line-width": 1.5,
        "line-opacity": 0.7,
        "line-dasharray": [2, 2],
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
          submergedBy: number;
          note?: string;
        };
        setHover({
          layer: "sealevel",
          name: props.name,
          detail: props.note,
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
          rangeStart: -10000,
          rangeEnd: props.submergedBy,
          wikipedia: props.name,
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
        });
        map.getCanvas().style.cursor = "pointer";
      }
    };
    const onLeave = () => {
      setHover(null);
      map.getCanvas().style.cursor = "";
    };

    map.on("mousemove", FILL_LAYER_ID, onMove);
    map.on("mouseleave", FILL_LAYER_ID, onLeave);

    map.on("click", FILL_LAYER_ID, (e) => {
      const top = e.features?.[0];
      if (!top) return;
      // Defer to the boundaries layer when a country is also under this click —
      // otherwise the sealevel tooltip overwrites the country tooltip and the
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
        submergedBy: number;
        note?: string;
      };
      useStore.getState().setLocked({
        layer: "sealevel",
        name: props.name,
        detail: props.note,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        rangeStart: -10000,
        rangeEnd: props.submergedBy,
        wikipedia: props.name,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      });
    });
  }, [map, setHover]);

  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    const v = visible ? "visible" : "none";
    for (const id of [FILL_LAYER_ID, LINE_LAYER_ID]) {
      map.setLayoutProperty(id, "visibility", v);
    }
  }, [map, visible]);

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
