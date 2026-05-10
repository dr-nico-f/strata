/**
 * Mass population movements rendered as flow lines on the map. Coordinates
 * are intentionally schematic - they trace the rough corridor a migration
 * followed, not precise paths.
 *
 * Sources for the corridors and date ranges:
 *   - "The Penguin Atlas of World History" (Kinder & Hilgemann)
 *   - "Atlas of Human Migration" (Russell King)
 *   - Wikipedia: "Bantu expansion", "Indo-European migrations", "Austronesian
 *     expansion", "Anglo-Saxon settlement of Britain", "Viking expansion",
 *     "Slavic migrations", "Hungarian conquest", "Atlantic slave trade",
 *     "Mongol invasions", "Partition of India", "Flight and expulsion of
 *     Germans", "Great Atlantic Migration"
 */

export type MigrationKind = "peopling" | "conquest" | "forced" | "diaspora";

export interface Migration {
  id: string;
  name: string;
  kind: MigrationKind;
  /** Migration begins (years; negative = BCE). */
  start: number;
  /** Migration ends. Negative = BCE. */
  end: number;
  /** Path as [lng, lat] waypoints. */
  path: Array<[number, number]>;
  /** Optional Wikipedia slug. */
  wikipedia?: string;
  /** Optional one-line description. */
  note?: string;
}

/** Stable color per kind. Kept independent of religions/peoples palettes. */
export const MIGRATION_COLOR: Record<MigrationKind, string> = {
  peopling: "#5fd1a0", // greenish - peaceful settlement / spread
  conquest: "#ff7a90", // red - conquest-driven movement
  forced: "#ffae42", // orange - forced displacement (slave trade, expulsion)
  diaspora: "#c39bff", // purple - diaspora / scattered settlement
};

export const MIGRATION_LABEL: Record<MigrationKind, string> = {
  peopling: "Peopling",
  conquest: "Conquest",
  forced: "Forced",
  diaspora: "Diaspora",
};

