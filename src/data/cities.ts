// Cities dataset = hand-curated historical entries (cities.curated.ts) merged
// with the top 800 modern cities by population from the GeoNames cities15000
// dump (cities.geonames.generated.ts). The curated list always wins on
// duplicate ids so historical metadata (founding year, abandonment, population
// curves, Wikipedia slugs) is preserved.
//
// Re-generate the GeoNames-derived list with:
//   npm run build:cities
//
// Sources:
//   GeoNames cities15000 (CC BY 4.0) - https://www.geonames.org/
//   Curated entries - hand-authored (see cities.curated.ts)

import { CURATED_CITIES, type City, cityPopulationAt } from "./cities.curated";
import {
  CURATED_CAPITAL_IDS,
  CURATED_CITY_CC,
  GEONAMES_CITIES,
} from "./cities.geonames.generated";

function buildMergedCities(): readonly City[] {
  const byId = new Map<string, City>();
  for (const c of GEONAMES_CITIES) byId.set(c.id, c);
  // Curated entries overwrite GeoNames duplicates. Should rarely happen because
  // the build script already filters known collisions, but this is the
  // belt-and-braces guarantee. We also back-fill `cc` and `capital` from the
  // auto-generated maps so historical entries (Delhi, Athens, Rome, Babylon...)
  // bucket to the right country for the population layer and inherit the
  // capital flag when they displace a modern PPLC row.
  for (const c of CURATED_CITIES) {
    const cc = c.cc ?? CURATED_CITY_CC[c.id];
    const capital = c.capital ?? CURATED_CAPITAL_IDS.has(c.id);
    const merged: City =
      cc === c.cc && capital === c.capital
        ? c
        : { ...c, ...(cc ? { cc } : {}), ...(capital ? { capital } : {}) };
    byId.set(c.id, merged);
  }
  return Array.from(byId.values());
}

export const CITIES: readonly City[] = buildMergedCities();
export type { City };
export { cityPopulationAt };
