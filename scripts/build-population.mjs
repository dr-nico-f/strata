#!/usr/bin/env node
/**
 * Build per-country population data from live sources.
 *
 *   1) Our World in Data (OWID) "Population" long-run dataset
 *      - HYDE v3.3 (10000 BCE -> 1799), Gapminder (1800-1949), UN WPP (1950+).
 *      - CSV download via the public Grapher endpoint.
 *      - Licensed CC-BY 4.0.
 *
 *   2) restcountries.com /v3.1
 *      - Country centroid (latlng) + area in km^2 keyed by ISO3 (cca3).
 *      - Used to position and size the dot scatter for each country.
 *      - Licensed Mozilla Public License v2.
 *
 * Output:
 *   src/data/population.owid.generated.ts -- the runtime layer reads this.
 *
 * Usage:
 *   node scripts/build-population.mjs           # uses /tmp cache when present
 *   node scripts/build-population.mjs --refresh # forces a re-download
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const OWID_URL =
  "https://ourworldindata.org/grapher/population.csv?useColumnShortNames=true&v=1&csvType=full";
const REST_URL = "https://restcountries.com/v3.1/all?fields=cca2,cca3,name,latlng,area,region";

const CACHE_DIR = "/tmp";
const OWID_CACHE = resolve(CACHE_DIR, "owid_population.csv");
const REST_CACHE = resolve(CACHE_DIR, "restcountries_v31.json");

const OUTPUT = resolve(ROOT, "public/data/population-owid.json");

const args = new Set(process.argv.slice(2));
const refresh = args.has("--refresh") || args.has("-r");

function fetchTo(url, dest) {
  if (existsSync(dest) && !refresh) {
    console.log(`✓ using cached ${dest}`);
    return;
  }
  console.log(`↓ ${url}`);
  // -L follows redirects; --fail returns nonzero on 4xx/5xx so we don't
  // silently keep an HTML error page in the cache.
  execSync(`curl -sSL --fail -o "${dest}" "${url}"`, { stdio: "inherit" });
}

/**
 * Parse OWID's CSV. Columns: entity,code,year,population_historical.
 *
 * `code` is ISO3 for real countries and `OWID_*` for aggregates (World,
 * Africa, Europe, etc.). We bucket those separately.
 */
function parseOwid(csv) {
  const lines = csv.split("\n");
  const byIso3 = new Map(); // ISO3 -> { name, anchors: [[year, popMillions], ...] }
  const world = []; // [year, popMillions]
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // Names can contain commas and quotes; OWID's CSV is well-formed enough
    // that splitting on the last 3 commas is safe (code, year, population
    // never contain commas).
    const idx1 = line.lastIndexOf(",");
    const idx2 = line.lastIndexOf(",", idx1 - 1);
    const idx3 = line.lastIndexOf(",", idx2 - 1);
    if (idx3 < 0) continue;
    const popStr = line.slice(idx1 + 1).trim();
    const yearStr = line.slice(idx2 + 1, idx1).trim();
    const code = line.slice(idx3 + 1, idx2).trim();
    let entity = line.slice(0, idx3).trim();
    if (entity.startsWith('"') && entity.endsWith('"')) {
      entity = entity.slice(1, -1).replace(/""/g, '"');
    }
    if (!popStr) continue;
    const year = Number.parseInt(yearStr, 10);
    const pop = Number.parseFloat(popStr);
    if (!Number.isFinite(year) || !Number.isFinite(pop) || pop <= 0) continue;
    const popMillions = pop / 1_000_000;

    if (code === "OWID_WRL") {
      world.push([year, popMillions]);
      continue;
    }
    // Reject other OWID aggregates (continents, sub-regions, "World excl ...").
    if (!code || !/^[A-Z]{3}$/.test(code)) continue;

    if (!byIso3.has(code)) byIso3.set(code, { name: entity, anchors: [] });
    byIso3.get(code).anchors.push([year, popMillions]);
  }
  // Sort each curve by year so consumers can interpolate without re-sorting.
  for (const v of byIso3.values()) v.anchors.sort((a, b) => a[0] - b[0]);
  world.sort((a, b) => a[0] - b[0]);
  return { byIso3, world };
}

