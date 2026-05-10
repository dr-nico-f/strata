// Cities dataset = hand-curated historical entries (cities.curated.ts) merged
// with modern cities fetched at runtime from cities-geonames.json.
//
// Re-generate the GeoNames JSON with:
//   npm run build:cities

import { CURATED_CITIES, type City, cityPopulationAt } from "./cities.curated";

let CITIES: readonly City[] = CURATED_CITIES;

export async function loadGenerated(): Promise<void> {
  const resp = await fetch(`${import.meta.env.BASE_URL}data/cities-geonames.json`);
  const data: {
    cities: City[];
    curatedCityCc: Record<string, string>;
    curatedCapitalIds: string[];
  } = await resp.json();

  const curatedCapitalSet = new Set(data.curatedCapitalIds);
  const byId = new Map<string, City>();

  for (const c of data.cities) byId.set(c.id, c);

  for (const c of CURATED_CITIES) {
    const cc = c.cc ?? data.curatedCityCc[c.id];
    const capital = c.capital ?? curatedCapitalSet.has(c.id);
    const merged: City =
      cc === c.cc && capital === c.capital
        ? c
        : { ...c, ...(cc ? { cc } : {}), ...(capital ? { capital } : {}) };
    byId.set(c.id, merged);
  }

  CITIES = Array.from(byId.values());
}

export { CITIES };
export type { City };
export { cityPopulationAt };
