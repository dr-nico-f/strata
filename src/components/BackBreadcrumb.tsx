import { useEffect, useRef, useState } from "react";
import { formatYear, useStore } from "../store";

/**
 * Recent-year breadcrumb. Collapsed to a small "↶ recent N" button by
 * default; on click it pops out to show up to 5 previously visited years.
 * Clicking a year snaps the timeline back to it (and closes the popover).
 *
 * Designed to be embedded inline in another container (currently the
 * TimeSlider's top row). Renders nothing until at least one year has been
 * visited, so it doesn't reserve space when there's no history.
 */
export function BackBreadcrumb() {
  const recent = useStore((s) => s.recentYears);
  const setYear = useStore((s) => s.setYear);
  const hideUi = useStore((s) => s.hideUi);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close the popover on any outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (hideUi) return null;
  if (!recent.length) return null;
  const display = recent.slice(0, 5);

  return (
    <div ref={wrapperRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={
          open
            ? "Hide recent years"
            : `${display.length} recent year${display.length === 1 ? "" : "s"}`
        }
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 12px",
          background: open
            ? "var(--panel-hover, rgba(255, 255, 255, 0.08))"
            : "var(--panel-bg, rgba(20, 22, 30, 0.85))",
          border: "1px solid var(--panel-border, rgba(255, 255, 255, 0.08))",
          borderRadius: 999,
          fontSize: 11,
          color: "var(--panel-fg, #e8e8ee)",
          cursor: "pointer",
        }}
      >
        <span style={{ opacity: 0.7 }}>↶</span>
        <span>recent</span>
        <span
          style={{
            opacity: 0.7,
            background: "rgba(255, 255, 255, 0.08)",
            padding: "1px 6px",
            borderRadius: 999,
            fontSize: 10,
          }}
        >
          {display.length}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            // Pop UPWARD out of the slider panel so the era-preset row
            // doesn't get pushed around when this opens. zIndex is bumped
            // so the popover floats above sibling slider rows.
            bottom: "calc(100% + 6px)",
            left: 0,
            display: "flex",
            gap: 6,
            alignItems: "center",
            padding: "6px 10px",
            background: "var(--panel-bg, rgba(20, 22, 30, 0.95))",
            border: "1px solid var(--panel-border, rgba(255, 255, 255, 0.1))",
            borderRadius: 999,
            fontSize: 11,
            color: "var(--panel-fg, #e8e8ee)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
            whiteSpace: "nowrap",
            backdropFilter: "blur(6px)",
            zIndex: 100,
          }}
        >
          {display.map((y) => (
            <button
              key={y}
              onClick={() => {
                setYear(y);
                setOpen(false);
              }}
              title={`Jump back to ${formatYear(y)}`}
              style={{
                background: "var(--panel-hover, rgba(255, 255, 255, 0.06))",
                border: "1px solid var(--panel-border, rgba(255, 255, 255, 0.1))",
                borderRadius: 999,
                padding: "3px 9px",
                color: "inherit",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              {formatYear(y)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
