import type {
  GeoJSONSource,
  Map as MaplibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import { PEOPLE, PersonKind } from "../data/people";
import { formatYear, useStore } from "../store";
import { useDeferredYear } from "../utils/useDeferredYear";

const SOURCE_ID = "people-src";
const STEM_LAYER_ID = "people-stem";
const MARKER_LAYER_ID = "people-marker";

const KIND_COLOR: Record<PersonKind, string> = {
  ruler: "#ffd86b",
  religious: "#c39bff",
  philosopher: "#7aa2ff",
  scientist: "#5fd1a0",
  artist: "#ff7a90",
  explorer: "#3da9c7",
};

function buildFeatures(year: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const p of PEOPLE) {
    if (year < p.birth || year > p.death) continue;
    features.push({
      type: "Feature",
      id: p.id,
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        name: p.name,
        kind: p.kind,
        birth: p.birth,
        death: p.death,
        blurb: p.blurb,
        wikipedia: p.wikipedia ?? p.name,
        lng: p.lng,
        lat: p.lat,
        _color: KIND_COLOR[p.kind],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function usePeopleLayer(map: MaplibreMap | null) {
  const year = useDeferredYear(80);
  const visible = useStore((s) => s.layers.people);
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
      id: MARKER_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": 5,
        "circle-color": ["get", "_color"],
        "circle-stroke-color": "rgba(20, 20, 28, 0.9)",
        "circle-stroke-width": 1.4,
        "circle-opacity": 0.95,
      },
    });

    map.addLayer({
      id: STEM_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": 1.5,
        "circle-color": ["get", "_color"],
        "circle-translate": [0, 6],
        "circle-opacity": 0.75,
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
        layer: "people",
        id: props.id as string,
        name: props.name as string,
        detail: `${capitalize(props.kind as string)} · ${props.blurb as string}`,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        rangeStart: props.birth as number,
        rangeEnd: props.death as number,
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
        layer: "people",
        id: props.id as string,
        name: props.name as string,
        detail: `${capitalize(props.kind as string)} · ${props.blurb as string} (${formatYear(props.birth as number)}–${formatYear(props.death as number)})`,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        rangeStart: props.birth as number,
        rangeEnd: props.death as number,
        wikipedia: props.wikipedia as string,
        lng: props.lng as number,
        lat: props.lat as number,
      });
    });
  }, [map, setHover]);

  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    const v = visible ? "visible" : "none";
    for (const id of [STEM_LAYER_ID, MARKER_LAYER_ID]) {
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
