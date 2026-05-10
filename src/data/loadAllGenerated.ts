import { loadGenerated as loadBattles } from "./battles";
import { loadGenerated as loadCities } from "./cities";
import { loadGenerated as loadDisasters } from "./disasters";
import { loadGenerated as loadPopulation } from "./population";
import { useStore } from "../store";

let loaded = false;

/**
 * Fetch and merge all generated JSON datasets in parallel, then bump
 * dataVersion so subscribed components re-render with the full data.
 * Safe to call multiple times (no-ops after the first success).
 */
export async function loadAllGeneratedData(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    await Promise.all([loadBattles(), loadCities(), loadDisasters(), loadPopulation()]);
  } catch (e) {
    console.error("Failed to load generated data:", e);
    loaded = false;
    return;
  }
  useStore.getState().bumpDataVersion();
}
