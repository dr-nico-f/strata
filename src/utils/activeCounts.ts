import { BATTLES } from "../data/battles";
import { CITIES } from "../data/cities";
import { CONNECTIONS } from "../data/connections";
import { DISASTERS } from "../data/disasters";
import { EVENTS } from "../data/events";
import { LANGUAGE_FAMILIES, activeLanguageStage } from "../data/languages";
import { MIGRATIONS } from "../data/migrations";
import { PEOPLE as NOTABLE_PEOPLE } from "../data/people";
import { PEOPLES } from "../data/peoples";
import { POPULATION_REGIONS, populationAt } from "../data/population";
import { RELIGIONS, activeReligionStage } from "../data/religions";
import { PALEO_LAND } from "../data/sealevel";
import { LayerId } from "../store";

const EVENT_WINDOW = 200;
const BATTLE_WINDOW = 100;
const DISASTER_WINDOW = 80;

export function getActiveCount(layer: LayerId, year: number): number {
  switch (layer) {
    case "boundaries":
      return -1; // Unknown without loading the GeoJSON; we display "—" for this
    case "peoples":
      return PEOPLES.filter((p) => year >= p.start && year <= p.end).length;
    case "cities":
      return CITIES.filter(
        (c) => year >= c.founded && (c.abandoned === undefined || year <= c.abandoned),
      ).length;
    case "events":
      return EVENTS.filter((e) => Math.abs(year - e.year) <= EVENT_WINDOW)
        .length;
    case "connections":
      return CONNECTIONS.filter((c) => year >= c.start && year <= c.end).length;
    case "battles":
      return BATTLES.filter((b) => Math.abs(year - b.year) <= BATTLE_WINDOW)
        .length;
    case "population":
      // Count countries with non-zero modeled population at this year. OWID's
      // country list is ~240 entries but pre-modern centuries leave most
      // entries at zero, so this gives a much truer "active" feel.
      return POPULATION_REGIONS.filter((r) => populationAt(r, year) >= 0.05).length;
    case "sealevel":
      return PALEO_LAND.filter((l) => year < l.submergedBy).length;
    case "religions":
      return RELIGIONS.filter((r) => activeReligionStage(r, year)).length;
    case "languages":
      return LANGUAGE_FAMILIES.filter((l) => activeLanguageStage(l, year)).length;
    case "disasters":
      return DISASTERS.filter((d) => {
        const start = d.year;
        const end = d.endYear ?? d.year;
        if (year >= start && year <= end) return true;
        return Math.min(Math.abs(year - start), Math.abs(year - end)) <= DISASTER_WINDOW;
      }).length;
    case "people":
      return NOTABLE_PEOPLE.filter((p) => year >= p.birth && year <= p.death).length;
    case "migrations":
      return MIGRATIONS.filter((m) => year >= m.start && year <= m.end).length;
  }
}

export type ActiveItem = {
  id: string;
  layer: LayerId;
  name: string;
  detail?: string;
  lng: number;
  lat: number;
  rangeStart?: number;
  rangeEnd?: number;
  pointYear?: number;
  wikipedia?: string;
};

function centroidOf(pts: Array<[number, number]>): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
  }
  return [sx / pts.length, sy / pts.length];
}

