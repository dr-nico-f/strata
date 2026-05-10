// Battles dataset = hand-curated narrative-rich entries (battles.curated.ts)
// merged with the top ~900 most-linked battles from Wikidata
// (battles.wikidata.generated.ts). The curated list always wins on duplicate
// ids/names so descriptions stay rich.
//
// Re-generate the Wikidata-derived list with:
//   npm run build:battles
//
// Sources:
//   Wikidata (CC0) - https://www.wikidata.org/
//   Curated entries - hand-authored (see battles.curated.ts)

import { CURATED_BATTLES, type Battle } from "./battles.curated";
import { WIKIDATA_BATTLES } from "./battles.wikidata.generated";

function buildMergedBattles(): readonly Battle[] {
  const byId = new Map<string, Battle>();
  for (const b of WIKIDATA_BATTLES) byId.set(b.id, b);
  // Curated entries overwrite Wikidata duplicates so the hand-written
  // descriptions and Wikipedia slugs survive.
  for (const b of CURATED_BATTLES) byId.set(b.id, b);
  return Array.from(byId.values()).sort((a, b) => a.year - b.year);
}

export const BATTLES: readonly Battle[] = buildMergedBattles();
export type { Battle };
