import type { Map as MaplibreMap } from "maplibre-gl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  HoverInfo,
  MAX_YEAR,
  MIN_YEAR,
  formatYear,
  useStore,
  wikipediaUrl,
} from "../store";
import { subscribeMapInstance } from "../utils/mapInstance";
import { useWikipediaSummary } from "../utils/useWikipediaSummary";
import { CityPopulationSparkline } from "./CityPopulationSparkline";

const OFFSET = 14;

export function Tooltip() {
  const hover = useStore((s) => s.hover);
  const locked = useStore((s) => s.locked);
  const setLocked = useStore((s) => s.setLocked);
  const year = useStore((s) => s.year);
  const focusedCountry = useStore((s) => s.focusedCountry);
  const detailPanelOpen = useStore((s) => s.detailPanelOpen);
  const setDetailPanelOpen = useStore((s) => s.setDetailPanelOpen);

  const active: HoverInfo = locked ?? hover;
  const isLocked = !!locked;

  // Live screen coords for the pinned feature, recomputed locally as the
  // camera animates. Hover tooltips keep using hover.x / hover.y because
  // those are already in screen space and only update on mousemove.
  const [pinnedScreen, setPinnedScreen] = useState<{ x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    if (!isLocked || locked?.lng === undefined || locked?.lat === undefined) {
      setPinnedScreen(null);
      return;
    }
    const lng = locked.lng;
    const lat = locked.lat;
    let cur: MaplibreMap | null = null;
    const project = () => {
      if (!cur) return;
      const p = cur.project([lng, lat]);
      setPinnedScreen({ x: p.x, y: p.y });
    };
    const detach = (m: MaplibreMap | null) => {
      if (!m) return;
      m.off("move", project);
      m.off("zoom", project);
      m.off("rotate", project);
    };
    const unsub = subscribeMapInstance((m) => {
      detach(cur);
      cur = m;
      if (!m) {
        // Map torn down (theme switch, HMR). Fall back to the cursor coords
        // the click handler captured.
        setPinnedScreen(null);
        return;
      }
      m.on("move", project);
      m.on("zoom", project);
      m.on("rotate", project);
      project();
    });
    return () => {
      detach(cur);
      unsub();
    };
  }, [isLocked, locked?.lng, locked?.lat]);

  // Only call out to Wikipedia when a tooltip is pinned. Hover tooltips stay
  // synchronous to avoid hammering the API while users sweep over the map.
  const { summary, loading: wikiLoading } = useWikipediaSummary(
    isLocked ? active?.wikipedia : undefined,
    isLocked,
  );

  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    }
  }, [active]);

  if (!active) return null;

  // For pinned tooltips, prefer the live-projected screen coords; fall back
  // to the click-captured x/y if we don't have a map yet (e.g. mid theme
  // swap) so the tooltip never flashes off-screen.
  const anchorX = isLocked && pinnedScreen ? pinnedScreen.x : active.x;
  const anchorY = isLocked && pinnedScreen ? pinnedScreen.y : active.y;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = anchorX + OFFSET;
  let top = anchorY + OFFSET;
  if (left + size.w > vw - 8) left = anchorX - size.w - OFFSET;
  if (top + size.h > vh - 96) top = anchorY - size.h - OFFSET;
  if (left < 8) left = 8;
  if (top < 8) top = 8;

  const showRange =
    active.rangeStart !== undefined && active.rangeEnd !== undefined;

  // Compute leader-line endpoint on the panel edge closest to the cursor
  const panelCenterX = left + size.w / 2;
  const panelCenterY = top + size.h / 2;
  const dx = anchorX - panelCenterX;
  const dy = anchorY - panelCenterY;
  // Pick nearest edge
  let edgeX = panelCenterX;
  let edgeY = panelCenterY;
  if (Math.abs(dx) / (size.w / 2 || 1) > Math.abs(dy) / (size.h / 2 || 1)) {
    edgeX = dx > 0 ? left + size.w : left;
    edgeY = panelCenterY + (dy * (size.w / 2)) / (Math.abs(dx) || 1);
  } else {
    edgeY = dy > 0 ? top + size.h : top;
    edgeX = panelCenterX + (dx * (size.h / 2)) / (Math.abs(dy) || 1);
  }

  return (
    <>
      <svg
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        <line
          x1={edgeX}
          y1={edgeY}
          x2={anchorX}
          y2={anchorY}
          stroke="var(--leader)"
          strokeWidth={isLocked ? 1.5 : 1}
          strokeDasharray={isLocked ? "none" : "2 4"}
        />
        <circle
          cx={anchorX}
          cy={anchorY}
          r={isLocked ? 5 : 3.5}
          fill="var(--leader)"
        />
      </svg>
      <div
        ref={ref}
        style={{
          position: "fixed",
          left,
          top,
          background: "var(--panel)",
          border: `1px solid ${isLocked ? "var(--accent)" : "var(--panel-border)"}`,
          borderRadius: 8,
          padding: "10px 12px",
          zIndex: 6,
          maxWidth: isLocked ? 380 : 320,
          backdropFilter: "blur(6px)",
          boxShadow: isLocked
            ? "0 8px 30px rgba(245, 185, 66, 0.25)"
            : "0 6px 24px rgba(0,0,0,0.35)",
          pointerEvents: isLocked ? "auto" : "none",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{active.layer}</span>
            {active.layer === "cities" && active.capital && (
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  color: "#f5b942",
                  border: "1px solid rgba(245, 185, 66, 0.45)",
                  borderRadius: 3,
                  padding: "1px 5px",
                  lineHeight: 1.2,
                }}
                title="National capital"
              >
                ★ capital
              </span>
            )}
            {active.layer === "cities" &&
              active.ruinAge !== undefined &&
              active.ruinAge > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    color: "#c89060",
                    border: "1px solid rgba(200, 144, 96, 0.45)",
                    borderRadius: 3,
                    padding: "1px 5px",
                    lineHeight: 1.2,
                  }}
                  title="Abandoned"
                >
                  ruin
                </span>
              )}
            {isLocked && (
              <span style={{ color: "var(--accent-strong)" }}>· pinned</span>
            )}
          </div>
          {isLocked && (
            <div style={{ display: "flex", gap: 4 }}>
              {active.lng !== undefined && active.lat !== undefined && (
                <button
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("hs:flyto", {
                        detail: {
                          center: [active.lng!, active.lat!] as [number, number],
                          zoom: 5.5,
                        },
                      }),
                    );
                  }}
                  style={{
                    fontSize: 11,
                    padding: "2px 6px",
                    lineHeight: 1,
                    color: "var(--accent-strong)",
                  }}
                  title="Center map on this feature"
                  aria-label="Center map on this feature"
                >
                  ⊕
                </button>
              )}
              <button
                onClick={() => setLocked(null)}
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  lineHeight: 1,
                  color: "var(--text-muted)",
                }}
                title="Unpin (ESC)"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{active.name}</div>
        {active.layer === "cities" && (
          <CityMeta
            pop={active.pop}
            cc={active.cc}
            ruinAge={active.ruinAge}
            year={year}
          />
        )}
        {active.detail && (
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginTop: 4,
            }}
          >
            {active.detail}
          </div>
        )}
        {showRange && (
          <MiniTimeline
            start={active.rangeStart!}
            end={active.rangeEnd!}
            year={year}
          />
        )}
        {active.pointYear !== undefined && (
          <PointMarker year={active.pointYear} current={year} />
        )}
        {isLocked && active.layer === "cities" && (
          <CityPopulationSparkline cityId={active.id} year={year} />
        )}
        {isLocked && summary && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 10px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.04)",
              borderLeft: "2px solid var(--accent)",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            {summary.thumbnail && (
              <img
                src={summary.thumbnail.source}
                alt=""
                style={{
                  width: 56,
                  height: 56,
                  objectFit: "cover",
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ fontSize: 12, lineHeight: 1.45, color: "var(--text)" }}>
              {summary.description && (
                <div
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: "var(--text-muted)",
                    marginBottom: 2,
                  }}
                >
                  {summary.description}
                </div>
              )}
              <div>
                {summary.extract.length > 280
                  ? summary.extract.slice(0, 280) + "…"
                  : summary.extract}
              </div>
            </div>
          </div>
        )}
        {isLocked && wikiLoading && !summary && (
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
            Fetching Wikipedia summary…
          </div>
        )}
        {isLocked &&
          active.layer === "boundaries" &&
          focusedCountry &&
          focusedCountry.name === active.name && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => setDetailPanelOpen(!detailPanelOpen)}
                style={{
                  fontSize: 12,
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--accent)",
                  background: detailPanelOpen
                    ? "rgba(245, 185, 66, 0.18)"
                    : "rgba(245, 185, 66, 0.08)",
                  color: "var(--accent-strong)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
                title={
                  detailPanelOpen
                    ? "Hide the country detail panel"
                    : "Show cities, events, battles, people, and disasters in this country"
                }
              >
                {detailPanelOpen ? "Hide details" : "Show country details ↗"}
              </button>
            </div>
          )}
        {active.wikipedia && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <a
              href={summary?.url ?? wikipediaUrl(active.wikipedia)}
              target="_blank"
              rel="noreferrer"
              style={{ pointerEvents: "auto" }}
              onClick={(e) => e.stopPropagation()}
            >
              Wikipedia ↗
            </a>
          </div>
        )}
        {!isLocked && (
          <div
            style={{
              marginTop: 8,
              fontSize: 10,
              color: "var(--text-muted)",
              opacity: 0.6,
            }}
          >
            Click to pin
          </div>
        )}
      </div>
    </>
  );
}

