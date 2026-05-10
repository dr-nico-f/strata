import type {
  GeoJSONSource,
  Map as MaplibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import { RELIGIONS, activeReligionStage } from "../data/religions";
import {
  MODERN_RELIGION_BY_COUNTRY,
  MODERN_RELIGION_COLOR,
  MODERN_RELIGION_LABEL,
  MODERN_RELIGION_MIN_YEAR,
} from "../data/religions.modern";
import { useStore } from "../store";

const SOURCE_ID = "religions-src";
const FILL_LAYER_ID = "religions-fill";
const LINE_LAYER_ID = "religions-line";
const LABEL_LAYER_ID = "religions-label";

function bboxAreaFromGeometry(geom: GeoJSON.Geometry): number {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  const visit = (lng: number, lat: number) => {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  };
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates) {
      for (const [lng, lat] of ring) visit(lng, lat);
    }
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) {
      for (const ring of poly) {
        for (const [lng, lat] of ring) visit(lng, lat);
      }
    }
  }
  if (!isFinite(minLng)) return 0;
  return (maxLng - minLng) * (maxLat - minLat);
}

const close = (poly: Array<[number, number]>): Array<[number, number]> =>
  poly.length && (poly[0][0] !== poly[poly.length - 1][0] ||
    poly[0][1] !== poly[poly.length - 1][1])
    ? [...poly, poly[0]]
    : poly;

const COUNTRY_RELIGION_LOOKUP = new Map(
  MODERN_RELIGION_BY_COUNTRY.map((e) => [e.name, e]),
);

