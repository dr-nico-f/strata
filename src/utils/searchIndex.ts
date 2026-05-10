import { BATTLES } from "../data/battles";
import { CITIES } from "../data/cities";
import { CONNECTIONS } from "../data/connections";
import { DISASTERS } from "../data/disasters";
import { ERAS } from "../data/eras";
import { EVENTS } from "../data/events";
import { LANGUAGE_FAMILIES, activeLanguageStage } from "../data/languages";
import { MIGRATIONS } from "../data/migrations";
import { PEOPLE as NOTABLE_PEOPLE } from "../data/people";
import { PEOPLES } from "../data/peoples";
import { RELIGIONS, activeReligionStage } from "../data/religions";
import { PALEO_LAND } from "../data/sealevel";
import { LayerId } from "../store";

export interface SearchHit {
  id: string;
  layer: LayerId | "era";
  name: string;
  detail?: string;
  /** Year to navigate to when this hit is selected. */
  year: number;
  /** Optional centroid to fly the camera to. */
  lng?: number;
  lat?: number;
  /** Optional active range, used by the tooltip. */
  rangeStart?: number;
  rangeEnd?: number;
  pointYear?: number;
  wikipedia?: string;
}

function centroid(pts: Array<[number, number]>): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
  }
  return [sx / pts.length, sy / pts.length];
}

/**
 * Build a flat, in-memory search index across every layer + era. Includes
 * all-time entries for region-style features (peoples, sealevel, religions,
 * languages) so the user can find them no matter what year they're on.
 */
function buildIndex(): SearchHit[] {
  const hits: SearchHit[] = [];

  for (const e of ERAS) {
    hits.push({
      id: `era:${e.id}`,
      layer: "era",
      name: e.label,
      detail: "Era",
      year: e.year,
    });
  }

  for (const c of CITIES) {
    hits.push({
      id: `cities:${c.id}`,
      layer: "cities",
      name: c.name,
      detail: c.note,
      year: c.founded,
      lng: c.lng,
      lat: c.lat,
      rangeStart: c.founded,
      rangeEnd: c.abandoned ?? 2025,
      wikipedia: c.wikipedia ?? c.name,
    });
  }

  for (const e of EVENTS) {
    hits.push({
      id: `events:${e.id}`,
      layer: "events",
      name: e.name,
      detail: e.description,
      year: e.year,
      lng: e.lng,
      lat: e.lat,
      pointYear: e.year,
      wikipedia: e.wikipedia ?? e.name,
    });
  }

  for (const b of BATTLES) {
    hits.push({
      id: `battles:${b.id}`,
      layer: "battles",
      name: b.name,
      detail: b.description,
      year: b.year,
      lng: b.lng,
      lat: b.lat,
      pointYear: b.year,
      wikipedia: b.wikipedia ?? b.name,
    });
  }

  for (const p of PEOPLES) {
    const [lng, lat] = centroid(p.polygon);
    hits.push({
      id: `peoples:${p.id}`,
      layer: "peoples",
      name: p.name,
      detail: p.note,
      year: Math.round((p.start + p.end) / 2),
      lng,
      lat,
      rangeStart: p.start,
      rangeEnd: p.end,
      wikipedia: p.name,
    });
  }

  for (const conn of CONNECTIONS) {
    const [lng, lat] = centroid(conn.path);
    hits.push({
      id: `connections:${conn.id}`,
      layer: "connections",
      name: conn.name,
      detail: conn.kind === "migration" ? "Migration" : "Trade route",
      year: Math.round((conn.start + conn.end) / 2),
      lng,
      lat,
      rangeStart: conn.start,
      rangeEnd: conn.end,
      wikipedia: conn.name,
    });
  }

  for (const land of PALEO_LAND) {
    const [lng, lat] = centroid(land.polygon);
    hits.push({
      id: `sealevel:${land.id}`,
      layer: "sealevel",
      name: land.name,
      detail: land.note,
      year: -8000,
      lng,
      lat,
      rangeStart: -10000,
      rangeEnd: land.submergedBy,
      wikipedia: land.name,
    });
  }

  for (const rel of RELIGIONS) {
    // Use the latest stage for centroid (more representative for modern users)
    const stage =
      activeReligionStage(rel, 2025) ?? rel.stages[rel.stages.length - 1];
    const [lng, lat] = centroid(stage.polygon);
    hits.push({
      id: `religions:${rel.id}`,
      layer: "religions",
      name: rel.name,
      detail: rel.note,
      year: rel.stages[0].startYear,
      lng,
      lat,
      wikipedia: rel.wikipedia ?? rel.name,
    });
  }

  for (const lang of LANGUAGE_FAMILIES) {
    const stage =
      activeLanguageStage(lang, 0) ?? lang.stages[lang.stages.length - 1];
    const [lng, lat] = centroid(stage.polygon);
    hits.push({
      id: `languages:${lang.id}`,
      layer: "languages",
      name: lang.name,
      detail: lang.note,
      year: lang.stages[0].startYear,
      lng,
      lat,
      wikipedia: lang.wikipedia ?? lang.name,
    });
  }

  for (const d of DISASTERS) {
    hits.push({
      id: `disasters:${d.id}`,
      layer: "disasters",
      name: d.name,
      detail: d.description,
      year: d.year,
      lng: d.lng,
      lat: d.lat,
      pointYear: d.year,
      rangeStart: d.year,
      rangeEnd: d.endYear ?? d.year,
      wikipedia: d.wikipedia ?? d.name,
    });
  }

  for (const p of NOTABLE_PEOPLE) {
    hits.push({
      id: `people:${p.id}`,
      layer: "people",
      name: p.name,
      detail: p.blurb,
      year: Math.round((p.birth + p.death) / 2),
      lng: p.lng,
      lat: p.lat,
      rangeStart: p.birth,
      rangeEnd: p.death,
      wikipedia: p.wikipedia ?? p.name,
    });
  }

  for (const m of MIGRATIONS) {
    const [lng, lat] = centroid(m.path);
    hits.push({
      id: `migrations:${m.id}`,
      layer: "migrations",
      name: m.name,
      detail: m.note,
      year: Math.round((m.start + m.end) / 2),
      lng,
      lat,
      rangeStart: m.start,
      rangeEnd: m.end,
      wikipedia: m.wikipedia ?? m.name,
    });
  }

  return hits;
}

const INDEX = buildIndex();

/** Score a hit by how well its name matches the query. Higher = better. */
function scoreHit(hit: SearchHit, q: string): number {
  const name = hit.name.toLowerCase();
  if (name === q) return 1000;
  if (name.startsWith(q)) return 500 - name.length;
  const idx = name.indexOf(q);
  if (idx === 0) return 400 - name.length;
  if (idx > 0) return 200 - idx - name.length / 4;
  // Try detail
  const det = (hit.detail ?? "").toLowerCase();
  if (det.includes(q)) return 50;
  return -1;
}

export function searchAll(query: string, limit = 10): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const scored: Array<{ hit: SearchHit; score: number }> = [];
  for (const hit of INDEX) {
    const score = scoreHit(hit, q);
    if (score > 0) scored.push({ hit, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.hit);
}
