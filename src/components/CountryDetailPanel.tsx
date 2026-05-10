import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { BATTLES } from "../data/battles";
import { CITIES } from "../data/cities";
import { DISASTERS } from "../data/disasters";
import { EVENTS } from "../data/events";
import { PEOPLE as NOTABLE_PEOPLE } from "../data/people";
import {
  MODERN_RELIGION_BY_COUNTRY,
  MODERN_RELIGION_LABEL,
  MODERN_RELIGION_MIN_YEAR,
} from "../data/religions.modern";
import { formatYear, useStore, wikipediaUrl } from "../store";

type Bbox = [number, number, number, number];

function within(bbox: Bbox, lng: number, lat: number): boolean {
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

function pointInRing(
  lng: number,
  lat: number,
  ring: GeoJSON.Position[],
): boolean {
  // Standard ray-casting on a closed ring.
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(
  lng: number,
  lat: number,
  poly: GeoJSON.Position[][],
): boolean {
  if (!poly[0] || !pointInRing(lng, lat, poly[0])) return false;
  for (let i = 1; i < poly.length; i++) {
    if (pointInRing(lng, lat, poly[i])) return false;
  }
  return true;
}

function pointInGeometry(
  lng: number,
  lat: number,
  geom: GeoJSON.Geometry,
): boolean {
  if (geom.type === "Polygon") return pointInPolygon(lng, lat, geom.coordinates);
  if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) {
      if (pointInPolygon(lng, lat, poly)) return true;
    }
  }
  return false;
}

interface SectionItem {
  id: string;
  name: string;
  detail?: string;
  year?: number;
  rangeStart?: number;
  rangeEnd?: number;
  wikipedia?: string;
  lng: number;
  lat: number;
}

const RELIGION_LOOKUP = new Map(
  MODERN_RELIGION_BY_COUNTRY.map((e) => [e.name, e]),
);

type Section = "all" | "cities" | "events" | "battles" | "people" | "disasters";

const SECTION_CHIPS: ReadonlyArray<{ id: Section; label: string }> = [
  { id: "all", label: "All" },
  { id: "cities", label: "Cities" },
  { id: "events", label: "Events" },
  { id: "battles", label: "Battles" },
  { id: "people", label: "People" },
  { id: "disasters", label: "Disasters" },
];

