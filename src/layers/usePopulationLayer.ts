import type { GeoJSONSource, Map as MaplibreMap, MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { CITIES, cityPopulationAt, type City } from "../data/cities";
import {
  POPULATION_REGIONS,
  populationAt,
  worldPopulationAt,
  type PopRegion,
} from "../data/population";
import { useStore } from "../store";
import { useDeferredYear } from "../utils/useDeferredYear";

const SOURCE_ID = "population-src";
const DOT_LAYER_ID = "population-dot";

// Each dot represents this many millions of people. 0.2M ≈ ~40K dots in 2023
// (8B people / 0.2M) and ~33 dots in 8000 BCE. MapLibre's circle layer can
// render many tens of thousands of points without breaking a sweat; the
// bottleneck is buildFeatures itself which is still O(dots) and runs in a
// few ms once per year change.
const PEOPLE_PER_DOT_MILLIONS = 0.2;
// Per-country safety belt to keep the two ~1.4B-person giants from eating
// the entire dot budget. Anything below ~500M renders every dot it earns;
// only China + India clip at this cap.
const MAX_DOTS_PER_COUNTRY = 2500;

// How far from a city a dot can land, in degrees. Earlier we tightened this
// for megacities, but at continental zoom the resulting cluster collapsed to
// a single screen pixel — so NYC's ~30 dots looked identical to a town with
// 1 dot. Now we keep the cluster visible: even megacities get ~0.45° (~50km
// metro-area scale) and small towns get a touch more so isolated dots breathe.
const CITY_JITTER_MIN = 0.4;
const CITY_JITTER_MAX = 0.7;
// Exponent applied to a city's population when computing its draw weight.
// Linear weighting (1.0) under-emphasizes megacities when a country has many
// long-tail entries; >1 makes NYC, Tokyo, Mexico City, etc. dominate visually.
const CITY_WEIGHT_EXPONENT = 1.4;

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** Mulberry32 - tiny deterministic PRNG. */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bucket each city to a country (keyed by ISO3). Cities tagged with an ISO2
 * `cc` (every GeoNames-derived city) are looked up directly in the country
 * table — this is fast and authoritative, and crucially fixes failures where
 * nearest-centroid bucketing stole big-country cities (e.g., NYC was closer
 * to Bermuda than to USA's Kansas-area centroid; Toronto was closer to USA's
 * centroid than Canada's Hudson-Bay centroid).
 *
 * Curated cities (mostly ancient/historical) usually omit `cc`. They fall
 * back to nearest-centroid, which is fine because those entries are rare,
 * geographically unambiguous, and don't have a clean modern-country mapping
 * anyway (Babylon → Iraq is more cosmetic than meaningful).
 */
function buildCountryCityIndex(): Map<string, City[]> {
  const index = new Map<string, City[]>();
  const cs: PopRegion[] = POPULATION_REGIONS.slice();

  // ISO2 → ISO3 lookup, built from the OWID country table.
  const iso2ToIso3 = new Map<string, string>();
  for (const c of cs) {
    if (c.cca2) iso2ToIso3.set(c.cca2.toUpperCase(), c.id);
  }

  for (const city of CITIES) {
    let countryId = "";

    // Path A: city has an ISO2 from GeoNames. Direct lookup.
    if (city.cc) {
      countryId = iso2ToIso3.get(city.cc.toUpperCase()) ?? "";
    }

    // Path B: fall back to nearest centroid.
    if (!countryId) {
      let bestDistSq = Infinity;
      for (const c of cs) {
        const dLat = city.lat - c.lat;
        const meanLatRad = ((city.lat + c.lat) / 2) * (Math.PI / 180);
        const dLng = (city.lng - c.lng) * Math.cos(meanLatRad);
        const dSq = dLat * dLat + dLng * dLng;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          countryId = c.id;
        }
      }
    }

    if (!countryId) continue;
    let bucket = index.get(countryId);
    if (!bucket) {
      bucket = [];
      index.set(countryId, bucket);
    }
    bucket.push(city);
  }
  return index;
}

let COUNTRY_CITIES = buildCountryCityIndex();
let lastDataVersion = -1;

/**
 * Pick a jitter radius for a city given how many dots will land on it. We
 * keep the range tight enough that dots stay "near a city" but large enough
 * that 30+ dots in a megacity don't collapse to a single map pixel.
 */
function jitterRadiusFor(dotsAtCity: number): number {
  if (dotsAtCity >= 30) return 0.55;
  if (dotsAtCity >= 10) return 0.5;
  if (dotsAtCity >= 3) return CITY_JITTER_MIN;
  return CITY_JITTER_MAX;
}

interface ActiveCity {
  city: City;
  weight: number;
}

/**
 * For one country at one year, return its active cities together with the
 * relative population weight to use when sampling dot positions.
 */
function activeCitiesFor(region: PopRegion, year: number): ActiveCity[] {
  const cities = COUNTRY_CITIES.get(region.id);
  if (!cities || cities.length === 0) return [];
  const out: ActiveCity[] = [];
  for (const city of cities) {
    if (year < city.founded) continue;
    if (city.abandoned !== undefined && year > city.abandoned) continue;
    let pop = 0;
    if (city.populationCurve) pop = cityPopulationAt(city, year);
    // Cities with no curve get a default weight (≈ 50K) so they still anchor
    // dots, just less attractively than known-large cities.
    if (pop <= 0) pop = 50;
    // Power-weighting concentrates dots in megacities and away from the
    // long tail. NYC vs a small town: linear ratio ~170:1 → power-1.4 ratio
    // ~1080:1, which matches our intuition that NYC should be a clear cluster.
    out.push({ city, weight: Math.pow(pop, CITY_WEIGHT_EXPONENT) });
  }
  return out;
}

function buildFeatures(year: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const region of POPULATION_REGIONS) {
    const popMillions = populationAt(region, year);
    if (popMillions <= 0) continue;
    const requested = Math.round(popMillions / PEOPLE_PER_DOT_MILLIONS);
    const dots = Math.min(requested, MAX_DOTS_PER_COUNTRY);
    if (dots <= 0) continue;
    const peoplePerDot = (popMillions * 1_000_000) / dots;

    // Seed depends only on the country, not the year. This keeps dot
    // positions stable across years so scrubbing the timeline animates
    // population growth (dots fade in around growing cities) instead of a
    // jittery reshuffle every year.
    let seed = 0;
    for (let i = 0; i < region.id.length; i++) {
      seed = (seed * 31 + region.id.charCodeAt(i)) | 0;
    }
    const rand = rng(seed);

    const active = activeCitiesFor(region, year);
    // Cumulative-weight array so we can binary-search a weighted random pick.
    let cumulative: number[] = [];
    let totalWeight = 0;
    if (active.length > 0) {
      cumulative = new Array(active.length);
      for (let i = 0; i < active.length; i++) {
        totalWeight += active[i].weight;
        cumulative[i] = totalWeight;
      }
    }

    // Track how many dots land on each city so we can size the jitter (a
    // megacity should look like a tight cluster, not a sprayed cloud).
    const dotsPerCity = active.length > 0 ? new Int32Array(active.length) : null;
    const cityPicks = new Int32Array(dots);
    if (active.length > 0 && totalWeight > 0 && dotsPerCity) {
      for (let i = 0; i < dots; i++) {
        const target = rand() * totalWeight;
        // Binary search.
        let lo = 0;
        let hi = cumulative.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (cumulative[mid] < target) lo = mid + 1;
          else hi = mid;
        }
        cityPicks[i] = lo;
        dotsPerCity[lo]++;
      }
    }

    for (let i = 0; i < dots; i++) {
      let lng: number;
      let lat: number;

      if (active.length > 0 && dotsPerCity) {
        // City-anchored: place near the picked city with size-aware jitter.
        const pick = cityPicks[i];
        const city = active[pick].city;
        const jitter = jitterRadiusFor(dotsPerCity[pick]);
        // Square-rooted radius gives uniform area distribution within the disc.
        const r = Math.sqrt(rand()) * jitter;
        const theta = rand() * 2 * Math.PI;
        const dLat = r * Math.sin(theta);
        const dLng = (r * Math.cos(theta)) / Math.max(0.2, Math.cos((city.lat * Math.PI) / 180));
        lng = city.lng + dLng;
        lat = city.lat + dLat;
      } else {
        // Fall-back: ancient eras / countries with no cities in our dataset.
        // Scatter inside ~60% of the equal-area-disc radius. Equal-area
        // assumes the country is circular, but most aren't — so the full
        // disc tends to leak into oceans for elongated nations like India.
        // The 0.6× factor keeps dots inside the country's bulk.
        const fallbackRadius = region.radius * 0.6;
        const r = Math.sqrt(rand()) * fallbackRadius;
        const theta = rand() * 2 * Math.PI;
        const dLat = r * Math.sin(theta);
        const dLng = (r * Math.cos(theta)) / Math.max(0.2, Math.cos((region.lat * Math.PI) / 180));
        lng = region.lng + dLng;
        lat = region.lat + dLat;
      }

      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          region: region.name,
          country: region.id,
          continent: region.continent,
          peoplePerDot,
          popMillions,
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

/** Compact population text, e.g. 47.3M, 1.42B, 0.9M, 12K. */
function formatPop(millions: number): string {
  if (millions >= 1000) return `${(millions / 1000).toFixed(2)}B`;
  if (millions >= 100) return `${Math.round(millions)}M`;
  if (millions >= 10) return `${millions.toFixed(1)}M`;
  if (millions >= 1) return `${millions.toFixed(2)}M`;
  if (millions >= 0.01) return `${(millions * 1000).toFixed(0)}K`;
  return "—";
}

export function usePopulationLayer(map: MaplibreMap | null) {
  // Population dot rebuild is the heaviest year-driven work in the app
  // (~40K features at the present day). Defer the year that drives the
  // rebuild so a fast slider drag doesn't fire 10+ rebuilds/sec.
  const year = useDeferredYear(120);
  const liveYear = useStore((s) => s.year);
  const visible = useStore((s) => s.layers.population);
  const setHover = useStore((s) => s.setHover);
  const dataVersion = useStore((s) => s.dataVersion);
  const setupForMap = useRef<MaplibreMap | null>(null);
  // Latest year is captured by closure inside the hover handler. We update
  // this ref whenever year changes so the formatted detail stays in sync.
  const yearRef = useRef(liveYear);
  yearRef.current = liveYear;

  useEffect(() => {
    if (!map || setupForMap.current === map) return;
    setupForMap.current = map;

    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });

    map.addLayer({
      id: DOT_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 1.4, 4, 2.4, 7, 3.6],
        // Color by continent. Each region gets a distinguishable warm/cool
        // hue so neighboring countries are visually separable at a glance.
        // (Default falls through to amber for any future "Other" rows.)
        "circle-color": [
          "match",
          ["get", "continent"],
          "Asia",
          "#ffd86b",
          "Europe",
          "#7aa2ff",
          "Africa",
          "#ff9a4a",
          "Americas",
          "#5fd1a0",
          "Oceania",
          "#c39bff",
          "Antarctic",
          "#9bd0ff",
          "#ffe9a8",
        ],
        // Initial opacity. Updated by the "era tint" effect below so ancient
        // eras feel sparser/dimmer than modern ones.
        "circle-opacity": 0.7,
        "circle-stroke-color": "#1a1208",
        "circle-stroke-width": 0.4,
        // Smooth opacity transitions when we update paint properties or swap
        // source data — feels much nicer when scrubbing the timeline.
        "circle-opacity-transition": { duration: 240, delay: 0 },
        "circle-radius-transition": { duration: 240, delay: 0 },
      },
    });

    const onMove = (e: MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [DOT_LAYER_ID],
      });
      const top = feats[0];
      if (!top) return;
      const props = top.properties as {
        region: string;
        country: string;
        peoplePerDot: number;
        popMillions: number;
      };
      const y = yearRef.current;
      const worldPop = worldPopulationAt(y);
      const pct = worldPop > 0 ? (props.popMillions / worldPop) * 100 : 0;
      setHover({
        layer: "population",
        id: props.country,
        name: props.region,
        detail: `${formatPop(props.popMillions)} people · ${pct.toFixed(1)}% of world · ≈${formatPop(props.peoplePerDot / 1_000_000)} per dot`,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        wikipedia: props.region,
      });
      map.getCanvas().style.cursor = "crosshair";
    };
    const onLeave = () => {
      setHover(null);
      map.getCanvas().style.cursor = "";
    };
    map.on("mousemove", DOT_LAYER_ID, onMove);
    map.on("mouseleave", DOT_LAYER_ID, onLeave);
  }, [map, setHover]);

  useEffect(() => {
    if (!map || setupForMap.current !== map) return;
    map.setLayoutProperty(DOT_LAYER_ID, "visibility", visible ? "visible" : "none");
  }, [map, visible]);

  useEffect(() => {
    if (!map || setupForMap.current !== map || !visible) return;
    if (dataVersion !== lastDataVersion) {
      COUNTRY_CITIES = buildCountryCityIndex();
      lastDataVersion = dataVersion;
    }
    const fc = buildFeatures(year);
    (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(fc);

    // Era tint: ramp opacity by year so the deep past feels sparse/quiet and
    // the modern era pops. The numbers below are anchor points; MapLibre
    // animates between them via the circle-opacity-transition we configured.
    let opacity: number;
    if (year < -3000) opacity = 0.45;
    else if (year < 0) opacity = 0.55;
    else if (year < 1000) opacity = 0.62;
    else if (year < 1700) opacity = 0.68;
    else if (year < 1900) opacity = 0.74;
    else opacity = 0.8;
    map.setPaintProperty(DOT_LAYER_ID, "circle-opacity", opacity);
  }, [map, year, visible, dataVersion]);
}

// HMR: this file installs MapLibre event listeners and layers via a
// setup-once pattern. Hot-replacing the module would leave stale closures
// attached to the map, so accept the update by triggering a full page
// reload instead. URL/localStorage state restores year, layers, theme, etc.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