function MiniTimeline({
  start,
  end,
  year,
}: {
  start: number;
  end: number;
  year: number;
}) {
  const total = MAX_YEAR - MIN_YEAR;
  const startPct = ((start - MIN_YEAR) / total) * 100;
  const widthPct = ((end - start) / total) * 100;
  const yearPct = ((year - MIN_YEAR) / total) * 100;

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          position: "relative",
          height: 8,
          background: "rgba(255,255,255,0.07)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${startPct}%`,
            width: `${Math.max(widthPct, 0.4)}%`,
            top: 0,
            bottom: 0,
            background: "rgba(245, 185, 66, 0.7)",
            borderRadius: 3,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `calc(${yearPct}% - 1px)`,
            top: -2,
            bottom: -2,
            width: 2,
            background: "var(--accent-strong)",
          }}
        />
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatYear(start)} &mdash; {formatYear(end)}
      </div>
    </div>
  );
}

function formatPopulationThousands(thousands: number): string {
  if (!Number.isFinite(thousands) || thousands <= 0) return "";
  if (thousands < 1) return `~${Math.round(thousands * 1000)} people`;
  if (thousands < 1000) return `~${Math.round(thousands).toLocaleString()}k people`;
  const millions = thousands / 1000;
  if (millions < 10) return `~${millions.toFixed(1)}M people`;
  return `~${Math.round(millions).toLocaleString()}M people`;
}

