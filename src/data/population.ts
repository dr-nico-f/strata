/**
 * Per-country population, sourced live from Our World in Data (HYDE 3.3 +
 * Gapminder + UN WPP). The actual numbers are in `population.owid.generated.ts`
 * and refreshed by `npm run build:population`.
 *
 * This module preserves the older `PopRegion` / `populationAt` surface so the
 * rest of the app does not need to know that we used to ship 17 hand-curated
 * regions instead of ~240 ISO3 countries.
 */
import { OWID_COUNTRIES, OWID_WORLD_CURVE, type OwidCountry } from "./population.owid.generated";

export { OWID_BUILD_DATE, OWID_WORLD_CURVE } from "./population.owid.generated";

export interface PopRegion {
  /** ISO3 country code (was a hand-coded slug pre-OWID). */
  id: string;
  /** ISO 3166-1 alpha-2 code (matches GeoNames `cc`). */
  cca2: string;
  /** Continent / region: Africa, Americas, Asia, Europe, Oceania, Antarctic, Other. */
  continent: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  /** Anchor points sorted by year. Population in millions. */
  curve: ReadonlyArray<[year: number, popMillions: number]>;
}

export const POPULATION_REGIONS: readonly PopRegion[] = OWID_COUNTRIES.map(
  (c: OwidCountry): PopRegion => ({
    id: c.code,
    cca2: c.cca2,
    continent: c.region || "Other",
    name: c.name,
    lat: c.lat,
    lng: c.lng,
    radius: c.radius,
    curve: c.curve,
  }),
);

/** Linear interpolation across an anchor curve. Returns population in millions. */
function interpolate(curve: ReadonlyArray<[number, number]>, year: number): number {
  if (curve.length === 0) return 0;
  if (year <= curve[0][0]) return curve[0][1];
  if (year >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];
  // OWID curves are dense -- a linear scan is fine in practice but we use
  // a binary search to keep this O(log n) for the per-frame buildFeatures
  // call (called every year change with 237 countries).
  let lo = 0;
  let hi = curve.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (curve[mid][0] <= year) lo = mid;
    else hi = mid;
  }
  const [y0, p0] = curve[lo];
  const [y1, p1] = curve[hi];
  if (y0 === y1) return p0;
  const t = (year - y0) / (y1 - y0);
  return p0 + (p1 - p0) * t;
}

export function populationAt(region: PopRegion, year: number): number {
  return interpolate(region.curve, year);
}

/** Estimated world population (millions) at a given year, from OWID. */
export function worldPopulationAt(year: number): number {
  return interpolate(OWID_WORLD_CURVE, year);
}
