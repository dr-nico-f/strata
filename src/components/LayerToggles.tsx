import { useEffect, useState } from "react";
import { THEMES, ThemeId } from "../store";
import { useStore } from "../store";
import type { LayerId } from "../store";
import { getActiveCount } from "../utils/activeCounts";
import { CONTINENT_VIEWS } from "../utils/continents";
import { ShareButton } from "./ShareButton";

const LAYER_ORDER: { id: LayerId; label: string; key: string; color: string }[] = [
  { id: "boundaries", label: "Political boundaries", key: "B", color: "#7aa2ff" },
  { id: "peoples", label: "Peoples & cultures", key: "P", color: "#f5b942" },
  { id: "connections", label: "Trade & migration", key: "N", color: "#c39bff" },
  { id: "cities", label: "Cities", key: "C", color: "#5fd1a0" },
  { id: "events", label: "Events", key: "E", color: "#ff7a90" },
  { id: "battles", label: "Battles", key: "X", color: "#ff5252" },
  { id: "disasters", label: "Disasters", key: "D", color: "#ff6a00" },
  { id: "people", label: "Notable people", key: "F", color: "#ffd86b" },
  { id: "religions", label: "Religions", key: "I", color: "#7aa2ff" },
  { id: "languages", label: "Language families", key: "L", color: "#f5b942" },
  { id: "migrations", label: "Migrations", key: "M", color: "#5fd1a0" },
  { id: "population", label: "Population dots", key: "O", color: "#ffe9a8" },
  { id: "sealevel", label: "Sea level", key: "Y", color: "#3da9c7" },
];

const THEME_LABELS: Record<ThemeId, string> = {
  dark: "Dark",
  light: "Light",
  sepia: "Sepia",
};

