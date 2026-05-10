import { create } from "zustand";

export type LayerId =
  | "boundaries"
  | "peoples"
  | "cities"
  | "events"
  | "connections"
  | "battles"
  | "population"
  | "sealevel"
  | "religions"
  | "languages"
  | "disasters"
  | "people"
  | "migrations";

export const LAYER_IDS: readonly LayerId[] = [
  "boundaries",
  "peoples",
  "cities",
  "events",
  "connections",
  "battles",
  "population",
  "sealevel",
  "religions",
  "languages",
  "disasters",
  "people",
  "migrations",
] as const;

export type ProjectionMode = "flat" | "globe";
export type ThemeId = "dark" | "light" | "sepia";

export const THEMES: readonly ThemeId[] = ["dark", "light", "sepia"] as const;

export const MIN_YEAR = -10000;
export const MAX_YEAR = 2025;
export const DEFAULT_YEAR = 1492;

export type FeatureRef = {
  layer: LayerId;
  name: string;
  detail?: string;
  rangeStart?: number;
  rangeEnd?: number;
  pointYear?: number;
  lng?: number;
  lat?: number;
  wikipedia?: string;
  /** Stable id used by the bracket-key navigator. */
  id?: string;
  /** City-only: current population in thousands at the active year. */
  pop?: number;
  /** City-only: ISO-2 country code if known. */
  cc?: string;
  /** City-only: national capital flag. */
  capital?: boolean;
  /** City-only: years since the city was abandoned (0 if still active). */
  ruinAge?: number;
};

export type HoverInfo = (FeatureRef & { x: number; y: number }) | null;

interface AppState {
  year: number;
  setYear: (year: number) => void;

  layers: Record<LayerId, boolean>;
  toggleLayer: (id: LayerId) => void;
  setLayers: (layers: Record<LayerId, boolean>) => void;

  playing: boolean;
  setPlaying: (playing: boolean) => void;

  /**
   * Playback speed multiplier applied to the per-tick step in `TimeSlider`.
   * 1 = default cinematic pace (~15s for the full timeline). Persists to
   * localStorage so the user's preferred pace survives reloads.
   */
  playSpeed: number;
  setPlaySpeed: (s: number) => void;

  hover: HoverInfo;
  setHover: (hover: HoverInfo) => void;

  locked: HoverInfo;
  setLocked: (locked: HoverInfo) => void;

  projection: ProjectionMode;
  setProjection: (p: ProjectionMode) => void;

  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;

  boundaryBrightness: number;
  setBoundaryBrightness: (b: number) => void;

  autoSpin: boolean;
  setAutoSpin: (s: boolean) => void;

  helpOpen: boolean;
  setHelpOpen: (h: boolean) => void;

  nowPanelOpen: boolean;
  setNowPanelOpen: (h: boolean) => void;

  loadingBoundary: boolean;
  setLoadingBoundary: (l: boolean) => void;

  /** Last few visited years, most-recent first. Capped at 8. */
  recentYears: number[];
  pushRecentYear: (year: number) => void;

  /** Hides all chrome (panels, slider, header) for screenshots. */
  hideUi: boolean;
  setHideUi: (h: boolean) => void;

  /** Transient toast text, auto-clears after a few seconds. */
  toast: string | null;
  setToast: (t: string | null) => void;

  /** Search panel visibility. */
  searchOpen: boolean;
  setSearchOpen: (o: boolean) => void;

  /**
   * Active region focus bbox `[minLng, minLat, maxLng, maxLat]`. When set,
   * the map dims everything outside this rectangle to bring attention to a
   * single continent / region. Null = no focus.
   */
  focusBbox: [number, number, number, number] | null;
  setFocusBbox: (b: [number, number, number, number] | null) => void;

  /**
   * Country/region currently being inspected in the detail panel. Null = panel
   * closed. The bbox is used to filter cities/events/battles/people/disasters
   * for the panel and for the dim-mask region focus.
   */
  focusedCountry: {
    name: string;
    bbox: [number, number, number, number];
    /**
     * Full unclipped Polygon/MultiPolygon for the country at the active
     * boundary snapshot. When present, the focus mask traces the country
     * outline and the detail panel filters features with point-in-polygon
     * tests instead of bbox tests. Optional because some focus sources
     * (e.g. continent presets) only know a bbox.
     */
    geometry?: GeoJSON.Geometry;
  } | null;
  setFocusedCountry: (
    c: {
      name: string;
      bbox: [number, number, number, number];
      geometry?: GeoJSON.Geometry;
    } | null,
  ) => void;

  /**
   * Whether the country detail list panel is open. The focus mask + tooltip
   * always show on country click, but the larger list (cities/events/etc.)
   * stays hidden until the user explicitly clicks "Show country details" on
   * the pinned tooltip. Closing `focusedCountry` also closes this panel.
   */
  detailPanelOpen: boolean;
  setDetailPanelOpen: (open: boolean) => void;

  /**
   * Active curated story tour. `null` when not in a tour. The runtime applies
   * each chapter's year/camera/layers/pin imperatively when this changes.
   */
  tour: { storyId: string; chapterIndex: number } | null;
  startTour: (storyId: string, chapterIndex?: number) => void;
  advanceTour: (delta: 1 | -1) => void;
  exitTour: () => void;

  storyPickerOpen: boolean;
  setStoryPickerOpen: (open: boolean) => void;

