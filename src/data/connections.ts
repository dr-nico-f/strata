/**
 * Trade routes and migrations rendered as polylines on the map. Coordinates
 * are intentionally schematic - they trace the rough corridor a route or
 * migration followed, not precise paths.
 */

export type ConnectionKind = "trade" | "migration";

export interface Connection {
  id: string;
  name: string;
  kind: ConnectionKind;
  start: number;
  end: number;
  /** Path as [lng, lat] waypoints. Drawn as a polyline. */
  path: Array<[number, number]>;
  note?: string;
}

export const CONNECTIONS: readonly Connection[] = [
  {
    id: "silk-road",
    name: "Silk Road",
    kind: "trade",
    start: -130,
    end: 1450,
    path: [
      [108.95, 34.27], // Chang'an
      [100, 38],
      [80, 41],
      [70, 41], // Samarkand region
      [62, 39],
      [52, 35],
      [44, 36],
      [37, 37], // Antioch
      [29, 41], // Constantinople
    ],
    note: "Eurasian trade network, Han to late Yuan",
  },
  {
    id: "trans-saharan",
    name: "Trans-Saharan trade",
    kind: "trade",
    start: 700,
    end: 1600,
    path: [
      [-3.0, 16.77], // Timbuktu
      [3, 22],
      [5, 28],
      [10, 31], // Ghadames
      [10.32, 36.85], // Carthage region
    ],
    note: "Gold, salt, and slaves across the Sahara",
  },
  {
    id: "indian-ocean",
    name: "Indian Ocean trade",
    kind: "trade",
    start: -200,
    end: 1500,
    path: [
      [40, 8], // Horn of Africa
      [50, 14],
      [55, 18],
      [60, 22],
      [70, 22],
      [76, 12], // Malabar
      [85, 7],
      [95, 5],
      [100, 5],
      [105, 5], // Strait of Malacca
      [115, 5],
      [120, 30], // China coast
    ],
    note: "Monsoon-driven trade across the Indian Ocean rim",
  },
  {
    id: "amber-road",
    name: "Amber Road",
    kind: "trade",
    start: -1500,
    end: 800,
    path: [
      [19, 54], // Baltic
      [19, 49],
      [16, 45],
      [13, 41], // Adriatic
    ],
    note: "Baltic amber to Mediterranean",
  },
  {
    id: "viking-eastern",
    name: "Varangian route",
    kind: "trade",
    start: 800,
    end: 1100,
    path: [
      [18, 60], // Sweden
      [25, 60],
      [30, 60],
      [32, 56],
      [35, 50],
      [37, 45],
      [29, 41], // Constantinople
    ],
    note: "Vikings from Scandinavia to Constantinople via Russian rivers",
  },
  {
    id: "bantu-expansion",
    name: "Bantu expansion",
    kind: "migration",
    start: -1500,
    end: 500,
    path: [
      [11, 7], // Cameroon
      [18, 0],
      [25, -3],
      [30, -8],
      [35, -15],
      [30, -25],
      [27, -29], // Southern Africa
    ],
    note: "Spread of Bantu-speaking peoples across sub-Saharan Africa",
  },
  {
    id: "polynesian-voyages",
    name: "Polynesian voyages",
    kind: "migration",
    start: -1000,
    end: 1300,
    path: [
      [175, -22], // Tonga / Samoa region
      [-150, -17], // Society Islands
      [-155, 20], // Hawaii
      [-149, -17],
      [-109, -27], // Rapa Nui
      [-149, -17],
      [175, -41], // Aotearoa (NZ)
    ],
    note: "Austronesian seafarers across the Pacific",
  },
  {
    id: "indo-european",
    name: "Indo-European migrations",
    kind: "migration",
    start: -3500,
    end: -1000,
    path: [
      [40, 50], // Pontic-Caspian steppe
      [25, 48],
      [10, 50], // Central Europe
      [5, 45],
      [-5, 42], // Iberia
    ],
    note: "Steppe-origin migrations into Europe (one of several branches)",
  },
  {
    id: "indo-european-east",
    name: "Indo-Iranian migrations",
    kind: "migration",
    start: -2500,
    end: -1000,
    path: [
      [40, 50],
      [55, 45],
      [65, 40],
      [70, 32], // Indus
      [78, 28],
    ],
    note: "Steppe-origin migrations into Iran and India",
  },
  {
    id: "han-to-rome",
    name: "Roman-Chinese trade",
    kind: "trade",
    start: 100,
    end: 600,
    path: [
      [12.5, 41.9],
      [29, 41],
      [44, 36],
      [60, 35],
      [80, 40],
      [108.95, 34.27],
    ],
    note: "Indirect maritime + overland connections between empires",
  },
  {
    id: "atlantic-triangle",
    name: "Atlantic triangular trade",
    kind: "trade",
    start: 1550,
    end: 1860,
    path: [
      [-1, 51], // Britain
      [-15, 15], // West Africa
      [-65, 18], // Caribbean
      [-1, 51],
    ],
    note: "Goods, enslaved people, and raw materials between Europe, Africa, and the Americas",
  },
  {
    id: "columbian-exchange",
    name: "Columbian exchange",
    kind: "migration",
    start: 1492,
    end: 1700,
    path: [
      [-6, 36], // Iberia
      [-30, 20],
      [-65, 18], // Caribbean
      [-90, 19], // Central America
    ],
    note: "Two-way exchange of plants, animals, people, and disease",
  },
  {
    id: "mongol-postroad",
    name: "Mongol Yam network",
    kind: "trade",
    start: 1240,
    end: 1370,
    path: [
      [38, 50], // Sarai
      [60, 48],
      [85, 47],
      [105, 45],
      [115, 44],
      [116.4, 39.9], // Khanbaliq (Beijing)
    ],
    note: "Imperial relay system spanning the Mongol realm",
  },
  {
    id: "manila-galleon",
    name: "Manila galleon",
    kind: "trade",
    start: 1565,
    end: 1815,
    path: [
      [121, 14], // Manila
      [140, 25],
      [180, 35],
      [-140, 35],
      [-117, 32], // Acapulco approach
      [-100, 17], // Acapulco
    ],
    note: "Pacific link between Spanish Philippines and Mexico",
  },
];
