import {
  DEFAULT_YEAR,
  LAYER_IDS,
  MAX_YEAR,
  MIN_YEAR,
  THEMES,
  type LayerId,
  type ProjectionMode,
  type ThemeId,
} from "../store";

const LAYER_LETTER: Record<LayerId, string> = {
  boundaries: "b",
  peoples: "p",
  cities: "c",
  events: "e",
  connections: "n",
  battles: "x",
  population: "o",
  sealevel: "y",
  religions: "i",
  languages: "l",
  disasters: "d",
  people: "f",
  migrations: "m",
};

const LETTER_TO_LAYER: Record<string, LayerId> = Object.fromEntries(
  Object.entries(LAYER_LETTER).map(([k, v]) => [v, k as LayerId]),
);

export interface UrlState {
  year?: number;
  layers?: Record<LayerId, boolean>;
  projection?: ProjectionMode;
  theme?: ThemeId;
  /** Active story tour, if any: `{ storyId, chapterIndex }`. */
  tour?: { storyId: string; chapterIndex: number };
}

export function readUrlState(): UrlState {
  const params = new URLSearchParams(window.location.search);
  const out: UrlState = {};

  const yearStr = params.get("y");
  if (yearStr !== null) {
    const y = Number.parseInt(yearStr, 10);
    if (Number.isFinite(y) && y >= MIN_YEAR && y <= MAX_YEAR) {
      out.year = y;
    }
  }

  const layersStr = params.get("l");
  if (layersStr !== null) {
    const enabled = new Set<string>(layersStr.toLowerCase().split(""));
    const layers = {} as Record<LayerId, boolean>;
    for (const id of LAYER_IDS) {
      layers[id] = enabled.has(LAYER_LETTER[id]);
    }
    out.layers = layers;
  }

  const proj = params.get("p");
  if (proj === "flat" || proj === "globe") {
    out.projection = proj;
  }

  const theme = params.get("t");
  if (theme && (THEMES as readonly string[]).includes(theme)) {
    out.theme = theme as ThemeId;
  }

  const tour = params.get("tour");
  if (tour) {
    const [storyId, idxStr] = tour.split(":");
    const chapterIndex = Number.parseInt(idxStr ?? "0", 10);
    if (storyId && Number.isFinite(chapterIndex) && chapterIndex >= 0) {
      out.tour = { storyId, chapterIndex };
    }
  }

  return out;
}

export function writeUrlState(state: {
  year: number;
  layers: Record<LayerId, boolean>;
  projection: ProjectionMode;
  theme: ThemeId;
  tour: { storyId: string; chapterIndex: number } | null;
}): void {
  const params = new URLSearchParams(window.location.search);

  if (state.year !== DEFAULT_YEAR) {
    params.set("y", String(state.year));
  } else {
    params.delete("y");
  }

  const lettersOn = LAYER_IDS.filter((id) => state.layers[id])
    .map((id) => LAYER_LETTER[id])
    .join("");
  params.set("l", lettersOn);

  if (state.projection !== "flat") {
    params.set("p", state.projection);
  } else {
    params.delete("p");
  }

  if (state.theme !== "dark") {
    params.set("t", state.theme);
  } else {
    params.delete("t");
  }

  if (state.tour) {
    params.set("tour", `${state.tour.storyId}:${state.tour.chapterIndex}`);
  } else {
    params.delete("tour");
  }

  const newSearch = params.toString();
  const newUrl =
    window.location.pathname +
    (newSearch ? "?" + newSearch : "") +
    window.location.hash;
  if (
    newUrl !==
    window.location.pathname + window.location.search + window.location.hash
  ) {
    window.history.replaceState(null, "", newUrl);
  }
}

export const __layerLetterMap = LETTER_TO_LAYER;
