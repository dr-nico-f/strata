import type {
  GeoJSONSource,
  Map as MaplibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import {
  MIGRATIONS,
  MIGRATION_COLOR,
  MIGRATION_LABEL,
  type MigrationKind,
} from "../data/migrations";
import { useStore } from "../store";
import { useDeferredYear } from "../utils/useDeferredYear";
import { startAntLineAnimation } from "../utils/antLine";

const SOURCE_ID = "migrations-src";
const CASE_LAYER_ID = "migrations-case";
const LINE_LAYER_ID = "migrations-line";
const ORIGIN_LAYER_ID = "migrations-origin";
const DEST_LAYER_ID = "migrations-dest";

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function buildFeatures(year: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const m of MIGRATIONS) {
    if (year < m.start || year > m.end) continue;
    if (!m.path.length) continue;
    features.push({
      type: "Feature",
      id: m.id,
      geometry: { type: "LineString", coordinates: m.path },
      properties: {
        id: m.id,
        name: m.name,
        kind: m.kind,
        start: m.start,
        end: m.end,
        note: m.note ?? "",
        wikipedia: m.wikipedia ?? m.name,
        _color: MIGRATION_COLOR[m.kind],
      },
    });
    const origin = m.path[0];
    const dest = m.path[m.path.length - 1];
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: origin },
      properties: { _kind: "origin", color: MIGRATION_COLOR[m.kind] },
    });
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: dest },
      properties: { _kind: "dest", color: MIGRATION_COLOR[m.kind] },
    });
  }
  return { type: "FeatureCollection", features };
}

export function useMigrationsLayer(map: MaplibreMap | null) {
  const year = useDeferredYear(80);
  const visible = useStore((s) => s.layers.migrations);
  const setHover = useStore((s) => s.setHover);
  const setupForMap = useRef<MaplibreMap | null>(null);

  useEffect(() => {
    if (!map || setupForMap.current === map) return;
    setupForMap.current = map;

    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });

    // Dark casing for legibility against bright basemaps.
    map.addLayer({
      id: CASE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      filter: ["!", ["has", "_kind"]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#000",
        "line-width": 5,
        "line-opacity": 0.35,
      },
    });

    // Colored, dashed flow line.
    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      filter: ["!", ["has", "_kind"]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["coalesce", ["get", "_color"], "#5fd1a0"],
        "line-width": 2.4,
        "line-opacity": 0.95,
        "line-dasharray": [1.6, 1.4],
      },
    });

    // Hollow origin marker.
    map.addLayer({
      id: ORIGIN_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["==", ["get", "_kind"], "origin"],
      paint: {
        "circle-radius": 5,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": ["coalesce", ["get", "color"], "#5fd1a0"],
        "circle-stroke-width": 2,
      },
    });

    // Filled destination marker.
    map.addLayer({
      id: DEST_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["==", ["get", "_kind"], "dest"],
      paint: {
        "circle-radius": 5,
        "circle-color": ["coalesce", ["get", "color"], "#5fd1a0"],
        "circle-stroke-color": "#000",
        "circle-stroke-width": 1,
        "circle-opacity": 0.95,
      },
    });

    const onMove = (e: MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [LINE_LAYER_ID],
      });
      const top = feats[0];
      if (!top) return;
      const props = top.properties as {
        id: string;
        name: string;
        kind: MigrationKind;
        start: number;
        end: number;
        note?: string;
        wikipedia?: string;
      };
      setHover({
        layer: "migrations",
        id: props.id,
        name: props.name,
        detail: `${MIGRATION_LABEL[props.kind]}${props.note ? " — " + props.note : ""}`,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        rangeStart: props.start,
        rangeEnd: props.end,
        wikipedia: props.wikipedia,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      });
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      setHover(null);
      map.getCanvas().style.cursor = "";
    };
    const onClick = (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const top = e.features?.[0];
      if (!top) return;
      const props = top.properties as {
        id: string;
        name: string;
        kind: MigrationKind;
        start: number;
        end: number;
        note?: string;
        wikipedia?: string;
      };
      useStore.getState().setLocked({
        layer: "migrations",
        id: props.id,
        name: props.name,
        detail: `${MIGRATION_LABEL[props.kind]}${props.note ? " — " + props.note : ""}`,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        rangeStart: props.start,
        rangeEnd: props.end,
        wikipedia: props.wikipedia,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      });
    };

    map.on("mousemove", LINE_LAYER_ID, onMove);
    map.on("mouseleave", LINE_LAYER_ID, onLeave);
    map.on("click", LINE_LAYER_ID, onClick);

    // Start the marching-ants animation on the dashed flow line. The util
    // self-bails if the layer is hidden or the map is destroyed.
    const cancel = startAntLineAnimation(map, [LINE_LAYER_ID], 70);
    return () => cancel();
  }, [map, setHover]);

  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    const v = visible ? "visible" : "none";
    for (const id of [
      CASE_LAYER_ID,
      LINE_LAYER_ID,
      ORIGIN_LAYER_ID,
      DEST_LAYER_ID,
    ]) {
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