  /**
   * Multi-layer click chooser. Set when a single click hit features in two
   * or more distinct layers; the user picks which one to pin via a small
   * floating popup near the cursor.
   */
  pendingChoice: {
    x: number;
    y: number;
    options: Array<{
      layer: LayerId;
      id?: string;
      name: string;
      detail?: string;
      wikipedia?: string;
      lng: number;
      lat: number;
      rangeStart?: number;
      rangeEnd?: number;
      pointYear?: number;
    }>;
  } | null;
  setPendingChoice: (c: AppState["pendingChoice"]) => void;

  /**
   * Bumped after async-loaded generated data (battles, cities, disasters,
   * population) finishes merging. Subscribing to this forces a re-render
   * so components pick up the enriched datasets.
   */
  dataVersion: number;
  bumpDataVersion: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  year: DEFAULT_YEAR,
  setYear: (year) => {
    const clamped = Math.max(MIN_YEAR, Math.min(MAX_YEAR, Math.round(year)));
    const cur = get().year;
    if (cur !== clamped) {
      // Push the previous year onto the breadcrumb when the user makes a
      // notable jump (>5 years apart) so scrubbing doesn't pollute history.
      if (Math.abs(cur - clamped) >= 5) {
        get().pushRecentYear(cur);
      }
    }
    set({ year: clamped });
  },

  layers: {
    boundaries: true,
    peoples: true,
    cities: true,
    events: true,
    connections: true,
    battles: true,
    population: false,
    sealevel: true,
    religions: false,
    languages: false,
    disasters: true,
    people: true,
    migrations: false,
  },
  toggleLayer: (id) => set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
  setLayers: (layers) => set({ layers }),

  playing: false,
  setPlaying: (playing) => set({ playing }),

  playSpeed: (() => {
    if (typeof window === "undefined") return 1;
    const raw = window.localStorage.getItem("hs-play-speed");
    const v = raw ? Number(raw) : 1;
    return Number.isFinite(v) && v > 0 ? v : 1;
  })(),
  setPlaySpeed: (playSpeed) => {
    set({ playSpeed });
    if (typeof window !== "undefined") {
      window.localStorage.setItem("hs-play-speed", String(playSpeed));
    }
  },

  hover: null,
  setHover: (hover) => set({ hover }),

  locked: null,
  setLocked: (locked) => set({ locked }),

  projection: "globe",
  setProjection: (projection) => set({ projection }),

  theme: "sepia",
  setTheme: (theme) => set({ theme }),

  boundaryBrightness: 1,
  setBoundaryBrightness: (boundaryBrightness) => set({ boundaryBrightness }),

  autoSpin: true,
  setAutoSpin: (autoSpin) => set({ autoSpin }),

  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),

  nowPanelOpen: false,
  setNowPanelOpen: (nowPanelOpen) => set({ nowPanelOpen }),

  loadingBoundary: false,
  setLoadingBoundary: (loadingBoundary) => set({ loadingBoundary }),

  recentYears: [],
  pushRecentYear: (year) =>
    set((s) => {
      const next = [year, ...s.recentYears.filter((y) => y !== year)].slice(0, 8);
      return { recentYears: next };
    }),

  hideUi: false,
  setHideUi: (hideUi) => set({ hideUi }),

  toast: null,
  setToast: (toast) => {
    set({ toast });
    // Auto-dismiss so callers don't have to manage their own timers.
    // Skipped when explicitly clearing (toast === null).
    if (toast !== null) {
      const message = toast;
      setTimeout(() => {
        if (useStore.getState().toast === message) {
          set({ toast: null });
        }
      }, 2400);
    }
  },

  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),

  focusBbox: null,
  setFocusBbox: (focusBbox) => set({ focusBbox }),

  focusedCountry: null,
  setFocusedCountry: (focusedCountry) =>
    // When focus is cleared, the detail panel must follow -- otherwise the
    // panel would render with stale data.
    set({ focusedCountry, detailPanelOpen: focusedCountry ? get().detailPanelOpen : false }),

  detailPanelOpen: false,
  setDetailPanelOpen: (detailPanelOpen) => set({ detailPanelOpen }),

  tour: null,
  startTour: (storyId, chapterIndex = 0) => {
    set({ tour: { storyId, chapterIndex }, storyPickerOpen: false });
  },
  advanceTour: (delta) => {
    const cur = get().tour;
    if (!cur) return;
    // Clamp to the story's chapter range. Importing the story dataset here
    // would create a circular module graph (data → store), so we look the
    // story up via a window-scoped helper that the StoryPlayer registers
    // when it mounts. Falls back to "no clamp" if the helper isn't ready.
    const lookupChapterCount = (
      window as unknown as {
        __hsChapterCount?: (id: string) => number | undefined;
      }
    ).__hsChapterCount;
    const total = lookupChapterCount?.(cur.storyId);
    const next = cur.chapterIndex + delta;
    if (total !== undefined && (next < 0 || next >= total)) return;
    set({ tour: { ...cur, chapterIndex: next } });
  },
  exitTour: () => set({ tour: null }),

  storyPickerOpen: false,
  setStoryPickerOpen: (storyPickerOpen) => set({ storyPickerOpen }),

  pendingChoice: null,
  setPendingChoice: (pendingChoice) => set({ pendingChoice }),

  dataVersion: 0,
  bumpDataVersion: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));

export function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year).toLocaleString()} BCE`;
  if (year === 0) return "1 BCE";
  return `${year.toLocaleString()} CE`;
}

export function wikipediaUrl(slug: string): string {
  if (slug.startsWith("http")) return slug;
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(slug.replace(/ /g, "_"))}`;
}
