/**
 * Schematic land bridges and continental-shelf areas exposed during the
 * Last Glacial Maximum (~20,000 BCE), submerging gradually as the Pleistocene
 * ended. Each region has a `submergedBy` year - it is rendered while the
 * current year is earlier than that.
 *
 * Polygons are intentionally rough and shouldn't be read as authoritative
 * paleocoastlines.
 */

export interface PaleoLand {
  id: string;
  name: string;
  /** The region is rendered while year < submergedBy. */
  submergedBy: number;
  polygon: Array<[number, number]>;
  note?: string;
}

export const PALEO_LAND: readonly PaleoLand[] = [
  {
    id: "doggerland",
    name: "Doggerland",
    submergedBy: -6500,
    polygon: [
      [-2.5, 53.5],
      [4, 55.5],
      [8, 55.5],
      [9, 53.5],
      [7, 51.5],
      [3, 51.0],
      [-1, 52],
    ],
    note: "Land bridge between Britain and continental Europe",
  },
  {
    id: "british-isles",
    name: "British Isles connected",
    submergedBy: -7500,
    polygon: [
      [-5, 50],
      [-2, 50],
      [1, 50.5],
      [1.5, 51],
      [-0.5, 51.3],
      [-3, 50.6],
    ],
    note: "Channel was a wide river plain",
  },
  {
    id: "beringia",
    name: "Beringia",
    submergedBy: -9000,
    polygon: [
      [-170, 70],
      [-160, 68],
      [-160, 64],
      [-167, 60],
      [-180, 58],
      [180, 58],
      [170, 60],
      [165, 65],
      [170, 70],
    ],
    note: "Land bridge between Siberia and Alaska",
  },
  {
    id: "sundaland",
    name: "Sundaland",
    submergedBy: -7000,
    polygon: [
      [95, 8],
      [105, 12],
      [110, 8],
      [115, 5],
      [118, 0],
      [120, -4],
      [115, -8],
      [108, -10],
      [102, -8],
      [97, -3],
      [95, 2],
    ],
    note: "Continental shelf joining Borneo, Sumatra, Java to the Asian mainland",
  },
  {
    id: "sahul",
    name: "Sahul",
    submergedBy: -8000,
    polygon: [
      [129, -3],
      [142, -5],
      [150, -7],
      [152, -10],
      [144, -14],
      [140, -18],
      [142, -40],
      [148, -44],
      [144, -45],
      [136, -42],
      [129, -38],
      [124, -28],
      [122, -18],
      [125, -8],
    ],
    note: "Australia, New Guinea, and Tasmania connected",
  },
  {
    id: "persian-gulf",
    name: "Persian Gulf basin",
    submergedBy: -6000,
    polygon: [
      [48, 30],
      [56, 26.5],
      [57, 24],
      [50, 23],
      [48, 26],
    ],
    note: "Persian Gulf was a fertile river plain",
  },
  {
    id: "sicily-bridge",
    name: "Sicily-Italy bridge",
    submergedBy: -8000,
    polygon: [
      [15, 38],
      [15.7, 38.4],
      [15.8, 37.8],
      [15.2, 37.6],
    ],
    note: "Strait of Messina was much narrower or dry",
  },
  {
    id: "japan-bridge",
    name: "Japan-Korea bridge",
    submergedBy: -9000,
    polygon: [
      [128.5, 35],
      [131, 35],
      [131, 33.5],
      [128.5, 33.5],
    ],
    note: "Korea Strait partially exposed",
  },
];
