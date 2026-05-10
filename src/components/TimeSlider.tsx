import { useEffect, useMemo, useRef, useState } from "react";
import { BackBreadcrumb } from "./BackBreadcrumb";
import { BATTLES } from "../data/battles";
import { BOUNDARY_SNAPSHOT_YEARS } from "../data/boundariesManifest";
import { ERAS } from "../data/eras";
import { EVENTS } from "../data/events";
import { PEOPLE as NOTABLE_PEOPLE } from "../data/people";
import {
  DEFAULT_YEAR,
  MAX_YEAR,
  MIN_YEAR,
  formatYear,
  useStore,
} from "../store";
import { DENSITY, DENSITY_BIN_SIZE } from "../utils/density";
import { pickSnapshotYear } from "../utils/pickSnapshot";

const TOTAL_RANGE = MAX_YEAR - MIN_YEAR;

// Piecewise time-scale stops. Linear time gives the last two centuries only
// ~1.9% of the slider width, which is impossible to scrub accurately on a
// small screen. These stops compress prehistory and stretch modern history
// (1800–2025 → ~35% of the track ≈ 18× boost in pixels-per-year for the
// era with the densest data).
const STOPS: ReadonlyArray<{ year: number; pct: number }> = [
  { year: -10000, pct: 0 },
  { year: -3000, pct: 10 },
  { year: 0, pct: 24 },
  { year: 1000, pct: 35 },
  { year: 1500, pct: 46 },
  { year: 1800, pct: 64 },
  { year: 1900, pct: 77 },
  { year: 2025, pct: 100 },
];

function pctFor(year: number): number {
  if (year <= STOPS[0].year) return 0;
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (year >= a.year && year <= b.year) {
      const t = (year - a.year) / (b.year - a.year);
      return a.pct + t * (b.pct - a.pct);
    }
  }
  return 100;
}

function yearFor(pct: number): number {
  if (pct <= 0) return STOPS[0].year;
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (pct >= a.pct && pct <= b.pct) {
      const t = (pct - a.pct) / (b.pct - a.pct);
      return Math.round(a.year + t * (b.year - a.year));
    }
  }
  return STOPS[STOPS.length - 1].year;
}

// Native <input type="range"> is linear, so we expose a 0–10000 logical
// position to it and translate to/from year on every read/write. 10000
// steps give ~1px resolution at any reasonable screen width.
const SLIDER_RES = 10000;
function yearToSlider(year: number): number {
  return Math.round((pctFor(year) / 100) * SLIDER_RES);
}
function sliderToYear(value: number): number {
  return yearFor((value / SLIDER_RES) * 100);
}

function eraLabelFor(year: number): string {
  let label = ERAS[0].label;
  for (const e of ERAS) {
    if (e.year <= year) label = e.label;
    else break;
  }
  return label;
}

/**
 * Index of (year, name) pairs across events / battles / people, sorted by
 * year for binary-search lookup. Built once at module load — EVENTS,
 * BATTLES, PEOPLE are static imports and never change at runtime.
 */
type IndexedFeature = { year: number; name: string };
const FEATURE_INDEX: IndexedFeature[] = (() => {
  const out: IndexedFeature[] = [];
  for (const e of EVENTS) out.push({ year: e.year, name: e.name });
  for (const b of BATTLES) out.push({ year: b.year, name: b.name });
  for (const p of NOTABLE_PEOPLE) {
    out.push({ year: p.birth, name: p.name });
    if (p.death !== p.birth) out.push({ year: p.death, name: p.name });
  }
  out.sort((a, b) => a.year - b.year);
  return out;
})();

