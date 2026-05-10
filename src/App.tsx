import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ClimateBand } from "./components/ClimateBand";
import { climateAt, climateColor } from "./data/climate";
import { loadAllGeneratedData } from "./data/loadAllGenerated";
import { CountryDetailPanel } from "./components/CountryDetailPanel";
import { LayerChoicePopup } from "./components/LayerChoicePopup";
import { LayerToggles } from "./components/LayerToggles";
import { MapView } from "./components/MapView";
import { NowPanel } from "./components/NowPanel";
import { Toast } from "./components/ShareButton";
import { StarField } from "./components/StarField";
import { TimeSlider } from "./components/TimeSlider";
import { Tooltip } from "./components/Tooltip";
import { MAX_YEAR, MIN_YEAR, useStore } from "./store";
import { useFocusFromUrl } from "./utils/useFocusFromUrl";
import { useKeyboard } from "./utils/useKeyboard";
import { useUrlSync } from "./utils/useUrlSync";

// Lazy-loaded overlays. These return null when their store flag is closed,
// so we further gate the JSX render behind that flag — that way the
// dynamic import() doesn't fire until the user actually opens the panel.
// Each one is a named export, so we re-shape it into a default export for
// React.lazy.
const HelpOverlayLazy = lazy(() =>
  import("./components/HelpOverlay").then((m) => ({ default: m.HelpOverlay })),
);
const StoryPickerLazy = lazy(() =>
  import("./components/StoryPicker").then((m) => ({ default: m.StoryPicker })),
);
const StoryPlayerLazy = lazy(() =>
  import("./components/StoryPlayer").then((m) => ({ default: m.StoryPlayer })),
);
const SearchBarLazy = lazy(() =>
  import("./components/SearchBar").then((m) => ({ default: m.SearchBar })),
);

function MobileBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!isMobile || dismissed) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 500,
        background: "rgba(14, 17, 22, 0.95)",
        backdropFilter: "blur(8px)",
        borderTop: "1px solid rgba(245, 185, 66, 0.3)",
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        fontSize: 13,
        color: "#e6e8ec",
      }}
    >
      <span>
        <strong style={{ color: "#f5b942" }}>Best viewed on desktop</strong> — Strata uses keyboard
        shortcuts, hover tooltips, and a wide map canvas.
      </span>
      <button
        onClick={() => setDismissed(true)}
        style={{
          flexShrink: 0,
          padding: "4px 12px",
          fontSize: 12,
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 6,
          color: "#e6e8ec",
          cursor: "pointer",
        }}
      >
        Got it
      </button>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          border: "3px solid rgba(255,255,255,0.15)",
          borderTopColor: "var(--accent-strong, #f5b942)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
    </div>
  );
}

export default function App() {
  useKeyboard();
  useUrlSync();
  useFocusFromUrl();

  useEffect(() => {
    loadAllGeneratedData();
  }, []);

  // Apply the active theme as a data attribute on <html> for our CSS variables.
  const theme = useStore((s) => s.theme);
  const hideUi = useStore((s) => s.hideUi);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-hide-ui", hideUi);
  }, [hideUi]);

  // Gate the lazy overlays so their chunks don't load until the user
  // actually opens them. Subscribing here keeps the bundle splittable
  // without changing the components themselves.
  const helpOpen = useStore((s) => s.helpOpen);
  const storyPickerOpen = useStore((s) => s.storyPickerOpen);
  const searchOpen = useStore((s) => s.searchOpen);
  const tour = useStore((s) => s.tour);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <StarField />
      <MapView />
      <ClimateBand />
      <Tooltip />
      <LayerChoicePopup />
      <NowPanel />
      <CountryDetailPanel />
      <LayerToggles />
      <Header />
      <TimeSlider />
      <Suspense fallback={<LoadingSpinner />}>
        {searchOpen && <SearchBarLazy />}
        {tour !== null && <StoryPlayerLazy />}
        {storyPickerOpen && <StoryPickerLazy />}
        {helpOpen && <HelpOverlayLazy />}
      </Suspense>
      <Toast />
      <MobileBanner />
    </div>
  );
}