function CityMeta({
  pop,
  cc,
  ruinAge,
  year,
}: {
  pop?: number;
  cc?: string;
  ruinAge?: number;
  year: number;
}) {
  const popText = pop !== undefined ? formatPopulationThousands(pop) : "";
  const isRuin = ruinAge !== undefined && ruinAge > 0;
  if (!popText && !cc && !isRuin) return null;

  // Phrase the ruin age in centuries past ~150yr to read more naturally.
  let ruinText = "";
  if (isRuin) {
    if (ruinAge < 150) {
      ruinText = `Abandoned ${Math.round(ruinAge!)} yrs ago`;
    } else {
      const centuries = Math.round(ruinAge! / 100);
      ruinText = `Abandoned ~${centuries.toLocaleString()} centuries ago`;
    }
  }

  return (
    <div
      style={{
        fontSize: 12,
        color: "var(--text-muted)",
        marginTop: 2,
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {popText && (
        <span title={`Population at ${formatYear(year)}`}>{popText}</span>
      )}
      {cc && <span style={{ opacity: 0.7 }}>· {cc}</span>}
      {ruinText && <span style={{ color: "#c89060" }}>· {ruinText}</span>}
    </div>
  );
}

function PointMarker({ year, current }: { year: number; current: number }) {
  const total = MAX_YEAR - MIN_YEAR;
  const yearPct = ((year - MIN_YEAR) / total) * 100;
  const currentPct = ((current - MIN_YEAR) / total) * 100;

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          position: "relative",
          height: 8,
          background: "rgba(255,255,255,0.07)",
          borderRadius: 3,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `calc(${yearPct}% - 3px)`,
            top: -1,
            width: 6,
            height: 10,
            background: "#ff7a90",
            borderRadius: 3,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `calc(${currentPct}% - 1px)`,
            top: -2,
            bottom: -2,
            width: 2,
            background: "var(--accent-strong)",
          }}
        />
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatYear(year)}
      </div>
    </div>
  );
}