function lowerBound(year: number): number {
  let lo = 0;
  let hi = FEATURE_INDEX.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (FEATURE_INDEX[mid].year < year) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const TOP_FEATURES_CACHE = new Map<number, string[]>();

/**
 * Top features near a given year. Memoized + binary-searched against a
 * pre-sorted feature index, so even a worst-case empty-region scan stays
 * O(log n) + small linear walk and a second hover at the same year is O(1).
 */
function topFeaturesNear(year: number): string[] {
  const cached = TOP_FEATURES_CACHE.get(year);
  if (cached) return cached;
  // Try widening windows so the closest features always win out.
  for (const window of [3, 10, 25, 75]) {
    const lo = lowerBound(year - window);
    const out: string[] = [];
    const seen = new Set<string>();
    for (let i = lo; i < FEATURE_INDEX.length; i++) {
      const f = FEATURE_INDEX[i];
      if (f.year > year + window) break;
      if (seen.has(f.name)) continue;
      seen.add(f.name);
      out.push(f.name);
      if (out.length >= 3) break;
    }
    if (out.length >= 3 || (window === 75 && out.length > 0)) {
      // 75 is our widest window; commit whatever we got rather than scan
      // further into deep empty stretches of prehistory.
      TOP_FEATURES_CACHE.set(year, out);
      return out;
    }
    if (window === 75) {
      TOP_FEATURES_CACHE.set(year, out);
      return out;
    }
  }
  return [];
}

const ERA_COLORS: Record<string, string> = {
  "ice-age": "rgba(122, 162, 255, 0.10)",
  neolithic: "rgba(95, 209, 160, 0.10)",
  "early-bronze": "rgba(245, 185, 66, 0.10)",
  bronze: "rgba(245, 185, 66, 0.13)",
  iron: "rgba(195, 155, 90, 0.13)",
  classical: "rgba(195, 155, 255, 0.13)",
  roman: "rgba(255, 122, 144, 0.13)",
  "early-medieval": "rgba(122, 162, 255, 0.10)",
  "high-medieval": "rgba(122, 162, 255, 0.13)",
  renaissance: "rgba(255, 174, 66, 0.16)",
  exploration: "rgba(95, 209, 160, 0.13)",
  enlightenment: "rgba(255, 216, 107, 0.13)",
  industrial: "rgba(140, 140, 160, 0.13)",
  ww1: "rgba(255, 106, 106, 0.13)",
  ww2: "rgba(255, 106, 106, 0.16)",
  modern: "rgba(95, 209, 255, 0.13)",
};

export function TimeSlider() {
  const year = useStore((s) => s.year);
  const setYear = useStore((s) => s.setYear);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const playSpeed = useStore((s) => s.playSpeed);
  const setPlaySpeed = useStore((s) => s.setPlaySpeed);
  const loading = useStore((s) => s.loadingBoundary);
  const hideUi = useStore((s) => s.hideUi);

  const rafRef = useRef<number | null>(null);

  // Hover preview shown while the cursor is over the slider track.
  // `pendingX` is rAF-throttled; `preview` is what's actually rendered.
  const [preview, setPreview] = useState<{ year: number; x: number } | null>(
    null,
  );
  const previewRafRef = useRef<number | null>(null);
  const previewPendingRef = useRef<{ year: number; x: number } | null>(null);

  const previewMemo = useMemo(() => {
    if (!preview) return null;
    return {
      year: preview.year,
      x: preview.x,
      era: eraLabelFor(preview.year),
      features: topFeaturesNear(preview.year),
    };
  }, [preview]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    // Drive playback off elapsed time at the display's native refresh rate
    // (rAF), not a fixed 60ms tick. The old gate capped automatic playback
    // to ~16 FPS, which read as choppy at every speed. With per-frame
    // ticking + a sub-frame pct accumulator, the playhead advances smoothly
    // and only flips `year` (which is integer-quantized in the store) when
    // it actually crosses a year boundary — so React/Zustand fan-out stays
    // bounded even at 10× and at modern parts of the timeline where each
    // year is ~6px wide.
    //
    // 1× takes ~15s for the full timeline, matching the previous tuning
    // (0.4 pct/tick × 60ms = 0.4 pct ≈ 1/15000ms × 100pct).
    const PCT_PER_MS = (100 / 15000) * playSpeed;
    let lastT = performance.now();
    let pctAcc = pctFor(useStore.getState().year);

    const tick = (t: number) => {
      // Cap dt so a stalled tab / dropped frames don't cause a giant jump
      // when playback resumes. visibilitychange auto-pauses, but throttled
      // back-tabs can still slip through a few sluggish frames.
      const dt = Math.min(100, t - lastT);
      lastT = t;
      pctAcc += PCT_PER_MS * dt;
      if (pctAcc >= 100) {
        useStore.getState().setYear(MAX_YEAR);
        useStore.getState().setPlaying(false);
        return;
      }
      const newYear = yearFor(pctAcc);
      const cur = useStore.getState().year;
      if (newYear !== cur) {
        useStore.getState().setYear(newYear);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, playSpeed]);

  // Auto-pause when the tab loses visibility. rAF throttles to 1Hz when the
  // tab is hidden, which makes playback both jerky and likely to overshoot
  // the user's intended stopping point — pausing is the friendlier default.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && useStore.getState().playing) {
        useStore.getState().setPlaying(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const surprise = () => {
    setPlaying(false);
    // Bias toward the last 5000 years (the range with the richest data)
    const r = Math.random();
    const y = r < 0.7
      ? Math.floor(-3000 + Math.random() * (MAX_YEAR + 3000))
      : Math.floor(MIN_YEAR + Math.random() * TOTAL_RANGE);
    setYear(y);
  };

  const snap = () => {
    const s = pickSnapshotYear(BOUNDARY_SNAPSHOT_YEARS, year);
    setYear(s);
  };

  if (hideUi) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: "var(--panel)",
        borderTop: "1px solid var(--panel-border)",
        padding: "8px 20px 14px",
        zIndex: 5,
        backdropFilter: "blur(6px)",
      }}
    >
      <EraPresets year={year} setYear={setYear} setPlaying={setPlaying} />

      {/* Top row — year is the slider's "value", so it's centered as the
          focal point. Recent-year navigator anchored left. The help button
          used to live on the right here but felt orphaned next to the
          centered year; it now lives in the LayerToggles panel's top-right
          corner alongside the rest of the meta-controls. */}
      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginTop: 8,
          minHeight: 36,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        >
          <BackBreadcrumb />
        </div>

        <YearDisplay year={year} setYear={setYear} setPlaying={setPlaying} />
        {loading && (
          <span
            aria-label="Loading boundary snapshot"
            title="Loading boundary snapshot…"
            style={{
              position: "absolute",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            <span className="hs-spinner" aria-hidden="true" />
            Loading…
          </span>
        )}
      </div>

      {/* Slider — always its own row, full panel width. The piecewise scale
          (see STOPS at top of file) means modern history gets ~18× more
          pixels-per-year than under the old linear scale. */}
      <div
        style={{ position: "relative", marginTop: 10 }}
        onMouseMove={(ev) => {
          const rect = ev.currentTarget.getBoundingClientRect();
          const ratio = (ev.clientX - rect.left) / rect.width;
          const clamped = Math.max(0, Math.min(1, ratio));
          const yr = yearFor(clamped * 100);
          previewPendingRef.current = { year: yr, x: ev.clientX };
          if (previewRafRef.current === null) {
            previewRafRef.current = requestAnimationFrame(() => {
              previewRafRef.current = null;
              if (previewPendingRef.current) {
                setPreview(previewPendingRef.current);
              }
            });
          }
        }}
        onMouseLeave={() => {
          if (previewRafRef.current !== null) {
            cancelAnimationFrame(previewRafRef.current);
            previewRafRef.current = null;
          }
          previewPendingRef.current = null;
          setPreview(null);
        }}
      >
        <DensitySparkline />
        <EraBands />
        <input
          className="time-slider"
          type="range"
          min={0}
          max={SLIDER_RES}
          step={1}
          value={yearToSlider(year)}
          aria-label="Year"
          aria-valuetext={formatYear(year)}
          onChange={(e) => setYear(sliderToYear(Number(e.target.value)))}
          style={{ width: "100%", display: "block", position: "relative" }}
        />
        <SnapshotTicks />
        {previewMemo && (
          <SliderHoverChip
            preview={previewMemo}
            onJump={() => setYear(previewMemo.year)}
          />
        )}
        {loading && (
          <div
            className="shimmer"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: -8,
              height: 3,
              borderRadius: 2,
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Endpoint labels — anchored to the slider's left/right edges so it's
          obvious they label the *slider's* bounds, not the era bands above. */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 10,
          fontSize: 10,
          letterSpacing: 0.4,
          color: "var(--text-muted)",
          fontVariantNumeric: "tabular-nums",
          pointerEvents: "none",
        }}
      >
        <span>{formatYear(MIN_YEAR)}</span>
        <span>{formatYear(MAX_YEAR)}</span>
      </div>

      {/* Transport row — compact icon-only buttons. Play is the primary CTA
          (filled accent), the rest are ghost buttons in matched 32×32 squares
          so the row reads as a unified mini-toolbar instead of a strip of
          chunky labelled buttons. */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
          rowGap: 6,
          marginTop: 10,
        }}
      >
        <TransportButton
          onClick={() => setPlaying(!playing)}
          title={playing ? "Pause (Space)" : "Play (Space)"}
          ariaLabel={playing ? "Pause" : "Play"}
          primary
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </TransportButton>
        <TransportButton
          onClick={() => {
            setPlaying(false);
            setYear(DEFAULT_YEAR);
          }}
          title="Reset to default year"
          ariaLabel="Reset"
        >
          <ResetIcon />
        </TransportButton>
        <TransportButton
          onClick={() => {
            setPlaying(false);
            setYear(MAX_YEAR);
          }}
          title={`Jump to present (${formatYear(MAX_YEAR)}) — End`}
          ariaLabel="Jump to present"
        >
          <NowIcon />
        </TransportButton>
        <TransportButton
          onClick={surprise}
          title="Random year (R)"
          ariaLabel="Random year"
        >
          <ShuffleIcon />
        </TransportButton>
        <TransportButton
          onClick={snap}
          title="Snap to nearest boundary snapshot (N)"
          ariaLabel="Snap to nearest snapshot"
        >
          <SnapIcon />
        </TransportButton>
        <PlaySpeedControl speed={playSpeed} setSpeed={setPlaySpeed} />
      </div>
    </div>
  );
}

/**
 * Compact square button used for the transport row. `primary` swaps in the
 * accent fill so Play (the main CTA) reads as the focal action. Everything
 * else inherits the ghost treatment.
 */
function TransportButton({
  onClick,
  title,
  ariaLabel,
  primary = false,
  children,
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      style={{
        width: 32,
        height: 32,
        padding: 0,
        borderRadius: 8,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: primary
          ? "var(--accent-strong, #f5b942)"
          : "rgba(255, 255, 255, 0.05)",
        border: primary
          ? "1px solid var(--accent-strong, #f5b942)"
          : "1px solid var(--panel-border)",
        color: primary ? "#0a0d14" : "var(--text)",
        boxShadow: primary ? "0 2px 8px rgba(245, 185, 66, 0.30)" : "none",
        transition: "background 120ms ease, transform 80ms ease",
      }}
    >
      {children}
    </button>
  );
}

/**
 * Tiny segmented control for playback speed. Sits at the right edge of the
 * transport row so the play/pause button stays the visual anchor in the
 * center. Persists to localStorage via the store setter.
 */
const PLAY_SPEEDS: ReadonlyArray<number> = [0.1, 0.5, 1, 2, 5];

function PlaySpeedControl({
  speed,
  setSpeed,
}: {
  speed: number;
  setSpeed: (s: number) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Playback speed"
      title="Playback speed"
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 32,
        marginLeft: 6,
        padding: 2,
        borderRadius: 8,
        border: "1px solid var(--panel-border)",
        background: "rgba(255, 255, 255, 0.05)",
        gap: 2,
      }}
    >
      {PLAY_SPEEDS.map((s) => {
        const active = Math.abs(s - speed) < 1e-6;
        return (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            aria-pressed={active}
            title={`${s}× speed`}
            style={{
              height: 26,
              padding: "0 8px",
              borderRadius: 6,
              border: "none",
              background: active
                ? "var(--accent-strong, #f5b942)"
                : "transparent",
              color: active ? "#0a0d14" : "var(--text-muted)",
              fontSize: 11,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              cursor: "pointer",
              transition: "background 120ms ease, color 120ms ease",
            }}
          >
            {s}×
          </button>
        );
      })}
    </div>
  );
}