export function LayerToggles() {
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const projection = useStore((s) => s.projection);
  const setProjection = useStore((s) => s.setProjection);
  const year = useStore((s) => s.year);
  const brightness = useStore((s) => s.boundaryBrightness);
  const setBrightness = useStore((s) => s.setBoundaryBrightness);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const setNowPanelOpen = useStore((s) => s.setNowPanelOpen);
  const nowPanelOpen = useStore((s) => s.nowPanelOpen);
  const focusBbox = useStore((s) => s.focusBbox);
  const setFocusBbox = useStore((s) => s.setFocusBbox);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const setHelpOpen = useStore((s) => s.setHelpOpen);
  const hideUi = useStore((s) => s.hideUi);
  // Subscribe so this component re-renders when generated data finishes loading.
  void useStore((s) => s.dataVersion);

  // Collapsed by default so the panel stays compact on small screens. The
  // bottom sections (View / Recenter / Theme / Export / footnote) are
  // hidden behind a "More" toggle. Persisted in localStorage so the user's
  // choice survives reloads.
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem("hs:layerPanelExpanded") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("hs:layerPanelExpanded", expanded ? "1" : "0");
    } catch {
      /* storage may be unavailable in private mode; ignore */
    }
  }, [expanded]);

  if (hideUi) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        background: "var(--panel)",
        border: "1px solid var(--panel-border)",
        borderRadius: 10,
        padding: "12px 14px",
        zIndex: 5,
        width: 250,
        backdropFilter: "blur(6px)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
        maxHeight: "calc(100vh - 180px)",
        overflowY: "auto",
      }}
    >
      {/* Search + help row. The help "?" sits as a sibling to the search
          bar so the two meta-controls share the panel's top edge without
          overlapping. Conventional top-right placement for an info
          affordance, grouped with the other panel-wide controls. */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 6,
          marginBottom: 10,
        }}
      >
        <button
          onClick={() => setSearchOpen(true)}
          title="Search any layer (/ or ⌘K)"
          style={{
            flex: 1,
            padding: "8px 10px",
            textAlign: "left",
            background: "var(--panel-hover, rgba(255, 255, 255, 0.06))",
            border: "1px solid var(--panel-border)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 14 }}>⌕</span>
          <span style={{ flex: 1 }}>Search…</span>
          <span style={{ fontFamily: "monospace", fontSize: 10, opacity: 0.7 }}>/</span>
        </button>
        <button
          onClick={() => setHelpOpen(true)}
          title="Help (?)"
          aria-label="Open help"
          style={{
            width: 32,
            padding: 0,
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1,
            color: "var(--text-muted)",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--panel-border)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          ?
        </button>
      </div>

      <SectionHeader>Layers</SectionHeader>
      {LAYER_ORDER.map(({ id, label, key, color }) => {
        const count = getActiveCount(id, year);
        return (
          <label
            key={id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "3px 0",
              cursor: "pointer",
              opacity: layers[id] ? 1 : 0.55,
            }}
            title={`Toggle (${key})`}
          >
            <input type="checkbox" checked={layers[id]} onChange={() => toggleLayer(id)} />
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: color,
              }}
            />
            <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontVariantNumeric: "tabular-nums",
                minWidth: 22,
                textAlign: "right",
              }}
              title={`${count >= 0 ? count : ""} active`}
            >
              {count >= 0 ? count : "—"}
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                fontFamily: "monospace",
                marginLeft: 2,
                width: 12,
                textAlign: "right",
              }}
            >
              {key}
            </span>
          </label>
        );
      })}

      <button
        onClick={() => setNowPanelOpen(!nowPanelOpen)}
        style={{ width: "100%", marginTop: 8, fontSize: 12 }}
        title="Toggle 'Now' panel"
      >
        {nowPanelOpen ? "Hide" : "Show"} now panel
      </button>

      {/* Truncate the panel here on small screens — everything below is
          tucked behind this toggle so the panel doesn't run past the
          time-slider footer. Choice is persisted in localStorage. */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          marginTop: 6,
          fontSize: 11,
          color: "var(--text-muted)",
          background: "transparent",
          border: "1px dashed var(--panel-border)",
        }}
        title={expanded ? "Hide additional controls" : "Show view, theme, focus, export…"}
        aria-expanded={expanded}
      >
        {expanded ? "Less ▴" : "More ▾"}
      </button>

      {expanded && (
        <>
          <Divider />
          <SectionHeader>View</SectionHeader>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button
              onClick={() => setProjection("flat")}
              style={projection === "flat" ? activeBtn : passiveBtn}
              title="Flat (Mercator)"
            >
              Flat
            </button>
            <button
              onClick={() => setProjection("globe")}
              style={projection === "globe" ? activeBtn : passiveBtn}
              title="3D Globe (G)"
            >
              Globe
            </button>
          </div>

          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
            Boundary brightness
          </div>
          <input
            type="range"
            min={0.4}
            max={1.6}
            step={0.05}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
          />

          <Divider />
          <SectionHeader>Recenter & focus</SectionHeader>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
            }}
          >
            {CONTINENT_VIEWS.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("hs:flyto", { detail: c }));
                  setFocusBbox(c.bbox ?? null);
                }}
                style={{ fontSize: 12, padding: "4px 6px" }}
              >
                {c.label}
              </button>
            ))}
          </div>
          {focusBbox && (
            <button
              onClick={() => setFocusBbox(null)}
              style={{
                fontSize: 11,
                padding: "4px 6px",
                marginTop: 6,
                width: "100%",
                background: "var(--accent)",
                color: "var(--bg)",
                border: "none",
                borderRadius: 4,
                fontWeight: 600,
              }}
              title="Clear region focus (also: Esc twice)"
            >
              Clear focus
            </button>
          )}

          <Divider />
          <SectionHeader>Theme</SectionHeader>
          <div style={{ display: "flex", gap: 6 }}>
            {THEMES.map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                style={t === theme ? activeBtn : passiveBtn}
              >
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>

          <Divider />
          <SectionHeader>Export</SectionHeader>
          <div style={{ display: "flex", gap: 6 }}>
            <SavePngButton />
            <ShareButton />
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 10,
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}
          >
            ←/→ step year • shift ×100 • space play • ? help
          </div>
        </>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: "var(--text-muted)",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: "var(--panel-border)",
        margin: "12px 0 10px",
      }}
    />
  );
}

const activeBtn: React.CSSProperties = {
  flex: 1,
  fontSize: 12,
  borderColor: "var(--accent)",
  background: "rgba(245, 185, 66, 0.15)",
  color: "var(--accent-strong)",
};

const passiveBtn: React.CSSProperties = {
  flex: 1,
  fontSize: 12,
  borderColor: "var(--panel-border)",
  background: "rgba(255,255,255,0.04)",
  color: "var(--text)",
};

function SavePngButton() {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (busy) {
      const t = setTimeout(() => setBusy(false), 1500);
      return () => clearTimeout(t);
    }
  }, [busy]);

  return (
    <button
      onClick={() => {
        setBusy(true);
        window.dispatchEvent(new CustomEvent("hs:savepng"));
      }}
      style={{ width: "100%", fontSize: 12 }}
      title="Save current view as PNG"
    >
      {busy ? "Saving…" : "Save view as PNG"}
    </button>
  );
}