/** All currently-active features for the "Now" panel. */
export function getActiveItems(year: number): ActiveItem[] {
  const items: ActiveItem[] = [];
  for (const p of PEOPLES) {
    if (year < p.start || year > p.end) continue;
    const [lng, lat] = centroidOf(p.polygon);
    items.push({
      id: p.id,
      layer: "peoples",
      name: p.name,
      detail: p.note,
      lng,
      lat,
      rangeStart: p.start,
      rangeEnd: p.end,
      wikipedia: p.name,
    });
  }
  for (const c of CITIES) {
    if (year < c.founded) continue;
    if (c.abandoned !== undefined && year > c.abandoned) continue;
    items.push({
      id: c.id,
      layer: "cities",
      name: c.name,
      detail: c.note,
      lng: c.lng,
      lat: c.lat,
      rangeStart: c.founded,
      rangeEnd: c.abandoned ?? 2025,
      wikipedia: c.wikipedia ?? c.name,
    });
  }
  for (const e of EVENTS) {
    if (Math.abs(year - e.year) > EVENT_WINDOW) continue;
    items.push({
      id: e.id,
      layer: "events",
      name: e.name,
      detail: e.description,
      lng: e.lng,
      lat: e.lat,
      pointYear: e.year,
      wikipedia: e.wikipedia ?? e.name,
    });
  }
  for (const conn of CONNECTIONS) {
    if (year < conn.start || year > conn.end) continue;
    const [lng, lat] = centroidOf(conn.path);
    items.push({
      id: conn.id,
      layer: "connections",
      name: conn.name,
      detail: conn.kind === "migration" ? "Migration" : "Trade route",
      lng,
      lat,
      rangeStart: conn.start,
      rangeEnd: conn.end,
      wikipedia: conn.name,
    });
  }
  for (const b of BATTLES) {
    if (Math.abs(year - b.year) > BATTLE_WINDOW) continue;
    items.push({
      id: b.id,
      layer: "battles",
      name: b.name,
      detail: b.description,
      lng: b.lng,
      lat: b.lat,
      pointYear: b.year,
      wikipedia: b.wikipedia ?? b.name,
    });
  }
  for (const land of PALEO_LAND) {
    if (year >= land.submergedBy) continue;
    const [lng, lat] = centroidOf(land.polygon);
    items.push({
      id: land.id,
      layer: "sealevel",
      name: land.name,
      detail: land.note,
      lng,
      lat,
      rangeStart: -10000,
      rangeEnd: land.submergedBy,
      wikipedia: land.name,
    });
  }
  for (const rel of RELIGIONS) {
    const stage = activeReligionStage(rel, year);
    if (!stage) continue;
    const [lng, lat] = centroidOf(stage.polygon);
    items.push({
      id: rel.id,
      layer: "religions",
      name: rel.name,
      detail: rel.note,
      lng,
      lat,
      wikipedia: rel.wikipedia ?? rel.name,
    });
  }
  for (const lang of LANGUAGE_FAMILIES) {
    const stage = activeLanguageStage(lang, year);
    if (!stage) continue;
    const [lng, lat] = centroidOf(stage.polygon);
    items.push({
      id: lang.id,
      layer: "languages",
      name: lang.name,
      detail: lang.note,
      lng,
      lat,
      wikipedia: lang.wikipedia ?? lang.name,
    });
  }
  for (const d of DISASTERS) {
    const start = d.year;
    const end = d.endYear ?? d.year;
    let dist: number;
    if (year >= start && year <= end) dist = 0;
    else dist = Math.min(Math.abs(year - start), Math.abs(year - end));
    if (dist > DISASTER_WINDOW) continue;
    items.push({
      id: d.id,
      layer: "disasters",
      name: d.name,
      detail: d.description,
      lng: d.lng,
      lat: d.lat,
      pointYear: d.year,
      rangeStart: d.year,
      rangeEnd: d.endYear ?? d.year,
      wikipedia: d.wikipedia ?? d.name,
    });
  }
  for (const p of NOTABLE_PEOPLE) {
    if (year < p.birth || year > p.death) continue;
    items.push({
      id: p.id,
      layer: "people",
      name: p.name,
      detail: p.blurb,
      lng: p.lng,
      lat: p.lat,
      rangeStart: p.birth,
      rangeEnd: p.death,
      wikipedia: p.wikipedia ?? p.name,
    });
  }
  for (const m of MIGRATIONS) {
    if (year < m.start || year > m.end) continue;
    const [lng, lat] = centroidOf(m.path);
    items.push({
      id: m.id,
      layer: "migrations",
      name: m.name,
      detail: m.note,
      lng,
      lat,
      rangeStart: m.start,
      rangeEnd: m.end,
      wikipedia: m.wikipedia ?? m.name,
    });
  }
  return items;
}