/* ── Transport icons. Inline SVGs use currentColor so the button's own
   text color drives the fill/stroke, which means primary vs. ghost
   buttons get the right contrast for free. ── */

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
      <path d="M3 2 L12 7 L3 12 Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
      <rect x="3" y="2" width="2.6" height="10" fill="currentColor" />
      <rect x="8.4" y="2" width="2.6" height="10" fill="currentColor" />
    </svg>
  );
}

function ResetIcon() {
  // Counter-clockwise loop arrow — universal "back to start" glyph.
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 7 A5 5 0 1 0 4 3.2" />
      <path d="M2 1 L2 4 L5 4" />
    </svg>
  );
}

function NowIcon() {
  // Skip-to-end (▶|) — visually pairs with the Play triangle.
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path d="M2 2 L9 7 L2 12 Z" fill="currentColor" />
      <rect x="10" y="2" width="2" height="10" fill="currentColor" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3 L4.5 3 L9 11 L12 11" />
      <path d="M2 11 L4.5 11 L6 8.4" />
      <path d="M8 5.6 L9 4 L12 3 M10 1 L12 3 L10 5" />
      <path d="M10 9 L12 11 L10 13" />
    </svg>
  );
}

function SnapIcon() {
  // Crosshair / target — implies "snap onto a fixed point."
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="7" cy="7" r="4" />
      <circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <path d="M7 0.5 L7 2.5 M7 11.5 L7 13.5 M0.5 7 L2.5 7 M11.5 7 L13.5 7" />
    </svg>
  );
}

