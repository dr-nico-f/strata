import { useMemo, useRef } from "react";
import { STORIES, STORIES_BY_ERA, findStory, type Story } from "../data/stories";
import { useStore } from "../store";
import { useFocusTrap } from "../utils/useFocusTrap";
import { readRecentTours } from "../utils/localState";

export function StoryPicker() {
  const open = useStore((s) => s.storyPickerOpen);
  const setOpen = useStore((s) => s.setStoryPickerOpen);
  const startTour = useStore((s) => s.startTour);
  // Recompute on each open so it reflects what was just played. Cheap.
  const recents: Story[] = useMemo(() => {
    if (!open) return [];
    return readRecentTours()
      .map(findStory)
      .filter((s): s is Story => !!s);
  }, [open]);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open, () => setOpen(false));
  if (!open) return null;
  const eras = Object.keys(STORIES_BY_ERA) as Story["era"][];
  const totalChapters = STORIES.reduce((n, s) => n + s.chapters.length, 0);
  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 280,
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
        aria-label="Story tours"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 92vw)",
          maxHeight: "84vh",
          overflow: "auto",
          background: "var(--panel)",
          border: "1px solid var(--panel-border)",
          borderRadius: 12,
          padding: 22,
          boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Story tours</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {STORIES.length} curated tours · {totalChapters} chapters. Use{" "}
              <kbd
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  padding: "0 4px",
                  border: "1px solid var(--panel-border)",
                  borderRadius: 3,
                }}
              >
                ←
              </kbd>{" "}
              <kbd
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  padding: "0 4px",
                  border: "1px solid var(--panel-border)",
                  borderRadius: 3,
                }}
              >
                →
              </kbd>{" "}
              once a tour is running.
            </div>
          </div>
          <button onClick={() => setOpen(false)} title="Close (ESC)">
            ✕
          </button>
        </div>

        {recents.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "var(--accent-strong)",
                marginBottom: 8,
              }}
            >
              Recently played
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 8,
              }}
            >
              {recents.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  onSelect={() => startTour(story.id, 0)}
                  highlight
                />
              ))}
            </div>
          </div>
        )}

        {eras.map((era) => {
          const list = STORIES_BY_ERA[era];
          if (!list?.length) return null;
          return (
            <div key={era} style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 8,
                }}
              >
                {era}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 8,
                }}
              >
                {list.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    onSelect={() => startTour(story.id, 0)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StoryCard({
  story,
  onSelect,
  highlight = false,
}: {
  story: Story;
  onSelect: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: 8,
        border: highlight
          ? "1px solid var(--accent)"
          : "1px solid var(--panel-border)",
        background: highlight
          ? "rgba(245, 185, 66, 0.08)"
          : "rgba(255,255,255,0.03)",
        cursor: "pointer",
        lineHeight: 1.35,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: 2,
        }}
      >
        {story.title}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {story.summary}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--accent-strong)",
          marginTop: 4,
          opacity: 0.85,
        }}
      >
        {story.chapters.length} chapter
        {story.chapters.length === 1 ? "" : "s"}
      </div>
    </button>
  );
}
