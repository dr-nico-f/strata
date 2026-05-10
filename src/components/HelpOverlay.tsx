import { useRef } from "react";
import { useStore } from "../store";
import { useFocusTrap } from "../utils/useFocusTrap";

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: "T", description: "Browse story tours" },
  { keys: "← / →", description: "Step year by 1 (advance chapter when in a tour)" },
  { keys: "shift + ← / →", description: "Step year by 100" },
  { keys: "alt + ← / →", description: "Step year by 10" },
  { keys: "space", description: "Play / pause" },
  { keys: "Home / End", description: "Jump to earliest year / present (Now)" },
  { keys: "G", description: "Toggle 3D globe" },
  { keys: "R", description: "Surprise me (random year)" },
  { keys: "shift + N", description: "Snap to nearest boundary snapshot" },
  { keys: "/ or ⌘K", description: "Open the search bar" },
  { keys: "[ / ]", description: "Cycle through active features" },
  { keys: "H", description: "Hide all UI (print / screenshot mode)" },
  { keys: "S", description: "Copy a shareable link" },
  { keys: "?", description: "Show this help" },
  { keys: "ESC", description: "Close panel / unpin tooltip / clear focus" },
  { keys: "Layers", description: "B P C E N X D F I L M O Y" },
];

const FEATURES: Array<{ name: string; description: string }> = [
  {
    name: "Story tours",
    description:
      "Press T or click ▶ Stories — 35 curated tours through ~50 moments of world history, with arrow-key navigation.",
  },
  {
    name: "Click any country",
    description:
      'Pin a country tooltip and dim the rest of the world. Press "Show country details" to open the side panel of cities, events, battles, people, and disasters.',
  },
  {
    name: "Multi-layer chooser",
    description:
      "Click somewhere two or more layers overlap (e.g. a city inside a country with a language overlay) — a small popup lets you pick which one to pin.",
  },
  {
    name: "City population sparkline",
    description:
      "Pin a city — the tooltip shows its full population trajectory with the current year highlighted.",
  },
  {
    name: "Animated routes",
    description:
      "Trade routes, migration corridors, and migration flows march in the direction of travel.",
  },
  {
    name: "Watch the cities",
    description:
      "Scrub the year slider — newly founded cities flash gold, abandoned ones flash red.",
  },
];

const URL_PARAMS: Array<{ name: string; description: string }> = [
  { name: "y", description: "Year (e.g. ?y=1492)" },
  { name: "l", description: "Layers as letters (?l=BPC = boundaries+peoples+cities)" },
  { name: "p", description: "Projection: 'flat' or 'globe'" },
  { name: "t", description: "Theme: 'dark', 'light', or 'sepia'" },
  { name: "focus", description: "Pinned feature (e.g. ?focus=cities:rome)" },
];

