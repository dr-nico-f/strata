import type { GeoJSONSource, Map as MaplibreMap, MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { DISASTERS, DisasterKind } from "../data/disasters";
import { useStore } from "../store";
import { useDeferredYear } from "../utils/useDeferredYear";

const SOURCE_ID = "disasters-src";
const HALO_LAYER_ID = "disasters-halo";
const MARKER_LAYER_ID = "disasters-marker";

const WINDOW_YEARS = 80;

const KIND_COLOR: Record<DisasterKind, string> = {
  volcano: "#ff6a00",
  earthquake: "#d6a300",
  plague: "#cc4cff",
  famine: "#a06a3f",
  storm: "#3aa7e0",
  tsunami: "#3da9c7",
  wildfire: "#ff3a3a",
  flood: "#5ec0ff",
};

function buildFeatures(year: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const d of DISASTERS) {
    const start = d.year;
    const end = d.endYear ?? d.year;
    let dist: number;
    if (year >= start && year <= end) dist = 0;
    else dist = Math.min(Math.abs(year - start), Math.abs(year - end));
    if (dist > WINDOW_YEARS) continue;
    features.push({
      type: "Feature",
      id: d.id,
      geometry: { type: "Point", coordinates: [d.lng, d.lat] },
      properties: {
        id: d.id,
        name: d.name,
        kind: d.kind,
        year: d.year,
        endYear: d.endYear ?? d.year,
        description: d.description,
        wikipedia: d.wikipedia ?? d.name,
        lng: d.lng,
        lat: d.lat,
        proximity: 1 - dist / WINDOW_YEARS,
        _color: KIND_COLOR[d.kind],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function useDisastersLayer(map: MaplibreMap | null) {
  const year = useDeferredYear(80);
  const visible = useStore((s) => s.layers.disasters);
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
      id: HALO_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": ["*", 12, ["+", 0.5, ["get", "proximity"]]],
        "circle-color": ["get", "_color"],
        "circle-opacity": ["*", 0.4, ["get", "proximity"]],
        "circle-blur": 0.6,
      },
    });

    map.addLayer({
      id: MARKER_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": 6,
        "circle-color": ["get", "_color"],
        "circle-stroke-color": "#1a1410",
        "circle-stroke-width": 1.6,
        "circle-opacity": ["+", 0.6, ["*", 0.4, ["get", "proximity"]]],
      },
    });

    const onMove = (e: MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [MARKER_LAYER_ID],
      });
      const top = feats[0];
      if (!top) return;
      const props = top.properties as Record<string, string | number>;
      setHover({
        layer: "disasters",
        id: props.id as string,
        name: `${capitalize(props.kind as string)} · ${props.name}`,
        detail: props.description as string,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        pointYear: props.year as number,
        rangeStart: props.year as number,
        rangeEnd: props.endYear as number,
        wikipedia: props.wikipedia as string,
        lng: props.lng as number,
        lat: props.lat as number,
      });
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      setHover(null);
      map.getCanvas().style.cursor = "";
    };

    map.on("mousemove", MARKER_LAYER_ID, onMove);
    map.on("mouseleave", MARKER_LAYER_ID, onLeave);

    map.on("click", MARKER_LAYER_ID, (e) => {
      const top = e.features?.[0];
      if (!top) return;
      const props = top.properties as Record<string, string | number>;
      useStore.getState().setLocked({
        layer: "disasters",
        id: props.id as string,
        name: `${capitalize(props.kind as string)} · ${props.name}`,
        detail: props.description as string,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        pointYear: props.year as number,
        rangeStart: props.year as number,
        rangeEnd: props.endYear as number,
        wikipedia: props.wikipedia as string,
        lng: props.lng as number,
        lat: props.lat as number,
      });
    });
  }, [map, setHover]);

  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    const v = visible ? "visible" : "none";
    for (const id of [HALO_LAYER_ID, MARKER_LAYER_ID]) {
      map.setLayoutProperty(id, "visibility", v);
    }
  }, [map, visible]);

  useEffect(() => {
    if (!map || setupForMap.current !== map || !visible) return;
    const fc = buildFeatures(year);
    (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(fc);
  }, [map, year, visible]);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// HMR: this file installs MapLibre event listeners and layers via a
// setup-once pattern. Hot-replacing the module would leave stale closures
// attached to the map, so accept the update by triggering a full page
// reload instead. URL/localStorage state restores year, layers, theme, etc.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
