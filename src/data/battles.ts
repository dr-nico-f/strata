// Battles dataset = hand-curated narrative-rich entries (battles.curated.ts)
// merged with the top ~900 most-linked battles from Wikidata (fetched at
// runtime from battles-wikidata.json). The curated list always wins on
// duplicate ids/names so descriptions stay rich.
//
// Re-generate the Wikidata-derived JSON with:
//   npm run build:battles

import { CURATED_BATTLES, type Battle } from "./battles.curated";

// Start with curated-only; enriched after loadGenerated() completes.
// ES module live binding: importers see the updated value after reassignment.
let BATTLES: readonly Battle[] = CURATED_BATTLES;

export async function loadGenerated(): Promise<void> {
  const resp = await fetch(`${import.meta.env.BASE_URL}data/battles-wikidata.json`);
  const wikidata: Battle[] = await resp.json();
  const byId = new Map<string, Battle>();
  for (const b of wikidata) byId.set(b.id, b);
  for (const b of CURATED_BATTLES) byId.set(b.id, b);
  BATTLES = Array.from(byId.values()).sort((a, b) => a.year - b.year);
}

export { BATTLES };
export type { Battle };
