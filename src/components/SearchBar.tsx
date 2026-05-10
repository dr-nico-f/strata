import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatYear, useStore } from "../store";
import { searchAll, SearchHit } from "../utils/searchIndex";
import { useFocusTrap } from "../utils/useFocusTrap";

const LAYER_COLOR: Record<string, string> = {
  era: "#8a8aa6",
  cities: "#5fd1a0",
  events: "#7aa2ff",
  battles: "#ff6a6a",
  peoples: "#ffae42",
  connections: "#c39bff",
  sealevel: "#3da9c7",
  religions: "#7aa2ff",
  languages: "#f5b942",
  disasters: "#ff6a00",
  people: "#ffd86b",
  population: "#5fd1a0",
  boundaries: "#c39bff",
};

export function SearchBar() {
  const open = useStore((s) => s.searchOpen);
  const setOpen = useStore((s) => s.setSearchOpen);
  const setYear = useStore((s) => s.setYear);
  const setLocked = useStore((s) => s.setLocked);
  const setLayers = useStore((s) => s.setLayers);
  const layers = useStore((s) => s.layers);
  const hideUi = useStore((s) => s.hideUi);

  const [q, setQ] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeSearch = useCallback(() => {
    setOpen(false);
    setQ("");
  }, [setOpen]);
  useFocusTrap(panelRef, open, closeSearch);

  const hits = useMemo(() => searchAll(q, 12), [q]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [q]);

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (ev.key === "/" || (ev.key === "k" && (ev.metaKey || ev.ctrlKey))) {
        ev.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  if (hideUi) return null;

  function pick(hit: SearchHit) {
    if (hit.layer !== "era" && hit.layer in layers && !layers[hit.layer]) {
      setLayers({ ...layers, [hit.layer]: true });
    }
    setYear(hit.year);
    if (hit.lng !== undefined && hit.lat !== undefined) {
      window.dispatchEvent(
        new CustomEvent("hs:flyto", {
          detail: { center: [hit.lng, hit.lat], zoom: 4 },
        }),
      );
    }
    if (hit.layer !== "era") {
      // Pin a tooltip in the center of the screen so the user gets a label
      setLocked({
        layer: hit.layer,
        id: hit.id,
        name: hit.name,
        detail: hit.detail,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        rangeStart: hit.rangeStart,
        rangeEnd: hit.rangeEnd,
        pointYear: hit.pointYear,
        wikipedia: hit.wikipedia,
        lng: hit.lng,
        lat: hit.lat,
      });
    }
    setOpen(false);
    setQ("");
  }

  function onKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setActiveIdx((i) => Math.min(hits.length - 1, i + 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      const hit = hits[activeIdx];
      if (hit) pick(hit);
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      setOpen(false);
      setQ("");
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 12, 22, 0.55)",
        zIndex: 200,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 92vw)",
          background: "var(--panel-bg, rgba(20, 22, 30, 0.95))",
          border: "1px solid var(--panel-border, rgba(255, 255, 255, 0.1))",
          borderRadius: 12,
          boxShadow: "0 18px 60px rgba(0, 0, 0, 0.55)",
          color: "var(--panel-fg, #e8e8ee)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderBottom: "1px solid var(--panel-border, rgba(255, 255, 255, 0.08))",
          }}
        >
          <span style={{ fontSize: 18, opacity: 0.6 }}>⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder='Search any layer (e.g. "Hannibal", "Rome", "Black Death")'
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "inherit",
              fontSize: 15,
            }}
          />
          <kbd style={kbdStyle}>Esc</kbd>
        </div>
        <div style={{ maxHeight: 360, overflow: "auto" }}>
          {hits.length === 0 && q.trim().length >= 2 && (
            <div style={{ padding: 18, opacity: 0.6, fontSize: 13 }}>No matches.</div>
          )}
          {hits.length === 0 && q.trim().length < 2 && (
            <div style={{ padding: 18, opacity: 0.6, fontSize: 13 }}>
              Type 2+ characters. Tries names first, then descriptions.
            </div>
          )}
          {hits.map((hit, i) => (
            <button
              key={hit.id}
              onClick={() => pick(hit)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 16px",
                background:
                  i === activeIdx ? "var(--panel-hover, rgba(255, 255, 255, 0.06))" : "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: LAYER_COLOR[hit.layer] ?? "#888",
                    flexShrink: 0,
                  }}
                />
                <strong style={{ flex: 1 }}>{hit.name}</strong>
                <span style={{ opacity: 0.55, fontSize: 11 }}>
                  {hit.layer} · {formatYear(hit.year)}
                </span>
              </div>
              {hit.detail && (
                <div
                  style={{
                    marginTop: 3,
                    marginLeft: 16,
                    opacity: 0.7,
                    fontSize: 12,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                  }}
                >
                  {hit.detail}
                </div>
              )}
            </button>
          ))}
        </div>
        <div
          style={{
            padding: "8px 14px",
            borderTop: "1px solid var(--panel-border, rgba(255, 255, 255, 0.08))",
            fontSize: 11,
            opacity: 0.65,
            display: "flex",
            gap: 14,
            justifyContent: "space-between",
          }}
        >
          <span>
            <kbd style={kbdStyle}>↑↓</kbd> navigate · <kbd style={kbdStyle}>Enter</kbd> jump
          </span>
          <span>
            <kbd style={kbdStyle}>/</kbd> or <kbd style={kbdStyle}>⌘K</kbd> to open
          </span>
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  fontSize: 10,
  padding: "1px 5px",
  borderRadius: 4,
  border: "1px solid rgba(255, 255, 255, 0.18)",
  background: "rgba(255, 255, 255, 0.06)",
};
