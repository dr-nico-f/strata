// Disasters dataset = hand-curated narrative-rich entries (disasters.curated.ts)
// merged with the auto-generated live dataset (disasters.live.generated.ts):
//   - USGS earthquake catalog for modern M >= 7.5 events (1900-2025)
//   - Wikidata for pre-1900 earthquakes, volcanic eruptions, tsunamis,
//     epidemics/pandemics, famines, and tropical cyclones
//
// Curated entries always win on duplicate id/name so historical color
// (Black Death, Tambora, San Francisco 1906, etc.) keeps its rich descriptions.
//
// Re-generate the live list with:
//   npm run build:disasters
//
// Sources:
//   USGS earthquake catalog (Public Domain) - https://earthquake.usgs.gov/
//   Wikidata (CC0) - https://www.wikidata.org/

import { CURATED_DISASTERS, type Disaster, type DisasterKind } from "./disasters.curated";
import { LIVE_DISASTERS } from "./disasters.live.generated";

function buildMergedDisasters(): readonly Disaster[] {
  const byId = new Map<string, Disaster>();
  for (const d of LIVE_DISASTERS) byId.set(d.id, d);
  for (const d of CURATED_DISASTERS) byId.set(d.id, d);
  return Array.from(byId.values()).sort((a, b) => a.year - b.year);
}

export const DISASTERS: readonly Disaster[] = buildMergedDisasters();
export type { Disaster, DisasterKind };
