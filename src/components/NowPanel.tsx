import { useEffect, useMemo, useState } from "react";
import { CITIES, cityPopulationAt } from "../data/cities";
import { EVENTS } from "../data/events";
import { worldPopulationAt } from "../data/population";
import { LayerId, formatYear, useStore } from "../store";
import { ActiveItem, getActiveItems } from "../utils/activeCounts";

/**
 * Render a population estimate compactly: 0.5M, 12M, 250M, 1.43B.
 */
function formatWorldPop(millions: number): string {
  if (millions >= 1000) return `${(millions / 1000).toFixed(2)}B`;
  if (millions >= 100) return `${Math.round(millions)}M`;
  if (millions >= 10) return `${millions.toFixed(1)}M`;
  if (millions >= 1) return `${millions.toFixed(2)}M`;
  if (millions >= 0.01) return `${(millions * 1000).toFixed(0)}K`;
  return "—";
}

const LAYER_LABELS: Record<LayerId, string> = {
  boundaries: "Boundaries",
  peoples: "Peoples",
  cities: "Cities",
  events: "Events",
  connections: "Trade & migration",
  battles: "Battles",
  population: "Population",
  sealevel: "Sea level",
  religions: "Religions",
  languages: "Languages",
  disasters: "Disasters",
  people: "Notable people",
  migrations: "Migrations",
};

const LAYER_ORDER: LayerId[] = [
  "events",
  "battles",
  "disasters",
  "people",
  "peoples",
  "cities",
  "connections",
  "migrations",
  "religions",
  "languages",
  "sealevel",
];

const LAYER_COLOR: Record<LayerId, string> = {
  boundaries: "#7aa2ff",
  peoples: "#f5b942",
  cities: "#5fd1a0",
  events: "#7aa2ff",
  connections: "#c39bff",
  battles: "#ff6a6a",
  population: "#ffe9a8",
  sealevel: "#3da9c7",
  religions: "#7aa2ff",
  languages: "#f5b942",
  disasters: "#ff6a00",
  people: "#ffd86b",
  migrations: "#5fd1a0",
};

export function NowPanel() {
  // Outer just decides visibility. The expensive useMemo / useEffect work
  // (active-item grouping, top-cities ranking, idle-fact timer) only runs
  // when the inner mounts, so collapsing the panel actually frees the CPU.
  const open = useStore((s) => s.nowPanelOpen);
  const hideUi = useStore((s) => s.hideUi);
  if (hideUi || !open) return null;
  return <NowPanelInner />;
}

