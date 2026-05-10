import { useEffect, useRef } from "react";
import { findStory, type StoryChapter } from "../data/stories";
import { formatYear, useStore, type LayerId } from "../store";
import { pushRecentTour } from "../utils/localState";

// Register a chapter-count lookup so the store's advanceTour can clamp
// without importing the data module (which would create a cycle).
if (typeof window !== "undefined") {
  (window as unknown as {
    __hsChapterCount: (id: string) => number | undefined;
  }).__hsChapterCount = (id: string) => findStory(id)?.chapters.length;
}

/**
 * StoryPlayer is the always-mounted runtime for curated story tours. It does
 * two things:
 *   1. Side-effects: when the active tour or chapter index changes, it pushes
 *      the chapter's year/camera/layers/pin into the rest of the app.
 *   2. UI: when a tour is active, it renders a bottom-center panel with the
 *      title, narration, prev/next buttons, and an exit affordance.
 */
export function StoryPlayer() {
  const tour = useStore((s) => s.tour);
  const advanceTour = useStore((s) => s.advanceTour);
  const exitTour = useStore((s) => s.exitTour);
  const layers = useStore((s) => s.layers);
  const setLayers = useStore((s) => s.setLayers);
  const setYear = useStore((s) => s.setYear);
  const setLocked = useStore((s) => s.setLocked);
  const setPlaying = useStore((s) => s.setPlaying);
  const setHover = useStore((s) => s.setHover);
  const hideUi = useStore((s) => s.hideUi);

  // Snapshot of the layer state when the tour started, so we can restore it
  // on exit without nuking the user's preferences.
  const restoreLayersRef = useRef<Record<LayerId, boolean> | null>(null);
  const lastTourIdRef = useRef<string | null>(null);
  // Year applied by the most recent chapter. If the current year diverges, the
  // user must have scrubbed (or hit an era preset, or pressed Home/End) — exit
  // the tour so the timeline doesn't keep snapping back.
  const tourYearRef = useRef<number | null>(null);
  const year = useStore((s) => s.year);

  const story = tour ? findStory(tour.storyId) : undefined;
  const chapter: StoryChapter | undefined =
    story && tour ? story.chapters[tour.chapterIndex] : undefined;

  // Apply the active chapter's side-effects whenever it changes.
  useEffect(() => {
    if (!tour || !story || !chapter) return;
    setPlaying(false);
    setHover(null);

    // Cache the layer state once per tour so exitTour can restore it; also
    // bump the tour id to the top of the most-recently-used list.
    if (lastTourIdRef.current !== tour.storyId) {
      restoreLayersRef.current = { ...layers };
      lastTourIdRef.current = tour.storyId;
      pushRecentTour(tour.storyId);
    }

    // Layer delta. Only flip ids that need to change, so we don't trigger a
    // big re-render of unrelated layers when chapters share state.
    if (chapter.enableLayers || chapter.disableLayers) {
      const next = { ...layers };
      let changed = false;
      for (const id of chapter.enableLayers ?? []) {
        if (!next[id]) {
          next[id] = true;
          changed = true;
        }
      }
      for (const id of chapter.disableLayers ?? []) {
        if (next[id]) {
          next[id] = false;
          changed = true;
        }
      }
      if (changed) setLayers(next);
    }

    tourYearRef.current = chapter.year;
    setYear(chapter.year);

    // Animate the camera. The MapView listens for `hs:flyto` events and calls
    // map.flyTo with these args; that keeps the imperative MapLibre code in
    // one place.
    window.dispatchEvent(
      new CustomEvent("hs:flyto", {
        detail: { center: chapter.center, zoom: chapter.zoom, duration: 1100 },
      }),
    );

    // Pin a synthetic tooltip at the chapter pin location. The leader line
    // re-projection in MapView will keep it attached after the camera move.
    const pinAt = chapter.pinAt ?? chapter.center;
    setLocked({
      layer: chapter.pinLayer ?? "events",
      name: chapter.title,
      detail:
        chapter.narration.length > 180
          ? chapter.narration.slice(0, 180).replace(/\s+\S*$/, "") + "…"
          : chapter.narration,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2 - 40,
      lng: pinAt[0],
      lat: pinAt[1],
      wikipedia: chapter.wikipedia,
      pointYear: chapter.year,
    });
    // Layers/setHover are stable from zustand; re-running on every layers
    // change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour?.storyId, tour?.chapterIndex]);

  // Restore the user's layer preferences when the tour is exited.
  useEffect(() => {
    if (tour) return;
    const restore = restoreLayersRef.current;
    restoreLayersRef.current = null;
    lastTourIdRef.current = null;
    tourYearRef.current = null;
    if (restore) {
      setLayers(restore);
      setLocked(null);
    }
    // setLayers / setLocked are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  // Detect manual year changes during a tour and exit gracefully so the
  // chapter doesn't keep yanking the slider back.
  useEffect(() => {
    if (!tour) return;
    if (tourYearRef.current === null) return;
    if (year !== tourYearRef.current) exitTour();
    // intentionally only re-runs on year/tour
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, tour]);

  if (!tour || !story || !chapter || hideUi) return null;
  const total = story.chapters.length;
  const idx = tour.chapterIndex;
  const atFirst = idx <= 0;
  const atLast = idx >= total - 1;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 144,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(620px, 92vw)",
        background: "rgba(20, 22, 30, 0.96)",
        border: "1px solid var(--accent)",
        borderRadius: 12,
        padding: "14px 18px 12px",
        boxShadow: "0 14px 40px rgba(0, 0, 0, 0.5)",
        zIndex: 30,
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: "var(--accent-strong)",
          }}
        >
          {story.title}{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            · chapter {idx + 1} of {total} · {formatYear(chapter.year)}
          </span>
        </div>
        <button
          onClick={exitTour}
          title="Exit tour (ESC)"
          style={{ fontSize: 11, padding: "2px 8px" }}
        >
          Exit ✕
        </button>
      </div>

      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: 4,
        }}
      >
        {chapter.title}
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.45,
          color: "var(--text)",
          opacity: 0.92,
          marginBottom: 10,
        }}
      >
        {chapter.narration}
      </div>

      <div
        style={{
          height: 3,
          background: "rgba(255,255,255,0.07)",
          borderRadius: 2,
          marginBottom: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${((idx + 1) / total) * 100}%`,
            background: "var(--accent)",
            transition: "width 0.4s ease-out",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <button
          onClick={() => advanceTour(-1)}
          disabled={atFirst}
          style={{ minWidth: 80, opacity: atFirst ? 0.4 : 1 }}
          title="Previous chapter (←)"
        >
          ← Prev
        </button>
        <div
          style={{
            display: "flex",
            gap: 4,
            flex: 1,
            justifyContent: "center",
          }}
        >
          {story.chapters.map((_, i) => (
            <span
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background:
                  i === idx
                    ? "var(--accent)"
                    : i < idx
                      ? "rgba(245, 185, 66, 0.45)"
                      : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>
        {atLast ? (
          <button
            onClick={exitTour}
            style={{
              minWidth: 80,
              background: "rgba(245, 185, 66, 0.18)",
              borderColor: "var(--accent)",
              color: "var(--accent-strong)",
              fontWeight: 600,
            }}
            title="End tour"
          >
            Finish
          </button>
        ) : (
          <button
            onClick={() => advanceTour(1)}
            style={{ minWidth: 80 }}
            title="Next chapter (→)"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
