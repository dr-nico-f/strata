import type {
  GeoJSONSource,
  Map as MaplibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import { CONNECTIONS } from "../data/connections";
import { useStore } from "../store";
import { startAntLineAnimation } from "../utils/antLine";

const SOURCE_ID = "connections-src";
const CASE_LAYER_ID = "connections-case";
const TRADE_LAYER_ID = "connections-trade";
const MIGRATION_LAYER_ID = "connections-migration";
const POINT_LAYER_ID = "connections-points";

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function buildFeatures(year: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const c of CONNECTIONS) {
    if (year < c.start || year > c.end) continue;
    features.push({
      type: "Feature",
      id: c.id,
      geometry: { type: "LineString", coordinates: c.path },
      properties: {
        id: c.id,
        name: c.name,
        kind: c.kind,
        start: c.start,
        end: c.end,
        note: c.note ?? "",
      },
    });
    for (const [lng, lat] of c.path) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: { _waypoint: true, kind: c.kind },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

export function useConnectionsLayer(map: MaplibreMap | null) {
  const year = useStore((s) => s.year);
  const visible = useStore((s) => s.layers.connections);
  const setHover = useStore((s) => s.setHover);
  const setupForMap = useRef<MaplibreMap | null>(null);

  useEffect(() => {
    if (!map || setupForMap.current === map) return;
    setupForMap.current = map;

    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });

    map.addLayer({
      id: CASE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      filter: ["!=", ["get", "_waypoint"], true],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#000000",
        "line-width": 4,
        "line-opacity": 0.4,
      },
    });

    map.addLayer({
      id: TRADE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      filter: [
        "all",
        ["!=", ["get", "_waypoint"], true],
        ["==", ["get", "kind"], "trade"],
      ],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#c39bff",
        "line-width": 2,
        "line-opacity": 0.9,
      },
    });

    map.addLayer({
      id: MIGRATION_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      filter: [
        "all",
        ["!=", ["get", "_waypoint"], true],
        ["==", ["get", "kind"], "migration"],
      ],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ffb079",
        "line-width": 2,
        "line-opacity": 0.9,
        "line-dasharray": [1, 1.5],
      },
    });

    map.addLayer({
      id: POINT_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["==", ["get", "_waypoint"], true],
      paint: {
        "circle-radius": 2.5,
        "circle-color": [
          "match",
          ["get", "kind"],
          "trade",
          "#c39bff",
          "migration",
          "#ffb079",
          "#c39bff",
        ],
        "circle-opacity": 0.9,
      },
    });

    const onMove = (e: MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [TRADE_LAYER_ID, MIGRATION_LAYER_ID],
      });
      const top = feats[0];
      if (top) {
        const props = top.properties as {
          name: string;
          kind: string;
          start: number;
          end: number;
          note?: string;
        };
        setHover({
          layer: "connections",
          name: props.name,
          detail: `${props.kind === "migration" ? "Migration" : "Trade route"}` +
            (props.note ? ` — ${props.note}` : ""),
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
          rangeStart: props.start,
          rangeEnd: props.end,
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

    const onClick = (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const top = e.features?.[0];
      if (!top) return;
      const props = top.properties as {
        name: string;
        kind: string;
        start: number;
        end: number;
        note?: string;
      };
      useStore.getState().setLocked({
        layer: "connections",
        name: props.name,
        detail: `${props.kind === "migration" ? "Migration" : "Trade route"}` +
          (props.note ? ` — ${props.note}` : ""),
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        rangeStart: props.start,
        rangeEnd: props.end,
        wikipedia: props.name,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      });
    };

    for (const id of [TRADE_LAYER_ID, MIGRATION_LAYER_ID]) {
      map.on("mousemove", id, onMove);
      map.on("mouseleave", id, onLeave);
      map.on("click", id, onClick);
    }

    // Marching-ants flow on both trade routes and migration corridors. The
    // dasharray paint we wrote in addLayer is overwritten each frame; the
    // initial value is just a placeholder for static-render conditions.
    const cancel = startAntLineAnimation(
      map,
      [TRADE_LAYER_ID, MIGRATION_LAYER_ID],
      55,
    );
    return () => cancel();
  }, [map, setHover]);

  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    const v = visible ? "visible" : "none";
    for (const id of [
      CASE_LAYER_ID,
      TRADE_LAYER_ID,
      MIGRATION_LAYER_ID,
      POINT_LAYER_ID,
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
