import type {
  GeoJSONSource,
  Map as MaplibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import { EVENTS } from "../data/events";
import { useStore } from "../store";
import { useDeferredYear } from "../utils/useDeferredYear";

const SOURCE_ID = "events-src";
const HALO_LAYER_ID = "events-halo";
const CIRCLE_LAYER_ID = "events-circle";

const WINDOW_YEARS = 8;

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function buildFeatures(year: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const e of EVENTS) {
    const dist = Math.abs(year - e.year);
    if (dist > WINDOW_YEARS) continue;
    features.push({
      type: "Feature",
      id: e.id,
      geometry: { type: "Point", coordinates: [e.lng, e.lat] },
      properties: {
        id: e.id,
        name: e.name,
        year: e.year,
        description: e.description,
        proximity: 1 - dist / WINDOW_YEARS,
        wikipedia: e.wikipedia ?? e.name,
        lng: e.lng,
        lat: e.lat,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function useEventsLayer(map: MaplibreMap | null) {
  const year = useDeferredYear(80);
  const visible = useStore((s) => s.layers.events);
  const setHover = useStore((s) => s.setHover);
  const setupForMap = useRef<MaplibreMap | null>(null);

  useEffect(() => {
    if (!map || setupForMap.current === map) return;
    setupForMap.current = map;

    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });

    map.addLayer({
      id: HALO_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "proximity"],
          0,
          8,
          1,
          18,
        ],
        "circle-color": "#ff7a90",
        "circle-opacity": [
          "interpolate",
          ["linear"],
          ["get", "proximity"],
          0,
          0.05,
          1,
          0.35,
        ],
        "circle-blur": 0.6,
      },
    });

    map.addLayer({
      id: CIRCLE_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": 5,
        "circle-color": "#ff7a90",
        "circle-stroke-color": "#2a0a12",
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.95,
      },
    });

    const onMove = (e: MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [CIRCLE_LAYER_ID],
      });
      const top = feats[0];
      if (top) {
        const props = top.properties as {
          name: string;
          year: number;
          description: string;
          wikipedia?: string;
          lng: number;
          lat: number;
        };
        setHover({
          layer: "events",
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
      }
    };
    const onLeave = () => {
      setHover(null);
      map.getCanvas().style.cursor = "";
    };

    map.on("mousemove", CIRCLE_LAYER_ID, onMove);
    map.on("mouseleave", CIRCLE_LAYER_ID, onLeave);

    map.on("click", CIRCLE_LAYER_ID, (e) => {
      const top = e.features?.[0];
      if (!top) return;
      const props = top.properties as {
        name: string;
        year: number;
        description: string;
        wikipedia?: string;
        lng: number;
        lat: number;
      };
      useStore.getState().setLocked({
        layer: "events",
        name: props.name,
        detail: props.description,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        pointYear: props.year,
        wikipedia: props.wikipedia,
        lng: props.lng,
        lat: props.lat,
      });
    });
  }, [map, setHover]);

  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    const v = visible ? "visible" : "none";
    for (const id of [HALO_LAYER_ID, CIRCLE_LAYER_ID]) {
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
