// scripts/build-cities.mjs
// -----------------------------------------------------------------------------
// Generates src/data/cities.geonames.generated.ts from the GeoNames
// `cities15000.txt` dump (https://download.geonames.org/export/dump/, CC BY 4.0).
//
// Usage:
//   node scripts/build-cities.mjs               # downloads if needed
//   node scripts/build-cities.mjs --refresh     # forces a re-download
//
// What it does:
//   1. Downloads cities15000.txt (~3 MB zip) if not already cached in /tmp.
//   2. Parses the tab-separated file (33k+ cities, all pop >= 15,000).
//   3. Picks the top N (default 800) by population.
//   4. Drops entries that collide with the hand-curated list in
//      src/data/cities.curated.ts so the curated metadata wins.
//   5. Emits src/data/cities.geonames.generated.ts.
//
// IMPORTANT: GeoNames does not include founding dates. Modern cities here
// default to founded=1900, which means they appear from the 20th century
// onward. The hand-curated list provides accurate founding dates for the
// historically significant cities (Athens, Rome, Beijing, etc.).
// -----------------------------------------------------------------------------

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TARGET = resolve(ROOT, "public/data/cities-geonames.json");
const CURATED_PATH = resolve(ROOT, "src/data/cities.curated.ts");

const ZIP_URL = "https://download.geonames.org/export/dump/cities15000.zip";
const CACHE_DIR = "/tmp";
const ZIP_PATH = resolve(CACHE_DIR, "cities15000.zip");
const TXT_PATH = resolve(CACHE_DIR, "cities15000.txt");

// How many GeoNames cities (after de-duplication) to keep.
const TARGET_COUNT = 2200;

// Country-level fallback "founded" year for cities the curated list doesn't
// cover. Values are conservative - they pick the year by which the country
// generally had European-style cities. Pre-Columbian founding dates aren't
// captured here; if you want them, add the city to the curated list.
const COUNTRY_FOUNDED_DEFAULT = {
  // Americas mostly settled later
  US: 1750,
  CA: 1750,
  AU: 1820,
  NZ: 1840,
  BR: 1600,
  AR: 1600,
  CL: 1600,
  PE: 1500,
  MX: 1520,
  CO: 1530,
  VE: 1530,
  EC: 1535,
  BO: 1540,
  PY: 1540,
  UY: 1700,
  PA: 1500,
  CU: 1500,
  // Otherwise default
  DEFAULT: 1900,
};

// Modern slugs that point at the same place as a historical curated entry.
// Drop the GeoNames row for these so the curated metadata wins.
const KNOWN_ALIASES = new Set([
  "istanbul", // -> constantinople
  "ho-chi-minh-city", // -> saigon
  "washington", // -> washington-dc
  "athens", // collides w/ curated "athens" (and "athens-modern")
  "naples", // curated has "naples"
  "athens-tx", // unrelated, defensive
]);

const args = new Set(process.argv.slice(2));
const refresh = args.has("--refresh") || args.has("-r");

function ensureZip() {
  if (existsSync(ZIP_PATH) && !refresh) {
    console.log(`✓ using cached ${ZIP_PATH}`);
    return;
  }
  console.log(`↓ downloading ${ZIP_URL} -> ${ZIP_PATH}`);
  execSync(`curl -sSL -o "${ZIP_PATH}" "${ZIP_URL}"`, { stdio: "inherit" });
}

function ensureTxt() {
  if (existsSync(TXT_PATH) && !refresh) return;
  console.log(`✱ unzipping into ${CACHE_DIR}`);
  execSync(`unzip -o -d "${CACHE_DIR}" "${ZIP_PATH}"`, { stdio: "inherit" });
}

function slug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Parse the curated cities file just enough to pull out each entry's id and
 * lowercase name (asciinames don't always match GeoNames spelling, so we use
 * both name and id for collision detection).
 */
function readCuratedKeys() {
  const text = readFileSync(CURATED_PATH, "utf-8");
  const ids = new Set();
  const names = new Set();
  // Match 'id: "..."' and 'name: "..."' pairs.
  const idRe = /\bid:\s*"([^"]+)"/g;
  const nameRe = /\bname:\s*"([^"]+)"/g;
  let m;
  while ((m = idRe.exec(text))) ids.add(m[1]);
  while ((m = nameRe.exec(text))) names.add(m[1].toLowerCase());
  return { ids, names };
}

