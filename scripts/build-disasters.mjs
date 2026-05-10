#!/usr/bin/env node
/**
 * Build a "live" disasters dataset by combining two public sources:
 *
 *   1) USGS earthquake catalog (FDSNWS API)
 *      - Authoritative source for modern (post-1900) earthquakes.
 *      - Returns clean GeoJSON with magnitude, time, place name.
 *      - URL: https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson
 *      - License: USGS data is in the public domain.
 *
 *   2) Wikidata SPARQL endpoint
 *      - Used for everything USGS doesn't cover: pre-1900 earthquakes,
 *        volcanic eruptions, tsunamis, pandemics, and famines.
 *      - Notability filter via wikibase:sitelinks >= N.
 *      - License: Wikidata content is published under CC0.
 *
 * The output is a JSON file (`public/data/disasters-live.json`) that
 * the runtime fetches and merges with the curated list.
 *
 * Re-run with `npm run build:disasters`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const SPARQL_URL = "https://query.wikidata.org/sparql";
const USER_AGENT = "Strata/1.0 (https://github.com/dr-nico-f/strata) build-disasters.mjs";

const USGS_MIN_MAG = 7.5;
const USGS_START = "1900-01-01";
const USGS_END = "2025-12-31";
const USGS_URL = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=${USGS_MIN_MAG}&starttime=${USGS_START}&endtime=${USGS_END}&orderby=magnitude&limit=2000`;

const REQUEST_DELAY_MS = 600;

const OUTPUT_PATH = path.join(ROOT, "public", "data", "disasters-live.json");

function slugify(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeStringLiteral(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseYearISO(iso) {
  const m = iso.match(/^(-?)0*(\d+)/);
  if (!m) return null;
  let y = parseInt(m[2], 10);
  if (m[1] === "-") y = -y;
  if (y === 0) y = -1;
  return y;
}

function parsePoint(wkt) {
  const m = wkt.match(/^Point\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/);
  if (!m) return null;
  return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) };
}

function readCuratedKeys() {
  const file = path.join(ROOT, "src", "data", "disasters.curated.ts");
  if (!fs.existsSync(file)) {
    return { ids: new Set(), names: new Set() };
  }
  const src = fs.readFileSync(file, "utf8");
  const ids = new Set();
  const names = new Set();
  for (const m of src.matchAll(/^\s+id:\s+"([^"]+)"/gm)) ids.add(m[1]);
  for (const m of src.matchAll(/^\s+name:\s+"([^"]+)"/gm)) {
    names.add(m[1].toLowerCase());
  }
  return { ids, names };
}

async function fetchJson(url, headers, attempt = 0) {
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`${r.status}: ${text.slice(0, 200)}`);
    }
    return r.json();
  } catch (err) {
    if (attempt >= 3) throw err;
    const wait = 2000 * (attempt + 1);
    console.warn(`  retrying after ${wait}ms (${err.message})`);
    await new Promise((r) => setTimeout(r, wait));
    return fetchJson(url, headers, attempt + 1);
  }
}

async function fetchUsgs() {
  console.log(`[disasters] USGS earthquakes M>=${USGS_MIN_MAG} ${USGS_START}..${USGS_END}`);
  const j = await fetchJson(USGS_URL, { "User-Agent": USER_AGENT });
  const out = [];
  for (const f of j.features ?? []) {
    const props = f.properties ?? {};
    const mag = props.mag;
    const place = props.place ?? "";
    const time = props.time;
    if (typeof time !== "number" || typeof mag !== "number") continue;
    const date = new Date(time);
    const year = date.getUTCFullYear();
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lng = coords[0];
    const lat = coords[1];
    const id = slugify(`usgs-${f.id}`);
    const name = `M${mag.toFixed(1)} earthquake (${place})`.slice(0, 90);
    const description = `M${mag.toFixed(1)} • ${place} • ${date.toISOString().slice(0, 10)} (USGS)`;
    out.push({
      id,
      name,
      year,
      kind: "earthquake",
      lat,
      lng,
      magnitude: mag,
      description,
      source: "USGS",
    });
  }
  console.log(`[disasters]   USGS returned ${out.length} earthquakes`);
  return out;
}

async function sparql(query) {
  const url = `${SPARQL_URL}?query=${encodeURIComponent(query)}`;
  return fetchJson(url, {
    Accept: "application/sparql-results+json",
    "User-Agent": USER_AGENT,
  });
}

const WIKIDATA_TYPES = [
  // Earthquakes pre-1900 only (USGS handles modern ones).
  {
    kind: "earthquake",
    qid: "Q8065",
    minSitelinks: 5,
    yearMax: 1899,
    label: "earthquake (pre-1900)",
  },
  { kind: "volcano", qid: "Q7944", minSitelinks: 5, label: "volcanic eruption" },
  { kind: "tsunami", qid: "Q179168", minSitelinks: 3, label: "tsunami" },
  { kind: "plague", qid: "Q12184", minSitelinks: 4, label: "pandemic" },
  { kind: "plague", qid: "Q44512", minSitelinks: 4, label: "epidemic" },
  { kind: "famine", qid: "Q168247", minSitelinks: 3, label: "famine" },
  { kind: "storm", qid: "Q8092", minSitelinks: 6, label: "tropical cyclone" },
];

function buildSparql(spec) {
  const yearFilter = spec.yearMax !== undefined ? `FILTER(YEAR(?date) <= ${spec.yearMax})` : "";
  return `
    SELECT ?d ?dLabel ?date ?coord ?sitelinks WHERE {
      ?d wdt:P31/wdt:P279* wd:${spec.qid} ;
         wdt:P585 ?date ;
         wdt:P625 ?coord ;
         wikibase:sitelinks ?sitelinks .
      ${yearFilter}
      FILTER(?sitelinks >= ${spec.minSitelinks})
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    ORDER BY DESC(?sitelinks)
    LIMIT 400
  `;
}

async function fetchWikidataDisasters() {
  const all = [];
  const seen = new Set();
  for (const spec of WIKIDATA_TYPES) {
    process.stdout.write(`[disasters] Wikidata ${spec.label} `);
    let rows;
    try {
      const j = await sparql(buildSparql(spec));
      rows = j.results.bindings;
    } catch (err) {
      console.warn(`failed: ${err.message}`);
      continue;
    }
    let kept = 0;
    for (const row of rows) {
      const qid = row.d.value.replace("http://www.wikidata.org/entity/", "");
      if (seen.has(qid)) continue;
      const name = row.dLabel?.value;
      if (!name || /^Q\d+$/.test(name)) continue;
      const point = parsePoint(row.coord.value);
      if (!point) continue;
      const year = parseYearISO(row.date.value);
      if (year === null) continue;
      seen.add(qid);
      all.push({
        id: slugify(name),
        name,
        year,
        kind: spec.kind,
        lat: point.lat,
        lng: point.lng,
        sitelinks: parseInt(row.sitelinks.value, 10),
        qid,
        description: `${spec.label} (${row.sitelinks.value} sitelinks)`,
        source: "Wikidata",
      });
      kept++;
    }
    console.log(`-> ${kept}`);
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }
  return all;
}

async function build() {
  console.log("[disasters] building...");
  const { ids: curatedIds, names: curatedNames } = readCuratedKeys();
  console.log(`[disasters] curated set: ${curatedIds.size} ids / ${curatedNames.size} names`);

  const usgs = await fetchUsgs();
  const wikidata = await fetchWikidataDisasters();

  const disasters = [];
  // De-dup by id; curated list collisions are dropped here. The runtime
  // merger overlays curated entries on top, so we don't need to keep duplicates.
  const seenIds = new Set(curatedIds);
  const blockedNames = new Set(curatedNames);
  function pushIfFresh(d) {
    if (!d.id) return;
    if (seenIds.has(d.id)) return;
    if (blockedNames.has(d.name.toLowerCase())) return;
    seenIds.add(d.id);
    disasters.push(d);
  }
  for (const d of [...usgs, ...wikidata]) pushIfFresh(d);

  // Slug collisions inside the generated set: append -2, -3, etc.
  const slugCount = new Map();
  for (const d of disasters) {
    const n = (slugCount.get(d.id) ?? 0) + 1;
    slugCount.set(d.id, n);
    if (n > 1) d.id = `${d.id}-${n}`;
  }
  disasters.sort((a, b) => a.year - b.year);

  const jsonData = disasters.map((d) => {
    const entry = {
      id: d.id,
      name: d.name,
      year: d.year,
      kind: d.kind,
      lat: d.lat,
      lng: d.lng,
      description: d.description,
    };
    if (d.source === "Wikidata") entry.wikipedia = d.name;
    if (d.qid) entry.wikidata = d.qid;
    if (d.magnitude !== undefined) entry.magnitude = d.magnitude;
    return entry;
  });
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(jsonData), "utf8");
  console.log(
    `[disasters] wrote ${disasters.length} disasters -> ${path.relative(ROOT, OUTPUT_PATH)}`,
  );
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
