import { LAYER_IDS, THEMES, type LayerId, type ProjectionMode, type ThemeId } from "../store";

const KEY = "history-sim:state:v1";

export interface LocalState {
  year?: number;
  layers?: Record<LayerId, boolean>;
  projection?: ProjectionMode;
  theme?: ThemeId;
}

export function readLocalState(): LocalState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<LocalState>;
    const out: LocalState = {};
    if (typeof parsed.year === "number") out.year = parsed.year;
    if (parsed.projection === "flat" || parsed.projection === "globe") {
      out.projection = parsed.projection;
    }
    if (parsed.theme && (THEMES as readonly string[]).includes(parsed.theme)) {
      out.theme = parsed.theme as ThemeId;
    }
    if (parsed.layers && typeof parsed.layers === "object") {
      const layers = {} as Record<LayerId, boolean>;
      for (const id of LAYER_IDS) {
        layers[id] = parsed.layers[id] === true;
      }
      out.layers = layers;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeLocalState(state: {
  year: number;
  layers: Record<LayerId, boolean>;
  projection: ProjectionMode;
  theme: ThemeId;
}): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

const RECENT_TOURS_KEY = "history-sim:recent-tours:v1";
const MAX_RECENT_TOURS = 5;

/**
 * Persist a small most-recently-used list of story tour ids so the picker
 * can resurface them at the top. Caps at 5; deduplicates; tolerates broken
 * storage (privacy mode, quota).
 */
export function readRecentTours(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_TOURS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT_TOURS);
  } catch {
    return [];
  }
}

export function pushRecentTour(id: string): void {
  try {
    const current = readRecentTours();
    const next = [id, ...current.filter((x) => x !== id)].slice(0, MAX_RECENT_TOURS);
    localStorage.setItem(RECENT_TOURS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}