function parseRestCountries(json) {
  const data = JSON.parse(json);
  const out = new Map();
  for (const row of data) {
    const code = row.cca3;
    if (!code) continue;
    const ll = row.latlng ?? [];
    if (ll.length !== 2) continue;
    const [lat, lng] = ll;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const area = Number.isFinite(row.area) ? row.area : 0;
    const name = row.name?.common ?? code;
    const cca2 = typeof row.cca2 === "string" ? row.cca2.toUpperCase() : "";
    const region = typeof row.region === "string" ? row.region : "";
    out.set(code, { name, lat, lng, area, cca2, region });
  }
  return out;
}

/**
 * Convert area in km^2 to a scatter radius in degrees. We approximate the
 * country as a disc of equal area and convert that radius to degrees of
 * latitude (1 deg ~= 111 km). Capped to [0.5, 18] so micro-states still
 * render at least one dot and giants like Russia don't bleed across the map.
 */
function areaToRadiusDeg(areaKm2) {
  if (!areaKm2 || areaKm2 <= 0) return 1.5;
  const radiusKm = Math.sqrt(areaKm2 / Math.PI);
  const deg = radiusKm / 111;
  return Math.max(0.5, Math.min(18, deg));
}

/**
 * Compact a population number to the smallest faithful representation:
 *   0.0..0.99   -> 2 decimals (so we can show e.g. 0.05 for ancient Iceland)
 *   1..999      -> 1 decimal
 *   >=1000      -> integer (China at 1.4 billion)
 * Trailing ".0" is dropped to keep the generated file lean.
 */
function fmtPop(p) {
  let n;
  if (p < 1) n = Math.round(p * 100) / 100;
  else if (p < 1000) n = Math.round(p * 10) / 10;
  else n = Math.round(p);
  return Number.isInteger(n) ? `${n}` : `${n}`;
}

function escapeStr(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function build() {
  fetchTo(OWID_URL, OWID_CACHE);
  fetchTo(REST_URL, REST_CACHE);

  const owid = parseOwid(readFileSync(OWID_CACHE, "utf-8"));
  const geo = parseRestCountries(readFileSync(REST_CACHE, "utf-8"));
  console.log(
    `✓ OWID: ${owid.byIso3.size} ISO3 country curves, ${owid.world.length} world anchors`,
  );
  console.log(`✓ REST: ${geo.size} country geographies`);

  // Merge: only emit countries with both a curve AND a known centroid.
  const merged = [];
  let dropped = 0;
  for (const [iso3, owidEntry] of owid.byIso3) {
    const g = geo.get(iso3);
    if (!g) {
      dropped++;
      continue;
    }
    // OWID's per-country curves can have hundreds of points (annual after
    // 1800). Embedding all is acceptable — the resulting file is ~700 KB,
    // dwarfed by our boundary GeoJSONs. Keep them as-is for max accuracy.
    const curve = owidEntry.anchors;
    if (curve.length === 0) continue;
    merged.push({
      code: iso3,
      cca2: g.cca2 || "",
      region: g.region || "Other",
      name: g.name, // restcountries common name is more consistent than OWID's
      lat: g.lat,
      lng: g.lng,
      radius: areaToRadiusDeg(g.area),
      curve,
    });
  }
  if (dropped > 0) {
    console.log(`  (${dropped} ISO3 in OWID lacked a restcountries match)`);
  }
  // Stable order: descending by latest-known population. This makes the
  // generated diff easier to read and lets the runtime treat the head of the
  // list as "biggest first" if it ever wants to.
  merged.sort((a, b) => {
    const ap = a.curve[a.curve.length - 1][1];
    const bp = b.curve[b.curve.length - 1][1];
    return bp - ap;
  });
  console.log(`✓ writing ${merged.length} countries`);

  const jsonCountries = merged.map((c) => ({
    code: c.code,
    cca2: c.cca2,
    region: c.region,
    name: c.name,
    lat: Number(c.lat.toFixed(3)),
    lng: Number(c.lng.toFixed(3)),
    radius: Number(c.radius.toFixed(2)),
    curve: c.curve.map(([y, p]) => {
      const n =
        p < 1 ? Math.round(p * 100) / 100 : p < 1000 ? Math.round(p * 10) / 10 : Math.round(p);
      return [y, n];
    }),
  }));

  const worldCurve = owid.world.map(([y, p]) => {
    const n =
      p < 1 ? Math.round(p * 100) / 100 : p < 1000 ? Math.round(p * 10) / 10 : Math.round(p);
    return [y, n];
  });

  const jsonData = {
    countries: jsonCountries,
    worldCurve,
    buildDate: new Date().toISOString().slice(0, 10),
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(jsonData));
  console.log(`✓ wrote ${OUTPUT}`);
}

build();