function defaultFoundedFor(cc) {
  return COUNTRY_FOUNDED_DEFAULT[cc] ?? COUNTRY_FOUNDED_DEFAULT.DEFAULT;
}

function readCuratedEntries() {
  // Lightweight parse of the curated file: pull each `id`, `name`, `lat`, `lng`
  // tuple. We rely on the file's consistent shape (one field per line, in that
  // order). Curated cities authored in a different order would be missed here,
  // which is fine — they just won't get an auto-filled cc.
  const text = readFileSync(CURATED_PATH, "utf-8");
  const objRe =
    /\{\s*id:\s*"([^"]+)",\s*name:\s*"[^"]*",\s*lat:\s*(-?[\d.]+),\s*lng:\s*(-?[\d.]+)/g;
  const out = [];
  let m;
  while ((m = objRe.exec(text))) {
    const id = m[1];
    const lat = parseFloat(m[2]);
    const lng = parseFloat(m[3]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      out.push({ id, lat, lng });
    }
  }
  return out;
}

function build() {
  ensureZip();
  ensureTxt();
  const text = readFileSync(TXT_PATH, "utf-8");
  const lines = text.split("\n").filter(Boolean);
  console.log(`✓ parsed ${lines.length} GeoNames rows`);

  const { ids: curatedIds, names: curatedNames } = readCuratedKeys();
  console.log(`✓ curated set: ${curatedIds.size} ids, ${curatedNames.size} names`);

  const cities = [];
  const seen = new Set(); // dedup by slug
  // We also retain *every* settled GeoNames row (lat/lng/cc only) so we can
  // look up the country for hand-curated historical cities at build time.
  // Curated cities like "Delhi" don't carry a `cc` field; without this lookup
  // they'd be bucketed by nearest country centroid at runtime, which mis-
  // assigns them (Delhi is closer to Nepal's centroid than India's).
  const allGeoCities = [];
  // Slugs / names of every national capital (PPLC) row. Used to flag the
  // matching curated city when its slug overlaps a modern capital that we
  // dropped in favor of the historical entry (e.g. cairo, beijing, rome).
  const pplcSlugs = new Set();
  const pplcAsciiNames = new Set();
  const pplcLocalNames = new Set();
  // PPLC rows by country, used to back-fill the capital flag on curated cities
  // by lat/lng proximity when the slug doesn't match (e.g. constantinople vs
  // istanbul, saigon vs ho-chi-minh-city).
  const pplcByCc = new Map();

  for (const line of lines) {
    const c = line.split("\t");
    if (c.length < 15) continue;
    const featureClass = c[6];
    const featureCode = c[7];
    if (featureClass !== "P") continue;
    if (
      // Drop very small admin subdivisions / sections / farms / hamlets.
      featureCode === "PPLX" ||
      featureCode === "PPLF" ||
      featureCode === "PPLH" ||
      featureCode === "PPLW" ||
      featureCode === "PPLQ" ||
      featureCode === "PPLCH"
    ) {
      continue;
    }
    const name = c[1];
    const ascii = c[2];
    const lat = parseFloat(c[4]);
    const lng = parseFloat(c[5]);
    const cc = c[8];
    const pop = parseInt(c[14], 10) || 0;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (cc) allGeoCities.push({ lat, lng, cc });
    const isCapital = featureCode === "PPLC";
    if (isCapital) {
      const id = slug(ascii || name);
      if (id) pplcSlugs.add(id);
      pplcAsciiNames.add((ascii || name).toLowerCase());
      pplcLocalNames.add(name.toLowerCase());
      if (cc) {
        if (!pplcByCc.has(cc)) pplcByCc.set(cc, []);
        pplcByCc.get(cc).push({ lat, lng });
      }
    }
    if (pop < 30_000) continue; // Trim aggressive lower bound for global "major" cities.
    const id = slug(ascii || name);
    if (!id || seen.has(id)) continue;
    if (curatedIds.has(id)) continue;
    if (curatedNames.has((ascii || name).toLowerCase())) continue;
    if (curatedNames.has(name.toLowerCase())) continue;
    if (KNOWN_ALIASES.has(id)) continue;
    seen.add(id);
    cities.push({
      id,
      name,
      ascii,
      cc,
      lat,
      lng,
      pop,
      capital: isCapital,
    });
  }

  cities.sort((a, b) => b.pop - a.pop);
  const trimmed = cities.slice(0, TARGET_COUNT);
  console.log(`✓ selected ${trimmed.length} GeoNames cities (top by population)`);
  console.log(`✓ retained ${allGeoCities.length} GeoNames rows for curated cc lookup`);

  // For each curated city, find the closest GeoNames row (by approximate
  // Euclidean degree distance). If the closest row is within 0.5° (~55 km),
  // use its cc — that's a safe match for any modern city. For ancient or
  // abandoned cities (Babylon, Uruk, Pataliputra) the nearest GeoNames row
  // is usually within that radius too because populated places tend to
  // persist near old settlements; the few that don't simply get no cc and
  // fall back to nearest country centroid at runtime.
  const curatedEntries = readCuratedEntries();
  const curatedCc = {};
  const curatedCapitals = [];
  let curatedMatched = 0;
  for (const ent of curatedEntries) {
    let bestDistSq = Infinity;
    let bestCc = "";
    for (const g of allGeoCities) {
      const dLat = ent.lat - g.lat;
      const meanLatRad = ((ent.lat + g.lat) / 2) * (Math.PI / 180);
      const dLng = (ent.lng - g.lng) * Math.cos(meanLatRad);
      const dSq = dLat * dLat + dLng * dLng;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestCc = g.cc;
      }
    }
    // 0.5° radius covers ~55 km, plenty for matching a curated city to its
    // modern country even when the closest populated place isn't on top of
    // it. Beyond that we'd be guessing.
    if (bestDistSq <= 0.25 && bestCc) {
      curatedCc[ent.id] = bestCc;
      curatedMatched++;
    }
    // Flag this curated city as a capital if either:
    //   (a) its slug or name matches any PPLC row exactly, OR
    //   (b) within its (matched) country a PPLC row sits within ~0.5° of it,
    //       which catches Cairo / Beijing / Rome where the curated entry
    //       displaces the modern PPLC row.
    let isCapital = false;
    if (pplcSlugs.has(ent.id)) {
      isCapital = true;
    } else if (bestCc && pplcByCc.has(bestCc)) {
      for (const cap of pplcByCc.get(bestCc)) {
        const dLat = ent.lat - cap.lat;
        const meanLatRad = ((ent.lat + cap.lat) / 2) * (Math.PI / 180);
        const dLng = (ent.lng - cap.lng) * Math.cos(meanLatRad);
        const dSq = dLat * dLat + dLng * dLng;
        if (dSq <= 0.25) {
          isCapital = true;
          break;
        }
      }
    }
    if (isCapital) curatedCapitals.push(ent.id);
  }
  console.log(
    `✓ matched ${curatedMatched}/${curatedEntries.length} curated cities to a country code`,
  );
  console.log(`✓ flagged ${curatedCapitals.length} curated cities as national capitals`);

  const jsonCities = trimmed.map((c) => {
    const founded = defaultFoundedFor(c.cc);
    const note = `${c.ascii && c.ascii !== c.name ? c.ascii + " (" : ""}${c.cc}${c.ascii && c.ascii !== c.name ? ")" : ""} · pop ${c.pop.toLocaleString()}`;
    const entry = {
      id: c.id,
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      founded,
      cc: c.cc,
      note,
      populationCurve: [
        [founded, 5],
        [2025, Math.round(c.pop / 1000)],
      ],
    };
    if (c.capital) entry.capital = true;
    return entry;
  });

  const sortedCuratedIds = Object.keys(curatedCc).sort();
  const ccMap = {};
  for (const id of sortedCuratedIds) ccMap[id] = curatedCc[id];

  const sortedCuratedCapitals = [...curatedCapitals].sort();

  const jsonData = {
    cities: jsonCities,
    curatedCityCc: ccMap,
    curatedCapitalIds: sortedCuratedCapitals,
  };

  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, JSON.stringify(jsonData));
  console.log(`✓ wrote ${TARGET} (${trimmed.length} cities)`);
}

build();