export function CountryDetailPanel() {
  const country = useStore((s) => s.focusedCountry);
  const open = useStore((s) => s.detailPanelOpen);
  const setOpen = useStore((s) => s.setDetailPanelOpen);
  const setLocked = useStore((s) => s.setLocked);
  const year = useStore((s) => s.year);
  const hideUi = useStore((s) => s.hideUi);
  const [section, setSection] = useState<Section>("all");
  // Reset filter chip when the user opens a different country -- otherwise
  // a "Battles" filter would persist into the next click and feel sticky.
  useEffect(() => {
    setSection("all");
  }, [country?.name]);

  // Defer the year used for filtering so a fast slider scrub doesn't block
  // the main thread on point-in-polygon over thousands of points. The header
  // still uses the live `year`.
  const deferredYear = useDeferredValue(year);
  const isStale = deferredYear !== year;

  // Closing the panel just hides the list -- the country focus (mask + pinned
  // tooltip) stays so the user can re-open via the tooltip button.
  const close = () => setOpen(false);

  const data = useMemo(() => {
    if (!country) return null;
    const bbox = country.bbox;
    const geom = country.geometry;
    // Point is "in this country" if it passes the cheap bbox test AND, when
    // we have the real polygon, the point-in-polygon test. Bbox alone is fine
    // for continent presets (no geometry).
    const inFocus = (lng: number, lat: number): boolean => {
      if (!within(bbox, lng, lat)) return false;
      if (!geom) return true;
      return pointInGeometry(lng, lat, geom);
    };
    const cities: SectionItem[] = CITIES.filter((c) => inFocus(c.lng, c.lat))
      .filter(
        (c) =>
          deferredYear >= c.founded &&
          (c.abandoned === undefined || deferredYear <= c.abandoned),
      )
      .slice(0, 60)
      .map((c) => ({
        id: c.id,
        name: c.name,
        detail: c.note,
        rangeStart: c.founded,
        rangeEnd: c.abandoned ?? 2025,
        wikipedia: c.wikipedia ?? c.name,
        lng: c.lng,
        lat: c.lat,
      }));
    const events: SectionItem[] = EVENTS.filter((e) => inFocus(e.lng, e.lat))
      .filter((e) => Math.abs(deferredYear - e.year) <= 200)
      .slice(0, 30)
      .map((e) => ({
        id: e.id,
        name: e.name,
        detail: e.description,
        year: e.year,
        wikipedia: e.wikipedia ?? e.name,
        lng: e.lng,
        lat: e.lat,
      }));
    const battles: SectionItem[] = BATTLES.filter((b) => inFocus(b.lng, b.lat))
      .filter((b) => Math.abs(deferredYear - b.year) <= 100)
      .slice(0, 30)
      .map((b) => ({
        id: b.id,
        name: b.name,
        detail: b.description,
        year: b.year,
        wikipedia: b.wikipedia ?? b.name,
        lng: b.lng,
        lat: b.lat,
      }));
    const people: SectionItem[] = NOTABLE_PEOPLE.filter((p) =>
      inFocus(p.lng, p.lat),
    )
      .filter((p) => deferredYear >= p.birth && deferredYear <= p.death)
      .slice(0, 30)
      .map((p) => ({
        id: p.id,
        name: p.name,
        detail: p.blurb,
        rangeStart: p.birth,
        rangeEnd: p.death,
        wikipedia: p.wikipedia ?? p.name,
        lng: p.lng,
        lat: p.lat,
      }));
    const disasters: SectionItem[] = DISASTERS.filter((d) =>
      inFocus(d.lng, d.lat),
    )
      .filter((d) => Math.abs(deferredYear - d.year) <= 80)
      .slice(0, 20)
      .map((d) => ({
        id: d.id,
        name: d.name,
        detail: d.description,
        year: d.year,
        wikipedia: d.wikipedia ?? d.name,
        lng: d.lng,
        lat: d.lat,
      }));
    const religion =
      deferredYear >= MODERN_RELIGION_MIN_YEAR
        ? RELIGION_LOOKUP.get(country.name)
        : undefined;
    return { cities, events, battles, people, disasters, religion };
  }, [country, deferredYear]);

  if (hideUi) return null;
  if (!open || !country || !data) return null;

  const total =
    data.cities.length +
    data.events.length +
    data.battles.length +
    data.people.length +
    data.disasters.length;

  const setYear = useStore.getState().setYear;
  const goto = (it: SectionItem, layer: string) => {
    // Snap the timeline so the feature is actually active when we land on it
    // -- otherwise clicking a 1066 battle while at 2025 flies us to a city we
    // can't see on the map.
    const currentYear = useStore.getState().year;
    if (it.year !== undefined) {
      if (Math.abs(currentYear - it.year) > 5) setYear(it.year);
    } else if (it.rangeStart !== undefined && it.rangeEnd !== undefined) {
      if (currentYear < it.rangeStart || currentYear > it.rangeEnd) {
        setYear(Math.round((it.rangeStart + Math.min(it.rangeEnd, 2025)) / 2));
      }
    }
    window.dispatchEvent(
      new CustomEvent("hs:flyto", {
        detail: { center: [it.lng, it.lat] as [number, number], zoom: 5 },
      }),
    );
    setLocked({
      layer: layer as never,
      id: it.id,
      name: it.name,
      detail: it.detail,
      x: window.innerWidth - 220,
      y: 200,
      rangeStart: it.rangeStart,
      rangeEnd: it.rangeEnd,
      pointYear: it.year,
      wikipedia: it.wikipedia,
      lng: it.lng,
      lat: it.lat,
    });
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 308, // Sits left of the layer toggles panel (which is ~280px + 16 right offset).
        bottom: 130,
        width: 340,
        background: "var(--panel)",
        border: "1px solid var(--accent)",
        borderRadius: 10,
        padding: 14,
        zIndex: 9,
        backdropFilter: "blur(6px)",
        overflow: "auto",
        boxShadow: "0 12px 40px rgba(245, 185, 66, 0.25)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase" }}>
          Country detail · {formatYear(year)}
        </div>
        <button
          onClick={close}
          title="Close (ESC)"
          style={{ fontSize: 11, padding: "2px 6px", lineHeight: 1 }}
        >
          ✕
        </button>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
        {country.name}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
        {total} active feature{total === 1 ? "" : "s"} in this region
        {isStale && (
          <span style={{ marginLeft: 8, opacity: 0.7 }}>· updating…</span>
        )}
      </div>

      <div
        style={{
          fontSize: 10,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 5,
        }}
      >
        Filter by section
      </div>
      <div
        style={{
          display: "flex",
          gap: 5,
          flexWrap: "wrap",
          marginBottom: 12,
          opacity: isStale ? 0.6 : 1,
          transition: "opacity 0.15s",
        }}
      >
        {SECTION_CHIPS.map((chip) => {
          const count =
            chip.id === "all"
              ? total
              : (
                  data[chip.id as Exclude<Section, "all">] as SectionItem[]
                ).length;
          const active = section === chip.id;
          const dimmed = chip.id !== "all" && count === 0;
          return (
            <button
              key={chip.id}
              onClick={() => setSection(chip.id)}
              disabled={dimmed}
              title={
                dimmed
                  ? `No ${chip.label.toLowerCase()} active here`
                  : `Show ${chip.label.toLowerCase()} (${count})`
              }
              style={{
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 999,
                border: `1px solid ${active ? "var(--accent)" : "var(--panel-border)"}`,
                background: active
                  ? "rgba(245, 185, 66, 0.22)"
                  : "rgba(255, 255, 255, 0.05)",
                color: active
                  ? "var(--accent-strong)"
                  : dimmed
                    ? "var(--text-muted)"
                    : "var(--text)",
                opacity: dimmed ? 0.45 : 1,
                cursor: dimmed ? "default" : "pointer",
                fontWeight: active ? 600 : 400,
              }}
            >
              {chip.label}
              {chip.id !== "all" && (
                <span style={{ opacity: 0.65, marginLeft: 5 }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {data.religion && (section === "all") && (
        <Section title="Religion (Pew Research)">
          <div style={{ fontSize: 13 }}>
            {MODERN_RELIGION_LABEL[data.religion.religion]}{" "}
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
              ({data.religion.confidence})
            </span>
          </div>
        </Section>
      )}

      {(section === "all" || section === "cities") && data.cities.length > 0 && (
        <Section title={`Cities (${data.cities.length})`}>
          {data.cities.map((c) => (
            <Row
              key={c.id}
              item={c}
              layer="cities"
              onClick={() => goto(c, "cities")}
            />
          ))}
        </Section>
      )}
      {(section === "all" || section === "events") && data.events.length > 0 && (
        <Section title={`Events (${data.events.length})`}>
          {data.events.map((e) => (
            <Row
              key={e.id}
              item={e}
              layer="events"
              onClick={() => goto(e, "events")}
            />
          ))}
        </Section>
      )}
      {(section === "all" || section === "battles") && data.battles.length > 0 && (
        <Section title={`Battles (${data.battles.length})`}>
          {data.battles.map((b) => (
            <Row
              key={b.id}
              item={b}
              layer="battles"
              onClick={() => goto(b, "battles")}
            />
          ))}
        </Section>
      )}
      {(section === "all" || section === "people") && data.people.length > 0 && (
        <Section title={`Notable people (${data.people.length})`}>
          {data.people.map((p) => (
            <Row
              key={p.id}
              item={p}
              layer="people"
              onClick={() => goto(p, "people")}
            />
          ))}
        </Section>
      )}
      {(section === "all" || section === "disasters") && data.disasters.length > 0 && (
        <Section title={`Disasters (${data.disasters.length})`}>
          {data.disasters.map((d) => (
            <Row
              key={d.id}
              item={d}
              layer="disasters"
              onClick={() => goto(d, "disasters")}
            />
          ))}
        </Section>
      )}

      {total === 0 && !data.religion && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14 }}>
          No active features in this region for {formatYear(year)}. Try moving the
          time slider or zooming out.
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  item,
  onClick,
}: {
  item: SectionItem;
  layer: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "5px 6px",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 12,
        lineHeight: 1.4,
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ fontWeight: 500 }}>
        {item.name}
        {item.year !== undefined && (
          <span style={{ color: "var(--text-muted)", marginLeft: 6, fontSize: 11 }}>
            {formatYear(item.year)}
          </span>
        )}
      </div>
      {item.detail && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.detail}
        </div>
      )}
      {item.wikipedia && (
        <a
          href={wikipediaUrl(item.wikipedia)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 10 }}
        >
          Wikipedia ↗
        </a>
      )}
    </div>
  );
}

