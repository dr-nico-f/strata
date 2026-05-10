/**
 * Hand-curated disasters with rich descriptions: famous eruptions, plagues,
 * famines, and megaquakes the auto-generated lists either miss or describe
 * dryly.
 *
 * The full active dataset (this list + USGS + Wikidata) is exposed as
 * `DISASTERS` from `./disasters`.
 */

export type DisasterKind =
  | "volcano"
  | "earthquake"
  | "plague"
  | "famine"
  | "storm"
  | "tsunami"
  | "wildfire"
  | "flood";

export interface Disaster {
  id: string;
  name: string;
  year: number;
  /** When the impact effectively ended (default: same as `year`). */
  endYear?: number;
  kind: DisasterKind;
  lat: number;
  lng: number;
  description: string;
  wikipedia?: string;
  /** Optional Wikidata QID for citation. */
  wikidata?: string;
  /** Optional magnitude (earthquakes / volcanic VEI / etc). */
  magnitude?: number;
}

export const CURATED_DISASTERS: readonly Disaster[] = [
  {
    id: "thera-disaster",
    name: "Eruption of Thera",
    year: -1600,
    kind: "volcano",
    lat: 36.4,
    lng: 25.4,
    description: "Massive Bronze Age eruption; tsunami and ash blanket the eastern Mediterranean",
    wikipedia: "Minoan_eruption",
  },
  {
    id: "vesuvius-79",
    name: "Mount Vesuvius eruption",
    year: 79,
    kind: "volcano",
    lat: 40.82,
    lng: 14.43,
    description: "Pompeii and Herculaneum buried in ash and pyroclastic flow",
    wikipedia: "Eruption_of_Mount_Vesuvius_in_AD_79",
  },
  {
    id: "antonine-plague",
    name: "Antonine Plague",
    year: 165,
    endYear: 180,
    kind: "plague",
    lat: 41.9,
    lng: 12.5,
    description: "Smallpox or measles devastates the Roman Empire under Marcus Aurelius",
    wikipedia: "Antonine_Plague",
  },
  {
    id: "plague-justinian",
    name: "Plague of Justinian",
    year: 541,
    endYear: 549,
    kind: "plague",
    lat: 41.01,
    lng: 28.98,
    description: "First recorded bubonic plague pandemic; Constantinople loses ~40%",
    wikipedia: "Plague_of_Justinian",
  },
  {
    id: "san-felipe-quake",
    name: "1556 Shaanxi earthquake",
    year: 1556,
    kind: "earthquake",
    lat: 34.5,
    lng: 109.7,
    description: "Deadliest earthquake in recorded history; ~830,000 dead",
    wikipedia: "1556_Shaanxi_earthquake",
  },
  {
    id: "black-death-disaster",
    name: "Black Death",
    year: 1347,
    endYear: 1351,
    kind: "plague",
    lat: 45,
    lng: 10,
    description: "Bubonic plague kills 30–60% of Europe and tens of millions globally",
    wikipedia: "Black_Death",
  },
  {
    id: "lisbon-1755",
    name: "1755 Lisbon earthquake",
    year: 1755,
    kind: "earthquake",
    lat: 38.72,
    lng: -9.14,
    description: "Magnitude ~9 quake + tsunami + fires destroy Lisbon",
    wikipedia: "1755_Lisbon_earthquake",
  },
  {
    id: "tambora-1815",
    name: "Mount Tambora eruption",
    year: 1815,
    kind: "volcano",
    lat: -8.25,
    lng: 118,
    description: "Largest eruption in recorded history; triggers the 1816 'Year Without a Summer'",
    wikipedia: "1815_eruption_of_Mount_Tambora",
  },
  {
    id: "great-famine-ireland",
    name: "Great Famine (Ireland)",
    year: 1845,
    endYear: 1852,
    kind: "famine",
    lat: 53.41,
    lng: -8.24,
    description: "Potato blight kills ~1M and drives mass emigration",
    wikipedia: "Great_Famine_(Ireland)",
  },
  {
    id: "krakatoa",
    name: "Krakatoa eruption",
    year: 1883,
    kind: "volcano",
    lat: -6.1,
    lng: 105.42,
    description: "Tsunami kills 36,000; sound heard 4,800 km away",
    wikipedia: "1883_eruption_of_Krakatoa",
  },
  {
    id: "1918-flu",
    name: "1918 influenza pandemic",
    year: 1918,
    endYear: 1920,
    kind: "plague",
    lat: 39.1,
    lng: -94.6,
    description: "H1N1 pandemic infects ~500M and kills 25–50M worldwide",
    wikipedia: "Spanish_flu",
  },
  {
    id: "great-chinese-famine",
    name: "Great Chinese Famine",
    year: 1959,
    endYear: 1961,
    kind: "famine",
    lat: 35,
    lng: 105,
    description: "~30M dead; failures of the Great Leap Forward + drought",
    wikipedia: "Great_Chinese_Famine",
  },
  {
    id: "indian-ocean-tsunami",
    name: "Indian Ocean tsunami",
    year: 2004,
    kind: "earthquake",
    lat: 3.32,
    lng: 95.85,
    description: "M9.1–9.3 earthquake + tsunami kill ~230,000 across 14 countries",
    wikipedia: "2004_Indian_Ocean_earthquake_and_tsunami",
  },
  {
    id: "tohoku-2011",
    name: "Tōhoku earthquake & tsunami",
    year: 2011,
    kind: "earthquake",
    lat: 38.32,
    lng: 142.37,
    description: "M9.1 quake, tsunami, and Fukushima nuclear meltdown in Japan",
    wikipedia: "2011_Tōhoku_earthquake_and_tsunami",
  },
  {
    id: "covid-disaster",
    name: "COVID-19 pandemic",
    year: 2020,
    endYear: 2023,
    kind: "plague",
    lat: 30.59,
    lng: 114.31,
    description: "Coronavirus pandemic kills millions and reshapes daily life worldwide",
    wikipedia: "COVID-19_pandemic",
  },
];