let modernBoundariesPromise: Promise<GeoJSON.FeatureCollection> | null = null;
function loadModernBoundaries(): Promise<GeoJSON.FeatureCollection> {
  if (!modernBoundariesPromise) {
    const base =
      (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
    modernBoundariesPromise = fetch(`${base}data/boundaries/world_2000.geojson`)
      .then((r) => r.json() as Promise<GeoJSON.FeatureCollection>)
      .catch((err) => {
        modernBoundariesPromise = null;
        throw err;
      });
  }
  return modernBoundariesPromise;
}

/** <1945: schematic polygon stages from `religions.ts` (Wikidata-cited). */
function buildHistoricalFeatures(year: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const rel of RELIGIONS) {
    const stage = activeReligionStage(rel, year);
    if (!stage) continue;
    const cite = rel.wikidata ? ` · Wikidata ${rel.wikidata}` : "";
    const closed = close(stage.polygon);
    features.push({
      type: "Feature",
      id: rel.id,
      geometry: { type: "Polygon", coordinates: [closed] },
      properties: {
        id: rel.id,
        name: rel.name,
        note: `${rel.note ?? ""} (stage from ${stage.startYear})${cite}`,
        wikipedia: rel.wikipedia ?? rel.name,
        stageStart: stage.startYear,
        _color: rel.color,
        _opacity: 0.18,
        // Every historical stage gets a label centered on its polygon.
        _label: rel.name,
        _area: bboxAreaFromGeometry({
          type: "Polygon",
          coordinates: [closed],
        }),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

/** >=1945: country-fill keyed by Pew Research majority religion per country. */
async function buildModernFeatures(
  year: number,
): Promise<GeoJSON.FeatureCollection> {
  const boundaries = await loadModernBoundaries();
  // Per-country features.
  const features: GeoJSON.Feature[] = [];
  // Bucket by religion so we can later label only the single largest
  // country in each bucket (one "Christianity" / "Islam" / etc. label
  // covering the cluster, instead of one per country).
  const largestByReligion = new Map<
    string,
    { area: number; idx: number }
  >();
  for (const f of boundaries.features) {
    const name = (f.properties as { NAME?: string } | null)?.NAME;
    if (!name) continue;
    const entry = COUNTRY_RELIGION_LOOKUP.get(name);
    if (!entry) continue;
    const area = bboxAreaFromGeometry(f.geometry);
    const idx = features.length;
    features.push({
      type: "Feature",
      id: `modern:${name}`,
      geometry: f.geometry,
      properties: {
        id: `modern:${entry.religion}:${name}`,
        name: `${name}: ${MODERN_RELIGION_LABEL[entry.religion]}`,
        note: `${MODERN_RELIGION_LABEL[entry.religion]} (${entry.confidence}, Pew Research ${year}).`,
        wikipedia: `Religion_in_${name.replace(/ /g, "_")}`,
        _color: MODERN_RELIGION_COLOR[entry.religion],
        // Solid majorities render bolder; pluralities are softer to signal
        // they're a largest group rather than >50% adherence.
        _opacity: entry.confidence === "majority" ? 0.32 : 0.18,
        _area: area,
        // Label assigned below — only the largest country per religion
        // gets one, so the layer ends up with ~6 modern labels total
        // instead of one per country (≈190 labels).
        _label: "",
      },
    });
    const cur = largestByReligion.get(entry.religion);
    if (!cur || area > cur.area) {
      largestByReligion.set(entry.religion, { area, idx });
    }
  }
  for (const [religion, { idx }] of largestByReligion) {
    const f = features[idx];
    if (!f.properties) continue;
    f.properties._label = MODERN_RELIGION_LABEL[
      religion as keyof typeof MODERN_RELIGION_LABEL
    ];
  }
  return { type: "FeatureCollection", features };
}

export function useReligionsLayer(map: MaplibreMap | null) {
  const year = useStore((s) => s.year);
  const visible = useStore((s) => s.layers.religions);
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
        "fill-opacity": ["coalesce", ["get", "_opacity"], 0.18],
      },
    });
    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": ["coalesce", ["get", "_color"], "#888"],
        "line-width": 1.2,
        "line-dasharray": [3, 3],
        "line-opacity": 0.55,
      },
    });

    // Religion labels — italic + spaced, low priority. Filtered to
    // features that have a non-empty `_label`. Historical era assigns
    // a label to every stage; modern era only to the largest country
    // per religion (so we don't render 190 "Christianity" labels).
    map.addLayer({
      id: LABEL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["all", ["has", "_label"], ["!=", ["get", "_label"], ""]],
      layout: {
        "text-field": ["get", "_label"],
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
            10, 11,
            100, 13,
            1000, 16,
            5000, 19,
          ],
          4,
          [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "_area"], 0],
            0, 12,
            10, 14,
            100, 17,
            1000, 22,
            5000, 26,
          ],
        ],
        "text-letter-spacing": 0.2,
        "text-transform": "uppercase",
        "text-max-width": 7,
        "text-padding": 4,
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        // Lowest priority among label layers — country / city labels win
        // collisions. Within religions, larger area wins.
        "symbol-sort-key": ["*", -1, ["coalesce", ["get", "_area"], 0]],
      },
      paint: {
        "text-color": ["coalesce", ["get", "_color"], "rgba(245, 220, 180, 0.9)"],
        "text-opacity": 0.5,
        "text-halo-color": "rgba(15, 12, 8, 0.8)",
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
      if (!top) {
        setHover(null);
        return;
      }
      const props = top.properties as {
        id: string;
        name: string;
        note: string;
        wikipedia: string;
      };
      setHover({
        layer: "religions",
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
      // otherwise the religion tooltip overwrites the country tooltip and the
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
        layer: "religions",
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

  // Theme-aware religion label paint.
  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    if (!map.getLayer(LABEL_LAYER_ID)) return;
    if (theme === "light") {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", "rgba(60, 35, 20, 0.85)");
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-halo-color",
        "rgba(252, 250, 240, 0.92)",
      );
    } else if (theme === "sepia") {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", "rgba(70, 30, 12, 0.85)");
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-halo-color",
        "rgba(248, 232, 198, 0.92)",
      );
    } else {
      map.setPaintProperty(LABEL_LAYER_ID, "text-color", [
        "coalesce",
        ["get", "_color"],
        "rgba(245, 220, 180, 0.9)",
      ]);
      map.setPaintProperty(
        LABEL_LAYER_ID,
        "text-halo-color",
        "rgba(15, 12, 8, 0.8)",
      );
    }
  }, [map, theme]);

  useEffect(() => {
    if (!map || setupForMap.current !== map || !visible) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    if (year >= MODERN_RELIGION_MIN_YEAR) {
      let cancelled = false;
      buildModernFeatures(year)
        .then((fc) => {
          if (!cancelled) source.setData(fc);
        })
        .catch((err) => {
          // Fall back to historical schematic if the modern boundary fetch fails.
          console.warn("[religions] modern fill failed, falling back", err);
          if (!cancelled) source.setData(buildHistoricalFeatures(year));
        });
      return () => {
        cancelled = true;
      };
    }
    source.setData(buildHistoricalFeatures(year));
  }, [map, year, visible]);
}

// HMR: this file installs MapLibre event listeners and layers via a
// setup-once pattern. Hot-replacing the module would leave stale closures
// attached to the map, so accept the update by triggering a full page
// reload instead. URL/localStorage state restores year, layers, theme, etc.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