function Header() {
  const setNowPanelOpen = useStore((s) => s.setNowPanelOpen);
  const nowPanelOpen = useStore((s) => s.nowPanelOpen);
  const setStoryPickerOpen = useStore((s) => s.setStoryPickerOpen);
  const setYear = useStore((s) => s.setYear);
  const year = useStore((s) => s.year);
  const hideUi = useStore((s) => s.hideUi);
  // Climate readout that used to live in a free-floating chip at the top-
  // right (where it collided with the LayerToggles panel and inherited the
  // ClimateBand's 55% opacity). Now sits inline with the Header at full
  // opacity, contextual to the year.
  const climate = useMemo(() => {
    const c = climateAt(year);
    const sign = c.anomaly >= 0 ? "+" : "−";
    return {
      label: `${sign}${Math.abs(c.anomaly).toFixed(2)} °C`,
      epoch: c.epoch,
      color: climateColor(c.anomaly),
    };
  }, [year]);
  // Click the wordmark for a surprise jump. Same bias as the slider's R
  // shortcut: 70% chance we land somewhere in the last 5000 years where the
  // data is densest, otherwise anywhere in the whole timeline.
  const surprise = () => {
    const r = Math.random();
    const span = MAX_YEAR - MIN_YEAR;
    const denseStart = -3000;
    const denseSpan = MAX_YEAR - denseStart;
    const y =
      r < 0.7
        ? Math.floor(denseStart + Math.random() * denseSpan)
        : Math.floor(MIN_YEAR + Math.random() * span);
    setYear(y);
  };
  if (hideUi) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: nowPanelOpen ? 304 : 16,
        right: 280,
        zIndex: 4,
        pointerEvents: "none",
        transition: "left 0.2s ease-out",
      }}
    >
      <div
        style={{
          display: "inline-block",
          background: "var(--panel)",
          border: "1px solid var(--panel-border)",
          borderRadius: 10,
          padding: "8px 14px",
          backdropFilter: "blur(6px)",
          boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
          onClick={surprise}
          title="Surprise me — jump to a random year"
          style={{
            display: "block",
            fontSize: 11,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            font: "inherit",
            fontWeight: 400,
          }}
        >
          Strata — History Simulation
        </button>
        <div style={{ fontSize: 14 }}>
          Drag the slider, hop eras, toggle layers, press <kbd style={kbdStyle}>?</kbd> for help
          {" · "}
          <button
            onClick={() => setStoryPickerOpen(true)}
            style={{
              fontSize: 12,
              padding: "1px 8px",
              marginLeft: 2,
              background: "rgba(245, 185, 66, 0.12)",
              borderColor: "var(--accent)",
              color: "var(--accent-strong)",
              fontWeight: 600,
            }}
            title="Browse curated tours (T)"
          >
            ▶ Stories
          </button>
          {!nowPanelOpen && (
            <>
              {" · "}
              <button
                onClick={() => setNowPanelOpen(true)}
                style={{
                  fontSize: 12,
                  padding: "1px 6px",
                  marginLeft: 2,
                }}
              >
                Show what's active
              </button>
            </>
          )}
        </div>
        {/* Climate badge — shows the global temperature anomaly + epoch
            for the current year. Always opaque, always contextual. */}
        <div
          title="Global temperature anomaly relative to ~1850 baseline"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 6,
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <span
            style={{
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              opacity: 0.7,
            }}
          >
            Climate
          </span>
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 9,
              height: 9,
              borderRadius: 5,
              background: climate.color,
              boxShadow: `0 0 6px ${climate.color}`,
            }}
          />
          <span
            style={{
              fontWeight: 600,
              color: "var(--text)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {climate.label}
          </span>
          {climate.epoch && <span style={{ opacity: 0.7 }}>· {climate.epoch}</span>}
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 12,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid var(--panel-border)",
  borderRadius: 3,
  padding: "0 4px",
};