export const MIGRATIONS: readonly Migration[] = [
  // -------- Prehistoric / ancient peopling --------
  {
    id: "bantu-expansion",
    name: "Bantu expansion",
    kind: "peopling",
    start: -1500,
    end: 1500,
    path: [
      [11, 6], // Cameroon grasslands (Bantu homeland)
      [15, 3],
      [20, -2],
      [25, -5],
      [28, -8],
      [30, -15],
      [28, -22],
      [27, -29], // Eastern Cape
    ],
    wikipedia: "Bantu_expansion",
    note: "From the Cameroon-Nigeria grasslands across sub-Saharan Africa over ~3000 years.",
  },
  {
    id: "indo-european-west",
    name: "Indo-European migration (west)",
    kind: "peopling",
    start: -4500,
    end: -1500,
    path: [
      [38, 49], // Pontic-Caspian steppe
      [30, 50],
      [22, 51],
      [14, 52],
      [6, 51],
      [0, 49],
      [-6, 47],
    ],
    wikipedia: "Indo-European_migrations",
    note: "Pontic-Caspian steppe peoples spread west into Europe (Yamnaya horizon).",
  },
  {
    id: "indo-european-east",
    name: "Indo-European migration (east)",
    kind: "peopling",
    start: -4000,
    end: -1500,
    path: [
      [42, 49], // Pontic steppe
      [55, 45],
      [62, 42],
      [68, 38],
      [73, 33],
      [76, 29], // Indus / Punjab
      [80, 26],
      [85, 25],
    ],
    wikipedia: "Indo-Aryan_migrations",
    note: "Eastern branch into Iran and the Indian subcontinent (Indo-Iranian / Indo-Aryan).",
  },
  {
    id: "austronesian-expansion",
    name: "Austronesian / Polynesian expansion",
    kind: "peopling",
    start: -3000,
    end: 1300,
    path: [
      [121, 24], // Taiwan
      [122, 14], // Philippines
      [125, 0], // Sulawesi
      [140, -5], // New Guinea
      [160, -10], // Solomon Islands
      [175, -15], // Fiji
      [-170, -14], // Samoa
      [-150, -10], // French Polynesia
      [-152, 20], // Hawaii
      [-110, -27], // Easter Island
      [175, -41], // New Zealand
    ],
    wikipedia: "Austronesian_expansion",
    note: "Taiwan -> ISEA -> Polynesian triangle; arrived in Aotearoa ~1280 CE.",
  },

  // -------- Late antiquity / early medieval --------
  {
    id: "anglo-saxon",
    name: "Anglo-Saxon settlement of Britain",
    kind: "peopling",
    start: 400,
    end: 650,
    path: [
      [9, 54], // Jutland
      [8, 53],
      [4, 52], // North Sea crossing
      [1, 52],
      [-1, 52], // East Anglia
      [-2, 53], // Mercia
      [-3, 51], // Wessex
    ],
    wikipedia: "Anglo-Saxon_settlement_of_Britain",
    note: "Angles, Saxons, Jutes, Frisians settle eastern Britain after Roman withdrawal.",
  },
  {
    id: "slavic-expansion",
    name: "Slavic migrations",
    kind: "peopling",
    start: 500,
    end: 950,
    path: [
      [27, 52], // Polesia / Pripet marshes (Slavic homeland)
      [22, 50],
      [19, 49], // Moravia
      [17, 47],
      [21, 45], // Pannonia / Balkans
      [25, 43],
      [28, 42], // Bulgaria
    ],
    wikipedia: "Migration_of_the_Serbs",
    note: "From the Pripet marshes south and west into the Balkans, central and eastern Europe.",
  },
  {
    id: "viking-diaspora",
    name: "Viking / Norse diaspora",
    kind: "diaspora",
    start: 793,
    end: 1100,
    path: [
      [11, 60], // Scandinavia
      [-2, 56], // North Sea
      [-7, 55], // Britain
      [-22, 64], // Iceland
      [-45, 60], // Greenland
      [-55, 50], // Vinland (Newfoundland)
    ],
    wikipedia: "Viking_expansion",
    note: "Norse settlement across the North Atlantic; sister currents into Russia and Normandy.",
  },
  {
    id: "viking-east",
    name: "Varangian / Rus' expansion",
    kind: "diaspora",
    start: 800,
    end: 1050,
    path: [
      [18, 59], // Stockholm region
      [22, 60],
      [27, 60], // Lake Ladoga
      [30, 60], // Novgorod
      [32, 56],
      [30, 50], // Kyiv
      [33, 47], // Dnieper rapids
      [35, 44],
      [29, 41], // Constantinople
    ],
    wikipedia: "Rus%27_people",
    note: "Varangians (Rus') down the Volga and Dnieper toward Constantinople.",
  },
  {
    id: "magyar-conquest",
    name: "Hungarian (Magyar) conquest",
    kind: "conquest",
    start: 800,
    end: 900,
    path: [
      [60, 55], // Ural / Western Siberia (Ugric homeland)
      [50, 52],
      [40, 50],
      [32, 48],
      [25, 47], // Carpathian basin
      [19, 47], // Pannonia
    ],
    wikipedia: "Hungarian_conquest_of_the_Carpathian_Basin",
    note: "Magyars cross the Carpathians and settle Pannonia, founding Hungary.",
  },

  // -------- High medieval --------
  {
    id: "mongol-invasions",
    name: "Mongol invasions",
    kind: "conquest",
    start: 1206,
    end: 1300,
    path: [
      [105, 47], // Mongolia
      [95, 45],
      [82, 43],
      [70, 42],
      [60, 40],
      [52, 35], // Persia
      [44, 36], // Mesopotamia
    ],
    wikipedia: "Mongol_invasions_and_conquests",
    note: "From the Mongol homeland west across Eurasia at unprecedented speed.",
  },
  {
    id: "mongol-north",
    name: "Mongol invasion of Rus'",
    kind: "conquest",
    start: 1237,
    end: 1241,
    path: [
      [105, 47], // Mongolia
      [80, 50],
      [60, 53],
      [50, 54],
      [37, 55], // Moscow
      [30, 50], // Kyiv
      [22, 50], // Poland
    ],
    wikipedia: "Mongol_invasion_of_Europe",
    note: "Subutai and Batu Khan strike Rus', Poland, and Hungary.",
  },

  // -------- Early modern --------
  {
    id: "atlantic-slave-trade",
    name: "Atlantic slave trade",
    kind: "forced",
    start: 1500,
    end: 1888,
    path: [
      [-2, 6], // Bight of Benin / Slave Coast
      [-15, 5],
      [-30, 0],
      [-45, -10], // Brazil (largest destination)
      [-43, -22], // Rio de Janeiro
    ],
    wikipedia: "Atlantic_slave_trade",
    note: "~12.5M Africans trafficked to the Americas. Brazil was the single largest destination.",
  },
  {
    id: "atlantic-slave-caribbean",
    name: "Atlantic slave trade (Caribbean / N. America)",
    kind: "forced",
    start: 1500,
    end: 1865,
    path: [
      [-5, 6], // West Africa
      [-25, 12],
      [-50, 18],
      [-75, 18], // Caribbean
      [-77, 25], // Florida
      [-80, 32], // Charleston
    ],
    wikipedia: "Atlantic_slave_trade",
    note: "Middle Passage to the Caribbean and British North America.",
  },
  {
    id: "great-atlantic-migration",
    name: "Great Atlantic migration",
    kind: "peopling",
    start: 1820,
    end: 1920,
    path: [
      [12, 50], // Central Europe (German exodus)
      [0, 52],
      [-15, 50],
      [-40, 48],
      [-65, 44],
      [-75, 41], // New York
    ],
    wikipedia: "Atlantic_migrations",
    note: "~55M Europeans cross the Atlantic; peaks 1880s-1914.",
  },
  {
    id: "great-atlantic-southern",
    name: "Great Atlantic migration (southern arm)",
    kind: "peopling",
    start: 1850,
    end: 1930,
    path: [
      [10, 41], // Italy / southern Europe
      [-5, 36],
      [-25, 25],
      [-45, 0],
      [-55, -25], // Argentina / Brazil
      [-58, -34], // Buenos Aires
    ],
    wikipedia: "Italian_diaspora",
    note: "Italian, Spanish, and Portuguese emigration to Argentina, Brazil, Uruguay.",
  },

  // -------- 20th century displacement --------
  {
    id: "partition-india-pakistan",
    name: "Partition of India",
    kind: "forced",
    start: 1947,
    end: 1948,
    path: [
      [76, 30], // Punjab (split)
      [73, 31], // Lahore
      [67, 24], // Karachi
    ],
    wikipedia: "Partition_of_India",
    note: "~14M displaced across the Punjab and Bengal borders within months.",
  },
  {
    id: "partition-bengal",
    name: "Partition of Bengal",
    kind: "forced",
    start: 1947,
    end: 1951,
    path: [
      [88, 23], // Bengal border
      [90, 24],
      [91, 23], // Dhaka direction
    ],
    wikipedia: "Partition_of_Bengal_(1947)",
    note: "Hindu and Muslim communities cross the new East/West Bengal frontier.",
  },
  {
    id: "german-expulsion",
    name: "Expulsion of Germans (1944-50)",
    kind: "forced",
    start: 1944,
    end: 1950,
    path: [
      [25, 50], // Pre-war eastern German lands
      [20, 51],
      [15, 51],
      [10, 51], // West/East Germany
    ],
    wikipedia: "Flight_and_expulsion_of_Germans_(1944%E2%80%931950)",
    note: "~12-14M ethnic Germans pushed west of the Oder-Neisse line.",
  },
];
