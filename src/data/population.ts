/**
 * Per-country population, sourced live from Our World in Data (HYDE 3.3 +
 * Gapminder + UN WPP). The actual numbers are fetched at runtime from
 * population-owid.json and refreshed by `npm run build:population`.
 */

export interface OwidCountry {
  code: string;
  cca2: string;
  region: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  curve: ReadonlyArray<[number, number]>;
}

export interface PopRegion {
  /** ISO3 country code. */
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

let POPULATION_REGIONS: readonly PopRegion[] = [];
let OWID_WORLD_CURVE: ReadonlyArray<[number, number]> = [];
let OWID_BUILD_DATE = "";

export async function loadGenerated(): Promise<void> {
  const resp = await fetch(`${import.meta.env.BASE_URL}data/population-owid.json`);
  const data: {
    countries: OwidCountry[];
    worldCurve: [number, number][];
    buildDate: string;
  } = await resp.json();

  POPULATION_REGIONS = data.countries.map(
    (c): PopRegion => ({
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
  OWID_WORLD_CURVE = data.worldCurve;
  OWID_BUILD_DATE = data.buildDate;
}

/** Linear interpolation across an anchor curve. Returns population in millions. */
function interpolate(curve: ReadonlyArray<[number, number]>, year: number): number {
  if (curve.length === 0) return 0;
  if (year <= curve[0][0]) return curve[0][1];
  if (year >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];
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

export { POPULATION_REGIONS, OWID_WORLD_CURVE, OWID_BUILD_DATE };