function YearDisplay({
  year,
  setYear,
  setPlaying,
}: {
  year: number;
  setYear: (y: number) => void;
  setPlaying: (p: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (editing) {
    return (
      <input
        type="number"
        autoFocus
        defaultValue={year}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          if (trimmed !== "") {
            const v = Number(trimmed);
            if (Number.isFinite(v)) {
              setPlaying(false);
              setYear(v);
            }
          }
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        style={{
          width: 110,
          fontSize: 18,
          fontWeight: 600,
          textAlign: "center",
          color: "var(--accent-strong)",
        }}
      />
    );
  }
  return (
    <button
      onClick={() => {
        setDraft(String(year));
        setEditing(true);
      }}
      title="Click to type a year (negative for BCE)"
      style={{
        minWidth: 130,
        fontVariantNumeric: "tabular-nums",
        fontSize: 22,
        fontWeight: 600,
        color: "var(--accent-strong)",
        textAlign: "center",
        background: "transparent",
        border: "1px solid transparent",
      }}
    >
      {formatYear(year)}
    </button>
  );
}

function EraPresets({
  year,
  setYear,
  setPlaying,
}: {
  year: number;
  setYear: (y: number) => void;
  setPlaying: (p: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontSize: 11,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginRight: 4,
        }}
      >
        Eras
      </span>
      {ERAS.map((era, i) => {
        // An era is "active" when the current year falls within its span
        // [era.year, nextEra.year). The last era extends to MAX_YEAR. The
        // previous ±25y heuristic only lit up briefly near the era's start
        // year and missed the bulk of each span.
        const start = era.year;
        const end = i < ERAS.length - 1 ? ERAS[i + 1].year : MAX_YEAR + 1;
        const active = year >= start && year < end;
        return (
          <button
            key={era.id}
            aria-pressed={active}
            onClick={() => {
              setPlaying(false);
              setYear(era.year);
            }}
            title={formatYear(era.year)}
            style={{
              fontSize: 12,
              padding: "3px 8px",
              borderColor: active ? "var(--accent)" : "var(--panel-border)",
              background: active
                ? "rgba(245, 185, 66, 0.15)"
                : "rgba(255, 255, 255, 0.04)",
              color: active ? "var(--accent-strong)" : "var(--text)",
            }}
          >
            {era.label}
          </button>
        );
      })}
    </div>
  );
}

function SliderHoverChip({
  preview,
  onJump,
}: {
  preview: { year: number; x: number; era: string; features: string[] };
  onJump: () => void;
}) {
  // Pin the chip to the cursor's clientX (viewport coordinates), but render it
  // inside the slider wrapper, so we offset by the wrapper's own bounding box.
  // Using `position: fixed` sidesteps overflow clipping by parent panels.
  // Clicking the chip jumps to that year — handy when the preview shows a
  // feature you actually want to land on.
  const head = `${formatYear(preview.year)} · ${preview.era}`;
  const subtitle = preview.features.slice(0, 2).join(" · ");
  return (
    <button
      type="button"
      onClick={onJump}
      onMouseDown={(e) => e.stopPropagation()}
      title={`Jump to ${formatYear(preview.year)}`}
      style={{
        position: "fixed",
        left: preview.x,
        bottom: 90,
        transform: "translateX(-50%)",
        background: "rgba(20, 22, 30, 0.96)",
        color: "var(--text)",
        border: "1px solid var(--panel-border)",
        borderRadius: 6,
        padding: "5px 9px",
        fontSize: 11,
        lineHeight: 1.35,
        maxWidth: 320,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
        zIndex: 12,
        pointerEvents: "auto",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: "pointer",
        textAlign: "left",
        font: "inherit",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: "var(--accent-strong)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {head}
      </div>
      {subtitle && (
        <div
          style={{
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {subtitle}
        </div>
      )}
    </button>
  );
}

function EraBands() {
  // Draw soft tinted bands directly behind the slider track. Bands span
  // [era[i].year, era[i+1].year) so the visual feels like a timeline.
  const segments = ERAS.map((era, i) => {
    const start = era.year;
    const end = i < ERAS.length - 1 ? ERAS[i + 1].year : MAX_YEAR;
    return {
      id: era.id,
      label: era.label,
      start,
      end,
      color: ERA_COLORS[era.id] ?? "rgba(255, 255, 255, 0.05)",
    };
  });
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 4,
        height: 14,
        pointerEvents: "none",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {segments.map((seg) => (
        <span
          key={seg.id}
          title={`${seg.label} (${formatYear(seg.start)}+)`}
          style={{
            position: "absolute",
            left: `${pctFor(seg.start)}%`,
            width: `${pctFor(seg.end) - pctFor(seg.start)}%`,
            top: 0,
            bottom: 0,
            background: seg.color,
          }}
        />
      ))}
    </div>
  );
}

function DensitySparkline() {
  // Tiny bar chart above the slider showing how many events/battles/disasters
  // fall in each ~200-year bin. Empty centuries become visually obvious.
  const { bins, starts, max } = DENSITY;
  return (
    <div
      aria-hidden="true"
      title="Event density (events + battles + disasters per ~200 years)"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "100%",
        marginBottom: 2,
        height: 18,
        pointerEvents: "none",
      }}
    >
      {bins.map((count, i) => {
        if (!count) return null;
        const left = pctFor(starts[i]);
        // Bin width must follow the piecewise scale, otherwise modern bins
        // would be drawn at the old narrow linear width and underflow the
        // stretched modern segment.
        const width = pctFor(starts[i] + DENSITY_BIN_SIZE) - left;
        const h = Math.max(2, (count / max) * 18);
        return (
          <span
            key={starts[i]}
            style={{
              position: "absolute",
              left: `calc(${left}% + 1px)`,
              width: `calc(${width}% - 2px)`,
              bottom: 0,
              height: h,
              // Softened to read as an ambient density hint rather than
              // competing with the era bands directly below it.
              background:
                "linear-gradient(180deg, rgba(245, 185, 66, 0.32), rgba(245, 185, 66, 0.10))",
              borderRadius: "2px 2px 0 0",
            }}
          />
        );
      })}
    </div>
  );
}

function SnapshotTicks() {
  // Faint ticks marking the years we actually have hand-drawn nation-boundary
  // snapshots for — i.e., the targets the "Snap" button uses. Kept subtle so
  // they read as anchor marks rather than another data dimension.
  return (
    <div
      title="Boundary snapshot years (Snap targets)"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: "100%",
        marginTop: -4,
        height: 5,
        pointerEvents: "none",
      }}
    >
      {BOUNDARY_SNAPSHOT_YEARS.map((y) => (
        <span
          key={y}
          style={{
            position: "absolute",
            left: `calc(${pctFor(y)}% - 0.5px)`,
            top: 0,
            width: 1,
            height: 5,
            background: "rgba(122, 162, 255, 0.32)",
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}
