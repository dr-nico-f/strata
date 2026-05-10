import { useEffect } from "react";
import { useStore, type LayerId } from "../store";

const LAYER_LABEL: Record<LayerId, string> = {
  boundaries: "Country",
  peoples: "People",
  cities: "City",
  events: "Event",
  connections: "Route",
  battles: "Battle",
  population: "Population",
  sealevel: "Sea level",
  religions: "Religion",
  languages: "Language",
  disasters: "Disaster",
  people: "Notable person",
  migrations: "Migration",
};

const LAYER_COLOR: Record<LayerId, string> = {
  boundaries: "#7aa2ff",
  peoples: "#a18bff",
  cities: "#5fd1a0",
  events: "#ffd86b",
  connections: "#c39bff",
  battles: "#ff7a90",
  population: "#9ad0ff",
  sealevel: "#7ce0e6",
  religions: "#f29bff",
  languages: "#ffae42",
  disasters: "#ff9a3c",
  people: "#ff9bd1",
  migrations: "#5fd1a0",
};

/**
 * Floating chooser shown when a single click hits features in 2+ layers.
 * Lets the user pick which one to pin without forcing the click handlers
 * to silently defer to a hard-coded priority.
 */
export function LayerChoicePopup() {
  const choice = useStore((s) => s.pendingChoice);
  const setChoice = useStore((s) => s.setPendingChoice);
  const setLocked = useStore((s) => s.setLocked);

  // Close on click anywhere outside the popup or on Escape.
  useEffect(() => {
    if (!choice) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-layer-choice]")) return;
      setChoice(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [choice, setChoice]);

  if (!choice) return null;

  const W = 240;
  const ESTIMATED_H = 36 + choice.options.length * 38;
  let left = choice.x + 14;
  let top = choice.y + 14;
  if (left + W > window.innerWidth - 8) left = choice.x - W - 14;
  if (top + ESTIMATED_H > window.innerHeight - 100) {
    top = choice.y - ESTIMATED_H - 14;
  }
  if (left < 8) left = 8;
  if (top < 8) top = 8;

  return (
    <div
      data-layer-choice
      style={{
        position: "fixed",
        left,
        top,
        width: W,
        background: "rgba(20, 22, 30, 0.97)",
        border: "1px solid var(--accent)",
        borderRadius: 10,
        padding: "8px 4px",
        zIndex: 14,
        boxShadow: "0 14px 40px rgba(0,0,0,0.5)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "var(--text-muted)",
          padding: "2px 10px 6px",
        }}
      >
        Multiple features here · pick one
      </div>
      {choice.options.map((opt, i) => (
        <button
          key={`${opt.layer}:${opt.id ?? opt.name}:${i}`}
          onClick={() => {
            setLocked({
              layer: opt.layer,
              id: opt.id,
              name: opt.name,
              detail: opt.detail,
              wikipedia: opt.wikipedia,
              lng: opt.lng,
              lat: opt.lat,
              x: choice.x,
              y: choice.y,
              rangeStart: opt.rangeStart,
              rangeEnd: opt.rangeEnd,
              pointYear: opt.pointYear,
            });
            setChoice(null);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "6px 10px",
            background: "transparent",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            textAlign: "left",
            color: "var(--text)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.06)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: LAYER_COLOR[opt.layer],
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {opt.name}
            </div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              {LAYER_LABEL[opt.layer]}
            </div>
          </span>
        </button>
      ))}
      <button
        onClick={() => setChoice(null)}
        style={{
          fontSize: 11,
          padding: "2px 10px",
          marginTop: 4,
          marginLeft: 6,
          color: "var(--text-muted)",
          background: "transparent",
          border: "none",
        }}
      >
        Cancel · ESC
      </button>
    </div>
  );
}