export function HelpOverlay() {
  const open = useStore((s) => s.helpOpen);
  const setOpen = useStore((s) => s.setHelpOpen);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open, () => setOpen(false));
  if (!open) return null;
  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Help"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 92vw)",
          maxHeight: "84vh",
          overflow: "auto",
          background: "var(--panel)",
          border: "1px solid var(--panel-border)",
          borderRadius: 12,
          padding: 22,
          boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
          position: "relative",
        }}
      >
        <Aurora />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600 }}>Strata · help</div>
          <button onClick={() => setOpen(false)} title="Close (ESC)">
            ✕
          </button>
        </div>

        <div
          style={{
            fontSize: 11,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 6,
          }}
        >
          Keyboard shortcuts
        </div>
        <table style={{ width: "100%", fontSize: 13, marginBottom: 18 }}>
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys}>
                <td
                  style={{
                    fontFamily: "monospace",
                    color: "var(--accent-strong)",
                    paddingRight: 14,
                    paddingBottom: 4,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.keys}
                </td>
                <td style={{ color: "var(--text)" }}>{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            fontSize: 11,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 6,
          }}
        >
          Try this
        </div>
        <table style={{ width: "100%", fontSize: 13, marginBottom: 18 }}>
          <tbody>
            {FEATURES.map((f) => (
              <tr key={f.name}>
                <td
                  style={{
                    color: "var(--accent-strong)",
                    paddingRight: 14,
                    paddingBottom: 6,
                    whiteSpace: "nowrap",
                    verticalAlign: "top",
                    fontWeight: 600,
                  }}
                >
                  {f.name}
                </td>
                <td
                  style={{
                    color: "var(--text)",
                    paddingBottom: 6,
                    lineHeight: 1.4,
                  }}
                >
                  {f.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            fontSize: 11,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 6,
          }}
        >
          URL parameters
        </div>
        <table style={{ width: "100%", fontSize: 13, marginBottom: 18 }}>
          <tbody>
            {URL_PARAMS.map((p) => (
              <tr key={p.name}>
                <td
                  style={{
                    fontFamily: "monospace",
                    color: "var(--accent-strong)",
                    paddingRight: 14,
                    paddingBottom: 4,
                  }}
                >
                  {p.name}
                </td>
                <td style={{ color: "var(--text)" }}>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            fontSize: 11,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 6,
          }}
        >
          Data sources
        </div>
        <ul
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.6,
            paddingLeft: 18,
            marginTop: 0,
          }}
        >
          <li>
            <strong>Boundaries</strong> -{" "}
            <a
              href="https://github.com/aourednik/historical-basemaps"
              target="_blank"
              rel="noreferrer"
            >
              historical-basemaps
            </a>{" "}
            (CC BY 4.0)
          </li>
          <li>
            <strong>Cities</strong> - 251 hand-curated historical cities merged with the top 800
            modern cities by population from{" "}
            <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
              GeoNames cities15000
            </a>{" "}
            (CC BY 4.0)
          </li>
          <li>
            <strong>Religions, year ≥ 1945</strong> - country-fill keyed to{" "}
            <a
              href="https://www.pewresearch.org/religion/feature/global-religious-landscape/"
              target="_blank"
              rel="noreferrer"
            >
              Pew Research majority religion per country
            </a>
          </li>
          <li>
            <strong>Religions, pre-1945</strong> - schematic spread polygons anchored to Wikidata
            Q-IDs and standard atlases (Hartz, Kinder & Hilgemann)
          </li>
          <li>
            <strong>Population</strong> - per-country curves from{" "}
            <a
              href="https://ourworldindata.org/grapher/population"
              target="_blank"
              rel="noreferrer"
            >
              Our World in Data
            </a>{" "}
            (HYDE 3.3 + Gapminder + UN WPP, CC BY 4.0), 237 countries from 10,000 BCE to 2023;
            centroids + areas via{" "}
            <a href="https://restcountries.com/" target="_blank" rel="noreferrer">
              restcountries.com
            </a>
          </li>
          <li>
            <strong>Climate</strong> - HadCRUT5 / Marcott / PAGES 2k anchors
          </li>
          <li>
            <strong>Battles</strong> - 41 hand-curated entries plus ~920 battles from{" "}
            <a href="https://www.wikidata.org/" target="_blank" rel="noreferrer">
              Wikidata
            </a>{" "}
            (CC0), filtered by Wikipedia sitelink count
          </li>
          <li>
            <strong>Disasters</strong> - 15 hand-curated entries plus ~500 major earthquakes from
            the{" "}
            <a href="https://earthquake.usgs.gov/fdsnws/event/1/" target="_blank" rel="noreferrer">
              USGS earthquake catalog
            </a>{" "}
            (M ≥ 7.5, public domain) and ~470 historical eruptions, tsunamis, epidemics, famines,
            and cyclones from Wikidata
          </li>
          <li>
            <strong>Migrations</strong> - 18 hand-curated mass population movements (Bantu
            expansion, Indo-European, Polynesian voyaging, Atlantic slave trade, etc.)
          </li>
          <li>
            <strong>Languages, peoples, events, notable people</strong> - hand-curated from
            Wikipedia and standard reference works
          </li>
          <li>
            <strong>Live Wikipedia summaries</strong> - pinned tooltips fetch from{" "}
            <a href="https://www.mediawiki.org/wiki/API:REST_API" target="_blank" rel="noreferrer">
              Wikipedia's REST summary API
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * A whisper-soft aurora + constellation behind the help panel header. Pure
 * cosmetics: a slowly-shifting radial gradient and a handful of twinkling
 * dots. CSS-only animation keeps it cheap and respects prefers-reduced-motion
 * via the `@media (prefers-reduced-motion)` rule in index.css if added.
 */
function Aurora() {
  // Deterministic star positions so the layout stays calm rather than
  // shimmering chaotically each render.
  const stars = [
    { x: 8, y: 14, r: 1.0, d: 0 },
    { x: 22, y: 8, r: 0.7, d: 1.4 },
    { x: 41, y: 18, r: 1.4, d: 0.7 },
    { x: 58, y: 6, r: 0.6, d: 2.0 },
    { x: 71, y: 14, r: 1.0, d: 1.1 },
    { x: 84, y: 22, r: 0.8, d: 0.4 },
    { x: 92, y: 8, r: 0.6, d: 1.7 },
    { x: 14, y: 32, r: 0.6, d: 2.3 },
    { x: 49, y: 38, r: 0.8, d: 0.9 },
    { x: 78, y: 36, r: 0.6, d: 1.9 },
  ];
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 130,
        pointerEvents: "none",
        overflow: "hidden",
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        opacity: 0.85,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -40,
          background:
            "radial-gradient(60% 80% at 30% 30%, rgba(95, 209, 200, 0.18), transparent 70%), radial-gradient(50% 70% at 75% 40%, rgba(195, 155, 255, 0.14), transparent 75%), radial-gradient(40% 60% at 50% 70%, rgba(245, 185, 66, 0.10), transparent 70%)",
          filter: "blur(4px)",
          animation: "hsAuroraShift 22s ease-in-out infinite alternate",
        }}
      />
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
      >
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="rgba(255, 255, 255, 0.85)"
            style={{
              animation: `hsTwinkle 4.5s ease-in-out ${s.d}s infinite alternate`,
            }}
          />
        ))}
        {/* Faint "constellation" lines to suggest a pattern. */}
        <polyline
          points="8,14 22,8 41,18 58,6 71,14 84,22"
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={0.25}
        />
      </svg>
    </div>
  );
}
