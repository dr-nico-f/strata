#!/usr/bin/env node
/**
 * Pull battles from Wikidata via the public SPARQL endpoint and emit a
 * TypeScript file the app imports alongside the curated battles list.
 *
 * Strategy:
 *   - Walk history in 200-year chunks from -3000 to 2025 (well before
 *     Thermopylae through today).
 *   - For each chunk, ask for all things that are an instance of "battle"
 *     (Q178561) or any subclass, with point-in-time, coordinates, and an
 *     English label, ordered by Wikipedia sitelink count desc.
 *   - LIMIT each chunk so a single overactive century (e.g. WW2) doesn't
 *     swamp the dataset.
 *   - Drop entries that collide with the curated list by id or name (case
 *     insensitive).
 *
 * Re-run with `npm run build:battles`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// Tunables
const CHUNK_SIZE = 200; // years per SPARQL request
const PER_CHUNK_LIMIT = 80; // max battles taken from any one chunk
const MIN_SITELINKS = 5; // notability cutoff
const START_YEAR = -3000;
const END_YEAR = 2025;
// Pause a moment between requests to be polite to the public endpoint.
const REQUEST_DELAY_MS = 500;

const SPARQL_URL = "https://query.wikidata.org/sparql";
const USER_AGENT =
  "Strata/1.0 (https://github.com/dr-nico-f/strata) build-battles.mjs";

const OUTPUT_PATH = path.join(
  ROOT,
  "src",
  "data",
  "battles.wikidata.generated.ts",
);

function slugify(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseYear(iso) {
  // Handle leading minus sign for BCE. Wikidata uses astronomical year
  // numbering: -0001 = 2 BCE. We normalize back to "1 BCE = -1" for the app
  // (year 0 doesn't exist in our timeline, so collapse it to -1).
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
  const file = path.join(ROOT, "src", "data", "battles.curated.ts");
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

async function sparqlQuery(query) {
  const url = `${SPARQL_URL}?query=${encodeURIComponent(query)}`;
  const r = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`SPARQL ${r.status}: ${text.slice(0, 200)}`);
  }
  return r.json();
}

function chunkQuery(startYear, endYear) {
  return `
    SELECT ?b ?bLabel ?date ?coord ?sitelinks WHERE {
      ?b wdt:P31/wdt:P279* wd:Q178561 ;
         wdt:P585 ?date ;
         wdt:P625 ?coord ;
         wikibase:sitelinks ?sitelinks .
      FILTER(YEAR(?date) >= ${startYear} && YEAR(?date) <= ${endYear} && ?sitelinks >= ${MIN_SITELINKS})
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${PER_CHUNK_LIMIT}
  `;
}

async function fetchChunk(startYear, endYear, attempt = 0) {
  const q = chunkQuery(startYear, endYear);
  try {
    const j = await sparqlQuery(q);
    return j.results.bindings;
  } catch (err) {
    if (attempt >= 3) throw err;
    const wait = 2000 * (attempt + 1);
    console.warn(
      `  retrying ${startYear}..${endYear} after ${wait}ms (${err.message})`,
    );
    await new Promise((r) => setTimeout(r, wait));
    return fetchChunk(startYear, endYear, attempt + 1);
  }
}

function escapeStringLiteral(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function build() {
  console.log("[battles] downloading from Wikidata SPARQL...");
  const { ids: curatedIds, names: curatedNames } = readCuratedKeys();
  console.log(
    `[battles] curated set: ${curatedIds.size} ids / ${curatedNames.size} names`,
  );

  const seenQids = new Set();
  const battles = [];
  for (let s = START_YEAR; s <= END_YEAR; s += CHUNK_SIZE) {
    const e = Math.min(s + CHUNK_SIZE - 1, END_YEAR);
    process.stdout.write(`[battles] ${s}..${e} `);
    const rows = await fetchChunk(s, e);
    let kept = 0;
    for (const row of rows) {
      const qid = row.b.value.replace("http://www.wikidata.org/entity/", "");
      if (seenQids.has(qid)) continue;
      const name = row.bLabel?.value;
      if (!name || /^Q\d+$/.test(name)) continue; // unlabelled
      const point = parsePoint(row.coord.value);
      if (!point) continue;
      const year = parseYear(row.date.value);
      if (year === null) continue;
      const id = slugify(name);
      if (!id) continue;
      if (curatedIds.has(id)) continue;
      if (curatedNames.has(name.toLowerCase())) continue;
      seenQids.add(qid);
      battles.push({
        id,
        name,
        year,
        lng: point.lng,
        lat: point.lat,
        sitelinks: parseInt(row.sitelinks.value, 10),
        qid,
      });
      kept++;
    }
    console.log(`-> kept ${kept}`);
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }
  // Resolve slug collisions (different battles with the same slug get
  // a -2, -3 suffix in chronological order).
  const slugCount = new Map();
  for (const b of battles) {
    const n = (slugCount.get(b.id) ?? 0) + 1;
    slugCount.set(b.id, n);
    if (n > 1) b.id = `${b.id}-${n}`;
  }
  battles.sort((a, b) => a.year - b.year);

  const header = `// AUTO-GENERATED by scripts/build-battles.mjs. DO NOT EDIT BY HAND.
// Run \`npm run build:battles\` to regenerate.
//
// Source: Wikidata SPARQL endpoint (https://query.wikidata.org/)
//   Query: instance of (or subclass of) battle (Q178561) with point-in-time
//   (P585), coordinates (P625), and English label. Notability filter:
//   wikibase:sitelinks >= ${MIN_SITELINKS}. Top ${PER_CHUNK_LIMIT} per ${CHUNK_SIZE}-year window.
//
// Wikidata content is published under CC0. Attribution is courtesy.

import type { Battle } from "./battles.curated";

export const WIKIDATA_BATTLES: readonly Battle[] = [
`;
  const body = battles
    .map((b) => {
      const wp = `https://en.wikipedia.org/wiki/${encodeURIComponent(
        b.name.replace(/ /g, "_"),
      )}`;
      return `  {
    id: "${escapeStringLiteral(b.id)}",
    name: "${escapeStringLiteral(b.name)}",
    year: ${b.year},
    lat: ${b.lat},
    lng: ${b.lng},
    description: "${b.sitelinks} Wikipedia sitelinks",
    wikipedia: "${escapeStringLiteral(b.name)}",
    wikidata: "${b.qid}",
  },`;
    })
    .join("\n");
  const footer = `
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _wikipediaUrl = "${"".replace(/./g, "")}"; // (suppress unused warnings)
void _wikipediaUrl;
`;
  // Drop the noisy "_wikipediaUrl" footer; it was an experiment.
  const out = header + body + "\n];\n";
  fs.writeFileSync(OUTPUT_PATH, out, "utf8");
  console.log(
    `[battles] wrote ${battles.length} battles -> ${path.relative(ROOT, OUTPUT_PATH)}`,
  );
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
