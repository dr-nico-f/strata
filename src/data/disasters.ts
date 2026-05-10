// Disasters dataset = hand-curated narrative-rich entries (disasters.curated.ts)
// merged with auto-generated data fetched at runtime from disasters-live.json.
//
// Re-generate the live JSON with:
//   npm run build:disasters

import { CURATED_DISASTERS, type Disaster, type DisasterKind } from "./disasters.curated";

let DISASTERS: readonly Disaster[] = CURATED_DISASTERS;

export async function loadGenerated(): Promise<void> {
  const resp = await fetch(`${import.meta.env.BASE_URL}data/disasters-live.json`);
  const live: Disaster[] = await resp.json();
  const byId = new Map<string, Disaster>();
  for (const d of live) byId.set(d.id, d);
  for (const d of CURATED_DISASTERS) byId.set(d.id, d);
  DISASTERS = Array.from(byId.values()).sort((a, b) => a.year - b.year);
}

export { DISASTERS };
export type { Disaster, DisasterKind };