function NowPanelInner() {
  const setOpen = useStore((s) => s.setNowPanelOpen);
  const year = useStore((s) => s.year);
  const layers = useStore((s) => s.layers);
  const setLocked = useStore((s) => s.setLocked);
  const dataVersion = useStore((s) => s.dataVersion);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const items = getActiveItems(year).filter((i) => layers[i.layer]);
    const map: Record<string, ActiveItem[]> = {};
    for (const it of items) {
      if (!map[it.layer]) map[it.layer] = [];
      map[it.layer].push(it);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, layers, dataVersion]);

  // Largest cities at the current year, top 5 by interpolated population.
  // Cities without a populationCurve are excluded (no signal to rank by).
  const topCities = useMemo(() => {
    const out: { id: string; name: string; lat: number; lng: number; pop: number }[] = [];
    for (const c of CITIES) {
      if (year < c.founded) continue;
      if (c.abandoned !== undefined && year > c.abandoned) continue;
      if (!c.populationCurve) continue;
      const pop = cityPopulationAt(c, year);
      if (pop <= 0) continue;
      out.push({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, pop });
    }
    out.sort((a, b) => b.pop - a.pop);
    return out.slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, dataVersion]);

  // "On this year" idle chip: surface a single nearby event when the user
  // hasn't moved the slider for ~2.5s. Picks the event closest in time to
  // the current year, breaking ties deterministically by id so the same
  // event always shows for the same year.
  const [idleEvent, setIdleEvent] = useState<(typeof EVENTS)[number] | null>(null);
  useEffect(() => {
    setIdleEvent(null);
    const t = setTimeout(() => {
      const candidates = EVENTS.filter((e) => Math.abs(e.year - year) <= 250);
      if (candidates.length === 0) return;
      candidates.sort((a, b) => {
        const da = Math.abs(a.year - year);
        const db = Math.abs(b.year - year);
        if (da !== db) return da - db;
        return a.id < b.id ? -1 : 1;
      });
      setIdleEvent(candidates[0]);
    }, 2500);
    return () => clearTimeout(t);
  }, [year]);

  const totalCount = Object.values(grouped).reduce((acc, arr) => acc + arr.length, 0);

  // Mini bar chart of counts per layer; longest bar = the layer with the most
  // active items at the current year.
  const maxCount = Math.max(1, ...Object.values(grouped).map((arr) => arr.length));

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        background: "var(--panel)",
        border: "1px solid var(--panel-border)",
        borderRadius: 10,
        padding: "12px 14px",
        zIndex: 5,
        width: 270,
        maxHeight: "calc(100vh - 200px)",
        overflowY: "auto",
        backdropFilter: "blur(6px)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Now: {formatYear(year)}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {totalCount} active item{totalCount === 1 ? "" : "s"}
            {" · "}
            <span
              title="Estimated world population (OWID: HYDE 3.3 + Gapminder + UN WPP)"
              style={{ color: "var(--accent-strong)" }}
            >
              {formatWorldPop(worldPopulationAt(year))} people
            </span>
          </div>
        </div>
        <button onClick={() => setOpen(false)} title="Hide">
          ✕
        </button>
      </div>

      {totalCount > 0 && (
        <div
          style={{
            marginBottom: 10,
            paddingBottom: 10,
            borderBottom: "1px solid var(--panel-border)",
          }}
        >
          {LAYER_ORDER.filter((l) => grouped[l]?.length).map((layer) => {
            const count = grouped[layer]!.length;
            return (
              <div
                key={`bar-${layer}`}
                title={`${count} ${LAYER_LABELS[layer]}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11,
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    width: 60,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {LAYER_LABELS[layer]}
                </span>
                <span
                  style={{
                    flex: 1,
                    height: 8,
                    background: "rgba(255, 255, 255, 0.05)",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      width: `${(count / maxCount) * 100}%`,
                      height: "100%",
                      background: LAYER_COLOR[layer],
                      borderRadius: 4,
                    }}
                  />
                </span>
                <span
                  style={{
                    width: 24,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--text-muted)",
                  }}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {idleEvent && (
        <div
          style={{
            marginBottom: 10,
            padding: "8px 10px",
            background: "rgba(122, 162, 255, 0.08)",
            border: "1px dashed rgba(122, 162, 255, 0.35)",
            borderRadius: 6,
            fontSize: 11,
            lineHeight: 1.4,
            color: "var(--text)",
          }}
          title={`${idleEvent.description} (${formatYear(idleEvent.year)})`}
        >
          <span
            style={{
              display: "block",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              fontSize: 10,
              marginBottom: 2,
            }}
          >
            On this year · {formatYear(idleEvent.year)}
          </span>
          <span
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("hs:flyto", {
                  detail: {
                    center: [idleEvent.lng, idleEvent.lat],
                    zoom: 4.5,
                  },
                }),
              );
            }}
            style={{ cursor: "pointer" }}
          >
            {idleEvent.name}
          </span>
        </div>
      )}

      {topCities.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              padding: "4px 0",
            }}
          >
            Largest cities · {topCities.length}
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {topCities.map((c) => (
              <li
                key={c.id}
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("hs:flyto", {
                      detail: { center: [c.lng, c.lat], zoom: 6 },
                    }),
                  );
                }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "3px 0",
                  fontSize: 12,
                  cursor: "pointer",
                  borderBottom: "1px dashed var(--panel-border)",
                }}
                title={`Click to fly to ${c.name}`}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    paddingRight: 6,
                  }}
                >
                  {c.name}
                </span>
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {c.pop >= 1000 ? `${(c.pop / 1000).toFixed(1)}M` : `${Math.round(c.pop)}K`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {LAYER_ORDER.filter((l) => grouped[l]?.length).map((layer) => {
        const items = grouped[layer]!;
        const isCollapsed = collapsed[layer];
        return (
          <div key={layer} style={{ marginBottom: 8 }}>
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [layer]: !c[layer] }))}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                background: "transparent",
                border: "none",
                padding: "4px 0",
                fontSize: 12,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              <span>
                {LAYER_LABELS[layer]} · {items.length}
              </span>
              <span>{isCollapsed ? "+" : "−"}</span>
            </button>
            {!isCollapsed && (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {items.slice(0, 12).map((it) => (
                  <li
                    key={it.id}
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("hs:flyto", {
                          detail: {
                            center: [it.lng, it.lat],
                            zoom: 4.5,
                          },
                        }),
                      );
                      setLocked({
                        layer: it.layer,
                        name: it.name,
                        detail: it.detail,
                        x: window.innerWidth / 2,
                        y: window.innerHeight / 2,
                        rangeStart: it.rangeStart,
                        rangeEnd: it.rangeEnd,
                        pointYear: it.pointYear,
                        wikipedia: it.wikipedia,
                        lng: it.lng,
                        lat: it.lat,
                      });
                    }}
                    style={{
                      padding: "3px 0",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--text)",
                      borderBottom: "1px dashed var(--panel-border)",
                    }}
                    title={it.detail ?? ""}
                  >
                    {it.name}
                  </li>
                ))}
                {items.length > 12 && (
                  <li
                    style={{
                      padding: "3px 0",
                      fontSize: 11,
                      color: "var(--text-muted)",
                    }}
                  >
                    +{items.length - 12} more
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })}
      {totalCount === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Nothing active at this year. Try moving the slider.
        </div>
      )}
    </div>
  );
}
